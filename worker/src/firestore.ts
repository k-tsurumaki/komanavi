/**
 * Worker 用 Firestore 操作
 */

import { initializeApp, getApps, getApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { MangaJobStatus, MangaResult } from "./types.js";

const COLLECTION_NAME = "mangaJobs";

// Firebase Admin 初期化
function initializeFirebase() {
  if (getApps().length > 0) {
    return getApp();
  }

  // ローカル開発時はサービスアカウントキーを使用
  // Cloud Run ではデフォルト認証情報を使用
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({
      credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

// 遅延初期化
let app: ReturnType<typeof initializeApp> | null = null;

function getDb() {
  if (!app) {
    app = initializeFirebase();
  }
  return getFirestore(app, 'komanavi');
}

/**
 * ジョブのステータスと進捗を更新
 */
export async function updateMangaJobStatus(
  jobId: string,
  status: MangaJobStatus,
  progress: number
): Promise<void> {
  const db = getDb();
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
  const db = getDb();
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
  errorCode: string,
  error: string,
  fallbackResult?: MangaResult
): Promise<void> {
  const db = getDb();
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
