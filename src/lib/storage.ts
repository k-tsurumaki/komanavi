import type { FeedbackItem, HistoryItem } from '@/lib/types/intermediate';

const HISTORY_KEY = 'komanavi-history';
const FEEDBACK_KEY = 'komanavi-feedback';
const HISTORY_RETENTION_DAYS = 90;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function pruneHistory(items: HistoryItem[]): HistoryItem[] {
  const cutoff = Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return items.filter((item) => new Date(item.createdAt).getTime() >= cutoff);
}

export function loadHistory(): HistoryItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    if (!Array.isArray(parsed)) return [];
    return pruneHistory(parsed);
  } catch {
    return [];
  }
}

export function saveHistoryItem(item: HistoryItem): void {
  if (!isBrowser()) return;
  const current = loadHistory();
  const next = [item, ...current.filter((entry) => entry.id !== item.id)];
  const pruned = pruneHistory(next);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(pruned));
}

export function clearHistory(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(HISTORY_KEY);
}

export function loadFeedback(): FeedbackItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(FEEDBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FeedbackItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveFeedbackItem(item: FeedbackItem): void {
  if (!isBrowser()) return;
  const current = loadFeedback();
  const next = [item, ...current];
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(next));
}
