/**
 * Firestore を使用した漫画ジョブの永続化
 * コレクション: mangaJobs/{jobId}
 */

import { getAdminFirestore } from "./firebase-admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type { MangaRequest, MangaResult, MangaJobStatus, MangaJobStatusResponse } from "./types/intermediate";

const COLLECTION_NAME = "mangaJobs";

/** エラーコードの型（MangaJobStatusResponse から抽出） */
type MangaErrorCode = MangaJobStatusResponse["errorCode"];

/**
 * Firestore に保存するジョブドキュメントの型
 */
export interface MangaJobDocument {
  id: string;
  status: MangaJobStatus;
  progress: number;
  userId?: string;
  clientId: string;
  request: MangaRequest;
  result?: MangaResult;
  error?: string;
  errorCode?: MangaErrorCode;
  storageUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * API レスポンス用に変換されたジョブ
 */
export interface MangaJobResponse {
  id: string;
  status: MangaJobStatus;
  progress: number;
  userId?: string;
  clientId: string;
  request: MangaRequest;
  result?: MangaResult;
  error?: string;
  errorCode?: MangaErrorCode;
  storageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Firestore ドキュメントを API レスポンス形式に変換
 */
function toResponse(doc: MangaJobDocument): MangaJobResponse {
  return {
    ...doc,
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
  };
}

/**
 * 新規ジョブを作成
 */
export async function createMangaJob(
  jobId: string,
  request: MangaRequest,
  userId: string | undefined,
  clientId: string
): Promise<void> {
  const db = getAdminFirestore();
  const now = Timestamp.now();

  const jobDoc: MangaJobDocument = {
    id: jobId,
    status: "queued",
    progress: 0,
    clientId,
    request,
    createdAt: now,
    updatedAt: now,
  };

  if (userId) {
    jobDoc.userId = userId;
  }

  await db.collection(COLLECTION_NAME).doc(jobId).set(jobDoc);
}

/**
 * ジョブを取得
 */
export async function getMangaJob(jobId: string): Promise<MangaJobResponse | null> {
  const db = getAdminFirestore();
  const doc = await db.collection(COLLECTION_NAME).doc(jobId).get();

  if (!doc.exists) {
    return null;
  }

  return toResponse(doc.data() as MangaJobDocument);
}

/**
 * ジョブのステータスと進捗を更新
 */
export async function updateMangaJobStatus(
  jobId: string,
  status: MangaJobStatus,
  progress: number
): Promise<void> {
  const db = getAdminFirestore();
  await db.collection(COLLECTION_NAME).doc(jobId).update({
    status,
    progress,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * ジョブの結果を設定（完了時）
 */
export async function updateMangaJobResult(
  jobId: string,
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

  await db.collection(COLLECTION_NAME).doc(jobId).update(updateData);
}

/**
 * ジョブのエラーを設定
 */
export async function updateMangaJobError(
  jobId: string,
  errorCode: NonNullable<MangaErrorCode>,
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

  await db.collection(COLLECTION_NAME).doc(jobId).update(updateData);
}

/**
 * 古いジョブを削除（TTL: 24時間）
 * Cloud Scheduler などで定期実行することを想定
 */
export async function cleanupOldJobs(ttlHours: number = 24): Promise<number> {
  const db = getAdminFirestore();
  const cutoff = Timestamp.fromDate(new Date(Date.now() - ttlHours * 60 * 60 * 1000));

  const snapshot = await db
    .collection(COLLECTION_NAME)
    .where("createdAt", "<", cutoff)
    .limit(500)
    .get();

  if (snapshot.empty) {
    return 0;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  return snapshot.size;
}
