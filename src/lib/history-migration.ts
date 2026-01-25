import { loadHistory, loadHistoryResults, clearHistory } from '@/lib/storage';
import { migrateHistory } from '@/lib/history-api';

const MIGRATION_FLAG_PREFIX = 'komanavi-history-migrated:';
const MIGRATION_ERROR_PREFIX = 'komanavi-history-migration-error:';

export function getMigrationError(userId: string): string | null {
  if (typeof window === 'undefined') return null;
  if (!userId) return null;
  return localStorage.getItem(`${MIGRATION_ERROR_PREFIX}${userId}`);
}

export function clearMigrationError(userId: string): void {
  if (typeof window === 'undefined') return;
  if (!userId) return;
  localStorage.removeItem(`${MIGRATION_ERROR_PREFIX}${userId}`);
}

export async function migrateLocalHistoryIfNeeded(userId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!userId) return;

  const flagKey = `${MIGRATION_FLAG_PREFIX}${userId}`;
  if (localStorage.getItem(flagKey)) return;

  const historyItems = loadHistory();
  const historyResults = loadHistoryResults();

  if (historyItems.length === 0 && historyResults.length === 0) {
    localStorage.setItem(flagKey, 'true');
    return;
  }

  try {
    const payload = {
      historyItems,
      historyResults,
    };

    await migrateHistory(payload);
    clearHistory();
    localStorage.setItem(flagKey, 'true');
    localStorage.removeItem(`${MIGRATION_ERROR_PREFIX}${userId}`);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('history:updated'));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '移行に失敗しました';
    localStorage.setItem(`${MIGRATION_ERROR_PREFIX}${userId}`, message);
    console.error('History migration failed:', error);
  }
}
