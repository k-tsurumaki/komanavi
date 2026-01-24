'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UrlInput } from '@/components/UrlInput';
import { DisclaimerModal } from '@/components/DisclaimerModal';
import { useAnalyzeStore } from '@/stores/analyzeStore';

export default function AnalyzePage() {
  const router = useRouter();
  const { status, error, analyze, reset } = useAnalyzeStore();
  const redirectRequestedRef = useRef(false);

  // 解析成功時に結果ページへ遷移
  useEffect(() => {
    if (status === 'success' && redirectRequestedRef.current) {
      const url = useAnalyzeStore.getState().url;
      const encodedUrl = encodeURIComponent(url);
      router.push(`/result?url=${encodedUrl}`);
    }
  }, [status, router]);

  // 成功/エラー状態でページに戻ってきた場合のみリセット（新規解析用）
  useEffect(() => {
    if ((status === 'success' || status === 'error') && !redirectRequestedRef.current) {
      reset();
    }
  }, [status, reset]);

  const handleSubmit = async (url: string) => {
    redirectRequestedRef.current = true;
    await analyze(url);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 免責同意モーダル */}
      <DisclaimerModal />

      {/* ヒーローセクション */}
      <section className="text-center mb-12">
        <h2 className="text-3xl font-bold mb-4">行政情報をわかりやすく</h2>
        <p className="text-lg text-gray-600 mb-2">
          難しい行政ページのURLを入力するだけで、
          <br className="hidden sm:inline" />
          わかりやすい要約とやることリストを作成します。
        </p>
      </section>

      {/* URL入力フォーム */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-12">
        <UrlInput onSubmit={handleSubmit} isLoading={status === 'loading'} />

        {/* ローディング表示 */}
        {status === 'loading' && (
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-4 bg-blue-50 rounded-lg">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              <span className="text-blue-700">
                ページを解析しています...<br />
                <span className="text-sm text-blue-600">（30秒〜1分程度かかります）</span>
              </span>
            </div>
          </div>
        )}

        {/* エラー表示 */}
        {status === 'error' && error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}
      </section>

      {/* 使い方説明 */}
      <section className="mb-12">
        <h3 className="text-xl font-bold mb-6 text-center">使い方</h3>
        <div className="grid sm:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg p-6 text-center border border-gray-200">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">1</span>
            </div>
            <h4 className="font-bold mb-2">URLを入力</h4>
            <p className="text-gray-600 text-base">
              調べたい行政ページのURLをコピーして貼り付けます
            </p>
          </div>
          <div className="bg-white rounded-lg p-6 text-center border border-gray-200">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">2</span>
            </div>
            <h4 className="font-bold mb-2">AIが解析</h4>
            <p className="text-gray-600 text-base">
              AIがページの内容を読み取り、要点を抽出します
            </p>
          </div>
          <div className="bg-white rounded-lg p-6 text-center border border-gray-200">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">3</span>
            </div>
            <h4 className="font-bold mb-2">結果を確認</h4>
            <p className="text-gray-600 text-base">
              わかりやすい要約とやることリストを確認できます
            </p>
          </div>
        </div>
      </section>

      {/* 対応例 */}
      <section>
        <h3 className="text-xl font-bold mb-6 text-center">こんな情報に対応</h3>
        <div className="flex flex-wrap justify-center gap-3">
          {['児童手当', '転入届', '介護保険', '国民健康保険', 'パスポート申請', '各種届出'].map(
            (tag) => (
              <span
                key={tag}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-base"
              >
                {tag}
              </span>
            )
          )}
        </div>
      </section>
    </div>
  );
}
