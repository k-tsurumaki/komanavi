'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { trackClientEvent } from '@/lib/client-analytics';
import {
  hasSeenStrongBannerInSession,
  isSessionSuppressed,
  markStrongBannerShownInSession,
  setSessionSuppressed,
} from '@/lib/mypage-onboarding';

type MypageOnboardingPromptProps = {
  enabled: boolean;
};

type ProfileResponse = {
  displayName: string;
  birthDate: string | null;
  gender: string;
  occupation: string;
  nationality: string;
  location: string;
  visualTraits: string;
  personality: string;
};

const BANNER_SHOW_DELAY_MS = 4000;
const EVENT_CONTEXT = {
  entry_point: 'result',
  surface: 'mypage_onboarding',
} as const;

function hasValue(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasMypageStarted(profile: ProfileResponse): boolean {
  if (hasValue(profile.displayName)) return true;
  if (hasValue(profile.birthDate)) return true;
  if (hasValue(profile.gender)) return true;
  if (hasValue(profile.occupation)) return true;
  if (hasValue(profile.location)) return true;
  if (hasValue(profile.visualTraits)) return true;
  if (hasValue(profile.personality)) return true;
  return false;
}

export function MypageOnboardingPrompt({ enabled }: MypageOnboardingPromptProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isStrongBannerVisible, setIsStrongBannerVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStartPending, setIsStartPending] = useState(false);
  const [profileGate, setProfileGate] = useState<{
    resolvedFor: string | null;
    shouldOffer: boolean | null;
  }>({
    resolvedFor: null,
    shouldOffer: null,
  });
  const startButtonRef = useRef<HTMLButtonElement | null>(null);
  const hasTrackedCompactImpressionRef = useRef(false);

  const userKey = useMemo(() => {
    const userId = session?.user?.id;
    return userId ? userId : null;
  }, [session?.user?.id]);

  const isAuthReady = enabled && status === 'authenticated' && Boolean(userKey);
  const isProfileResolvedForUser = isAuthReady && profileGate.resolvedFor === userKey;
  const shouldOffer = isProfileResolvedForUser && profileGate.shouldOffer === true;
  const isSuppressedInSession = userKey ? isSessionSuppressed(userKey) : false;
  const hasSeenStrongInSession = userKey ? hasSeenStrongBannerInSession(userKey) : false;

  const handleSkip = useCallback(
    (
      eventName:
        | 'banner_close'
        | 'modal_secondary_click'
        | 'modal_close'
        | 'compact_link_close'
    ) => {
      if (userKey) {
        setSessionSuppressed(userKey);
      }

      trackClientEvent(eventName, EVENT_CONTEXT);
      setIsStrongBannerVisible(false);
      setIsModalOpen(false);
      setIsStartPending(false);
    },
    [userKey]
  );

  const handleOpenModal = useCallback((eventName: 'banner_click' | 'compact_link_click') => {
    trackClientEvent(eventName, EVENT_CONTEXT);
    setIsStrongBannerVisible(false);
    setIsModalOpen(true);
  }, []);

  const handleStartFlow = useCallback(() => {
    if (isStartPending) {
      return;
    }

    setIsStartPending(true);
    trackClientEvent('modal_primary_click', EVENT_CONTEXT);

    try {
      trackClientEvent('flow_start_success', EVENT_CONTEXT);
      setIsModalOpen(false);
      setIsStrongBannerVisible(false);
      router.push('/mypage?flow=create&step=1');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      trackClientEvent('flow_start_fail', {
        ...EVENT_CONTEXT,
        error_message: message,
      });
      setIsStartPending(false);
    }
  }, [isStartPending, router]);

  useEffect(() => {
    if (!isAuthReady || !userKey) {
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const resolveProfile = async () => {
      try {
        const response = await fetch('/api/user/profile', {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
        });

        if (!response.ok) {
          if (isMounted) {
            setProfileGate({ resolvedFor: userKey, shouldOffer: false });
          }
          return;
        }

        const profile = (await response.json()) as ProfileResponse;

        if (!isMounted) {
          return;
        }

        setProfileGate({ resolvedFor: userKey, shouldOffer: !hasMypageStarted(profile) });
      } catch {
        if (!isMounted || controller.signal.aborted) {
          return;
        }
        setProfileGate({ resolvedFor: userKey, shouldOffer: false });
      }
    };

    void resolveProfile();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isAuthReady, userKey]);

  useEffect(() => {
    if (!isAuthReady || !userKey || !isProfileResolvedForUser || !shouldOffer) {
      return;
    }
    if (isSuppressedInSession) {
      return;
    }
    if (hasSeenStrongInSession) {
      return;
    }
    if (isStrongBannerVisible || isModalOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (isSessionSuppressed(userKey)) {
        return;
      }

      markStrongBannerShownInSession(userKey);
      setIsStrongBannerVisible(true);
      trackClientEvent('banner_impression', EVENT_CONTEXT);
    }, BANNER_SHOW_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    hasSeenStrongInSession,
    isAuthReady,
    isModalOpen,
    isProfileResolvedForUser,
    isStrongBannerVisible,
    isSuppressedInSession,
    shouldOffer,
    userKey,
  ]);

  const shouldRenderStrongBanner =
    isAuthReady && shouldOffer && isStrongBannerVisible && !isSuppressedInSession;
  const shouldRenderCompactLink =
    isAuthReady &&
    shouldOffer &&
    hasSeenStrongInSession &&
    !isSuppressedInSession &&
    !isStrongBannerVisible &&
    !isModalOpen;
  const shouldRenderModal = isAuthReady && shouldOffer && isModalOpen;

  useEffect(() => {
    if (!shouldRenderCompactLink) {
      hasTrackedCompactImpressionRef.current = false;
      return;
    }
    if (hasTrackedCompactImpressionRef.current) {
      return;
    }

    hasTrackedCompactImpressionRef.current = true;
    trackClientEvent('compact_link_impression', EVENT_CONTEXT);
  }, [shouldRenderCompactLink]);

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    trackClientEvent('modal_impression', EVENT_CONTEXT);
    const focusTimer = window.setTimeout(() => {
      startButtonRef.current?.focus();
    }, 0);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleSkip('modal_close');
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [handleSkip, isModalOpen]);

  if (!shouldRenderStrongBanner && !shouldRenderCompactLink && !shouldRenderModal) {
    return null;
  }

  return (
    <>
      {shouldRenderStrongBanner && (
        <section className="ui-card-float mb-5 border-stone-300/80 bg-gradient-to-r from-stone-50 to-white p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-600">
                Myページ
              </p>
              <h2 className="ui-heading mt-1 text-lg">あなた向けの設定を最短30秒で開始</h2>
              <p className="ui-muted mt-1 text-sm">
                表示名などの基本情報を入力すると、回答やチェックリストをあなた向けに最適化できます。
                <br />
                あとからいつでも編集できます。
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:min-w-[180px]">
              <button
                type="button"
                onClick={() => handleOpenModal('banner_click')}
                className="ui-btn ui-btn-primary px-4 py-2 text-sm !text-white"
              >
                作成する
              </button>
              <button
                type="button"
                onClick={() => handleSkip('banner_close')}
                className="ui-btn ui-btn-ghost px-4 py-2 text-sm"
              >
                閉じる
              </button>
            </div>
          </div>
        </section>
      )}

      {shouldRenderCompactLink && (
        <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-stone-300 bg-white/95 px-3 py-2 shadow-[0_12px_28px_rgba(38,8,1,0.16)] backdrop-blur">
          <button
            type="button"
            onClick={() => handleOpenModal('compact_link_click')}
            className="text-xs font-semibold text-stone-800 hover:text-stone-950"
          >
            Myページを作成
          </button>
          <button
            type="button"
            onClick={() => handleSkip('compact_link_close')}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-stone-300 text-stone-500 hover:bg-stone-100"
            aria-label="導線を閉じる"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12" />
              <path d="M18 6 6 18" />
            </svg>
          </button>
        </div>
      )}

      {shouldRenderModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleSkip('modal_close');
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="mypage-onboarding-title"
            className="ui-card-float relative w-full max-w-xl p-6"
          >
            <button
              type="button"
              onClick={() => handleSkip('modal_close')}
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 text-stone-600 hover:bg-stone-100"
              aria-label="閉じる"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12" />
                <path d="M18 6 6 18" />
              </svg>
            </button>

            <h2 id="mypage-onboarding-title" className="ui-heading pr-10 text-xl">
              作ると見つけてもらいやすくなります
            </h2>
            <p className="ui-muted mt-2 text-sm">所要時間: 最短30秒で開始できます。</p>

            <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
              <li className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-3">
                信頼感アップ: あなたの情報を一目で伝えられます。
              </li>
              <li className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-3">
                活動がまとまる: 解析履歴とプロフィールを一か所で管理できます。
              </li>
              <li className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-3">
                共有しやすい: あとで公開設定を選んでURL共有できます。
              </li>
            </ul>

            <div className="mt-4 rounded-xl border border-stone-300 bg-white p-4">
              <p className="text-xs font-semibold text-stone-600">プレビュー例</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">山田 太郎</p>
              <p className="mt-1 text-sm text-slate-600">行政手続きを迷わず進めたいです。</p>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => handleSkip('modal_secondary_click')}
                className="ui-btn ui-btn-secondary px-4 py-2 text-sm"
              >
                あとで
              </button>
              <button
                ref={startButtonRef}
                type="button"
                onClick={handleStartFlow}
                disabled={isStartPending}
                className="ui-btn ui-btn-primary px-5 py-2 text-sm !text-white"
              >
                {isStartPending ? '開始中...' : '最短30秒で開始'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
