import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebase-admin';

type TimestampLike = {
  toDate: () => Date;
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

function normalizeTimestampField(target: Record<string, unknown>, key: string) {
  const field = target[key];
  if (isTimestampLike(field)) {
    target[key] = field.toDate().toISOString();
  }
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
      return NextResponse.json({ nationality: '日本' });
    }

    const data = docSnap.data();
    const responseData: Record<string, unknown> = isPlainObject(data) ? { ...data } : {};
    normalizeTimestampField(responseData, 'birthDate');
    normalizeTimestampField(responseData, 'updatedAt');

    return NextResponse.json(responseData);
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

    const db = getAdminFirestore();
    const docRef = db.collection('users').doc(session.user.id);
    const saveData: Record<string, unknown> = { ...body };

    const birthDate = saveData.birthDate;
    if (typeof birthDate === 'string' && birthDate.trim().length > 0) {
      const parsedBirthDate = new Date(birthDate);
      if (Number.isNaN(parsedBirthDate.getTime())) {
        return NextResponse.json({ error: 'Invalid birthDate' }, { status: 400 });
      }
      saveData.birthDate = parsedBirthDate;
    } else {
      saveData.birthDate = null;
    }

    saveData.updatedAt = new Date();

    await docRef.set(saveData, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
