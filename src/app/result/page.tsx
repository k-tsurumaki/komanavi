'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { SummaryViewer } from '@/components/SummaryViewer';
import { ChecklistViewer } from '@/components/ChecklistViewer';
import { SourceReference } from '@/components/SourceReference';
import { MangaViewer } from '@/components/MangaViewer';
import { FeedbackSection } from '@/components/FeedbackSection';
import { useAnalyzeStore } from '@/stores/analyzeStore';

function ResultContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get('url');
  const { result, status, error, analyze } = useAnalyzeStore();

  // URLパラメータがあり、まだ解析結果がない場合は解析を実行
  useEffect(() => {
    if (url && !result && status === 'idle') {
      analyze(url);
    }
  }, [url, result, status, analyze]);

  if (!url) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 mb-4">URLが指定されていません</p>
          <Link
            href="/"
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
            href="/"
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
      {/* 戻るリンク */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 mb-6"
      >
        <span aria-hidden="true">←</span>
        新しいURLを解析
      </Link>
      <Link
        href="/history"
        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 mb-6 ml-4"
      >
        履歴を見る
      </Link>

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
      <FeedbackSection url={intermediate.metadata.source_url} resultId={result.id} />
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
