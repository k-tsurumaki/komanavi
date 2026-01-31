import { Storage } from "@google-cloud/storage";

const BUCKET_NAME = process.env.GCS_MANGA_BUCKET;
const SIGNED_URL_TTL_MINUTES = parseInt(
  process.env.GCS_SIGNED_URL_TTL_MINUTES ?? "60",
  10
);
const PROJECT_ID = process.env.GCP_PROJECT_ID;

if (!BUCKET_NAME) {
  throw new Error("GCS_MANGA_BUCKET environment variable is required");
}

if (!PROJECT_ID) {
  throw new Error("GCP_PROJECT_ID environment variable is required");
}

// Storage クライアントを初期化
// 認証の優先順位:
// 1. GOOGLE_APPLICATION_CREDENTIALS 環境変数で指定されたキーファイル
// 2. gcloud auth application-default login で設定された ADC
// 3. Cloud Run のメタデータサーバー（自動）
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
 * @param userId Firebase Auth ユーザーID
 * @param base64Data Base64エンコードされた画像データ（data:image/png;base64,... 形式）
 * @param metadata 画像メタデータ
 * @returns Cloud Storage オブジェクトパス
 */
export async function uploadMangaImage(
  userId: string,
  base64Data: string,
  metadata: Omit<MangaImageMetadata, "userId">
): Promise<string> {
  if (!BUCKET_NAME) {
    throw new Error("GCS_MANGA_BUCKET is not configured");
  }
  const bucket = storage.bucket(BUCKET_NAME);

  // Base64 Data URLからバイナリに変換
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
 * 署名付きURLを生成
 * - サービスアカウントキーがある場合: 直接署名
 * - ない場合（ADC/Cloud Run）: IAM signBlob API を使用
 *
 * @param objectPath Cloud Storage オブジェクトパス
 * @returns 署名付きURL
 */
export async function getSignedUrl(objectPath: string): Promise<string> {
  if (!BUCKET_NAME) {
    throw new Error("GCS_MANGA_BUCKET is not configured");
  }
  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(objectPath);

  // IAM signBlob API を使って署名付きURLを生成
  // Cloud Run: アタッチされたサービスアカウントで自動的に署名
  // ローカル（偽装ADC）: 偽装先サービスアカウントで署名
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + SIGNED_URL_TTL_MINUTES * 60 * 1000,
  });

  return url;
}

/**
 * 画像をアップロードして署名付きURLを返す
 * @param userId Firebase Auth ユーザーID
 * @param base64Data Base64エンコードされた画像データ
 * @param metadata 画像メタデータ
 * @returns 署名付きURL
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
