'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UrlInput } from '@/components/UrlInput';
import { DisclaimerModal } from '@/components/DisclaimerModal';
import { FlowStageIndicator } from '@/components/FlowStageIndicator';
import { deriveFlowStageModel, type FlowStepId } from '@/lib/flow-stage';
import { useAnalyzeStore } from '@/stores/analyzeStore';

const supportedTopics = [
  '児童手当',
  '転入届',
  '介護保険',
  '国民健康保険',
  'パスポート申請',
  '各種届出',
];

export default function AnalyzePage() {
  const router = useRouter();
  const { status, error, analyze, reset } = useAnalyzeStore();
  const redirectRequestedRef = useRef(false);
  const submittedUrlRef = useRef('');

  // 解析成功時に結果ページへ遷移
  useEffect(() => {
    if (status === 'success' && redirectRequestedRef.current) {
      const { lastHistoryId, url } = useAnalyzeStore.getState();
      const targetUrl = submittedUrlRef.current || url;
      const searchParams = new URLSearchParams();
      if (lastHistoryId) {
        searchParams.set('historyId', lastHistoryId);
      }
      if (targetUrl) {
        searchParams.set('url', targetUrl);
      }
      const query = searchParams.toString();
      router.push(query ? `/result?${query}` : '/result');
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
    submittedUrlRef.current = url;
    await analyze(url);
  };

  const flowModel = useMemo(
    () =>
      deriveFlowStageModel({
        analyzeStatus: status,
        isHistoryResolving: false,
        hasIntermediate: false,
        hasIntentInput: false,
        hasIntentGenerationError: false,
        isIntentGenerating: false,
        guidanceUnlocked: false,
        hasChecklistAvailable: false,
        hasChecklistReviewed: false,
        hasDeepDiveMessages: false,
        canStartAnalyzeFromUrl: false,
      }),
    [status]
  );

  const handleFlowNavigation = (stepId: FlowStepId) => {
    if (stepId !== 'analyze_url' || typeof window === 'undefined') {
      return;
    }
    const input = document.getElementById('url-input') as HTMLInputElement | null;
    if (!input) {
      return;
    }
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.focus();
  };

  return (
    <div className="ui-page ui-shell-gap space-y-6">
      <DisclaimerModal />

      <section className="animate-fade-up">
        <h2 className="ui-heading text-2xl sm:text-3xl">行政情報を、短時間で理解する</h2>
        <p className="ui-muted mt-3 max-w-3xl text-sm sm:text-base">
          行政ページのURLを入力すると、AIが要点を再構成し、次の行動がわかる形で提示します。
        </p>
      </section>

      <section className="ui-card-float p-5 sm:p-6">
        <UrlInput onSubmit={handleSubmit} isLoading={status === 'loading'} />

        {status === 'error' && error && (
          <div className="ui-callout ui-callout-error mt-5">{error}</div>
        )}

        <FlowStageIndicator
          model={flowModel}
          className="mt-5"
          onStepSelect={handleFlowNavigation}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="ui-card p-5">
          <p className="ui-badge">1</p>
          <h3 className="ui-heading mt-3 text-base">URLを入力</h3>
          <p className="ui-muted mt-2 text-sm">対象ページのURLを貼り付けます。</p>
        </article>
        <article className="ui-card p-5">
          <p className="ui-badge">2</p>
          <h3 className="ui-heading mt-3 text-base">AIが解析</h3>
          <p className="ui-muted mt-2 text-sm">本文を読み取り、要点を抽出します。</p>
        </article>
        <article className="ui-card p-5">
          <p className="ui-badge">3</p>
          <h3 className="ui-heading mt-3 text-base">結果を確認</h3>
          <p className="ui-muted mt-2 text-sm">チェックリストと補足解説を確認します。</p>
        </article>
      </section>

      <section className="ui-card p-5">
        <h3 className="ui-heading text-base">対応しやすいテーマ例</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {supportedTopics.map((tag) => (
            <span key={tag} className="ui-chip">
              {tag}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
