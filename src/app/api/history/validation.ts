import type { ChecklistItem } from '@/lib/types/intermediate';

type HistoryResultMutableFields = {
  checklist?: unknown;
  userIntent?: unknown;
  intentAnswer?: unknown;
  guidanceUnlocked?: unknown;
};

function isChecklistItem(value: unknown): value is ChecklistItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ChecklistItem>;
  if (typeof item.id !== 'string' || typeof item.text !== 'string') return false;
  if (typeof item.completed !== 'boolean') return false;
  if (item.category !== undefined && typeof item.category !== 'string') return false;
  if (item.deadline !== undefined && typeof item.deadline !== 'string') return false;
  if (item.sourceId !== undefined && typeof item.sourceId !== 'string') return false;
  if (item.priority !== undefined && !['high', 'medium', 'low'].includes(item.priority)) return false;
  return true;
}

export function validateHistoryResultMutableFields(
  fields: HistoryResultMutableFields,
  options?: { requireAtLeastOne?: boolean }
): string | null {
  const hasChecklist = fields.checklist !== undefined;
  const hasUserIntent = fields.userIntent !== undefined;
  const hasIntentAnswer = fields.intentAnswer !== undefined;
  const hasGuidanceUnlocked = fields.guidanceUnlocked !== undefined;

  if (options?.requireAtLeastOne && !hasChecklist && !hasUserIntent && !hasIntentAnswer && !hasGuidanceUnlocked) {
    return 'checklist, userIntent, intentAnswer or guidanceUnlocked is required';
  }

  if (hasChecklist && (!Array.isArray(fields.checklist) || !fields.checklist.every(isChecklistItem))) {
    return 'checklist is invalid';
  }
  if (hasUserIntent && typeof fields.userIntent !== 'string') {
    return 'userIntent must be string';
  }
  if (hasIntentAnswer && typeof fields.intentAnswer !== 'string') {
    return 'intentAnswer must be string';
  }
  if (hasGuidanceUnlocked && typeof fields.guidanceUnlocked !== 'boolean') {
    return 'guidanceUnlocked must be boolean';
  }

  return null;
}
