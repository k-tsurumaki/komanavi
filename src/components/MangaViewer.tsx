'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import type { MangaJobStatusResponse, MangaRequest, MangaResult } from '@/lib/types/intermediate';

interface MangaViewerProps {
  url: string;
  title: string;
  summary: string;
  keyPoints?: string[];
  resultId: string;   // 解析結果のID
  historyId: string;  // 会話履歴のID
  initialMangaResult?: MangaResult | null; // 履歴から復元した漫画データ
}

const USAGE_KEY = 'komanavi-manga-usage';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 600000;

interface MangaUsageState {
  date: string;
  count: number;
  urlCooldowns: Record<string, number>;
  activeJob?: {
    jobId: string;
    startedAt: number;
    url: string;
  };
}

function getTodayKey() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function loadUsage(): MangaUsageState {
  if (typeof window === 'undefined') {
    return { date: getTodayKey(), count: 0, urlCooldowns: {} };
  }
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return { date: getTodayKey(), count: 0, urlCooldowns: {} };
    const parsed = JSON.parse(raw) as MangaUsageState;
    if (parsed.date !== getTodayKey()) {
      return { date: getTodayKey(), count: 0, urlCooldowns: {} };
    }
    return parsed;
  } catch {
    return { date: getTodayKey(), count: 0, urlCooldowns: {} };
  }
}

function saveUsage(state: MangaUsageState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USAGE_KEY, JSON.stringify(state));
}

function buildRequest(props: MangaViewerProps): MangaRequest {
  return {
    url: props.url,
    title: props.title,
    summary: props.summary,
    keyPoints: props.keyPoints,
    resultId: props.resultId,
    historyId: props.historyId,
  };
}

async function getIdToken(): Promise<string | null> {
  try {
    // Firebase Auth の初期化を待つ
    const currentUser = await new Promise<User | null>((resolve) => {
      // 既にログイン済みの場合はすぐに返す
      if (auth.currentUser) {
        resolve(auth.currentUser);
        return;
      }
      // 初期化完了を待つ
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
      // タイムアウト（2秒）
      setTimeout(() => resolve(null), 2000);
    });

    if (!currentUser) {
      return null;
    }
    return await currentUser.getIdToken();
  } catch (error) {
    console.error('Failed to get ID token:', error);
    return null;
  }
}

function getErrorMessage(errorCode?: MangaJobStatusResponse['errorCode'], fallback?: string) {
  switch (errorCode) {
    case 'timeout':
      return '漫画生成がタイムアウトしました';
    case 'api_error':
      return '漫画生成中にエラーが発生しました';
    case 'validation_error':
      return '入力内容を確認してください';
    case 'rate_limited':
      return '本日の漫画生成回数の上限に達しました（最大3回）';
    case 'cooldown':
      return '同じURLの再生成は10分後にお試しください';
    case 'concurrent':
      return '現在ほかの漫画生成が進行中です。完了後に再度お試しください。';
    case 'unknown':
      return '漫画生成に失敗しました';
    default:
      return fallback || '漫画生成に失敗しました';
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split('');
  const lines: string[] = [];
  let line = '';

  words.forEach((char) => {
    const testLine = line + char;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line.length > 0) {
      lines.push(line);
      line = char;
    } else {
      line = testLine;
    }
  });

  if (line) lines.push(line);
  return lines;
}

function renderManga(result: MangaResult): string {
  const canvas = document.createElement('canvas');
  const panelCount = result.panels.length;
  const columns = Math.ceil(Math.sqrt(panelCount));
  const rows = Math.ceil(panelCount / columns);
  const panelSize = Math.floor(1200 / Math.max(columns, rows));
  const width = panelSize * columns;
  const height = panelSize * rows;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const padding = Math.floor(panelSize * 0.08);
  const bubblePadding = Math.floor(panelSize * 0.1);
  const fontSize = Math.max(16, Math.floor(panelSize * 0.08));

  result.panels.forEach((panel, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = col * panelSize;
    const y = row * panelSize;

    ctx.fillStyle = '#f7f7fb';
    ctx.fillRect(x, y, panelSize, panelSize);

    ctx.strokeStyle = '#d6d6e7';
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 2, y + 2, panelSize - 4, panelSize - 4);

    ctx.fillStyle = '#eef2ff';
    ctx.beginPath();
    ctx.arc(
      x + padding + panelSize * 0.15,
      y + padding + panelSize * 0.15,
      panelSize * 0.12,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = '#1f2937';
    ctx.font = `bold ${fontSize}px sans-serif`;

    const textX = x + bubblePadding;
    const textY = y + panelSize * 0.45;
    const maxWidth = panelSize - bubblePadding * 2;
    const lines = wrapText(ctx, panel.text, maxWidth);

    lines.forEach((line, lineIndex) => {
      ctx.fillText(line, textX, textY + lineIndex * (fontSize + 6));
    });
  });

  return canvas.toDataURL('image/png');
}

