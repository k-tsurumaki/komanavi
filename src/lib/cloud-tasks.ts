/**
 * Cloud Tasks を使用した漫画生成タスクのエンキュー
 */

import { CloudTasksClient, protos } from "@google-cloud/tasks";
import type { MangaRequest } from "./types/intermediate";

const PROJECT_ID = process.env.GCP_PROJECT_ID ?? "zenn-ai-agent-hackathon-vol4";
const LOCATION = process.env.CLOUD_TASKS_LOCATION ?? "asia-northeast1";
const QUEUE_NAME = process.env.CLOUD_TASKS_QUEUE ?? "manga-generation";
const WORKER_URL = process.env.MANGA_WORKER_URL;

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
  userId?: string;
}

/**
 * 漫画生成タスクを Cloud Tasks にエンキュー
 *
 * @param jobId ジョブID（Firestore のドキュメントID）
 * @param request 漫画生成リクエスト
 * @param userId 認証済みユーザーID（オプション）
 */
export async function enqueueMangaTask(
  jobId: string,
  request: MangaRequest,
  userId?: string
): Promise<string> {
  if (!WORKER_URL) {
    throw new Error("MANGA_WORKER_URL environment variable is not set");
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
        serviceAccountEmail: `komanavi-cloud-run@${PROJECT_ID}.iam.gserviceaccount.com`,
        audience: WORKER_URL,
      },
    },
    // タスク名を指定（重複防止）
    name: `${parent}/tasks/${jobId}`,
  };

  try {
    const [response] = await client.createTask({ parent, task });
    console.log(`[Cloud Tasks] Task created: ${response.name}`);
    return response.name ?? jobId;
  } catch (error) {
    // 同じ名前のタスクが既に存在する場合は無視
    if ((error as { code?: number }).code === 6) {
      console.log(`[Cloud Tasks] Task already exists: ${jobId}`);
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
