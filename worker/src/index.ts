import express, { Request, Response, NextFunction } from "express";
import { processManga } from "./process-manga.js";
import type { MangaRequest } from "./types.js";

const app = express();
app.use(express.json());

// Cloud Tasks からのリクエストボディ
interface ProcessRequest {
  resultId: string;  // jobId から resultId に変更
  request: MangaRequest;
  userId: string;
}

/**
 * Cloud Tasks から呼び出される漫画生成エンドポイント
 * OIDC 認証は Cloud Run の設定で制御
 */
app.post("/process", async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { resultId, request, userId } = req.body as ProcessRequest;

  // Cloud Tasks ヘッダーを確認（デバッグ用）
  const taskName = req.headers["x-cloudtasks-taskname"];
  const queueName = req.headers["x-cloudtasks-queuename"];
  const retryCount = req.headers["x-cloudtasks-taskretrycount"];

  // リクエストボディのサイズをログ出力
  const bodyJson = JSON.stringify(req.body);
  const bodySizeBytes = Buffer.byteLength(bodyJson, 'utf8');
  const bodySizeKB = (bodySizeBytes / 1024).toFixed(2);

  console.log(`[Worker] Processing job: ${resultId}`, {
    taskName,
    queueName,
    retryCount,
    title: request?.title,
    bodySizeBytes,
    bodySizeKB: `${bodySizeKB} KB`,
  });

  if (!resultId || !request || !userId) {
    console.error("[Worker] Invalid request: missing required fields");
    res.status(400).json({ success: false, error: "Missing required fields" });
    return;
  }

  try {
    await processManga(resultId, request, userId);

    const duration = Date.now() - startTime;
    console.log(`[Worker] Job ${resultId} completed successfully in ${duration}ms`);

    res.json({ success: true, duration });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Worker] Job ${resultId} failed after ${duration}ms:`, error);

    // Cloud Tasks はステータスコード >= 500 でリトライする
    // 一時的なエラー（レート制限など）は 500 を返してリトライ
    // 永続的なエラー（バリデーションなど）は 200 を返してリトライしない
    const isRetryable = isRetryableError(error);

    if (isRetryable) {
      res.status(500).json({ success: false, error: errorMessage, retryable: true });
    } else {
      // エラーは既に Firestore に記録されているので、タスクは成功として扱う
      res.json({ success: false, error: errorMessage, retryable: false });
    }
  }
});

/**
 * ヘルスチェックエンドポイント
 */
app.get("/health", (_req: Request, res: Response) => {
  res.send("OK");
});

/**
 * エラーがリトライ可能かどうかを判定
 */
function isRetryableError(_error: unknown): boolean {
  // リトライなし: すべてのエラーを非リトライ扱い
  return false;
}

/**
 * グローバルエラーハンドラー
 */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[Worker] Unhandled error:", err);
  res.status(500).json({ success: false, error: "Internal server error" });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`[Worker] Listening on port ${PORT}`);
  console.log(`[Worker] Environment: ${process.env.NODE_ENV || "development"}`);
});
