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
import { useAnalyzeStore } from '@/stores/analyzeStore';

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
    focus,
    setFocus,
    intent,
    setIntent,
    deepDiveSummary,
    setDeepDiveSummary,
    resetDeepDiveState,
  } = useAnalyzeStore();
  const lastLoadedHistoryId = useRef<string | null>(null);
  const isNavigatingToAnalyzeRef = useRef(false);
  const handledResultIdRef = useRef<string | null>(null);
  const autoAnalyzeTriggeredRef = useRef(false);
  const [deepDiveInput, setDeepDiveInput] = useState('');
  const [intentInput, setIntentInput] = useState('');
  const [isDeepDiveLoading, setIsDeepDiveLoading] = useState(false);
  const [deepDiveError, setDeepDiveError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isIntentGenerating, setIsIntentGenerating] = useState(false);
  const [chatMode, setChatMode] = useState<'deepDive' | 'intent'>('deepDive');

  const handleBackToHome = () => {
    isNavigatingToAnalyzeRef.current = true;
    reset();
  };

  useEffect(() => {
    if (!historyId) return;
    if (lastLoadedHistoryId.current === historyId) return;

    const loadDetail = async () => {
      try {
        const detail = await fetchHistoryDetail(historyId);
        if (!detail.history) {
          setError('履歴が見つかりませんでした');
          setStatus('error');
          lastLoadedHistoryId.current = historyId;
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
          lastLoadedHistoryId.current = historyId;
          return;
        }

        if (status === 'idle' && !result) {
          analyze(detail.history.url);
          lastLoadedHistoryId.current = historyId;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '履歴の取得に失敗しました');
        setStatus('error');
        lastLoadedHistoryId.current = historyId;
      }
    };

    loadDetail();
  }, [historyId, analyze, resetCheckedItems, setError, setResult, setStatus, setUrl]);

  // URLパラメータがあり、まだ解析結果がない場合は解析を実行
  useEffect(() => {
    if (historyId) return;
    if (isNavigatingToAnalyzeRef.current) return;
    if (autoAnalyzeTriggeredRef.current) return;
    if (url && !result && status === 'idle') {
      autoAnalyzeTriggeredRef.current = true;
      analyze(url);
    }
  }, [historyId, url, result, status, analyze]);

  const intermediate = result?.intermediate;
  const summaryText = result?.generatedSummary || intermediate?.summary || '';
  const overview = result?.overview;

  useEffect(() => {
    if (!result?.id || handledResultIdRef.current === result.id) return;
    handledResultIdRef.current = result.id;
    setChatMode('deepDive');
    if (isIntentGenerating) {
      setIsGenerating(true);
      setIsIntentGenerating(false);
      setIntentInput('');
      return;
    }
    setIsGenerating(false);
    setIntentInput('');
  }, [result?.id, isIntentGenerating]);

  if (!historyId && !url) {
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
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
          <p className="text-lg text-gray-700">データを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  const { checklist } = result;

  const handleSendDeepDive = async () => {
    if (!deepDiveInput.trim() || isDeepDiveLoading) return;
    setDeepDiveError(null);
    setIsDeepDiveLoading(true);

    const nextMessages = [...messages, { role: 'user', content: deepDiveInput.trim() }];
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
          focus: focus || undefined,
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

      const updatedMessages = data.answer
        ? [...nextMessages, { role: 'assistant', content: data.answer }]
        : nextMessages;

      const latestSummary = data.summary || deepDiveSummary;
      if (data.summary) {
        setDeepDiveSummary(data.summary);
      }

      if (updatedMessages.length > 20) {
        const overflowCount = updatedMessages.length - 20;
        const overflowMessages = updatedMessages.slice(0, overflowCount);

        try {
          const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'deepDive',
              summary: summaryText,
              messages: overflowMessages,
              focus: focus || undefined,
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
            }
          }
        } catch {
          // 要約失敗時は既存のdeepDiveSummaryを保持
        }

        setMessages(updatedMessages.slice(overflowCount));
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

  const handleConfirmIntent = () => {
    if (!intentInput.trim()) return;
    const trimmedIntent = intentInput.trim();
    setIntent(trimmedIntent);
    setIsGenerating(true);
    setIsIntentGenerating(true);

    const targetUrl = url || result?.intermediate?.metadata.source_url;
    if (targetUrl) {
      analyze(targetUrl, trimmedIntent);
    }
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
      <div className="relative rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)] mb-6">
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
            <div className="space-y-4">
              <div className="relative">
                <textarea
                  value={intentInput}
                  onChange={(event) => {
                    setIntentInput(event.target.value);
                    event.currentTarget.style.height = 'auto';
                    event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                  }}
                  rows={3}
                  placeholder="例: 私が対象かどうかと申請方法を知りたい"
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-14 text-sm focus:border-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleConfirmIntent}
                  disabled={!intentInput.trim()}
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
            </div>
          )}
        </div>

      {/* 回答生成開始 */}
      {isGenerating && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl" aria-hidden="true">
              ✨
            </span>
            <h3 className="text-lg font-bold">回答</h3>
          </div>
          {result.intentAnswer ? (
            <div className="mt-4 whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
              {result.intentAnswer}
            </div>
          ) : (
            <p className="text-sm text-gray-500 mt-3">
              回答を生成中です。しばらくお待ちください。
            </p>
          )}
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
