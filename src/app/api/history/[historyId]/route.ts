import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { auth } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const COLLECTIONS = {
  histories: 'conversation_histories',
  results: 'conversation_results',
  intermediates: 'conversation_intermediates',
  manga: 'conversation_manga',
} as const;

function toIsoString(value: unknown): string | null {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  return null;
}

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET(_request: NextRequest, context: { params: { historyId: string } }) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { historyId } = context.params;
  const db = getAdminFirestore();
  const historyRef = db.collection(COLLECTIONS.histories).doc(historyId);
  const historySnap = await historyRef.get();

  if (!historySnap.exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const historyData = historySnap.data();
  if (!historyData || historyData.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const history = {
    id: historySnap.id,
    ...historyData,
    createdAt: toIsoString(historyData.createdAt),
  };

  const resultId = historyData.resultId as string | undefined;
  let result = null;
  let intermediate = null;
  let manga = null;

  if (resultId) {
    const resultRef = db.collection(COLLECTIONS.results).doc(resultId);
    const resultSnap = await resultRef.get();
    if (resultSnap.exists) {
      const resultData = resultSnap.data();
      if (resultData?.userId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      result = {
        id: resultSnap.id,
        ...resultData,
        createdAt: toIsoString(resultData.createdAt),
      };

      const intermediateRef = db.collection(COLLECTIONS.intermediates).doc(resultId);
      const intermediateSnap = await intermediateRef.get();
      if (intermediateSnap.exists) {
        const intermediateData = intermediateSnap.data();
        if (intermediateData?.userId === userId) {
          intermediate = {
            id: intermediateSnap.id,
            ...intermediateData,
            createdAt: toIsoString(intermediateData.createdAt),
          };
        }
      }

      const mangaRef = db.collection(COLLECTIONS.manga).doc(resultId);
      const mangaSnap = await mangaRef.get();
      if (mangaSnap.exists) {
        const mangaData = mangaSnap.data();
        if (mangaData?.userId === userId) {
          manga = {
            id: mangaSnap.id,
            ...mangaData,
            createdAt: toIsoString(mangaData.createdAt),
          };
        }
      }
    }
  }

  return NextResponse.json({ history, result, intermediate, manga });
}

export async function DELETE(_request: NextRequest, context: { params: { historyId: string } }) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { historyId } = context.params;
  const db = getAdminFirestore();
  const historyRef = db.collection(COLLECTIONS.histories).doc(historyId);
  const historySnap = await historyRef.get();

  if (!historySnap.exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const historyData = historySnap.data();
  if (!historyData || historyData.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const resultId = historyData.resultId as string | undefined;
  const batch = db.batch();
  batch.delete(historyRef);

  if (resultId) {
    batch.delete(db.collection(COLLECTIONS.results).doc(resultId));
    batch.delete(db.collection(COLLECTIONS.intermediates).doc(resultId));
    batch.delete(db.collection(COLLECTIONS.manga).doc(resultId));
  }

  await batch.commit();

  return NextResponse.json({ deleted: true, historyId, resultId: resultId ?? null });
}
