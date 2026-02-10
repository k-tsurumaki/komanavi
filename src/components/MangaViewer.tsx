'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import type { MangaFlowState } from '@/lib/flow-stage';
import type {
  IntermediateRepresentation,
  MangaJobStatusResponse,
  MangaRequest,
  MangaResult,
} from '@/lib/types/intermediate';

interface MangaViewerProps {
  url: string;
  title: string;
  summary: string;
  keyPoints?: string[];
  resultId: string; // 解析結果のID
  historyId: string; // 会話履歴のID
  initialMangaResult?: MangaResult | null; // 履歴から復元した漫画データ
  onFlowStateChange?: (state: MangaFlowState) => void;
  autoGenerate?: boolean; // 自動生成フラグ
  intermediate?: IntermediateRepresentation; // 中間表現（追加フィールド用）
  userIntent?: string; // ユーザーの意図（パーソナライズ用）
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
    progress: number;
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

function buildRequest(
  props: Pick<
    MangaViewerProps,
    | 'url'
    | 'title'
    | 'summary'
    | 'keyPoints'
    | 'resultId'
    | 'historyId'
    | 'intermediate'
    | 'userIntent'
  >
): MangaRequest {
  const { intermediate } = props;

  return {
    url: props.url,
    title: props.title,
    summary: props.summary,
    keyPoints: props.keyPoints,
    resultId: props.resultId,
    historyId: props.historyId,
    userIntent: props.userIntent,

    // 中間表現から追加フィールドを抽出
    documentType: intermediate?.documentType,
    target: intermediate?.target
      ? {
          conditions: intermediate.target.conditions,
          eligibility_summary: intermediate.target.eligibility_summary,
        }
      : undefined,
    procedure: intermediate?.procedure
      ? {
          // トークン削減のため、detailsとnoteは除外してactionのみ抽出
          steps: intermediate.procedure.steps.map((step) => ({
            order: step.order,
            action: step.action,
          })),
          required_documents: intermediate.procedure.required_documents,
          deadline: intermediate.procedure.deadline,
          fee: intermediate.procedure.fee,
        }
      : undefined,
    benefits: intermediate?.benefits,
    contact: intermediate?.contact,
    warnings: intermediate?.warnings,
    tips: intermediate?.tips,
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
  const {
    url,
    title,
    summary,
    keyPoints,
    resultId,
    historyId,
    initialMangaResult,
    onFlowStateChange,
    autoGenerate,
    intermediate,
    userIntent,
  } = props;
  const { data: session } = useSession();
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [result, setResult] = useState<MangaResult | null>(initialMangaResult || null);
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const isPollingRef = useRef(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const regeneratingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoggedIn = !!session;

  const notifyFlowState = useCallback(
    (state: Omit<MangaFlowState, 'updatedAt'>) => {
      onFlowStateChange?.({
        ...state,
        updatedAt: Date.now(),
      });
    },
    [onFlowStateChange]
  );

  const mangaRequest = useMemo(
    () =>
      buildRequest({
        url,
        title,
        summary,
        keyPoints,
        resultId,
        historyId,
        intermediate,
        userIntent,
      }),
    [historyId, keyPoints, resultId, summary, title, url, intermediate, userIntent]
  );

  const canGenerateMessage = useMemo(() => {
    const usage = loadUsage();
    if (
      usage.activeJob &&
      usage.activeJob.url !== url &&
      Date.now() - usage.activeJob.startedAt < POLL_TIMEOUT_MS
    ) {
      return '現在ほかの漫画生成が進行中です。完了後に再度お試しください。';
    }
    return null;
  }, [url]);

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
          // ジョブが見つからない場合はポーリングを停止
          clearPolling();
          clearActiveJob(job);
          return;
        }
        if (!response.ok) {
          throw new Error('ステータスの取得に失敗しました');
        }
        const data: MangaJobStatusResponse = await response.json();
        const nextProgress = data.progress || 0;
        setProgress(nextProgress);

        // localStorageの進捗を更新（進捗が変化した時のみ保存）
        const usage = loadUsage();
        if (
          usage.activeJob &&
          usage.activeJob.jobId === job &&
          usage.activeJob.progress !== nextProgress
        ) {
          usage.activeJob.progress = nextProgress;
          saveUsage(usage);
        }

        if (data.status === 'queued' || data.status === 'processing') {
          notifyFlowState({
            status: 'in_progress',
            progress: nextProgress,
          });
        }

        if (data.status === 'done' && data.result) {
          setResult(data.result);
          if (data.result.imageUrls && data.result.imageUrls.length > 0) {
            setImageUrl(data.result.imageUrls[0]);
          } else {
            const pngUrl = renderManga(data.result);
            setImageUrl(pngUrl);
          }
          setError(null);
          notifyFlowState({
            status: 'completed',
            progress: 100,
          });
          clearPolling();
          clearActiveJob(job);
        }

        if (data.status === 'error') {
          // エラー時はresultを設定しない（フォールバック画像を生成させない）
          setResult(null);
          setError(getErrorMessage(data.errorCode, data.error));
          notifyFlowState({
            status: 'error',
            progress: nextProgress,
            errorCode: data.errorCode,
          });
          clearPolling();
          clearActiveJob(job);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'ステータス取得に失敗しました');
        notifyFlowState({
          status: 'error',
          errorCode: 'unknown',
        });
        clearPolling();
        clearActiveJob(job);
      }
    },
    [clearActiveJob, clearPolling, notifyFlowState]
  );

  const startPolling = useCallback(
    (job: string, initialProgress = 0) => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;
      setIsPolling(true);
      notifyFlowState({
        status: 'in_progress',
        progress: initialProgress,
      });
      startedAtRef.current = Date.now();
      pollingRef.current = setInterval(() => {
        if (startedAtRef.current && Date.now() - startedAtRef.current > POLL_TIMEOUT_MS) {
          setError('漫画生成がタイムアウトしました');
          notifyFlowState({
            status: 'error',
            errorCode: 'timeout',
          });
          clearPolling();
          clearActiveJob(job);
          return;
        }
        pollStatus(job);
      }, POLL_INTERVAL_MS);
    },
    [clearActiveJob, clearPolling, notifyFlowState, pollStatus]
  );

  const handleGenerate = useCallback(async () => {
    setError(null);

    const usage = loadUsage();

    if (
      usage.activeJob &&
      usage.activeJob.url !== url &&
      Date.now() - usage.activeJob.startedAt < POLL_TIMEOUT_MS
    ) {
      setError('現在ほかの漫画生成が進行中です。完了後に再度お試しください。');
      notifyFlowState({
        status: 'error',
        errorCode: 'concurrent',
      });
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
        body: JSON.stringify(mangaRequest),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData.errorCode, errorData.error));
      }

      const data = (await response.json()) as { jobId: string };
      setProgress(0);
      notifyFlowState({
        status: 'in_progress',
        progress: 0,
      });

      const nextUsage: MangaUsageState = {
        ...usage,
        count: usage.count + 1,
        urlCooldowns: usage.urlCooldowns,
        activeJob: { jobId: data.jobId, startedAt: Date.now(), url, progress: 0 },
      };
      saveUsage(nextUsage);

      startPolling(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '漫画生成に失敗しました');
      notifyFlowState({
        status: 'error',
        errorCode: 'unknown',
      });
    }
  }, [mangaRequest, notifyFlowState, startPolling, url]);

  const handleRegenerate = useCallback(async () => {
    // すでに再生成中または処理中なら無視
    if (isRegenerating || isPolling) {
      return;
    }

    setIsRegenerating(true);

    // 再生成時は初期データの復元を抑制するため result を維持しつつ imageUrl のみクリア
    setImageUrl('');
    setError(null);
    setProgress(0);
    clearPolling();
    clearActiveJob();

    try {
      // すぐに生成を開始
      await handleGenerate();
    } finally {
      // 最小200ms待機（視覚的フィードバック）
      if (regeneratingTimeoutRef.current) {
        clearTimeout(regeneratingTimeoutRef.current);
      }
      regeneratingTimeoutRef.current = setTimeout(() => {
        setIsRegenerating(false);
        regeneratingTimeoutRef.current = null;
      }, 200);
    }
  }, [handleGenerate, clearPolling, clearActiveJob, isRegenerating, isPolling]);

  useEffect(() => {
    const usage = loadUsage();
    if (usage.activeJob && usage.activeJob.url === url) {
      // localStorageから進捗を復元（0%フラッシュを防止）
      const restoredProgress = Math.max(0, usage.activeJob.progress || 0);
      if (restoredProgress > 0) {
        setProgress(restoredProgress);
      }
      startPolling(usage.activeJob.jobId, restoredProgress);
    } else if (initialMangaResult) {
      notifyFlowState({
        status: 'completed',
        progress: 100,
      });
    } else {
      notifyFlowState({
        status: 'not_started',
        progress: 0,
      });
    }

    return () => {
      clearPolling();
      if (regeneratingTimeoutRef.current) {
        clearTimeout(regeneratingTimeoutRef.current);
      }
    };
  }, [clearPolling, initialMangaResult, notifyFlowState, startPolling, url]);

  // 履歴から復元した漫画データを初期表示（再生成中・ポーリング中は復元しない）
  useEffect(() => {
    if (initialMangaResult && !imageUrl && !isPolling && !isRegenerating && !error) {
      setResult(initialMangaResult);
      setProgress(100);
      notifyFlowState({
        status: 'completed',
        progress: 100,
      });
      if (initialMangaResult.imageUrls && initialMangaResult.imageUrls.length > 0) {
        setImageUrl(initialMangaResult.imageUrls[0]);
      } else {
        const pngUrl = renderManga(initialMangaResult);
        setImageUrl(pngUrl);
      }
    }
  }, [initialMangaResult, imageUrl, isPolling, isRegenerating, error, notifyFlowState]);

  // 自動生成トリガー（一度だけ実行）
  const hasAutoGeneratedRef = useRef(false);

  useEffect(() => {
    if (
      autoGenerate &&
      !isPolling &&
      !isRegenerating &&
      !imageUrl &&
      !initialMangaResult &&
      !hasAutoGeneratedRef.current
    ) {
      hasAutoGeneratedRef.current = true;
      void handleGenerate();
    }
  }, [autoGenerate, isPolling, isRegenerating, imageUrl, initialMangaResult, handleGenerate]);

  // autoGenerateが変わったらリセット
  useEffect(() => {
    if (!autoGenerate) {
      hasAutoGeneratedRef.current = false;
    }
  }, [autoGenerate]);

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
            alt={`${title}の漫画`}
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
                    link.download = `${title}-manga.png`;
                    link.click();
                    URL.revokeObjectURL(blobUrl);
                  } else {
                    // Base64 Data URLの場合はそのまま
                    const link = document.createElement('a');
                    link.href = imageUrl;
                    link.download = `${title}-manga.png`;
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
              onClick={handleRegenerate}
              disabled={isRegenerating || isPolling}
            >
              {isRegenerating ? '再生成中...' : 'もう一度生成する'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
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

          {!error && canGenerateMessage && (
            <div className="ui-callout ui-callout-info">{canGenerateMessage}</div>
          )}

          {!error && !isPolling && !canGenerateMessage && (
            <div className="text-sm text-slate-500">
              {isLoggedIn
                ? '漫画を生成してみましょう。'
                : 'ログインすると生成した漫画が履歴に保存されます。'}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
