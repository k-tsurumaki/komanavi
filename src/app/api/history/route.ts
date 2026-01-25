import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import type { ChecklistItem, IntermediateRepresentation, MangaResult } from '@/lib/types/intermediate';

export const runtime = 'nodejs';

const COLLECTIONS = {
  histories: 'conversation_histories',
  results: 'conversation_results',
  intermediates: 'conversation_intermediates',
  manga: 'conversation_manga',
} as const;

type SaveHistoryRequest = {
  historyId?: string;
  resultId: string;
  url: string;
  title: string;
  summary?: string;
  status?: string;
  sourceDomain?: string;
  tags?: string[];
  checklist?: ChecklistItem[];
  intermediate?: IntermediateRepresentation;
  manga?: MangaResult;
  generatedSummary?: string;
  schemaVersion?: number;
};

function toDateValue(input?: string | number): Date | null {
  if (input === undefined) return null;
  if (typeof input === 'number' && Number.isFinite(input)) {
    return new Date(input);
  }
  if (typeof input === 'string') {
    const parsed = Date.parse(input);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed);
    }
  }
  return null;
}

function toIsoString(value: unknown): string | null {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const dateValue = (value as { toDate: () => Date }).toDate();
    return dateValue.toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return null;
}

function compact<T extends Record<string, unknown>>(data: T): T {
  const next = { ...data } as Record<string, unknown>;
  Object.keys(next).forEach((key) => {
    if (next[key] === undefined) {
      delete next[key];
    }
  });
  return next as T;
}

function resolveSourceDomain(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get('limit') ?? '50');
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50;
  const cursorParam = searchParams.get('cursor');

  const db = getAdminFirestore();
  let query = db
    .collection(COLLECTIONS.histories)
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .orderBy('__name__', 'desc')
    .limit(limit);

  if (cursorParam) {
    const [cursorMsRaw, cursorId] = cursorParam.split(':');
    const cursorMs = Number(cursorMsRaw);
    if (Number.isFinite(cursorMs) && cursorId) {
      query = query.startAfter(new Date(cursorMs), cursorId);
    } else if (Number.isFinite(cursorMs)) {
      query = query.startAfter(new Date(cursorMs));
    }
  }

  const snapshot = await query.get();
  const items = snapshot.docs.map((doc: any) => {
    const data = doc.data();
    const createdAt = toIsoString(data.createdAt) ?? null;
    return {
      id: doc.id,
      ...data,
      createdAt,
    };
  });

  const lastDoc = snapshot.docs.at(-1);
  const lastCreatedAt = lastDoc?.data().createdAt;
  let nextCursor: string | null = null;
  if (lastDoc && lastCreatedAt) {
    if (typeof lastCreatedAt?.toMillis === 'function') {
      nextCursor = `${lastCreatedAt.toMillis()}:${lastDoc.id}`;
    } else if (lastCreatedAt instanceof Date) {
      nextCursor = `${lastCreatedAt.getTime()}:${lastDoc.id}`;
    }
  }

  return NextResponse.json({ items, nextCursor, limit });
}

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: SaveHistoryRequest;
  try {
    body = (await request.json()) as SaveHistoryRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { resultId, url, title } = body;
  if (!resultId || !url || !title) {
    return NextResponse.json({ error: 'resultId, url, title are required' }, { status: 400 });
  }

  let historyId = body.historyId ?? crypto.randomUUID();
  const createdAt = new Date();
  const sourceDomain = body.sourceDomain ?? resolveSourceDomain(url);

  const db = getAdminFirestore();
  const resultRef = db.collection(COLLECTIONS.results).doc(resultId);
  const intermediateRef = db.collection(COLLECTIONS.intermediates).doc(resultId);
  const mangaRef = db.collection(COLLECTIONS.manga).doc(resultId);

  const existingResult = await resultRef.get();
  if (existingResult.exists) {
    const existing = existingResult.data();
    if (existing?.userId && existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (existing?.historyId && existing.historyId !== historyId) {
      if (body.historyId) {
        return NextResponse.json({ error: 'resultId already linked to another historyId' }, { status: 409 });
      }
      historyId = existing.historyId as string;
    }
  }

  let historyRef = db.collection(COLLECTIONS.histories).doc(historyId);
  const existingHistory = await historyRef.get();
  if (existingHistory.exists) {
    const historyData = existingHistory.data();
    if (!historyData?.userId || historyData.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (historyData.resultId && historyData.resultId !== resultId) {
      if (body.historyId) {
        return NextResponse.json({ error: 'historyId already linked to another resultId' }, { status: 409 });
      }
      historyId = crypto.randomUUID();
      historyRef = db.collection(COLLECTIONS.histories).doc(historyId);
    }
  }

  const historyData = compact({
    userId,
    url,
    title,
    createdAt,
    resultId,
    summary: body.summary,
    status: body.status,
    sourceDomain,
    tags: body.tags,
  });

  const resultData = compact({
    historyId,
    userId,
    createdAt,
    checklist: body.checklist,
    generatedSummary: body.generatedSummary,
    intermediateRef: body.intermediate ? intermediateRef.path : undefined,
    mangaRef: body.manga ? mangaRef.path : undefined,
    schemaVersion: body.schemaVersion ?? 1,
  });

  const batch = db.batch();
  batch.set(historyRef, historyData, { merge: true });
  batch.set(resultRef, resultData, { merge: true });

  if (body.intermediate) {
    batch.set(
      intermediateRef,
      compact({
        userId,
        historyId,
        resultId,
        createdAt,
        intermediate: body.intermediate,
      }),
      { merge: true }
    );
  }

  if (body.manga) {
    batch.set(
      mangaRef,
      compact({
        userId,
        historyId,
        resultId,
        createdAt,
        manga: body.manga,
      }),
      { merge: true }
    );
  }

  await batch.commit();

  return NextResponse.json({ historyId, resultId });
}
