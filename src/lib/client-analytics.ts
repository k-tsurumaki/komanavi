'use client';

type AnalyticsValue = string | number | boolean;

export type ClientAnalyticsParams = Record<string, AnalyticsValue | undefined>;

interface AnalyticsEventDetail {
  eventName: string;
  params: ClientAnalyticsParams;
}

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (command: 'event', eventName: string, params?: ClientAnalyticsParams) => void;
  }
}

export function trackClientEvent(eventName: string, params: ClientAnalyticsParams = {}): void {
  if (typeof window === 'undefined') {
    return;
  }

  const detail: AnalyticsEventDetail = { eventName, params };
  window.dispatchEvent(new CustomEvent<AnalyticsEventDetail>('analytics:event', { detail }));

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({ event: eventName, ...params });
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}
