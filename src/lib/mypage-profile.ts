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

export type MypageProfileFormValues = {
  displayName: string;
  birthDate: string;
  gender: string;
  occupation: string;
  nationality: string;
  location: string;
  visualTraits: string;
  personality: string;
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

function normalizeProfileString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBirthDateForInput(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'string') {
    if (value.trim().length === 0) {
      return '';
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return '';
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    const parsed = (value as TimestampLike).toDate();
    return parsed.toISOString().slice(0, 10);
  }

  return '';
}

export function getEmptyMypageProfileFormValues(): MypageProfileFormValues {
  return {
    displayName: '',
    birthDate: '',
    gender: '',
    occupation: '',
    nationality: '',
    location: '',
    visualTraits: '',
    personality: '',
  };
}

export function toMypageProfileFormValues(
  profile: MypageProfileLike | null | undefined
): MypageProfileFormValues {
  const values = getEmptyMypageProfileFormValues();
  if (!profile || typeof profile !== 'object') {
    return values;
  }

  return {
    displayName: normalizeProfileString(profile.displayName),
    birthDate: normalizeBirthDateForInput(profile.birthDate),
    gender: normalizeProfileString(profile.gender),
    occupation: normalizeProfileString(profile.occupation),
    nationality: normalizeProfileString(profile.nationality),
    location: normalizeProfileString(profile.location),
    visualTraits: normalizeProfileString(profile.visualTraits),
    personality: normalizeProfileString(profile.personality),
  };
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
