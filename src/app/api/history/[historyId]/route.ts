import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireUserId, toIsoString } from '@/app/api/history/utils';
import type { ChecklistItem } from '@/lib/types/intermediate';
import { validateHistoryResultMutableFields } from '@/app/api/history/validation';

export const runtime = 'nodejs';

const COLLECTIONS = {
  histories: 'conversation_histories',
  results: 'conversation_results',
  intermediates: 'conversation_intermediates',
} as const;

type PatchHistoryRequest = {
  checklist?: ChecklistItem[];
  userIntent?: string;
  intentAnswer?: string;
  guidanceUnlocked?: boolean;
};

function compact<T extends Record<string, unknown>>(data: T): T {
  const next = { ...data } as Record<string, unknown>;
  Object.keys(next).forEach((key) => {
    if (next[key] === undefined) {
      delete next[key];
    }
  });
  return next as T;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ historyId: string }> }
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { historyId } = await context.params;
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

  if (resultId) {
    const resultRef = db.collection(COLLECTIONS.results).doc(resultId);
    const resultSnap = await resultRef.get();
    if (resultSnap.exists) {
      const resultData = resultSnap.data();
      if (resultData?.userId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (resultData?.historyId && resultData.historyId !== historyId) {
        return NextResponse.json({ error: 'History/result mismatch' }, { status: 409 });
      }
      result = {
        id: resultSnap.id,
        ...resultData,
        createdAt: toIsoString(resultData.createdAt),
        updatedAt: toIsoString(resultData.updatedAt),
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

    }
  }

  return NextResponse.json({ history, result, intermediate });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ historyId: string }> }
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { historyId } = await context.params;
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
  }

  await batch.commit();

  return NextResponse.json({ deleted: true, historyId, resultId: resultId ?? null });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ historyId: string }> }
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: PatchHistoryRequest;
  try {
    body = (await request.json()) as PatchHistoryRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validationError = validateHistoryResultMutableFields(body, { requireAtLeastOne: true });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { historyId } = await context.params;
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
  if (!resultId) {
    return NextResponse.json({ error: 'Result not found' }, { status: 404 });
  }

  const resultRef = db.collection(COLLECTIONS.results).doc(resultId);
  const resultSnap = await resultRef.get();
  if (!resultSnap.exists) {
    return NextResponse.json({ error: 'Result not found' }, { status: 404 });
  }

  const resultData = resultSnap.data();
  if (resultData?.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (resultData?.historyId && resultData.historyId !== historyId) {
    return NextResponse.json({ error: 'History/result mismatch' }, { status: 409 });
  }

  const updatedAt = new Date();
  await resultRef.set(
    compact({
      updatedAt,
      checklist: body.checklist,
      userIntent: body.userIntent,
      intentAnswer: body.intentAnswer,
      guidanceUnlocked: body.guidanceUnlocked,
    }),
    { merge: true }
  );

  return NextResponse.json({ updated: true, historyId, resultId });
}
