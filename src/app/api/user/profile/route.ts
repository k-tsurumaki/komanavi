import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebase-admin';

type TimestampLike = {
  toDate: () => Date;
};

const PROFILE_STRING_FIELDS = [
  'displayName',
  'gender',
  'occupation',
  'nationality',
  'location',
  'visualTraits',
  'personality',
] as const;

type ProfileResponse = {
  displayName: string;
  birthDate: string | null;
  gender: string;
  occupation: string;
  nationality: string;
  location: string;
  visualTraits: string;
  personality: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestampLike(value: unknown): value is TimestampLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  );
}

function getDefaultProfile(): ProfileResponse {
  return {
    displayName: '',
    birthDate: null,
    gender: '',
    occupation: '',
    nationality: '日本',
    location: '',
    visualTraits: '',
    personality: '',
  };
}

function normalizeBirthDateToIso(value: unknown): string | null {
  if (isTimestampLike(value)) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return null;
}

function normalizeProfileString(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function buildProfileResponse(data: unknown): ProfileResponse {
  const profile = getDefaultProfile();
  if (!isPlainObject(data)) {
    return profile;
  }

  for (const field of PROFILE_STRING_FIELDS) {
    const normalized = normalizeProfileString(data[field]);
    if (field === 'nationality') {
      profile.nationality = normalized || '日本';
      continue;
    }
    profile[field] = normalized;
  }

  profile.birthDate = normalizeBirthDateToIso(data.birthDate);
  return profile;
}

function buildProfileUpdatePayload(body: Record<string, unknown>):
  | { ok: true; saveData: Record<string, unknown> }
  | { ok: false; error: string } {
  const saveData: Record<string, unknown> = {};

  for (const field of PROFILE_STRING_FIELDS) {
    if (!(field in body)) {
      continue;
    }
    const normalized = normalizeProfileString(body[field]);
    if (field === 'nationality') {
      saveData.nationality = normalized || '日本';
      continue;
    }
    saveData[field] = normalized;
  }

  if ('birthDate' in body) {
    const birthDate = body.birthDate;
    if (birthDate == null || (typeof birthDate === 'string' && birthDate.trim().length === 0)) {
      saveData.birthDate = null;
    } else if (typeof birthDate === 'string') {
      const parsedBirthDate = new Date(birthDate);
      if (Number.isNaN(parsedBirthDate.getTime())) {
        return { ok: false, error: 'Invalid birthDate' };
      }
      saveData.birthDate = parsedBirthDate;
    } else {
      return { ok: false, error: 'Invalid birthDate' };
    }
  }

  if (Object.keys(saveData).length === 0) {
    return { ok: false, error: 'No updatable profile fields provided' };
  }

  saveData.updatedAt = new Date();
  return { ok: true, saveData };
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminFirestore();

  try {
    const docRef = db.collection('users').doc(session.user.id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(getDefaultProfile());
    }

    return NextResponse.json(buildProfileResponse(docSnap.data()));
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    if (!isPlainObject(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const payloadResult = buildProfileUpdatePayload(body);
    if (!payloadResult.ok) {
      return NextResponse.json({ error: payloadResult.error }, { status: 400 });
    }

    const db = getAdminFirestore();
    const docRef = db.collection('users').doc(session.user.id);
    await docRef.set(payloadResult.saveData, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
