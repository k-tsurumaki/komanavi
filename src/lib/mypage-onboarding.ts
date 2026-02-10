const STORAGE_VERSION = 'v2';
const SESSION_SUPPRESSED_KEY_PREFIX = `komanavi-mypage-onboarding-session-suppressed:${STORAGE_VERSION}`;
const SESSION_STRONG_SHOWN_KEY_PREFIX = `komanavi-mypage-onboarding-session-strong-shown:${STORAGE_VERSION}`;
const SESSION_FLOW_START_PENDING_KEY_PREFIX = `komanavi-mypage-onboarding-session-flow-start-pending:${STORAGE_VERSION}`;
const FLOW_START_PENDING_MAX_AGE_MS = 30_000;

function getSessionSuppressedKey(userKey: string): string {
  return `${SESSION_SUPPRESSED_KEY_PREFIX}:${userKey}`;
}

function getSessionStrongShownKey(userKey: string): string {
  return `${SESSION_STRONG_SHOWN_KEY_PREFIX}:${userKey}`;
}

function getSessionFlowStartPendingKey(userKey: string): string {
  return `${SESSION_FLOW_START_PENDING_KEY_PREFIX}:${userKey}`;
}

export function isSessionSuppressed(userKey: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.sessionStorage.getItem(getSessionSuppressedKey(userKey)) === 'true';
}

export function setSessionSuppressed(userKey: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.setItem(getSessionSuppressedKey(userKey), 'true');
}

export function hasSeenStrongBannerInSession(userKey: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.sessionStorage.getItem(getSessionStrongShownKey(userKey)) === 'true';
}

export function markStrongBannerShownInSession(userKey: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.setItem(getSessionStrongShownKey(userKey), 'true');
}

export function markFlowStartPendingInSession(userKey: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.setItem(getSessionFlowStartPendingKey(userKey), String(Date.now()));
}

export function clearFlowStartPendingInSession(userKey: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.removeItem(getSessionFlowStartPendingKey(userKey));
}

export function consumeFlowStartPendingInSession(userKey: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const key = getSessionFlowStartPendingKey(userKey);
  const rawTimestamp = window.sessionStorage.getItem(key);
  if (!rawTimestamp) {
    return false;
  }

  window.sessionStorage.removeItem(key);
  const timestamp = Number(rawTimestamp);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  return Date.now() - timestamp <= FLOW_START_PENDING_MAX_AGE_MS;
}
