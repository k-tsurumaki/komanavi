'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import Link from 'next/link';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { FlowStageIndicator } from '@/components/FlowStageIndicator';
import { MypageOnboardingPrompt } from '@/components/MypageOnboardingPrompt';
import { SummaryViewer } from '@/components/SummaryViewer';
import { ChecklistViewer } from '@/components/ChecklistViewer';
import { MangaViewer } from '@/components/MangaViewer';
import { deriveFlowStageModel, type FlowStepId, type MangaFlowState } from '@/lib/flow-stage';
import {
  ANALYZE_ERROR_MESSAGE,
  CHECKLIST_ERROR_MESSAGE,
  DEEP_DIVE_ERROR_MESSAGE,
  INTENT_ANSWER_ERROR_MESSAGE,
} from '@/lib/error-messages';
import { fetchHistoryDetail, patchHistoryResult } from '@/lib/history-api';
import { parseStructuredIntentAnswer } from '@/lib/intent-answer-parser';
import type { IntentAnswerEntry } from '@/lib/intent-answer-parser';
import type {
  ChatMessage,
  ChecklistResponse,
  ChecklistGenerationState,
  ChecklistItem,
  IntentAnswerResponse,
  MangaResult,
} from '@/lib/types/intermediate';
import { useAnalyzeStore } from '@/stores/analyzeStore';

const DEFAULT_CHECKLIST_ERROR_MESSAGE = CHECKLIST_ERROR_MESSAGE;

