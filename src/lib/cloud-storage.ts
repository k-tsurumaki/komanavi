/**
 * Cloud Storage 操作（署名付きURL生成）
 */

import { Storage } from "@google-cloud/storage";

const BUCKET_NAME = process.env.GCS_MANGA_BUCKET || "komanavi-manga-images";
const SIGNED_URL_TTL_MINUTES = parseInt(
  process.env.GCS_SIGNED_URL_TTL_MINUTES ?? "60",
  10
);
const PROJECT_ID = process.env.GCP_PROJECT_ID;

if (!PROJECT_ID) {
  throw new Error("GCP_PROJECT_ID environment variable is required");
}

// Storage クライアントを初期化
const storage = new Storage({
  projectId: PROJECT_ID,
});

/**
 * gs:// 形式のURLからobjectPathを抽出
 */
export function parseStorageUrl(storageUrl: string): string | null {
  const match = storageUrl.match(/^gs:\/\/[^/]+\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * 署名付き URL を生成
 */
export async function generateSignedUrl(storageUrl: string): Promise<string> {
  const objectPath = parseStorageUrl(storageUrl);
  if (!objectPath) {
    throw new Error(`Invalid storage URL: ${storageUrl}`);
  }

  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(objectPath);

  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + SIGNED_URL_TTL_MINUTES * 60 * 1000,
  });

  return url;
}
