/**
 * Firestore を使用した漫画ジョブの永続化
 * コレクション: conversation_manga
 */

import { getAdminFirestore } from "./firebase-admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type {
  MangaRequest,
  MangaResult,
  MangaJobStatus,
  ConversationMangaDocument,
} from "./types/intermediate";

const CONVERSATION_MANGA_COLLECTION = "conversation_manga";

// ============================================
// 会話履歴に紐づく漫画の管理
// ============================================

/**
 * 会話履歴に紐づく漫画を作成
 */
export async function createConversationManga(
  resultId: string,
  historyId: string,
  request: MangaRequest,
  userId: string
): Promise<void> {
  const db = getAdminFirestore();
  const now = Timestamp.now();

  // 既存のドキュメントをチェック
  const existingDoc = await db.collection(CONVERSATION_MANGA_COLLECTION).doc(resultId).get();
  if (existingDoc.exists) {
    const existingData = existingDoc.data() as ConversationMangaDocument;
    // 所有権とhistoryIdの整合性を確認
    if (existingData.userId !== userId || existingData.historyId !== historyId) {
      throw new Error('Forbidden: resultId or historyId mismatch');
    }
    // 処理中のジョブは上書き不可（ただしタイムアウト経過していればOK）
    if (existingData.status === 'queued' || existingData.status === 'processing') {
      const elapsedMs = now.toMillis() - existingData.createdAt.toMillis();
      const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10分

      if (elapsedMs <= STALE_THRESHOLD_MS) {
        throw new Error('Job is already in progress');
      }
      // 10分以上経過していれば上書き許可（暗黙的なクリーンアップ）
      console.log(`[Manga Store] Stale job detected, allowing overwrite: ${resultId}`);
    }
  }

  const mangaDoc: ConversationMangaDocument = {
    id: resultId,
    resultId,
    historyId,
    userId,
    status: "queued",
    progress: 0,
    request,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(CONVERSATION_MANGA_COLLECTION).doc(resultId).set(mangaDoc);
}

/**
 * 漫画を取得
 */
export async function getConversationManga(resultId: string): Promise<ConversationMangaDocument | null> {
  const db = getAdminFirestore();
  const doc = await db.collection(CONVERSATION_MANGA_COLLECTION).doc(resultId).get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as ConversationMangaDocument;
}

/**
 * ジョブのステータスと進捗を更新
 */
export async function updateConversationMangaStatus(
  resultId: string,
  status: MangaJobStatus,
  progress: number
): Promise<void> {
  const db = getAdminFirestore();
  await db.collection(CONVERSATION_MANGA_COLLECTION).doc(resultId).update({
    status,
    progress,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * ジョブの結果を設定（完了時）
 */
export async function updateConversationMangaResult(
  resultId: string,
  result: MangaResult,
  storageUrl?: string
): Promise<void> {
  const db = getAdminFirestore();
  const updateData: Record<string, unknown> = {
    status: "done" as MangaJobStatus,
    progress: 100,
    result,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (storageUrl) {
    updateData.storageUrl = storageUrl;
  }

  await db.collection(CONVERSATION_MANGA_COLLECTION).doc(resultId).update(updateData);
}

/**
 * ジョブのエラーを設定
 */
export async function updateConversationMangaError(
  resultId: string,
  errorCode: string,
  error: string,
  fallbackResult?: MangaResult
): Promise<void> {
  const db = getAdminFirestore();
  const updateData: Record<string, unknown> = {
    status: "error" as MangaJobStatus,
    errorCode,
    error,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (fallbackResult) {
    updateData.result = fallbackResult;
  }

  await db.collection(CONVERSATION_MANGA_COLLECTION).doc(resultId).update(updateData);
}
