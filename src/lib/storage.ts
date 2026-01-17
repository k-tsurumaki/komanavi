import type { AnalyzeResult, FeedbackItem, HistoryItem } from '@/lib/types/intermediate';

const HISTORY_KEY = 'komanavi-history';
const HISTORY_RESULT_KEY = 'komanavi-history-results';
const FEEDBACK_KEY = 'komanavi-feedback';
const HISTORY_RETENTION_DAYS = 90;

interface StoredHistoryResult {
  historyId: string;
  resultId: string;
  createdAt: string;
  result: AnalyzeResult;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function pruneHistory(items: HistoryItem[]): HistoryItem[] {
  const cutoff = Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return items.filter((item) => new Date(item.createdAt).getTime() >= cutoff);
}

function pruneHistoryResults(items: StoredHistoryResult[]): StoredHistoryResult[] {
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
    const pruned = pruneHistory(parsed);
    if (pruned.length !== parsed.length) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(pruned));
    }
    return pruned;
  } catch {
    return [];
  }
}

export function loadHistoryResults(): StoredHistoryResult[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(HISTORY_RESULT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredHistoryResult[];
    if (!Array.isArray(parsed)) return [];
    const pruned = pruneHistoryResults(parsed);
    if (pruned.length !== parsed.length) {
      localStorage.setItem(HISTORY_RESULT_KEY, JSON.stringify(pruned));
    }
    return pruned;
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

export function saveHistoryResult(entry: StoredHistoryResult): void {
  if (!isBrowser()) return;
  const current = loadHistoryResults();
  const next = [
    entry,
    ...current.filter(
      (item) => item.historyId !== entry.historyId && item.resultId !== entry.resultId
    ),
  ];
  const pruned = pruneHistoryResults(next);
  localStorage.setItem(HISTORY_RESULT_KEY, JSON.stringify(pruned));
}

export function loadHistoryDetail(historyId: string): {
  item?: HistoryItem;
  result?: AnalyzeResult;
} {
  if (!isBrowser()) return {};
  const historyItems = loadHistory();
  const item = historyItems.find((entry) => entry.id === historyId);
  if (!item) return {};
  const results = loadHistoryResults();
  const stored =
    results.find((entry) => entry.historyId === historyId) ||
    results.find((entry) => entry.resultId === item.resultId);
  return { item, result: stored?.result };
}

export function loadHistoryPage(page: number, pageSize: number): {
  items: HistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} {
  const items = loadHistory();
  const total = items.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export function clearHistory(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(HISTORY_RESULT_KEY);
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
