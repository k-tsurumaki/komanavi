export interface IntentAnswerEntry {
  text: string;
}

export interface StructuredIntentAnswer {
  headline: string;
  finalJudgment: IntentAnswerEntry;
  firstPriorityAction: IntentAnswerEntry;
  failureRisks: IntentAnswerEntry[];
}

export function extractJsonChunk(text: string): string | null {
  const cleaned = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  const startIndex = cleaned.search(/[\[{]/);
  if (startIndex === -1) {
    return null;
  }
  const openChar = cleaned[startIndex];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIndex; i < cleaned.length; i += 1) {
    const char = cleaned[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === openChar) {
      depth += 1;
      continue;
    }
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return cleaned.slice(startIndex, i + 1);
      }
    }
  }
  return null;
}

export function parseJson<T>(text: string): T | null {
  try {
    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    const extracted = extractJsonChunk(text);
    if (!extracted) {
      return null;
    }
    try {
      return JSON.parse(extracted) as T;
    } catch {
      return null;
    }
  }
}

function normalizeIntentText(value: unknown, fallback = '不明'): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || fallback;
}

function normalizeIntentEntry(value: unknown, fallbackText = '不明'): IntentAnswerEntry {
  if (typeof value === 'string') {
    return {
      text: normalizeIntentText(value, fallbackText),
    };
  }
  if (!value || typeof value !== 'object') {
    return {
      text: fallbackText,
    };
  }
  const objectValue = value as Record<string, unknown>;
  return {
    text: normalizeIntentText(objectValue.text, fallbackText),
  };
}

function normalizeIntentEntryList(value: unknown, fallbackText: string): IntentAnswerEntry[] {
  if (!Array.isArray(value)) {
    return [normalizeIntentEntry(null, fallbackText)];
  }
  const entries = value
    .map((item) => normalizeIntentEntry(item, fallbackText))
    .filter((entry, index, self) => self.findIndex((current) => current.text === entry.text) === index)
    .slice(0, 5);
  return entries.length > 0 ? entries : [normalizeIntentEntry(null, fallbackText)];
}

export function parseStructuredIntentAnswer(rawText?: string): StructuredIntentAnswer | null {
  if (!rawText) {
    return null;
  }
  const parsed = parseJson<Record<string, unknown>>(rawText);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const core = (parsed.core && typeof parsed.core === 'object'
    ? parsed.core
    : parsed) as Record<string, unknown>;

  return {
    headline: normalizeIntentText(parsed.headline, 'あなた向けの回答'),
    finalJudgment: normalizeIntentEntry(
      core.finalJudgment ?? core.targetJudgment ?? core.targetAudienceDecision,
      '対象かどうかの判断材料は不明'
    ),
    firstPriorityAction: normalizeIntentEntry(
      core.firstPriorityAction ?? core.firstAction,
      '最優先の1手は不明'
    ),
    failureRisks: normalizeIntentEntryList(core.failureRisks ?? core.cautions, '失敗リスクは不明')
      .slice(0, 2),
  };
}
