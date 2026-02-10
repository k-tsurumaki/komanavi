import type { ChecklistGenerationState, ChecklistItem } from '@/lib/types/intermediate';

type HistoryResultMutableFields = {
  checklist?: unknown;
  userIntent?: unknown;
  intentAnswer?: unknown;
  guidanceUnlocked?: unknown;
  checklistState?: unknown;
  checklistError?: unknown;
  intermediate?: unknown;
};

const CHECKLIST_STATES: ChecklistGenerationState[] = ['not_requested', 'ready', 'error'];

function isChecklistItem(value: unknown): value is ChecklistItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ChecklistItem>;
  if (typeof item.id !== 'string' || typeof item.text !== 'string') return false;
  if (typeof item.completed !== 'boolean') return false;
  if (item.category !== undefined && typeof item.category !== 'string') return false;
  if (item.deadline !== undefined && typeof item.deadline !== 'string') return false;
  if (item.sourceId !== undefined && typeof item.sourceId !== 'string') return false;
  if (item.priority !== undefined && !['high', 'medium', 'low'].includes(item.priority))
    return false;
  return true;
}

function isIntermediateRepresentation(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const item = value as any;

  // 必須フィールドのチェック
  if (typeof item.title !== 'string') return false;
  if (typeof item.summary !== 'string') return false;
  if (typeof item.documentType !== 'string') return false;
  if (!item.metadata || typeof item.metadata !== 'object') return false;
  if (!Array.isArray(item.sources)) return false;

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
  const hasChecklistState = fields.checklistState !== undefined;
  const hasChecklistError = fields.checklistError !== undefined;
  const hasIntermediate = fields.intermediate !== undefined;

  if (
    options?.requireAtLeastOne &&
    !hasChecklist &&
    !hasUserIntent &&
    !hasIntentAnswer &&
    !hasGuidanceUnlocked &&
    !hasChecklistState &&
    !hasChecklistError &&
    !hasIntermediate
  ) {
    return 'checklist, userIntent, intentAnswer, guidanceUnlocked, checklistState, checklistError or intermediate is required';
  }

  if (
    hasChecklist &&
    (!Array.isArray(fields.checklist) || !fields.checklist.every(isChecklistItem))
  ) {
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
  if (
    hasChecklistState &&
    (typeof fields.checklistState !== 'string' ||
      !CHECKLIST_STATES.includes(fields.checklistState as ChecklistGenerationState))
  ) {
    return 'checklistState is invalid';
  }
  if (hasChecklistError && typeof fields.checklistError !== 'string') {
    return 'checklistError must be string';
  }
  if (hasChecklistError && !hasChecklistState) {
    return 'checklistState is required when checklistError is set';
  }

  const checklistState =
    hasChecklistState && typeof fields.checklistState === 'string'
      ? (fields.checklistState as ChecklistGenerationState)
      : undefined;
  if (checklistState && checklistState !== 'error' && hasChecklistError) {
    return 'checklistError must be omitted unless checklistState is error';
  }

  if (hasIntermediate && !isIntermediateRepresentation(fields.intermediate)) {
    return 'intermediate is invalid or missing required fields';
  }

  return null;
}
