'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { trackClientEvent } from '@/lib/client-analytics';
import { consumeFlowStartPendingInSession } from '@/lib/mypage-onboarding';

const EVENT_CONTEXT = {
  entry_point: 'result',
  surface: 'mypage_onboarding',
} as const;

export function FlowStartTracker() {
  const { data: session, status } = useSession();
  const userKey = session?.user?.id ?? null;

  useEffect(() => {
    if (status !== 'authenticated' || !userKey) {
      return;
    }
    if (!consumeFlowStartPendingInSession(userKey)) {
      return;
    }

    trackClientEvent('flow_start_success', EVENT_CONTEXT);
  }, [status, userKey]);

  return null;
}