function ResultContent() {
  const router = useRouter();
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
    reset,
    messages,
    setMessages,
    addMessage,
    setIntent,
    deepDiveSummary,
    setDeepDiveSummary,
    resetDeepDiveState,
    lastHistoryId,
  } = useAnalyzeStore();
  const lastLoadedHistoryId = useRef<string | null>(null);
  const handledResultIdRef = useRef<string | null>(null);
  const pendingHistoryPatchRef = useRef<{
    checklist?: ChecklistItem[];
    userIntent?: string;
    intentAnswer?: string;
    guidanceUnlocked?: boolean;
    checklistState?: ChecklistGenerationState;
    checklistError?: string;
  }>({});
  const patchTimeoutRef = useRef<number | null>(null);
  const [deepDiveInput, setDeepDiveInput] = useState('');
  const [intentInput, setIntentInput] = useState('');
  const [isDeepDiveLoading, setIsDeepDiveLoading] = useState(false);
  const [deepDiveError, setDeepDiveError] = useState<string | null>(null);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [isIntentGenerating, setIsIntentGenerating] = useState(false);
  const [isChecklistRegenerating, setIsChecklistRegenerating] = useState(false);
  const [isIntentLocked, setIsIntentLocked] = useState(false);
  const [chatMode, setChatMode] = useState<'deepDive' | 'intent'>('deepDive');
  const [hasIntentStepVisited, setHasIntentStepVisited] = useState(false);
  const [isHistoryResolving, setIsHistoryResolving] = useState(false);
  const [savedMangaResult, setSavedMangaResult] = useState<MangaResult | null>(null);
  const [hasChecklistReviewed, setHasChecklistReviewed] = useState(false);
  const [hasAnswerReviewed, setHasAnswerReviewed] = useState(false);
  const [mangaAutoTriggered, setMangaAutoTriggered] = useState(false);
  const tabsId = useId();
  const deepDiveTabId = `${tabsId}-deep-dive-tab`;
  const intentTabId = `${tabsId}-intent-tab`;
  const deepDivePanelId = `${tabsId}-deep-dive-panel`;
  const intentPanelId = `${tabsId}-intent-panel`;
  const deepDiveTabButtonRef = useRef<HTMLButtonElement | null>(null);
  const intentTabButtonRef = useRef<HTMLButtonElement | null>(null);
  const intentSubmitButtonRef = useRef<HTMLButtonElement | null>(null);
  const intentTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const summarySectionRef = useRef<HTMLDivElement | null>(null);
  const interactionSectionRef = useRef<HTMLDivElement | null>(null);
  const answerSectionRef = useRef<HTMLDivElement | null>(null);
  const checklistSectionRef = useRef<HTMLDivElement | null>(null);
  const mangaSectionRef = useRef<HTMLDivElement | null>(null);
  const [mangaFlowState, setMangaFlowState] = useState<MangaFlowState>({
    status: 'not_started',
    progress: 0,
    updatedAt: Date.now(),
  });
  const effectiveHistoryId = historyId ?? lastHistoryId;

  const handleBackToHome = () => {
    reset();
  };

  const flushPendingHistoryPatch = useCallback(
    async (options?: { keepalive?: boolean }) => {
      if (!effectiveHistoryId) return;

      if (patchTimeoutRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(patchTimeoutRef.current);
        patchTimeoutRef.current = null;
      }

      const payload = pendingHistoryPatchRef.current;
      pendingHistoryPatchRef.current = {};

      if (Object.keys(payload).length === 0) return;

      try {
        await patchHistoryResult(effectiveHistoryId, payload, options);
      } catch (patchError) {
        pendingHistoryPatchRef.current = {
          ...payload,
          ...pendingHistoryPatchRef.current,
        };
        console.warn('履歴の更新に失敗しました', patchError);
      }
    },
    [effectiveHistoryId]
  );

  const scheduleHistoryPatch = (patch: {
    checklist?: ChecklistItem[];
    userIntent?: string;
    intentAnswer?: string;
    guidanceUnlocked?: boolean;
    checklistState?: ChecklistGenerationState;
    checklistError?: string;
  }) => {
    pendingHistoryPatchRef.current = {
      ...pendingHistoryPatchRef.current,
      ...patch,
    };

    if (!effectiveHistoryId || typeof window === 'undefined') return;

    if (patchTimeoutRef.current !== null) {
      window.clearTimeout(patchTimeoutRef.current);
    }

    // チェックボックスの連打時に書き込みをまとめる
    patchTimeoutRef.current = window.setTimeout(() => {
      void flushPendingHistoryPatch();
    }, 450);
  };

  useEffect(() => {
    return () => {
      void flushPendingHistoryPatch({ keepalive: true });
    };
  }, [flushPendingHistoryPatch]);

  useEffect(() => {
    if (!effectiveHistoryId) return;
    if (Object.keys(pendingHistoryPatchRef.current).length === 0) return;
    void flushPendingHistoryPatch();
  }, [effectiveHistoryId, flushPendingHistoryPatch]);

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
            userIntent: detail.result.userIntent,
            intentAnswer: detail.result.intentAnswer,
            guidanceUnlocked: detail.result.guidanceUnlocked ?? false,
            overview: detail.result.overview,
            checklist: detail.result.checklist || [],
            checklistState: detail.result.checklistState,
            checklistError: detail.result.checklistError,
            status: 'success' as const,
          };
          setResult(mergedResult);
          setStatus('success');
          setError(null);
          resetDeepDiveState();

          // 漫画データを復元
          if (detail.manga?.result) {
            setSavedMangaResult(detail.manga.result);
            setMangaFlowState({
              status: 'completed',
              progress: 100,
              updatedAt: Date.now(),
            });
          } else {
            setSavedMangaResult(null);
            setMangaFlowState({
              status: 'not_started',
              progress: 0,
              updatedAt: Date.now(),
            });
          }

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
  }, [analyze, historyId, resetDeepDiveState, setError, setResult, setStatus, setUrl, url]);

  useEffect(() => {
    if (!result?.id || handledResultIdRef.current === result.id) return;
    handledResultIdRef.current = result.id;
    setChatMode('deepDive');
    setIsIntentGenerating(false);
    const restoredIntent = result.userIntent ?? '';
    setHasIntentStepVisited(Boolean(restoredIntent.trim()));
    setIntentInput(restoredIntent);
    setIntent(restoredIntent);
  }, [result?.id, result?.userIntent, setIntent]);

  useEffect(() => {
    if (!result?.id) return;
    setIsIntentLocked(Boolean(result.guidanceUnlocked));
  }, [result?.id, result?.guidanceUnlocked]);

  useEffect(() => {
    if (!result?.id) {
      return;
    }
    if (savedMangaResult) {
      setMangaFlowState({
        status: 'completed',
        progress: 100,
        updatedAt: Date.now(),
      });
      return;
    }
    setMangaFlowState({
      status: 'not_started',
      progress: 0,
      updatedAt: Date.now(),
    });
  }, [result?.id, savedMangaResult]);

  useEffect(() => {
    if (!result?.id) {
      return;
    }
    setHasAnswerReviewed(false);
    setHasChecklistReviewed(false);
    setMangaAutoTriggered(false);
  }, [result?.id]);

  const hasIntermediate = Boolean(result?.intermediate);
  const guidanceUnlocked = Boolean(result?.guidanceUnlocked);
  const checklistState = result?.checklistState ?? (guidanceUnlocked ? 'ready' : 'not_requested');
  const hasChecklistError = checklistState === 'error';
  const hasIntentInput = Boolean(intentInput.trim() || result?.userIntent?.trim());
  const hasAnswerAvailable = Boolean(result?.intentAnswer?.trim());
  const hasChecklistAvailable = Boolean(result?.checklist?.length) && !hasChecklistError;
  const canAnalyzeFromUrl = Boolean(
    url && status === 'idle' && !isHistoryResolving && !hasIntermediate
  );
  const hasIntentGenerationError = Boolean(intentError && !isIntentGenerating && !guidanceUnlocked);
  const shouldObserveAnswer = Boolean(
    guidanceUnlocked && !isIntentGenerating && hasAnswerAvailable && !hasAnswerReviewed
  );
  const shouldObserveChecklist = Boolean(
    guidanceUnlocked && !isIntentGenerating && hasChecklistAvailable && !hasChecklistReviewed
  );

  const flowModel = useMemo(
    () =>
      deriveFlowStageModel({
        analyzeStatus: status,
        isHistoryResolving,
        hasIntermediate,
        hasMangaSurfaceAvailable: Boolean(effectiveHistoryId),
        hasIntentInput,
        hasAnswerAvailable,
        hasAnswerReviewed,
        hasIntentStepVisited,
        hasDeepDiveStepVisited: chatMode === 'deepDive',
        hasIntentGenerationError,
        isIntentGenerating,
        guidanceUnlocked,
        hasChecklistAvailable,
        hasChecklistError,
        hasChecklistReviewed,
        hasDeepDiveMessages: messages.length > 0,
        canStartAnalyzeFromUrl: canAnalyzeFromUrl,
        manga: mangaFlowState,
      }),
    [
      canAnalyzeFromUrl,
      effectiveHistoryId,
      guidanceUnlocked,
      hasAnswerAvailable,
      hasAnswerReviewed,
      hasChecklistAvailable,
      hasChecklistError,
      hasChecklistReviewed,
      chatMode,
      hasIntentGenerationError,
      hasIntentInput,
      hasIntentStepVisited,
      hasIntermediate,
      isHistoryResolving,
      isIntentGenerating,
      mangaFlowState,
      messages.length,
      status,
    ]
  );

  useEffect(() => {
    if (!shouldObserveAnswer || !answerSectionRef.current || typeof window === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setHasAnswerReviewed(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(answerSectionRef.current);

    return () => {
      observer.disconnect();
    };
  }, [shouldObserveAnswer]);

  useEffect(() => {
    if (!shouldObserveChecklist || !checklistSectionRef.current || typeof window === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setHasChecklistReviewed(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(checklistSectionRef.current);

    return () => {
      observer.disconnect();
    };
  }, [shouldObserveChecklist]);

  // 意図入力完了後に自動で漫画生成を開始
  useEffect(() => {
    if (
      guidanceUnlocked &&
      !isIntentGenerating &&
      !mangaAutoTriggered &&
      savedMangaResult === null &&
      mangaFlowState.status === 'not_started'
    ) {
      setMangaAutoTriggered(true);
    }
  }, [
    guidanceUnlocked,
    isIntentGenerating,
    mangaAutoTriggered,
    savedMangaResult,
    mangaFlowState.status,
  ]);

  const scrollToSection = useCallback((target: HTMLElement | null) => {
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleFlowStepNavigation = useCallback(
    (stepId: FlowStepId) => {
      if (stepId === 'analyze_url') {
        if (canAnalyzeFromUrl && url) {
          void analyze(url);
          return;
        }
        reset();
        router.push('/analyze');
        return;
      }

      if (stepId === 'review_summary') {
        scrollToSection(summarySectionRef.current);
        return;
      }

      if (stepId === 'input_intent') {
        setHasIntentStepVisited(true);
        setChatMode('intent');
        scrollToSection(interactionSectionRef.current);
        window.setTimeout(() => {
          intentTextareaRef.current?.focus();
        }, 0);
        return;
      }

      if (stepId === 'generate_answer') {
        if (guidanceUnlocked && !isIntentGenerating) {
          if (hasAnswerAvailable) {
            scrollToSection(answerSectionRef.current);
          } else {
            setHasIntentStepVisited(true);
            setChatMode('intent');
            setIsIntentLocked(false);
            scrollToSection(interactionSectionRef.current);
            window.setTimeout(() => {
              intentTextareaRef.current?.focus();
            }, 0);
          }
          return;
        }
        setHasIntentStepVisited(true);
        setChatMode('intent');
        scrollToSection(interactionSectionRef.current);
        window.setTimeout(() => {
          intentSubmitButtonRef.current?.focus();
        }, 0);
        return;
      }

      if (stepId === 'review_checklist') {
        if (!hasChecklistError) {
          setHasChecklistReviewed(true);
        }
        scrollToSection(checklistSectionRef.current);
        return;
      }

      if (stepId === 'deep_dive') {
        setChatMode('deepDive');
        scrollToSection(interactionSectionRef.current);
        window.setTimeout(() => {
          deepDiveTabButtonRef.current?.focus();
        }, 0);
        return;
      }

      if (stepId === 'manga_review') {
        scrollToSection(mangaSectionRef.current);
      }
    },
    [
      analyze,
      canAnalyzeFromUrl,
      guidanceUnlocked,
      hasAnswerAvailable,
      hasChecklistError,
      isIntentGenerating,
      reset,
      router,
      scrollToSection,
      url,
    ]
  );

  const renderFlowIndicator = () => (
    <FlowStageIndicator
      model={flowModel}
      className="mb-5"
      onStepSelect={handleFlowStepNavigation}
    />
  );

  if (!historyId && !url && !result) {
    return (
      <div className="ui-page ui-shell-gap">
        {renderFlowIndicator()}
        <div className="ui-card ui-panel-error rounded-2xl p-6 text-center">
          <p className="mb-4 text-stone-900">URLが指定されていません</p>
          <Link
            href="/analyze"
            onClick={handleBackToHome}
            className="ui-btn ui-btn-primary px-6 py-2 text-sm !text-white"
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
      <div className="ui-page ui-shell-gap">
        {renderFlowIndicator()}
        <div className="flex flex-col items-center justify-center py-12">
          <div className="ui-spinner mb-4 h-12 w-12 animate-spin rounded-full border-2" />
          <p className="text-lg text-slate-700">ページを解析しています...</p>
          <p className="mt-2 text-sm text-slate-500">（30秒〜1分程度かかります）</p>
        </div>
      </div>
    );
  }

  // エラー
  if (status === 'error') {
    return (
      <div className="ui-page ui-shell-gap">
        {renderFlowIndicator()}
        <div className="ui-card ui-panel-error rounded-2xl p-6 text-center">
          <p className="mb-4 text-stone-900">{error || ANALYZE_ERROR_MESSAGE}</p>
          <Link
            href="/analyze"
            onClick={handleBackToHome}
            className="ui-btn ui-btn-primary px-6 py-2 text-sm !text-white"
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
      <div className="ui-page ui-shell-gap">
        {renderFlowIndicator()}
        <div className="flex flex-col items-center justify-center py-12">
          {canAnalyzeFromUrl ? (
            <div className="ui-card max-w-xl rounded-2xl p-6 text-center">
              <p className="text-lg font-semibold text-slate-800">
                このURLの結果はまだ表示されていません
              </p>
              {error && <p className="mt-2 text-sm text-stone-700">{error}</p>}
              <p className="mt-2 text-sm text-slate-600">
                自動では解析しません。必要な場合のみ手動で解析を開始してください。
              </p>
              <button
                type="button"
                onClick={() => {
                  if (url) {
                    analyze(url);
                  }
                }}
                className="ui-btn ui-btn-primary mt-4 px-5 py-2.5 text-sm !text-white"
              >
                このURLを解析する
              </button>
            </div>
          ) : (
            <>
              <div className="ui-spinner mb-4 h-12 w-12 animate-spin rounded-full border-2" />
              <p className="text-lg text-slate-700">データを読み込んでいます...</p>
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
    ? result.intentAnswer
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
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
  const shouldShowGuidanceSection = guidanceUnlocked || isIntentGenerating;
  const shouldShowChecklistSection = guidanceUnlocked && !isIntentGenerating;
  const checklistErrorMessage = result.checklistError || DEFAULT_CHECKLIST_ERROR_MESSAGE;

  const handleChecklistToggle = (id: string, completed: boolean) => {
    setHasChecklistReviewed(true);
    const nextChecklist = checklist.map((item) => (item.id === id ? { ...item, completed } : item));
    setResult({
      ...result,
      checklist: nextChecklist,
    });
    scheduleHistoryPatch({ checklist: nextChecklist });
  };

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
        throw new Error(errorData.error || DEEP_DIVE_ERROR_MESSAGE);
      }

      const data = (await response.json()) as {
        status: 'success' | 'error';
        answer?: string;
        summary?: string;
        error?: string;
      };

      if (data.status === 'error') {
        throw new Error(data.error || DEEP_DIVE_ERROR_MESSAGE);
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
      setDeepDiveError(err instanceof Error ? err.message : DEEP_DIVE_ERROR_MESSAGE);
    } finally {
      setIsDeepDiveLoading(false);
    }
  };

  const handleAdvanceToIntent = () => {
    setHasIntentStepVisited(true);
    setChatMode('intent');
  };

  const handleChatTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    let nextMode: 'deepDive' | 'intent' | null = null;

    if (event.key === 'ArrowRight') {
      nextMode = chatMode === 'deepDive' ? 'intent' : 'deepDive';
    } else if (event.key === 'ArrowLeft') {
      nextMode = chatMode === 'intent' ? 'deepDive' : 'intent';
    } else if (event.key === 'Home') {
      nextMode = 'deepDive';
    } else if (event.key === 'End') {
      nextMode = 'intent';
    }

    if (!nextMode) {
      return;
    }

    event.preventDefault();
    if (nextMode === 'intent') {
      setHasIntentStepVisited(true);
    }
    setChatMode(nextMode);
    if (nextMode === 'deepDive') {
      deepDiveTabButtonRef.current?.focus();
      return;
    }
    intentTabButtonRef.current?.focus();
  };

  const handleConfirmIntent = async () => {
    if (!intentInput.trim() || !result?.intermediate || isIntentGenerating) return;
    const trimmedIntent = intentInput.trim();
    const wasGuidanceUnlocked = Boolean(result.guidanceUnlocked);
    setHasAnswerReviewed(false);
    setIntentInput(trimmedIntent);
    setIntent(trimmedIntent);
    setIntentError(null);
    setDeepDiveError(null);
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
        throw new Error(payload.error || INTENT_ANSWER_ERROR_MESSAGE);
      }

      const nextChecklistState = payload.checklistState ?? 'ready';
      const generatedChecklist =
        nextChecklistState === 'ready' ? (payload.checklist ?? []) : result.checklist;
      const nextChecklistError =
        nextChecklistState === 'error'
          ? payload.checklistError || DEFAULT_CHECKLIST_ERROR_MESSAGE
          : undefined;

      const updatedIntermediate = payload.intermediate || result.intermediate;

      setResult({
        ...result,
        userIntent: trimmedIntent,
        intentAnswer: payload.intentAnswer,
        checklist: generatedChecklist,
        checklistState: nextChecklistState,
        checklistError: nextChecklistError,
        guidanceUnlocked: true,
        intermediate: updatedIntermediate,
      });
      setHasChecklistReviewed(false);
      setIsIntentGenerating(false);
      setIsIntentLocked(true);

      const historyPatch = {
        ...(nextChecklistState === 'ready' ? { checklist: generatedChecklist } : {}),
        userIntent: trimmedIntent,
        intentAnswer: payload.intentAnswer,
        guidanceUnlocked: true,
        checklistState: nextChecklistState,
        checklistError: nextChecklistError,
        intermediate: updatedIntermediate,
      };

      if (effectiveHistoryId) {
        void patchHistoryResult(effectiveHistoryId, historyPatch).catch((patchError) => {
          scheduleHistoryPatch(historyPatch);
          setIntentError('回答は生成されましたが、履歴の保存に失敗しました');
          console.warn('意図回答の履歴保存に失敗しました', patchError);
        });
      } else {
        scheduleHistoryPatch(historyPatch);
      }
    } catch (err) {
      setIntentError(err instanceof Error ? err.message : INTENT_ANSWER_ERROR_MESSAGE);
      setIsIntentGenerating(false);
      setIsIntentLocked(wasGuidanceUnlocked);
    }
  };

  const handleRegenerateChecklist = async () => {
    if (!result?.intermediate || isIntentGenerating || isChecklistRegenerating) {
      return;
    }

    const retryIntent = (result.userIntent || intentInput).trim();
    if (!retryIntent) {
      setIntentError('チェックリストを再生成するには意図の入力が必要です');
      return;
    }

    setIntentError(null);
    setIsChecklistRegenerating(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'checklist',
          userIntent: retryIntent,
          intermediate: result.intermediate,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as ChecklistResponse;
      if (!response.ok || payload.status === 'error') {
        throw new Error(payload.error || DEFAULT_CHECKLIST_ERROR_MESSAGE);
      }

      const nextChecklistState = payload.checklistState ?? 'ready';
      const generatedChecklist =
        nextChecklistState === 'ready' ? (payload.checklist ?? []) : result.checklist;
      const nextChecklistError =
        nextChecklistState === 'error'
          ? payload.checklistError || DEFAULT_CHECKLIST_ERROR_MESSAGE
          : undefined;

      setResult({
        ...result,
        checklist: generatedChecklist,
        checklistState: nextChecklistState,
        checklistError: nextChecklistError,
        userIntent: retryIntent,
      });
      if (nextChecklistState === 'ready') {
        setHasChecklistReviewed(false);
      }

      const historyPatch = {
        ...(nextChecklistState === 'ready' ? { checklist: generatedChecklist } : {}),
        userIntent: retryIntent,
        checklistState: nextChecklistState,
        checklistError: nextChecklistError,
      };

      if (effectiveHistoryId) {
        void patchHistoryResult(effectiveHistoryId, historyPatch).catch((patchError) => {
          scheduleHistoryPatch(historyPatch);
          setIntentError('チェックリストは更新されましたが、履歴の保存に失敗しました');
          console.warn('チェックリスト更新の履歴保存に失敗しました', patchError);
        });
      } else {
        scheduleHistoryPatch(historyPatch);
      }
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : DEFAULT_CHECKLIST_ERROR_MESSAGE;
      setResult({
        ...result,
        userIntent: retryIntent,
        checklistState: 'error',
        checklistError: message,
      });
      scheduleHistoryPatch({
        userIntent: retryIntent,
        checklistState: 'error',
        checklistError: message,
      });
    } finally {
      setIsChecklistRegenerating(false);
    }
  };

  const renderAnswerEntryCard = (
    title: string,
    entry: IntentAnswerEntry,
    toneClassName = 'border-stone-200 bg-white'
  ) => (
    <section className={`rounded-xl border p-4 ${toneClassName}`}>
      <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-900">{entry.text}</p>
    </section>
  );

  const canShowIntentEditButton = guidanceUnlocked && isIntentLocked && !isIntentGenerating;

  return (
    <div className="ui-page ui-shell-gap">
      <MypageOnboardingPrompt enabled />
      {renderFlowIndicator()}
      <DisclaimerBanner
        sourceUrl={intermediate.metadata.source_url}
        fetchedAt={intermediate.metadata.fetched_at}
      />

      <div ref={summarySectionRef}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="ui-heading text-lg">1分でわかる要点ガイド</h3>
        </div>

        <SummaryViewer data={intermediate} overview={overview} hideDetails />
      </div>

      <div
        ref={interactionSectionRef}
        className="group ui-chat-window relative mb-6 px-6 pb-3 pt-6"
      >
        <div className="absolute right-6 top-6">
          <div
            role="tablist"
            aria-label="回答モードの切り替え"
            className="inline-flex rounded-full border border-stone-300 bg-[#fcfbfa]/90 p-1 text-xs font-semibold text-stone-700"
          >
            <button
              ref={deepDiveTabButtonRef}
              type="button"
              id={deepDiveTabId}
              role="tab"
              aria-selected={chatMode === 'deepDive'}
              aria-controls={deepDivePanelId}
              tabIndex={chatMode === 'deepDive' ? 0 : -1}
              onKeyDown={handleChatTabKeyDown}
              onClick={() => setChatMode('deepDive')}
              className={`px-3 py-1 rounded-full transition ${
                chatMode === 'deepDive' ? 'bg-stone-100 text-stone-900 shadow-sm' : 'text-stone-600'
              }`}
            >
              深掘り
            </button>
            <button
              ref={intentTabButtonRef}
              type="button"
              id={intentTabId}
              role="tab"
              aria-selected={chatMode === 'intent'}
              aria-controls={intentPanelId}
              tabIndex={chatMode === 'intent' ? 0 : -1}
              onKeyDown={handleChatTabKeyDown}
              onClick={handleAdvanceToIntent}
              className={`px-3 py-1 rounded-full transition ${
                chatMode === 'intent' ? 'bg-stone-100 text-stone-900 shadow-sm' : 'text-stone-600'
              }`}
            >
              意図入力
            </button>
          </div>
        </div>
        <div
          id={deepDivePanelId}
          role="tabpanel"
          aria-labelledby={deepDiveTabId}
          hidden={chatMode !== 'deepDive'}
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4 pr-24">
            <div>
              <h3 className="ui-heading text-lg">気になる点を深掘り</h3>
              <p className="mt-1 text-sm text-slate-600">
                「ここが分からない」をAIアシスタントに質問して解消しましょう。
              </p>
            </div>
          </div>

          <div className="mb-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-xl px-4 py-3 border ${
                  message.role === 'user'
                    ? 'bg-stone-100 border-stone-300 text-stone-900'
                    : 'bg-[#fcfbfa] border-stone-300 text-stone-800'
                }`}
              >
                <p className="mb-1 text-xs font-semibold tracking-wide">
                  {message.role === 'user' ? 'あなた' : 'AIアシスタント'}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
              </div>
            ))}
          </div>

          {deepDiveError && <div className="ui-callout ui-callout-error mb-4">{deepDiveError}</div>}

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
              className="ui-textarea w-full resize-none pr-14 text-sm"
            />
            <button
              type="button"
              onClick={handleSendDeepDive}
              disabled={isDeepDiveLoading || !deepDiveInput.trim()}
              className="absolute bottom-3 right-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-stone-900 text-white shadow-sm hover:bg-stone-800 disabled:opacity-50"
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
        </div>

        <div
          id={intentPanelId}
          role="tabpanel"
          aria-labelledby={intentTabId}
          hidden={chatMode !== 'intent'}
          className="space-y-0"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4 pr-24">
            <div className="max-w-xl">
              <h3 className="ui-heading text-lg">最終的に実現したいことを一文で</h3>
              <p className="mt-1 text-sm text-slate-600">
                実現したいことを入力すると、具体的なチェックリストと漫画が提供されます。
              </p>
            </div>
          </div>

          <div className="relative">
            <textarea
              ref={intentTextareaRef}
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
              className="ui-textarea w-full resize-none pr-14 text-sm disabled:bg-stone-100 disabled:text-stone-500"
            />
            <button
              ref={intentSubmitButtonRef}
              type="button"
              onClick={handleConfirmIntent}
              disabled={isIntentGenerating || isIntentLocked || !intentInput.trim()}
              className="absolute bottom-3 right-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-stone-900 text-white shadow-sm hover:bg-stone-800 disabled:opacity-50"
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
          {intentError && <div className="ui-callout ui-callout-error mt-3">{intentError}</div>}
          {canShowIntentEditButton && (
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
          )}
        </div>
      </div>

      {/* 漫画ビューア - 回答の上に表示 */}
      {shouldShowChecklistSection && effectiveHistoryId && (
        <div ref={mangaSectionRef} className="mb-6">
          <MangaViewer
            url={intermediate.metadata.source_url}
            title={intermediate.title}
            summary={intermediate.summary}
            keyPoints={intermediate.keyPoints?.map((point) => point.text)}
            resultId={result.id}
            historyId={effectiveHistoryId}
            initialMangaResult={savedMangaResult}
            onFlowStateChange={setMangaFlowState}
            autoGenerate={mangaAutoTriggered}
            intermediate={intermediate}
            userIntent={result.userIntent}
          />
        </div>
      )}

      {/* 回答生成開始 */}
      {shouldShowGuidanceSection && (
        <div ref={answerSectionRef} className="ui-card mb-6 rounded-2xl border-stone-300/80 bg-stone-50/60 p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center">
              <div>
                <h3 className="ui-heading text-lg">回答</h3>
                <p className="text-xs text-slate-600">あなたの意図とプロフィール情報に基づく回答</p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-stone-300 bg-white p-4">
            {!isIntentGenerating && result.intentAnswer ? (
              structuredIntentAnswer ? (
                <div className="space-y-3.5">
                  <section className="relative overflow-hidden rounded-xl border border-stone-400 bg-white px-4 py-4 pl-7 shadow-[0_12px_28px_rgba(38,8,1,0.08)]">
                    <span
                      aria-hidden="true"
                      className="absolute bottom-3 left-3 top-3 w-1 rounded-full bg-stone-500/70"
                    />
                    <h4 className="text-sm font-semibold text-slate-700">結論</h4>
                    <p className="mt-2.5 text-[16px] font-semibold leading-relaxed text-slate-900 sm:text-[17px]">
                      {structuredIntentAnswer.headline}
                    </p>
                  </section>

                  {renderAnswerEntryCard(
                    'あなたは対象になりそうですか？',
                    structuredIntentAnswer.finalJudgment,
                    'border-stone-300 bg-white'
                  )}
                  {renderAnswerEntryCard(
                    '最優先の1手',
                    structuredIntentAnswer.firstPriorityAction,
                    'border-stone-300 bg-white'
                  )}

                  <section className="rounded-xl border border-stone-300 bg-stone-50 p-4">
                    <h4 className="text-sm font-semibold text-stone-900">
                      見落とすと申請で困るポイント
                    </h4>
                    <ul className="mt-3 space-y-2.5">
                      {structuredIntentAnswer.failureRisks.map((risk, index) => (
                        <li
                          key={`failure-risk-${index}`}
                          className="flex items-start gap-2.5 rounded-lg border border-stone-200 bg-white px-3 py-2.5"
                        >
                          <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-stone-200 text-[11px] font-semibold text-stone-800">
                            {index + 1}
                          </span>
                          <p className="text-sm leading-relaxed text-slate-900">{risk.text}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              ) : (
                <div className="space-y-3 text-sm leading-relaxed text-slate-800">
                  {rawIntentAnswerLines.length > 1 ? (
                    <ul className="space-y-2">
                      {rawIntentAnswerLines.map((line, index) => (
                        <li
                          key={index}
                          className="flex gap-2 rounded-lg border border-stone-200 bg-stone-50/60 px-3 py-2.5"
                        >
                          <span
                            className="mt-1 inline-flex h-1.5 w-1.5 rounded-full bg-stone-500"
                            aria-hidden="true"
                          />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-lg border border-stone-200 bg-stone-50/60 px-3 py-2.5">
                      {result.intentAnswer}
                    </p>
                  )}
                </div>
              )
            ) : isIntentGenerating ? (
              <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/70 px-4 py-3">
                <p className="text-sm text-slate-700">
                  あなた向けの回答を作成しています。まもなくご確認いただけます。
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-stone-500/70" />
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50/60 px-4 py-3 text-sm text-slate-600">
                回答はまだ生成されていません。意図を入力して生成してください。
              </p>
            )}
          </div>
        </div>
      )}

      {/* チェックリスト */}
      {shouldShowChecklistSection && (
        <div ref={checklistSectionRef} className="mb-6">
          {hasChecklistError ? (
            <div className="ui-card ui-panel-error rounded-2xl p-6">
              <h3 className="ui-heading text-lg">チェックリストの生成に失敗しました</h3>
              <p className="mt-2 text-sm text-stone-800">{checklistErrorMessage}</p>
              <button
                type="button"
                onClick={() => {
                  void handleRegenerateChecklist();
                }}
                disabled={
                  isChecklistRegenerating ||
                  isIntentGenerating ||
                  !result?.intermediate ||
                  !(result.userIntent?.trim() || intentInput.trim())
                }
                className="ui-btn ui-btn-primary mt-4 px-5 py-2 text-sm !text-white disabled:opacity-50"
              >
                {isChecklistRegenerating
                  ? 'チェックリストを再生成中...'
                  : 'チェックリストを再生成する'}
              </button>
            </div>
          ) : (
            <ChecklistViewer items={checklist} onToggle={handleChecklistToggle} />
          )}
        </div>
      )}

      {/* フィードバックセクション */}
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <div className="ui-page ui-shell-gap">
          <div className="flex items-center justify-center py-12">
            <div className="ui-spinner h-12 w-12 animate-spin rounded-full border-2" />
          </div>
        </div>
      }
    >
      <ResultContent />
    </Suspense>
  );
}
