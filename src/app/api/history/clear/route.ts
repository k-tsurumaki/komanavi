import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const COLLECTIONS = {
  histories: 'conversation_histories',
  results: 'conversation_results',
  intermediates: 'conversation_intermediates',
  manga: 'conversation_manga',
} as const;

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminFirestore();
  let lastDoc: any = null;
  let deletedCount = 0;

  while (true) {
    let query = db
      .collection(COLLECTIONS.histories)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .orderBy('__name__', 'desc')
      .limit(100);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc: any) => {
      const data = doc.data();
      const resultId = data.resultId as string | undefined;
      batch.delete(doc.ref);
      if (resultId) {
        batch.delete(db.collection(COLLECTIONS.results).doc(resultId));
        batch.delete(db.collection(COLLECTIONS.intermediates).doc(resultId));
        batch.delete(db.collection(COLLECTIONS.manga).doc(resultId));
      }
    });

    await batch.commit();
    deletedCount += snapshot.size;
    lastDoc = snapshot.docs.at(-1) ?? null;

    if (snapshot.size < 100) {
      break;
    }
  }

  return NextResponse.json({ deleted: true, count: deletedCount });
}
