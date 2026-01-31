import express, { Request, Response, NextFunction } from "express";
import { processManga } from "./process-manga.js";
import type { MangaRequest } from "./types.js";

const app = express();
app.use(express.json());

// Cloud Tasks からのリクエストボディ
interface ProcessRequest {
  jobId: string;
  request: MangaRequest;
  userId?: string;
}

/**
 * Cloud Tasks から呼び出される漫画生成エンドポイント
 * OIDC 認証は Cloud Run の設定で制御
 */
app.post("/process", async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { jobId, request, userId } = req.body as ProcessRequest;

  // Cloud Tasks ヘッダーを確認（デバッグ用）
  const taskName = req.headers["x-cloudtasks-taskname"];
  const queueName = req.headers["x-cloudtasks-queuename"];
  const retryCount = req.headers["x-cloudtasks-taskretrycount"];

  console.log(`[Worker] Processing job: ${jobId}`, {
    taskName,
    queueName,
    retryCount,
    title: request?.title,
  });

  if (!jobId || !request) {
    console.error("[Worker] Invalid request: missing jobId or request");
    res.status(400).json({ success: false, error: "Missing required fields" });
    return;
  }

  try {
    await processManga(jobId, request, userId);

    const duration = Date.now() - startTime;
    console.log(`[Worker] Job ${jobId} completed successfully in ${duration}ms`);

    res.json({ success: true, duration });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Worker] Job ${jobId} failed after ${duration}ms:`, error);

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

// HTTPステータスコード
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;

/**
 * エラーがリトライ可能かどうかを判定
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // レート制限エラー
    if ((error as { status?: number }).status === HTTP_STATUS_TOO_MANY_REQUESTS) {
      return true;
    }
    // ネットワークエラー
    if (error.message.includes("ECONNRESET") || error.message.includes("ETIMEDOUT")) {
      return true;
    }
    // Firestore 一時エラー
    if (error.message.includes("UNAVAILABLE") || error.message.includes("DEADLINE_EXCEEDED")) {
      return true;
    }
  }
  return false;
}

/**
 * グローバルエラーハンドラー
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[Worker] Unhandled error:", err);
  res.status(500).json({ success: false, error: "Internal server error" });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`[Worker] Listening on port ${PORT}`);
  console.log(`[Worker] Environment: ${process.env.NODE_ENV || "development"}`);
});
