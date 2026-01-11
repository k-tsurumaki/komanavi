'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { SummaryViewer } from '@/components/SummaryViewer';
import { ChecklistViewer } from '@/components/ChecklistViewer';
import { SourceReference } from '@/components/SourceReference';
import {
  sampleAnalyzeResult,
  sampleBenefitSummaryMarkdown,
} from '@/lib/mocks/sampleData';

function ResultContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get('url');

  // TODO: 実際のAPI呼び出しに置き換える
  // 現時点ではモックデータを使用
  const result = sampleAnalyzeResult;
  const { intermediate, checklist } = result;

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

      {/* 免責バナー */}
      <DisclaimerBanner
        sourceUrl={intermediate.metadata.source_url}
        fetchedAt={intermediate.metadata.fetched_at}
      />

      {/* 要約表示 */}
      <SummaryViewer data={intermediate} summaryMarkdown={sampleBenefitSummaryMarkdown} />

      {/* チェックリスト */}
      <div className="mb-6">
        <ChecklistViewer items={checklist} />
      </div>

      {/* 根拠表示 */}
      <div className="mb-6">
        <SourceReference sources={intermediate.sources} />
      </div>

      {/* フィードバックセクション */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 text-center">
        <p className="text-gray-700 mb-3">この情報は正しいですか？</p>
        <div className="flex justify-center gap-4">
          <button
            className="px-6 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
            onClick={() => alert('フィードバックありがとうございます！')}
          >
            👍 はい
          </button>
          <button
            className="px-6 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            onClick={() => alert('ご報告ありがとうございます。改善に努めます。')}
          >
            👎 いいえ
          </button>
        </div>
      </div>
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
