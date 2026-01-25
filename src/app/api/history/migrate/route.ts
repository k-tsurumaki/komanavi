import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import type { AnalyzeResult } from '@/lib/types/intermediate';

export const runtime = 'nodejs';

const COLLECTIONS = {
  histories: 'conversation_histories',
  results: 'conversation_results',
  intermediates: 'conversation_intermediates',
} as const;

type MigrationHistoryItem = {
  id: string;
  url: string;
  title: string;
  createdAt: string;
  resultId: string;
};

type MigrationHistoryResult = {
  historyId: string;
  resultId: string;
  createdAt: string;
  result: AnalyzeResult;
};

type MigrationRequest = {
  historyItems: MigrationHistoryItem[];
  historyResults: MigrationHistoryResult[];
};

function toDateValue(input?: string): Date {
  if (!input) return new Date();
  const parsed = Date.parse(input);
  if (Number.isNaN(parsed)) return new Date();
  return new Date(parsed);
}

function resolveSourceDomain(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
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

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: MigrationRequest;
  try {
    body = (await request.json()) as MigrationRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const historyItems = Array.isArray(body.historyItems) ? body.historyItems : [];
    const historyResults = Array.isArray(body.historyResults) ? body.historyResults : [];

    if (historyItems.length === 0) {
      return NextResponse.json({ migrated: 0 });
    }

    const resultsByHistoryId = new Map<string, MigrationHistoryResult>();
    const resultsByResultId = new Map<string, MigrationHistoryResult>();
    historyResults.forEach((entry) => {
      resultsByHistoryId.set(entry.historyId, entry);
      resultsByResultId.set(entry.resultId, entry);
    });

    const db = getAdminFirestore();
    let batch = db.batch();
    let batchCount = 0;
    let migrated = 0;

    const commitBatch = async () => {
      if (batchCount === 0) return;
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    };

    for (const history of historyItems) {
      if (!history?.id || !history.url || !history.resultId) {
        continue;
      }

      const createdAt = toDateValue(history.createdAt);
      const sourceDomain = resolveSourceDomain(history.url);
      const resultEntry =
        resultsByHistoryId.get(history.id) ?? resultsByResultId.get(history.resultId);

      const historyData = compact({
        userId,
        url: history.url,
        title: history.title || history.url,
        createdAt,
        resultId: history.resultId,
        summary:
          resultEntry?.result?.generatedSummary?.slice(0, 300) ||
          resultEntry?.result?.intermediate?.summary?.slice(0, 300),
        status: resultEntry?.result?.status,
        sourceDomain,
      });

      const historyRef = db.collection(COLLECTIONS.histories).doc(history.id);
      batch.set(historyRef, historyData, { merge: true });
      batchCount += 1;

      if (resultEntry?.result) {
        const result = resultEntry.result;
        const resultCreatedAt = toDateValue(resultEntry.createdAt || history.createdAt);
        const resultRef = db.collection(COLLECTIONS.results).doc(resultEntry.resultId);
        const intermediateRef = db.collection(COLLECTIONS.intermediates).doc(resultEntry.resultId);

        const resultData = compact({
          historyId: history.id,
          userId,
          createdAt: resultCreatedAt,
          checklist: result.checklist,
          generatedSummary: result.generatedSummary,
          intermediateRef: result.intermediate ? intermediateRef.path : undefined,
          schemaVersion: 1,
        });

        batch.set(resultRef, resultData, { merge: true });
        batchCount += 1;

        if (result.intermediate) {
          batch.set(
            intermediateRef,
            compact({
              userId,
              historyId: history.id,
              resultId: resultEntry.resultId,
              createdAt: resultCreatedAt,
              intermediate: result.intermediate,
            }),
            { merge: true }
          );
          batchCount += 1;
        }
      }

      migrated += 1;

      if (batchCount >= 400) {
        await commitBatch();
      }
    }

    await commitBatch();

    return NextResponse.json({ migrated });
  } catch (error) {
    console.error('History migration API error:', error);
    return NextResponse.json(
      { error: 'Migration failed' },
      { status: 500 }
    );
  }
}
