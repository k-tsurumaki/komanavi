import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireUserId, toIsoString, compact } from '@/app/api/history/utils';
import type { ChecklistItem } from '@/lib/types/intermediate';
import { validateHistoryResultMutableFields } from '@/app/api/history/validation';
import { generateSignedUrl } from '@/lib/cloud-storage';

export const runtime = 'nodejs';

const COLLECTIONS = {
  histories: 'conversation_histories',
  results: 'conversation_results',
  intermediates: 'conversation_intermediates',
  manga: 'conversation_manga',
} as const;

type PatchHistoryRequest = {
  checklist?: ChecklistItem[];
  userIntent?: string;
  intentAnswer?: string;
  guidanceUnlocked?: boolean;
};

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
  let manga = null;

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

      // 漫画データを取得
      const mangaRef = db.collection(COLLECTIONS.manga).doc(resultId);
      const mangaSnap = await mangaRef.get();
      if (mangaSnap.exists) {
        const mangaData = mangaSnap.data();
        if (mangaData?.userId === userId) {
          // 署名付きURLを再生成（期限切れ対策）
          let updatedResult = mangaData.result;
          if (mangaData.result && mangaData.storageUrl) {
            try {
              const newSignedUrl = await generateSignedUrl(mangaData.storageUrl);
              updatedResult = {
                ...mangaData.result,
                imageUrls: [newSignedUrl],
              };
              // Firestoreへの書き込みは不要（レスポンスにのみ新しいURLを含める）
            } catch (error) {
              console.error('Failed to generate signed URL:', error);
              // エラーが発生しても処理は続行（既存のURLを使う）
            }
          }

          manga = {
            id: mangaSnap.id,
            ...mangaData,
            result: updatedResult,
            createdAt: toIsoString(mangaData.createdAt),
            updatedAt: toIsoString(mangaData.updatedAt),
          };
        }
      }

    }
  }

  return NextResponse.json({ history, result, intermediate, manga });
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

  // resultId の所有権確認（セキュリティ強化）
  if (resultId) {
    const resultRef = db.collection(COLLECTIONS.results).doc(resultId);
    const resultSnap = await resultRef.get();

    if (resultSnap.exists) {
      const resultData = resultSnap.data();
      if (resultData?.userId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
  }

  const batch = db.batch();
  batch.delete(historyRef);

  if (resultId) {
    batch.delete(db.collection(COLLECTIONS.results).doc(resultId));
    batch.delete(db.collection(COLLECTIONS.intermediates).doc(resultId));

    // 漫画データも削除（セキュリティ課題の解決）
    batch.delete(db.collection(COLLECTIONS.manga).doc(resultId));
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
