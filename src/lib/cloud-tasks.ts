/**
 * Cloud Tasks を使用した漫画生成タスクのエンキュー
 */

import { CloudTasksClient, protos } from "@google-cloud/tasks";
import type { MangaRequest } from "./types/intermediate";

// gRPC ステータスコード
const GRPC_STATUS_ALREADY_EXISTS = 6;

const PROJECT_ID = process.env.GCP_PROJECT_ID;
const LOCATION = process.env.CLOUD_TASKS_LOCATION;
const QUEUE_NAME = process.env.CLOUD_TASKS_QUEUE;
const WORKER_URL = process.env.MANGA_WORKER_URL;
const SERVICE_ACCOUNT_EMAIL = process.env.CLOUD_RUN_SERVICE_ACCOUNT;

if (!PROJECT_ID) {
  throw new Error("GCP_PROJECT_ID environment variable is required");
}

if (!LOCATION) {
  throw new Error("CLOUD_TASKS_LOCATION environment variable is required");
}

if (!QUEUE_NAME) {
  throw new Error("CLOUD_TASKS_QUEUE environment variable is required");
}

if (!SERVICE_ACCOUNT_EMAIL) {
  throw new Error("CLOUD_RUN_SERVICE_ACCOUNT environment variable is required");
}

// Cloud Tasks クライアントを遅延初期化
let tasksClient: CloudTasksClient | null = null;

function getTasksClient(): CloudTasksClient {
  if (!tasksClient) {
    tasksClient = new CloudTasksClient();
  }
  return tasksClient;
}

/**
 * Cloud Tasks ペイロード
 */
interface MangaTaskPayload {
  jobId: string;
  request: MangaRequest;
  userId: string;
}

/**
 * 漫画生成タスクを Cloud Tasks にエンキュー
 *
 * @param jobId ジョブID（Firestore のドキュメントID）
 * @param request 漫画生成リクエスト
 * @param userId 認証済みユーザーID
 */
export async function enqueueMangaTask(
  jobId: string,
  request: MangaRequest,
  userId: string
): Promise<string> {
  if (!WORKER_URL) {
    throw new Error("MANGA_WORKER_URL environment variable is not set");
  }

  if (!PROJECT_ID || !LOCATION || !QUEUE_NAME) {
    throw new Error("Cloud Tasks configuration is incomplete");
  }

  const client = getTasksClient();
  const parent = client.queuePath(PROJECT_ID, LOCATION, QUEUE_NAME);

  const payload: MangaTaskPayload = {
    jobId,
    request,
    userId,
  };

  // タスクを作成
  const task: protos.google.cloud.tasks.v2.ITask = {
    httpRequest: {
      httpMethod: "POST",
      url: WORKER_URL,
      headers: {
        "Content-Type": "application/json",
      },
      body: Buffer.from(JSON.stringify(payload)).toString("base64"),
      // OIDC トークンで Worker サービスを認証
      oidcToken: {
        serviceAccountEmail: SERVICE_ACCOUNT_EMAIL,
        audience: WORKER_URL,
      },
    },
    // タスク名を指定（重複防止）
    name: `${parent}/tasks/${jobId}`,
  };

  try {
    const [response] = await client.createTask({ parent, task });
    console.log(`[Cloud Tasks] タスク作成: ${response.name}`);
    return response.name ?? jobId;
  } catch (error) {
    // 同じ名前のタスクが既に存在する場合は無視
    if ((error as { code?: number }).code === GRPC_STATUS_ALREADY_EXISTS) {
      console.log(`[Cloud Tasks] タスク既存: ${jobId}`);
      return `${parent}/tasks/${jobId}`;
    }
    throw error;
  }
}

/**
 * Cloud Tasks が利用可能かチェック
 * ローカル開発時など、Cloud Tasks が使えない場合は false を返す
 */
export function isCloudTasksEnabled(): boolean {
  return !!WORKER_URL && !!process.env.CLOUD_TASKS_QUEUE;
}
