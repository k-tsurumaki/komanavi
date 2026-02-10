'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { trackClientEvent } from '@/lib/client-analytics';
import {
  clearFlowStartPendingInSession,
  hasSeenStrongBannerInSession,
  isSessionSuppressed,
  markFlowStartPendingInSession,
  markStrongBannerShownInSession,
  setSessionSuppressed,
} from '@/lib/mypage-onboarding';
import { hasMypageStarted } from '@/lib/mypage-profile';

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
const START_PENDING_TIMEOUT_MS = 4000;
const PROFILE_GATE_RETRY_DELAY_MS = 1200;
const PROFILE_GATE_MAX_RETRIES = 1;
const MYPAGE_FLOW_URL = '/mypage?flow=create&step=1';
const EVENT_CONTEXT = {
  entry_point: 'result',
  surface: 'mypage_onboarding',
} as const;

export function MypageOnboardingPrompt({ enabled }: MypageOnboardingPromptProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isStrongBannerVisible, setIsStrongBannerVisible] = useState(false);
  const [isStartPending, setIsStartPending] = useState(false);
  const [profileGate, setProfileGate] = useState<{
    resolvedFor: string | null;
    shouldOffer: boolean | null;
    source: 'profile' | 'fallback' | null;
  }>({
    resolvedFor: null,
    shouldOffer: null,
    source: null,
  });
  const hasTrackedCompactImpressionRef = useRef(false);
  const startNavigationTimerRef = useRef<number | null>(null);
  const profileRetryTimerRef = useRef<number | null>(null);

  const userKey = useMemo(() => {
    const userId = session?.user?.id;
    return userId ? userId : null;
  }, [session?.user?.id]);

  const isAuthReady = enabled && status === 'authenticated' && Boolean(userKey);
  const isProfileResolvedForUser = isAuthReady && profileGate.resolvedFor === userKey;
  const shouldOffer = isProfileResolvedForUser && profileGate.shouldOffer === true;
  const shouldOfferFromProfile = shouldOffer && profileGate.source === 'profile';
  const shouldOfferFromFallback = shouldOffer && profileGate.source === 'fallback';
  const isSuppressedInSession = userKey ? isSessionSuppressed(userKey) : false;
  const hasSeenStrongInSession = userKey ? hasSeenStrongBannerInSession(userKey) : false;

  const clearStartNavigationTimer = useCallback(() => {
    if (startNavigationTimerRef.current === null) {
      return;
    }
    window.clearTimeout(startNavigationTimerRef.current);
    startNavigationTimerRef.current = null;
  }, []);

  const scheduleStartNavigationTimeout = useCallback(() => {
    clearStartNavigationTimer();
    startNavigationTimerRef.current = window.setTimeout(() => {
      startNavigationTimerRef.current = null;
      setIsStartPending(false);
    }, START_PENDING_TIMEOUT_MS);
  }, [clearStartNavigationTimer]);

  const clearProfileRetryTimer = useCallback(() => {
    if (profileRetryTimerRef.current === null) {
      return;
    }
    window.clearTimeout(profileRetryTimerRef.current);
    profileRetryTimerRef.current = null;
  }, []);

  const handleSkip = useCallback(
    (eventName: 'banner_close' | 'compact_link_close') => {
      if (userKey) {
        setSessionSuppressed(userKey);
        clearFlowStartPendingInSession(userKey);
      }
      clearStartNavigationTimer();

      trackClientEvent(eventName, EVENT_CONTEXT);
      setIsStrongBannerVisible(false);
      setIsStartPending(false);
    },
    [clearStartNavigationTimer, userKey]
  );

  const handleStartFlow = useCallback(
    (eventName: 'banner_click' | 'compact_link_click') => {
      if (isStartPending) {
        return;
      }

      setIsStartPending(true);
      trackClientEvent(eventName, EVENT_CONTEXT);
      setIsStrongBannerVisible(false);
      scheduleStartNavigationTimeout();
      if (userKey) {
        markFlowStartPendingInSession(userKey);
      }
      router.push(MYPAGE_FLOW_URL);
    },
    [isStartPending, router, scheduleStartNavigationTimeout, userKey]
  );

  useEffect(() => {
    return () => {
      clearStartNavigationTimer();
      clearProfileRetryTimer();
    };
  }, [clearProfileRetryTimer, clearStartNavigationTimer]);

  useEffect(() => {
    if (!isAuthReady || !userKey) {
      return;
    }

    clearProfileRetryTimer();
    let isMounted = true;
    const controller = new AbortController();
    const resolveAsFallback = () => {
      if (!isMounted) {
        return;
      }
      setProfileGate({ resolvedFor: userKey, shouldOffer: true, source: 'fallback' });
    };

    const resolveProfile = async (attempt: number) => {
      try {
        const response = await fetch('/api/user/profile', {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
        });

        if (!response.ok) {
          if (attempt < PROFILE_GATE_MAX_RETRIES) {
            profileRetryTimerRef.current = window.setTimeout(() => {
              profileRetryTimerRef.current = null;
              void resolveProfile(attempt + 1);
            }, PROFILE_GATE_RETRY_DELAY_MS);
            return;
          }
          resolveAsFallback();
          return;
        }

        const profile = (await response.json()) as ProfileResponse;

        if (!isMounted) {
          return;
        }

        setProfileGate({
          resolvedFor: userKey,
          shouldOffer: !hasMypageStarted(profile),
          source: 'profile',
        });
      } catch {
        if (!isMounted || controller.signal.aborted) {
          return;
        }
        if (attempt < PROFILE_GATE_MAX_RETRIES) {
          profileRetryTimerRef.current = window.setTimeout(() => {
            profileRetryTimerRef.current = null;
            void resolveProfile(attempt + 1);
          }, PROFILE_GATE_RETRY_DELAY_MS);
          return;
        }
        resolveAsFallback();
      }
    };

    void resolveProfile(0);

    return () => {
      isMounted = false;
      controller.abort();
      clearProfileRetryTimer();
    };
  }, [clearProfileRetryTimer, isAuthReady, userKey]);

  useEffect(() => {
    if (!isAuthReady || !userKey || !isProfileResolvedForUser || !shouldOfferFromProfile) {
      return;
    }
    if (isSuppressedInSession) {
      return;
    }
    if (hasSeenStrongInSession) {
      return;
    }
    if (isStrongBannerVisible) {
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
    isProfileResolvedForUser,
    isStrongBannerVisible,
    isSuppressedInSession,
    shouldOfferFromProfile,
    userKey,
  ]);

  const shouldRenderStrongBanner =
    isAuthReady && shouldOfferFromProfile && isStrongBannerVisible && !isSuppressedInSession;
  const shouldRenderCompactLink =
    isAuthReady &&
    shouldOffer &&
    (hasSeenStrongInSession || shouldOfferFromFallback) &&
    !isSuppressedInSession &&
    !isStrongBannerVisible;

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

  if (!shouldRenderStrongBanner && !shouldRenderCompactLink) {
    return null;
  }

  return (
    <>
      {shouldRenderStrongBanner && (
        <section className="mb-5 rounded-[24px] border border-stone-300 bg-stone-100 p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="ui-heading inline-flex items-center gap-2 text-lg text-stone-900">
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-stone-200 text-stone-700"
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="3" />
                    <path d="M19 8v6" />
                    <path d="M22 11h-6" />
                  </svg>
                </span>
                Myページを作成
              </h2>
              <p className="mt-1 text-sm text-stone-800">
                表示名などを入力するだけで、回答とチェックリストがあなた向けに最適化されます。
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:min-w-[180px]">
              <button
                type="button"
                onClick={() => handleStartFlow('banner_click')}
                disabled={isStartPending}
                className="ui-btn ui-btn-primary px-4 py-2 text-sm !text-white"
              >
                {isStartPending ? '移動中...' : '作成する'}
              </button>
              <button
                type="button"
                onClick={() => handleSkip('banner_close')}
                className="ui-btn border border-stone-300 bg-stone-100 px-4 py-2 text-sm text-stone-800 hover:bg-stone-200"
              >
                閉じる
              </button>
            </div>
          </div>
        </section>
      )}

      {shouldRenderCompactLink && (
        <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-stone-300 bg-stone-100/95 px-3 py-2 shadow-[var(--shadow-soft)] backdrop-blur">
          <button
            type="button"
            onClick={() => handleStartFlow('compact_link_click')}
            disabled={isStartPending}
            className="text-xs font-semibold text-stone-800 hover:text-stone-950"
          >
            {isStartPending ? '移動中...' : 'Myページを作成'}
          </button>
          <button
            type="button"
            onClick={() => handleSkip('compact_link_close')}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-stone-300 text-stone-600 hover:bg-stone-200"
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

    </>
  );
}
