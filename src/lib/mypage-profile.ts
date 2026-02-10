type TimestampLike = {
  toDate: () => Date;
};

export type MypageProfileLike = {
  displayName?: unknown;
  birthDate?: unknown;
  gender?: unknown;
  occupation?: unknown;
  nationality?: unknown;
  location?: unknown;
  visualTraits?: unknown;
  personality?: unknown;
};

const MYPAGE_PROFILE_STRING_FIELDS = [
  'displayName',
  'gender',
  'occupation',
  'nationality',
  'location',
  'visualTraits',
  'personality',
] as const;

function hasStringValue(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasBirthDateValue(value: unknown): boolean {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  if (typeof value === 'string') {
    if (value.trim().length === 0) {
      return false;
    }

    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime());
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    const parsed = (value as TimestampLike).toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime());
  }

  return false;
}

export function hasMypageStarted(profile: MypageProfileLike | null | undefined): boolean {
  if (!profile || typeof profile !== 'object') {
    return false;
  }

  if (hasBirthDateValue(profile.birthDate)) {
    return true;
  }

  for (const field of MYPAGE_PROFILE_STRING_FIELDS) {
    if (hasStringValue(profile[field])) {
      return true;
    }
  }

  return false;
}
