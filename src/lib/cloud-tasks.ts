/**
 * Cloud Tasks を使用した漫画生成タスクのエンキュー
 */

import { CloudTasksClient, protos } from "@google-cloud/tasks";
import type { MangaRequest } from "./types/intermediate";

// gRPC ステータスコード
const GRPC_STATUS_ALREADY_EXISTS = 6;

// 環境変数を遅延取得（ビルド時のエラーを回避）
function getProjectId(): string {
  const value = process.env.GCP_PROJECT_ID;
  if (!value) {
    throw new Error("GCP_PROJECT_ID environment variable is required");
  }
  return value;
}

function getLocation(): string {
  const value = process.env.CLOUD_TASKS_LOCATION;
  if (!value) {
    throw new Error("CLOUD_TASKS_LOCATION environment variable is required");
  }
  return value;
}

function getQueueName(): string {
  const value = process.env.CLOUD_TASKS_QUEUE;
  if (!value) {
    throw new Error("CLOUD_TASKS_QUEUE environment variable is required");
  }
  return value;
}

function getWorkerUrl(): string | undefined {
  return process.env.MANGA_WORKER_URL;
}

function getServiceAccountEmail(): string {
  const value = process.env.CLOUD_RUN_SERVICE_ACCOUNT;
  if (!value) {
    throw new Error("CLOUD_RUN_SERVICE_ACCOUNT environment variable is required");
  }
  return value;
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
  const workerUrl = getWorkerUrl();
  if (!workerUrl) {
    throw new Error("MANGA_WORKER_URL environment variable is not set");
  }

  const projectId = getProjectId();
  const location = getLocation();
  const queueName = getQueueName();
  const serviceAccountEmail = getServiceAccountEmail();

  const client = getTasksClient();
  const parent = client.queuePath(projectId, location, queueName);

  const payload: MangaTaskPayload = {
    jobId,
    request,
    userId,
  };

  // タスクを作成
  const task: protos.google.cloud.tasks.v2.ITask = {
    httpRequest: {
      httpMethod: "POST",
      url: workerUrl,
      headers: {
        "Content-Type": "application/json",
      },
      body: Buffer.from(JSON.stringify(payload)).toString("base64"),
      // OIDC トークンで Worker サービスを認証
      oidcToken: {
        serviceAccountEmail: serviceAccountEmail,
        audience: workerUrl,
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
  return !!getWorkerUrl() && !!process.env.CLOUD_TASKS_QUEUE;
}
