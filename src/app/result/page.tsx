'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';
import Link from 'next/link';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { SummaryViewer } from '@/components/SummaryViewer';
import { ChecklistViewer } from '@/components/ChecklistViewer';
import { SourceReference } from '@/components/SourceReference';
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
  } =
    useAnalyzeStore();
  const lastLoadedHistoryId = useRef<string | null>(null);

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
            checklist: detail.result.checklist || [],
            status: 'success' as const,
          };
          setResult(mergedResult);
          resetCheckedItems(mergedResult.checklist);
          setStatus('success');
          setError(null);
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

      {/* 要約表示 */}
      <SummaryViewer data={intermediate} />

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

      {/* 根拠表示 */}
      <div className="mb-6">
        <SourceReference sources={intermediate.sources} />
      </div>

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
