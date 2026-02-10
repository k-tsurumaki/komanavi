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
const MYPAGE_FLOW_URL = '/mypage?flow=create&step=1';
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
  const [isStartPending, setIsStartPending] = useState(false);
  const [profileGate, setProfileGate] = useState<{
    resolvedFor: string | null;
    shouldOffer: boolean | null;
  }>({
    resolvedFor: null,
    shouldOffer: null,
  });
  const hasTrackedCompactImpressionRef = useRef(false);
  const startNavigationTimerRef = useRef<number | null>(null);

  const userKey = useMemo(() => {
    const userId = session?.user?.id;
    return userId ? userId : null;
  }, [session?.user?.id]);

  const isAuthReady = enabled && status === 'authenticated' && Boolean(userKey);
  const isProfileResolvedForUser = isAuthReady && profileGate.resolvedFor === userKey;
  const shouldOffer = isProfileResolvedForUser && profileGate.shouldOffer === true;
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

      try {
        router.push(MYPAGE_FLOW_URL);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown_error';
        clearStartNavigationTimer();
        if (userKey) {
          clearFlowStartPendingInSession(userKey);
        }
        trackClientEvent('flow_start_fail', {
          ...EVENT_CONTEXT,
          error_message: message,
        });
        setIsStartPending(false);
      }
    },
    [clearStartNavigationTimer, isStartPending, router, scheduleStartNavigationTimeout, userKey]
  );

  useEffect(() => {
    return () => {
      clearStartNavigationTimer();
    };
  }, [clearStartNavigationTimer]);

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
                onClick={() => handleStartFlow('banner_click')}
                disabled={isStartPending}
                className="ui-btn ui-btn-primary px-4 py-2 text-sm !text-white"
              >
                {isStartPending ? '移動中...' : '作成する'}
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
            onClick={() => handleStartFlow('compact_link_click')}
            disabled={isStartPending}
            className="text-xs font-semibold text-stone-800 hover:text-stone-950"
          >
            {isStartPending ? '移動中...' : 'Myページを作成'}
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

    </>
  );
}
