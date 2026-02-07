'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { SummaryViewer } from '@/components/SummaryViewer';
import { ChecklistViewer } from '@/components/ChecklistViewer';
import { SourceReference } from '@/components/SourceReference';
import { GoogleSearchAttribution } from '@/components/GoogleSearchAttribution';
import { MangaViewer } from '@/components/MangaViewer';
import { fetchHistoryDetail } from '@/lib/history-api';
import type { ChatMessage, IntentAnswerResponse } from '@/lib/types/intermediate';
import { useAnalyzeStore } from '@/stores/analyzeStore';

interface IntentAnswerEntry {
  text: string;
}

interface StructuredIntentAnswer {
  headline: string;
  finalJudgment: IntentAnswerEntry;
  firstPriorityAction: IntentAnswerEntry;
  failureRisks: IntentAnswerEntry[];
}

function extractJsonChunk(text: string): string | null {
  const cleaned = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  const startIndex = cleaned.search(/[\[{]/);
  if (startIndex === -1) {
    return null;
  }
  const openChar = cleaned[startIndex];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIndex; i < cleaned.length; i += 1) {
    const char = cleaned[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === openChar) {
      depth += 1;
      continue;
    }
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return cleaned.slice(startIndex, i + 1);
      }
    }
  }
  return null;
}

function parseJson<T>(text: string): T | null {
  try {
    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    const extracted = extractJsonChunk(text);
    if (!extracted) {
      return null;
    }
    try {
      return JSON.parse(extracted) as T;
    } catch {
      return null;
    }
  }
}

function normalizeEvidenceUrl(url: unknown): string {
  if (typeof url !== 'string') {
    return '';
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return '';
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    parsed.hash = '';
    const normalized = parsed.toString();
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  } catch {
    return '';
  }
}

function normalizeIntentText(value: unknown, fallback = '不明'): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || fallback;
}

function normalizeIntentEntry(value: unknown, fallbackText = '不明'): IntentAnswerEntry {
  if (typeof value === 'string') {
    return {
      text: normalizeIntentText(value, fallbackText),
    };
  }
  if (!value || typeof value !== 'object') {
    return {
      text: fallbackText,
    };
  }
  const objectValue = value as Record<string, unknown>;
  return {
    text: normalizeIntentText(objectValue.text, fallbackText),
  };
}

function normalizeIntentEntryList(value: unknown, fallbackText: string): IntentAnswerEntry[] {
  if (!Array.isArray(value)) {
    return [normalizeIntentEntry(null, fallbackText)];
  }
  const entries = value
    .map((item) => normalizeIntentEntry(item, fallbackText))
    .filter((entry, index, self) => self.findIndex((current) => current.text === entry.text) === index)
    .slice(0, 5);
  return entries.length > 0 ? entries : [normalizeIntentEntry(null, fallbackText)];
}

function parseStructuredIntentAnswer(rawText?: string): StructuredIntentAnswer | null {
  if (!rawText) {
    return null;
  }
  const parsed = parseJson<Record<string, unknown>>(rawText);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const core = (parsed.core && typeof parsed.core === 'object'
    ? parsed.core
    : parsed) as Record<string, unknown>;

  return {
    headline: normalizeIntentText(parsed.headline, 'あなた向けの回答'),
    finalJudgment: normalizeIntentEntry(
      core.finalJudgment ?? core.targetJudgment ?? core.targetAudienceDecision,
      '対象かどうかの判断材料は不明'
    ),
    firstPriorityAction: normalizeIntentEntry(
      core.firstPriorityAction ?? core.firstAction,
      '最優先の1手は不明'
    ),
    failureRisks: normalizeIntentEntryList(core.failureRisks ?? core.cautions, '失敗リスクは不明')
      .slice(0, 2),
  };
}

function ResultContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get('url');
  const historyId = searchParams.get('historyId');
  const {
    result,
    status,
    error,
    analyze,
    setResult,
    setStatus,
    setError,
    setUrl,
    resetCheckedItems,
    reset,
    messages,
    setMessages,
    addMessage,
    setIntent,
    deepDiveSummary,
    setDeepDiveSummary,
    resetDeepDiveState,
  } = useAnalyzeStore();
  const lastLoadedHistoryId = useRef<string | null>(null);
  const handledResultIdRef = useRef<string | null>(null);
  const [deepDiveInput, setDeepDiveInput] = useState('');
  const [intentInput, setIntentInput] = useState('');
  const [isDeepDiveLoading, setIsDeepDiveLoading] = useState(false);
  const [deepDiveError, setDeepDiveError] = useState<string | null>(null);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isIntentGenerating, setIsIntentGenerating] = useState(false);
  const [isIntentLocked, setIsIntentLocked] = useState(false);
  const [chatMode, setChatMode] = useState<'deepDive' | 'intent'>('deepDive');
  const [isHistoryResolving, setIsHistoryResolving] = useState(false);

  const handleBackToHome = () => {
    reset();
  };

  useEffect(() => {
    if (!historyId) {
      setIsHistoryResolving(false);
      return;
    }
    if (lastLoadedHistoryId.current === historyId) return;
    lastLoadedHistoryId.current = historyId;
    setIsHistoryResolving(true);
    setResult(null);
    setStatus('idle');
    setError(null);

    const loadDetail = async () => {
      try {
        const detail = await fetchHistoryDetail(historyId);
        if (!detail.history) {
          setResult(null);
          if (url) {
            setUrl(url);
            setError('履歴が見つからなかったため、このURLを再解析してください');
            setStatus('idle');
          } else {
            setError('履歴が見つかりませんでした');
            setStatus('error');
          }
          return;
        }

        setUrl(detail.history.url);

        if (detail.result && detail.intermediate) {
          const mergedResult = {
            id: detail.result.id,
            intermediate: detail.intermediate.intermediate,
            generatedSummary:
              detail.result.generatedSummary || detail.intermediate.intermediate.summary || '',
            overview: detail.result.overview,
            checklist: detail.result.checklist || [],
            status: 'success' as const,
          };
          setResult(mergedResult);
          resetCheckedItems(mergedResult.checklist);
          setStatus('success');
          setError(null);
          resetDeepDiveState();
          return;
        }

        setResult(null);
        if (detail.history.url) {
          analyze(detail.history.url);
        } else if (url) {
          setUrl(url);
          setError('履歴情報にURLがないため、このURLを再解析してください');
          setStatus('idle');
        } else {
          setError('履歴情報から再解析できませんでした');
          setStatus('error');
        }
      } catch (err) {
        setResult(null);
        if (url) {
          setUrl(url);
          setError('履歴の取得に失敗したため、このURLを再解析してください');
          setStatus('idle');
        } else {
          setError(err instanceof Error ? err.message : '履歴の取得に失敗しました');
          setStatus('error');
        }
      } finally {
        setIsHistoryResolving(false);
      }
    };

    loadDetail();
  }, [
    analyze,
    historyId,
    resetCheckedItems,
    resetDeepDiveState,
    setError,
    setResult,
    setStatus,
    setUrl,
    url,
  ]);

  useEffect(() => {
    if (!result?.id || handledResultIdRef.current === result.id) return;
    handledResultIdRef.current = result.id;
    setChatMode('deepDive');
    if (isIntentGenerating) {
      setIsGenerating(true);
      setIsIntentGenerating(false);
      setIsIntentLocked(true);
      return;
    }
    setIsGenerating(false);
    setIsIntentLocked(false);
  }, [result?.id, isIntentGenerating]);

  if (!historyId && !url && !result) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 mb-4">URLが指定されていません</p>
          <Link
            href="/analyze"
            onClick={handleBackToHome}
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            トップページに戻る
          </Link>
        </div>
      </div>
    );
  }

  // ローディング中（意図入力の再解析中は画面を維持）
  if (status === 'loading' && !isIntentGenerating) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
          <p className="text-lg text-gray-700">ページを解析しています...</p>
          <p className="text-sm text-gray-500 mt-2">（30秒〜1分程度かかります）</p>
        </div>
      </div>
    );
  }

  // エラー
  if (status === 'error') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 mb-4">{error || '解析に失敗しました'}</p>
          <Link
            href="/analyze"
            onClick={handleBackToHome}
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            トップページに戻る
          </Link>
        </div>
      </div>
    );
  }

  // 結果がない場合
  if (!result || !result.intermediate) {
    const canAnalyzeFromUrl = Boolean(url && status === 'idle' && !isHistoryResolving);
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-12">
          {canAnalyzeFromUrl ? (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center max-w-xl">
              <p className="text-lg font-semibold text-gray-800">このURLの結果はまだ表示されていません</p>
              {error && (
                <p className="mt-2 text-sm text-amber-700">{error}</p>
              )}
              <p className="text-sm text-gray-600 mt-2">
                自動では解析しません。必要な場合のみ手動で解析を開始してください。
              </p>
              <button
                type="button"
                onClick={() => {
                  if (url) {
                    analyze(url);
                  }
                }}
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                このURLを解析する
              </button>
            </div>
          ) : (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
              <p className="text-lg text-gray-700">データを読み込んでいます...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const intermediate = result.intermediate;
  const summaryText = result.generatedSummary || intermediate.summary || '';
  const overview = result.overview;
  const structuredIntentAnswer = parseStructuredIntentAnswer(result.intentAnswer);
  const rawIntentAnswerLines = result.intentAnswer
    ? result.intentAnswer.split('\n').map((line) => line.trim()).filter(Boolean)
    : [];
  const { checklist } = result;
  const overviewTexts = [
    overview?.conclusion,
    overview?.targetAudience,
    ...(overview?.topics ?? []),
    ...(overview?.cautions ?? []),
    ...(overview?.criticalFacts ?? []).map((fact) => `${fact.item}: ${fact.value}`),
  ].filter((text): text is string => typeof text === 'string' && text.trim().length > 0);
  const checklistTexts = checklist
    .map((item) => item.text?.trim())
    .filter((text): text is string => Boolean(text));

  const evidenceTitleByUrl = new Map<string, string>();
  const registerEvidenceTitle = (url?: string, title?: string) => {
    const normalized = normalizeEvidenceUrl(url);
    if (!normalized) {
      return;
    }
    const trimmedTitle = title?.trim();
    if (trimmedTitle) {
      evidenceTitleByUrl.set(normalized, trimmedTitle);
      return;
    }
    if (!evidenceTitleByUrl.has(normalized)) {
      try {
        evidenceTitleByUrl.set(normalized, new URL(normalized).hostname.replace(/^www\./i, ''));
      } catch {
        evidenceTitleByUrl.set(normalized, normalized);
      }
    }
  };

  registerEvidenceTitle(intermediate.metadata.source_url, intermediate.metadata.page_title || intermediate.title);
  for (const chunk of intermediate.metadata.groundingMetadata?.groundingChunks ?? []) {
    registerEvidenceTitle(chunk.web?.uri, chunk.web?.title);
  }
  for (const relatedLink of intermediate.relatedLinks ?? []) {
    registerEvidenceTitle(relatedLink.url, relatedLink.title);
  }
  registerEvidenceTitle(
    intermediate.contact?.website,
    intermediate.contact?.department ? `${intermediate.contact.department} の案内ページ` : undefined
  );
  const groundingChunks = intermediate.metadata.groundingMetadata?.groundingChunks ?? [];
  const groundingSupports = intermediate.metadata.groundingMetadata?.groundingSupports ?? [];
  const usedGroundingChunkIndices = new Set<number>();
  for (const support of groundingSupports) {
    for (const index of support.groundingChunkIndices ?? []) {
      if (index >= 0 && index < groundingChunks.length) {
        usedGroundingChunkIndices.add(index);
      }
    }
  }
  const groundingEvidenceUrls = Array.from(
    new Set(
      (
        usedGroundingChunkIndices.size > 0
          ? Array.from(usedGroundingChunkIndices).map((index) => groundingChunks[index]?.web?.uri)
          : groundingChunks.map((chunk) => chunk.web?.uri)
      )
        .map((uri) => normalizeEvidenceUrl(uri))
        .filter(Boolean)
    )
  );
  const fallbackGroundingEvidenceUrls = Array.from(
    new Set(groundingChunks.map((chunk) => normalizeEvidenceUrl(chunk.web?.uri)).filter(Boolean))
  );
  const answerEvidenceUrls =
    groundingEvidenceUrls.length > 0 ? groundingEvidenceUrls : fallbackGroundingEvidenceUrls;
  const isAnswerEvidenceFallback =
    groundingEvidenceUrls.length === 0 && fallbackGroundingEvidenceUrls.length > 0;

  const handleSendDeepDive = async () => {
    if (!deepDiveInput.trim() || isDeepDiveLoading) return;
    setDeepDiveError(null);
    setIsDeepDiveLoading(true);

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: deepDiveInput.trim() },
    ];
    addMessage({ role: 'user', content: deepDiveInput.trim() });
    setDeepDiveInput('');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'deepDive',
          summary: summaryText,
          messages: nextMessages,
          deepDiveSummary: deepDiveSummary || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '深掘りに失敗しました');
      }

      const data = (await response.json()) as {
        status: 'success' | 'error';
        answer?: string;
        summary?: string;
        error?: string;
      };

      if (data.status === 'error') {
        throw new Error(data.error || '深掘りに失敗しました');
      }

      if (data.answer) {
        addMessage({ role: 'assistant', content: data.answer });
      }

      const updatedMessages: ChatMessage[] = data.answer
        ? [...nextMessages, { role: 'assistant', content: data.answer }]
        : nextMessages;

      const latestSummary = data.summary || deepDiveSummary;
      if (data.summary) {
        setDeepDiveSummary(data.summary);
      }

      if (updatedMessages.length > 20) {
        const overflowCount = updatedMessages.length - 20;
        const overflowMessages = updatedMessages.slice(0, overflowCount);
        let canTrimMessages = false;

        try {
          const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'deepDive',
              summary: summaryText,
              messages: overflowMessages,
              deepDiveSummary: latestSummary || undefined,
              summaryOnly: true,
            }),
          });

          if (response.ok) {
            const summaryData = (await response.json()) as {
              status: 'success' | 'error';
              summary?: string;
            };
            if (summaryData.status === 'success' && summaryData.summary) {
              setDeepDiveSummary(summaryData.summary);
              canTrimMessages = true;
            }
          }
        } catch {
          // 要約失敗時は既存のdeepDiveSummaryを保持
        }

        if (canTrimMessages) {
          setMessages(updatedMessages.slice(overflowCount));
        } else {
          setMessages(updatedMessages);
        }
      } else {
        setMessages(updatedMessages);
      }
    } catch (err) {
      setDeepDiveError(err instanceof Error ? err.message : '深掘りに失敗しました');
    } finally {
      setIsDeepDiveLoading(false);
    }
  };

  const handleAdvanceToIntent = () => {
    setChatMode('intent');
  };

  const handleConfirmIntent = async () => {
    if (!intentInput.trim() || !result?.intermediate || isIntentGenerating) return;
    const trimmedIntent = intentInput.trim();
    const hadIntentAnswer = Boolean(result.intentAnswer);
    setIntentInput(trimmedIntent);
    setIntent(trimmedIntent);
    setIntentError(null);
    setDeepDiveError(null);
    setIsGenerating(true);
    setIsIntentGenerating(true);
    setIsIntentLocked(true);
    setStatus('success');
    setError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'intent',
          userIntent: trimmedIntent,
          intermediate: result.intermediate,
          messages,
          deepDiveSummary: deepDiveSummary || undefined,
          overviewTexts,
          checklistTexts,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as IntentAnswerResponse;
      if (!response.ok || payload.status === 'error' || !payload.intentAnswer) {
        throw new Error(payload.error || '意図回答の生成に失敗しました');
      }

      setResult({
        ...result,
        intentAnswer: payload.intentAnswer,
      });
      setIsIntentGenerating(false);
      setIsGenerating(true);
      setIsIntentLocked(true);
    } catch (err) {
      setIntentError(err instanceof Error ? err.message : '意図回答の生成に失敗しました');
      setIsIntentGenerating(false);
      setIsGenerating(hadIntentAnswer);
      setIsIntentLocked(false);
    }
  };

  const renderAnswerEntryCard = (
    title: string,
    entry: IntentAnswerEntry,
    toneClassName = 'border-slate-200 bg-white'
  ) => (
    <section className={`rounded-xl border p-4 ${toneClassName}`}>
      <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
      <p className="mt-2 text-sm leading-relaxed text-slate-900">{entry.text}</p>
    </section>
  );

  const renderAnswerEvidenceSection = (keyPrefix: string) => {
    if (answerEvidenceUrls.length === 0) {
      return null;
    }
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-700">この回答の根拠</h4>
        {isAnswerEvidenceFallback && (
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            本文との直接ひも付けが取れないため、検索で参照した情報源を表示しています。
          </p>
        )}
        <ul className="mt-3 space-y-1.5">
          {answerEvidenceUrls.map((evidenceUrl, index) => (
            <li key={`${keyPrefix}-${index}`}>
              <a
                href={evidenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-600 underline underline-offset-2 hover:text-slate-900"
              >
                {evidenceTitleByUrl.get(evidenceUrl) || evidenceUrl}
              </a>
            </li>
          ))}
        </ul>
      </section>
    );
  };


  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 免責バナー */}
      <DisclaimerBanner
        sourceUrl={intermediate.metadata.source_url}
        fetchedAt={intermediate.metadata.fetched_at}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <Link
          href="/analyze"
          onClick={handleBackToHome}
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
        >
          <span aria-hidden="true">←</span>
          新しいURLを解析
        </Link>
        <div className="flex flex-wrap items-center gap-2" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="text-lg font-bold">1分でわかる！平易化されたWebページ</h3>
      </div>

      {/* 既存要約表示 */}
      <SummaryViewer data={intermediate} overview={overview} hideDetails />

      {/* 深掘りチャット */}
        <div className="group relative rounded-2xl border border-slate-200 bg-white/90 px-6 pt-6 pb-2 shadow-[0_12px_30px_rgba(15,23,42,0.08)] mb-6">
          <div className="absolute right-6 top-6">
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => setChatMode('deepDive')}
                className={`px-3 py-1 rounded-full transition ${
                  chatMode === 'deepDive'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                深掘り
              </button>
              <button
                type="button"
                onClick={handleAdvanceToIntent}
                className={`px-3 py-1 rounded-full transition ${
                  chatMode === 'intent' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                意図入力
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pr-24">
            {chatMode === 'deepDive' && (
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span aria-hidden="true">💬</span>
                  深掘りチャット
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-2">気になる点を深掘り</h3>
                <p className="text-sm text-slate-600">
                  「ここが分からない」をAIアシスタントに質問して解消しましょう。
                </p>
              </div>
            )}
            {chatMode === 'intent' && (
              <div className="max-w-xl">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span aria-hidden="true">🎯</span>
                  意図入力
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-2">最終的に実現したいことを一文で</h3>
                <p className="text-sm text-slate-600">
                  実現したいことを入力すると、具体的なチェックリストと漫画が提供されます。
                </p>
              </div>
            )}
          </div>

          {chatMode === 'deepDive' && (
            <>
              <div className="space-y-4 mb-4">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`rounded-xl px-4 py-3 border ${
                      message.role === 'user'
                        ? 'bg-slate-50 border-slate-200 text-slate-800'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <p className="text-xs font-semibold mb-1 tracking-wide">
                      {message.role === 'user' ? 'あなた' : 'AIアシスタント'}
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                  </div>
                ))}
              </div>

              {deepDiveError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {deepDiveError}
                </div>
              )}

              <div className="relative">
                <textarea
                  value={deepDiveInput}
                  onChange={(event) => {
                    setDeepDiveInput(event.target.value);
                    event.currentTarget.style.height = 'auto';
                    event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                  }}
                  rows={3}
                  placeholder="例: 対象条件をもう少し詳しく知りたい"
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-14 text-sm focus:border-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSendDeepDive}
                  disabled={isDeepDiveLoading || !deepDiveInput.trim()}
                  className="absolute bottom-3 right-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                  aria-label="送信"
                >
                  {isDeepDiveLoading ? (
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <span className="h-3.5 w-3.5 rounded-[2px] bg-white" aria-hidden="true" />
                    </span>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  )}
                </button>
              </div>
            </>
          )}

          {chatMode === 'intent' && (
            <div className="space-y-0">
              <div className="relative">
                <textarea
                  value={intentInput}
                  onChange={(event) => {
                    setIntentInput(event.target.value);
                    if (intentError) {
                      setIntentError(null);
                    }
                    event.currentTarget.style.height = 'auto';
                    event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                  }}
                  rows={3}
                  placeholder="例: 私が対象かどうかと申請方法を知りたい"
                  disabled={isIntentGenerating || isIntentLocked}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-14 text-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                />
                <button
                  type="button"
                  onClick={handleConfirmIntent}
                  disabled={isIntentGenerating || isIntentLocked || !intentInput.trim()}
                  className="absolute bottom-3 right-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                  aria-label="意図を確定"
                >
                  {isIntentGenerating ? (
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <span className="h-3.5 w-3.5 rounded-[2px] bg-white" aria-hidden="true" />
                    </span>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  )}
                </button>
              </div>
              {intentError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {intentError}
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsIntentLocked(false)}
                className="-mt-10 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                aria-label="意図を編集"
                disabled={isIntentGenerating}
              >
                <span className="text-base" aria-hidden="true">
                  ✎
                </span>
                メッセージを編集する
              </button>
            </div>
          )}
        </div>

      {/* 回答生成開始 */}
      {isGenerating && (
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)] mb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">
                ✨
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900">回答</h3>
                <p className="text-xs text-slate-500">あなたの意図とパーソナル情報に基づく回答</p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            {!isIntentGenerating && result.intentAnswer ? (
              structuredIntentAnswer ? (
                <div className="space-y-4">
                  <p className="text-sm font-semibold leading-relaxed text-slate-900">
                    {structuredIntentAnswer.headline}
                  </p>

                  {renderAnswerEvidenceSection('answer-evidence')}

                  {renderAnswerEntryCard(
                    'あなたは対象になりそうですか？',
                    structuredIntentAnswer.finalJudgment,
                    'border-sky-200 bg-sky-50/70'
                  )}
                  {renderAnswerEntryCard(
                    '最優先の1手',
                    structuredIntentAnswer.firstPriorityAction,
                    'border-emerald-200 bg-emerald-50/60'
                  )}

                  <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                    <h4 className="text-sm font-semibold text-amber-900">見落とすと申請で困るポイント</h4>
                    <ul className="mt-3 space-y-2">
                      {structuredIntentAnswer.failureRisks.map((risk, index) => (
                        <li key={`failure-risk-${index}`} className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                          <p className="text-sm leading-relaxed text-slate-900">{risk.text}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              ) : (
                <div className="space-y-3 text-sm text-slate-800 leading-relaxed">
                  {renderAnswerEvidenceSection('answer-evidence-fallback')}
                  {rawIntentAnswerLines.length > 1 ? (
                    <ul className="space-y-2">
                      {rawIntentAnswerLines.map((line, index) => (
                        <li key={index} className="flex gap-2">
                          <span className="mt-0.5 text-slate-400" aria-hidden="true">
                            ▪︎
                          </span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>{result.intentAnswer}</p>
                  )}
                </div>
              )
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-500">あなた向けの回答を作成しています。まもなくご確認いただけます。</p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-slate-300" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isGenerating && !isIntentGenerating && (
        <>
          {/* チェックリスト */}
          <div className="mb-6">
            <ChecklistViewer items={checklist} />
          </div>

          {/* 漫画ビューア（Phase 2） */}
          <MangaViewer
            url={intermediate.metadata.source_url}
            title={intermediate.title}
            summary={intermediate.summary}
            keyPoints={intermediate.keyPoints?.map((point) => point.text)}
          />

          {/* Google Search 引用表示 */}
          {intermediate.metadata.groundingMetadata && (
            <GoogleSearchAttribution groundingMetadata={intermediate.metadata.groundingMetadata} />
          )}

          {/* 根拠表示 */}
          <div className="mb-6">
            <SourceReference sources={intermediate.sources} />
          </div>
        </>
      )}

      {/* フィードバックセクション */}
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        </div>
      }
    >
      <ResultContent />
    </Suspense>
  );
}
