const STORAGE_VERSION = 'v2';
const SESSION_SUPPRESSED_KEY_PREFIX = `komanavi-mypage-onboarding-session-suppressed:${STORAGE_VERSION}`;
const SESSION_STRONG_SHOWN_KEY_PREFIX = `komanavi-mypage-onboarding-session-strong-shown:${STORAGE_VERSION}`;

function getSessionSuppressedKey(userKey: string): string {
  return `${SESSION_SUPPRESSED_KEY_PREFIX}:${userKey}`;
}

function getSessionStrongShownKey(userKey: string): string {
  return `${SESSION_STRONG_SHOWN_KEY_PREFIX}:${userKey}`;
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
