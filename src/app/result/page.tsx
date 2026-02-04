'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
  const [deepDiveInput, setDeepDiveInput] = useState('');
  const [intentInput, setIntentInput] = useState('');
  const [isDeepDiveLoading, setIsDeepDiveLoading] = useState(false);
  const [deepDiveError, setDeepDiveError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatMode, setChatMode] = useState<'deepDive' | 'intent'>('deepDive');
  const focusCandidates = useMemo(() => {
    if (!result?.intermediate?.keyPoints) return [];
    return result.intermediate.keyPoints.map((point) => point.text).filter(Boolean);
  }, [result?.intermediate?.keyPoints]);

  const handleDownload = () => {
    if (!result || !result.intermediate) return;
    const { intermediate, checklist } = result;
    const lines: string[] = [];
    lines.push(`# ${intermediate.title}`);
    lines.push('');
    lines.push(`- 元URL: ${intermediate.metadata.source_url}`);
    lines.push(`- 取得日時: ${intermediate.metadata.fetched_at}`);
    lines.push('');
    lines.push('## 要約');
    lines.push(intermediate.summary || result.generatedSummary || '');
    lines.push('');
    if (intermediate.keyPoints && intermediate.keyPoints.length > 0) {
      lines.push('## ポイント');
      intermediate.keyPoints.forEach((point) => {
        lines.push(`- ${point.text}`);
      });
      lines.push('');
    }
    if (checklist && checklist.length > 0) {
      lines.push('## やることチェックリスト');
      checklist.forEach((item) => {
        lines.push(`- [ ] ${item.text}`);
      });
      lines.push('');
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = `${intermediate.title || 'summary'}.md`;
    anchor.click();
    URL.revokeObjectURL(blobUrl);
  };

  const handleBackToHome = () => {
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
    if (url && !result && status === 'idle') {
      analyze(url);
    }
  }, [historyId, url, result, status, analyze]);

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

  // ローディング中
  if (status === 'loading') {
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

  const { intermediate, checklist } = result;
  const summaryText = result.generatedSummary || intermediate.summary || '';
  const overview = result.overview;

  useEffect(() => {
    setChatMode('deepDive');
    setIsGenerating(false);
    setIntentInput('');
  }, [result?.id]);

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
    setIntent(intentInput.trim());
    setIsGenerating(true);
  };


  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <Link
          href="/analyze"
          onClick={handleBackToHome}
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
        >
          <span aria-hidden="true">←</span>
          新しいURLを解析
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            結果をダウンロード
          </button>
        </div>
      </div>
      {/* 免責バナー */}
      <DisclaimerBanner
        sourceUrl={intermediate.metadata.source_url}
        fetchedAt={intermediate.metadata.fetched_at}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="text-lg font-bold">1分でわかる！平易化されたWebページ</h3>
      </div>

      {/* 既存要約表示 */}
      <SummaryViewer data={intermediate} overview={overview} hideDetails />

      {/* 深掘りチャット */}
      {!isGenerating && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            {chatMode === 'deepDive' && (
              <div>
                <h3 className="text-lg font-bold">深掘りチャット</h3>
                <p className="text-sm text-gray-600">平易化されたWebページから気になる点を深掘りできます。</p>
              </div>
            )}
            {chatMode === 'intent' && (
              <div className="max-w-xl">
                <h3 className="text-lg font-bold">知りたいことを一文で</h3>
                <p className="text-sm text-gray-600">
                  深掘りの要点を踏まえて、最終的に実施したいことを入力してください。
                </p>
              </div>
            )}
            <div className="ml-auto">
              <select
                id="chat-mode"
                value={chatMode}
                onChange={(event) => {
                  const next = event.target.value as 'deepDive' | 'intent';
                  if (next === 'intent') {
                    handleAdvanceToIntent();
                  } else {
                    setChatMode('deepDive');
                  }
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="deepDive">深掘り</option>
                <option value="intent">意図入力</option>
              </select>
            </div>
          </div>

          {chatMode === 'deepDive' && (
            <>
              <div className="space-y-4 mb-4">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`rounded-lg px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-blue-50 border border-blue-200 text-blue-900'
                        : 'bg-gray-50 border border-gray-200 text-gray-800'
                    }`}
                  >
                    <p className="text-sm font-semibold mb-1">
                      {message.role === 'user' ? 'あなた' : 'AI'}
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

              <div className="flex flex-col sm:flex-row gap-3">
                <textarea
                  value={deepDiveInput}
                  onChange={(event) => setDeepDiveInput(event.target.value)}
                  rows={3}
                  placeholder="例: この制度の対象者の条件をもう少し詳しく知りたい"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSendDeepDive}
                  disabled={isDeepDiveLoading || !deepDiveInput.trim()}
                  className="px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isDeepDiveLoading ? '送信中...' : '送信'}
                </button>
              </div>
            </>
          )}

          {chatMode === 'intent' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={intentInput}
                  onChange={(event) => setIntentInput(event.target.value)}
                  placeholder="例: 私が対象かどうかと申請方法を知りたい"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleConfirmIntent}
                  disabled={!intentInput.trim()}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  意図を確定
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 回答生成開始 */}
      {isGenerating && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-bold mb-2">回答を作成中</h3>
          <p className="text-sm text-gray-700">意図: {intent}</p>
          <p className="text-sm text-gray-500 mt-3">
            回答生成フェーズは準備中です。今後ここで回答が表示されます。
          </p>
        </div>
      )}

      {isGenerating && (
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
