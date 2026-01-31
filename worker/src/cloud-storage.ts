/**
 * Worker 用 Cloud Storage 操作
 */

import { Storage } from "@google-cloud/storage";

const BUCKET_NAME = process.env.GCS_MANGA_BUCKET ?? "komanavi-manga-images";
const SIGNED_URL_TTL_MINUTES = parseInt(
  process.env.GCS_SIGNED_URL_TTL_MINUTES ?? "60",
  10
);
const PROJECT_ID = process.env.GCP_PROJECT_ID ?? "zenn-ai-agent-hackathon-vol4";

// Storage クライアントを初期化
const storage = new Storage({
  projectId: PROJECT_ID,
});

export interface MangaImageMetadata {
  sourceUrl: string;
  title: string;
  generatedAt: string;
  userId: string;
}

/**
 * 漫画画像を Cloud Storage にアップロード
 */
export async function uploadMangaImage(
  userId: string,
  base64Data: string,
  metadata: Omit<MangaImageMetadata, "userId">
): Promise<string> {
  const bucket = storage.bucket(BUCKET_NAME);

  // Base64 Data URL からバイナリに変換
  const base64Match = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!base64Match) {
    throw new Error("Invalid base64 data URL format");
  }

  const [, , base64Content] = base64Match;
  const buffer = Buffer.from(base64Content, "base64");

  // オブジェクトパス生成
  const timestamp = Date.now();
  const uuid = crypto.randomUUID().split("-")[0];
  const objectPath = `users/${userId}/manga/${timestamp}-${uuid}.png`;

  const file = bucket.file(objectPath);

  // メタデータ設定
  const customMetadata: Record<string, string> = {
    "source-url": metadata.sourceUrl,
    title: metadata.title,
    "generated-at": metadata.generatedAt,
    "user-id": userId,
  };

  // アップロード
  await file.save(buffer, {
    metadata: {
      contentType: "image/png",
      metadata: customMetadata,
    },
    resumable: false,
  });

  return objectPath;
}

/**
 * 署名付き URL を生成
 */
export async function getSignedUrl(objectPath: string): Promise<string> {
  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(objectPath);

  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + SIGNED_URL_TTL_MINUTES * 60 * 1000,
  });

  return url;
}

/**
 * 画像をアップロードして署名付き URL を返す
 */
export async function uploadMangaImageAndGetUrl(
  userId: string,
  base64Data: string,
  metadata: Omit<MangaImageMetadata, "userId">
): Promise<{ storageUrl: string; signedUrl: string }> {
  const objectPath = await uploadMangaImage(userId, base64Data, metadata);
  const signedUrl = await getSignedUrl(objectPath);

  return {
    storageUrl: `gs://${BUCKET_NAME}/${objectPath}`,
    signedUrl,
  };
}
