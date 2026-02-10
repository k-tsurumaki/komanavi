/**
 * Cloud Storage 操作（署名付きURL生成）
 */

import { Storage } from "@google-cloud/storage";

const SIGNED_URL_TTL_MINUTES = parseInt(
  process.env.GCS_SIGNED_URL_TTL_MINUTES ?? "60",
  10
);

// Storage クライアントの遅延初期化
let storage: Storage | null = null;

function getStorage(): Storage {
  if (!storage) {
    const PROJECT_ID = process.env.GCP_PROJECT_ID;
    if (!PROJECT_ID) {
      throw new Error("GCP_PROJECT_ID environment variable is required");
    }
    storage = new Storage({
      projectId: PROJECT_ID,
    });
  }
  return storage;
}

/**
 * 署名付き URL を生成
 */
export async function generateSignedUrl(storageUrl: string): Promise<string> {
  const match = storageUrl.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid storage URL: ${storageUrl}`);
  }
  const [, bucketName, objectPath] = match;

  const storageClient = getStorage();
  const bucket = storageClient.bucket(bucketName);
  const file = bucket.file(objectPath);

  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + SIGNED_URL_TTL_MINUTES * 60 * 1000,
  });

  return url;
}