export function MangaViewer(props: MangaViewerProps) {
  const { data: session } = useSession();
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [result, setResult] = useState<MangaResult | null>(props.initialMangaResult || null);
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const isPollingRef = useRef(false);
  const isLoggedIn = !!session;

  const canGenerateMessage = useMemo(() => {
    const usage = loadUsage();
    if (
      usage.activeJob &&
      usage.activeJob.url !== props.url &&
      Date.now() - usage.activeJob.startedAt < POLL_TIMEOUT_MS
    ) {
      return '現在ほかの漫画生成が進行中です。完了後に再度お試しください。';
    }
    return null;
  }, [props.url]);

  const fallbackTexts = useMemo(() => {
    if (result?.panels?.length) {
      return result.panels.map((panel) => panel.text).filter(Boolean);
    }
    if (props.keyPoints && props.keyPoints.length > 0) {
      return props.keyPoints.filter(Boolean);
    }
    return [props.summary].filter(Boolean);
  }, [props.keyPoints, props.summary, result?.panels]);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
    isPollingRef.current = false;
  }, []);

  const clearActiveJob = useCallback((job?: string) => {
    const usage = loadUsage();
    if (!usage.activeJob) return;
    if (job && usage.activeJob.jobId !== job) return;
    delete usage.activeJob;
    saveUsage(usage);
  }, []);

  const pollStatus = useCallback(
    async (job: string) => {
      try {
        const response = await fetch(`/api/manga/${job}`);
        if (response.status === 404) {
          return;
        }
        if (!response.ok) {
          throw new Error('ステータスの取得に失敗しました');
        }
        const data: MangaJobStatusResponse = await response.json();
        setProgress(data.progress || 0);

        if (data.status === 'done' && data.result) {
          setResult(data.result);
          if (data.result.imageUrls && data.result.imageUrls.length > 0) {
            setImageUrl(data.result.imageUrls[0]);
          } else {
            const pngUrl = renderManga(data.result);
            setImageUrl(pngUrl);
          }
          setError(null);
          clearPolling();
          clearActiveJob(job);
        }

        if (data.status === 'error') {
          setResult(data.result ?? null);
          setError(getErrorMessage(data.errorCode, data.error));
          clearPolling();
          clearActiveJob(job);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'ステータス取得に失敗しました');
        clearPolling();
        clearActiveJob(job);
      }
    },
    [clearActiveJob, clearPolling]
  );

  const startPolling = useCallback(
    (job: string) => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;
      setIsPolling(true);
      startedAtRef.current = Date.now();
      pollingRef.current = setInterval(() => {
        if (startedAtRef.current && Date.now() - startedAtRef.current > POLL_TIMEOUT_MS) {
          setError('漫画生成がタイムアウトしました');
          clearPolling();
          clearActiveJob(job);
          return;
        }
        pollStatus(job);
      }, POLL_INTERVAL_MS);
    },
    [clearActiveJob, clearPolling, pollStatus]
  );

  const handleGenerate = useCallback(async () => {
    setError(null);

    const usage = loadUsage();

    if (
      usage.activeJob &&
      usage.activeJob.url !== props.url &&
      Date.now() - usage.activeJob.startedAt < POLL_TIMEOUT_MS
    ) {
      setError('現在ほかの漫画生成が進行中です。完了後に再度お試しください。');
      return;
    }

    try {
      // 認証トークンを取得（ログイン済みの場合のみ）
      const idToken = await getIdToken();

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch('/api/manga', {
        method: 'POST',
        headers,
        body: JSON.stringify(buildRequest(props)),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData.errorCode, errorData.error));
      }

      const data = (await response.json()) as { jobId: string };
      setProgress(0);

      const nextUsage: MangaUsageState = {
        ...usage,
        count: usage.count + 1,
        urlCooldowns: usage.urlCooldowns,
        activeJob: { jobId: data.jobId, startedAt: Date.now(), url: props.url },
      };
      saveUsage(nextUsage);

      startPolling(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '漫画生成に失敗しました');
    }
  }, [props, startPolling]);

  useEffect(() => {
    const usage = loadUsage();
    if (usage.activeJob && usage.activeJob.url === props.url) {
      startPolling(usage.activeJob.jobId);
    }

    return () => {
      clearPolling();
    };
  }, [clearPolling, props.url, startPolling]);

  // 履歴から復元した漫画データを初期表示
  useEffect(() => {
    if (props.initialMangaResult && !imageUrl) {
      setResult(props.initialMangaResult);
      setProgress(100);
      if (props.initialMangaResult.imageUrls && props.initialMangaResult.imageUrls.length > 0) {
        setImageUrl(props.initialMangaResult.imageUrls[0]);
      } else {
        const pngUrl = renderManga(props.initialMangaResult);
        setImageUrl(pngUrl);
      }
    }
  }, [props.initialMangaResult, imageUrl]);

  return (
    <div className="ui-card mb-6 rounded-2xl p-5 sm:p-6">
      <h3 className="ui-heading mb-3 flex items-center gap-2 text-lg">
        <span className="ui-badge" aria-hidden="true">
          MANGA
        </span>
        もっとわかりやすく（漫画で見る）
      </h3>

      <p className="mb-4 text-sm text-slate-600">
        4〜8コマの漫画で制度の要点を整理します。生成には最大60秒かかる場合があります。
      </p>

      {imageUrl ? (
        <div className="space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- 署名付きURLとdata URLの両方をそのまま表示するため */}
          <img
            src={imageUrl}
            alt={`${props.title}の漫画`}
            className="w-full rounded-xl border border-slate-200"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                try {
                  // 署名付きURLの場合はfetchしてBlobに変換
                  if (imageUrl.startsWith('http')) {
                    const response = await fetch(imageUrl, { cache: 'no-store' });
                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = `${props.title}-manga.png`;
                    link.click();
                    URL.revokeObjectURL(blobUrl);
                  } else {
                    // Base64 Data URLの場合はそのまま
                    const link = document.createElement('a');
                    link.href = imageUrl;
                    link.download = `${props.title}-manga.png`;
                    link.click();
                  }
                } catch (err) {
                  console.error('Download failed:', err);
                }
              }}
              className="ui-btn ui-btn-secondary px-5 py-2.5 text-sm"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
              画像をダウンロード
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-ghost px-4 py-2 text-sm"
              onClick={() => {
                // 全ての状態をクリア
                setImageUrl('');
                setResult(null);
                setError(null);
                setProgress(0);
                clearPolling();
                // localStorageのactiveJobをクリア
                clearActiveJob();
              }}
            >
              もう一度生成する
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleGenerate}
            className="ui-btn ui-btn-primary px-5 py-3 text-sm !text-white"
            disabled={!!canGenerateMessage || isPolling}
          >
            漫画を生成する
          </button>

          {isPolling && <div className="text-sm text-slate-600">生成中... {progress}%</div>}

          {error && (
            <div className="ui-callout ui-callout-error">
              {error}
              <div className="mt-2">
                <button
                  type="button"
                  className="font-semibold text-stone-700 hover:text-stone-800"
                  onClick={() => {
                    setError(null);
                    setProgress(0);
                    clearActiveJob();
                    handleGenerate();
                  }}
                >
                  再試行する
                </button>
              </div>
            </div>
          )}

          {error && fallbackTexts.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-sm font-semibold text-slate-700">
                テキスト要約でご案内します
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {fallbackTexts.map((text, index) => (
                  <li key={`${text}-${index}`}>{text}</li>
                ))}
              </ul>
            </div>
          )}

          {!error && canGenerateMessage && (
            <div className="ui-callout ui-callout-info">{canGenerateMessage}</div>
          )}

          {!error && !isPolling && !canGenerateMessage && (
            <div className="text-sm text-slate-500">
              {isLoggedIn
                ? '生成失敗時はテキスト要約を表示します。'
                : 'ログインすると生成した漫画が履歴に保存されます。'}
            </div>
          )}
        </div>
      )}

      {(error || (result && !imageUrl)) && (
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <p>テキスト要約にフォールバックしました。</p>
          <ul className="list-disc pl-5">
            {(result?.panels ?? [{ id: 'summary', text: props.summary }]).map((panel) => (
              <li key={panel.id}>{panel.text}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
