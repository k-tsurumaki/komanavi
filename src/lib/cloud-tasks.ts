/**
 * Cloud Tasks を使用した漫画生成タスクのエンキュー
 */

import { CloudTasksClient, protos } from '@google-cloud/tasks';
import type { MangaRequest } from './types/intermediate';

// gRPC ステータスコード
const GRPC_STATUS_ALREADY_EXISTS = 6;

type CloudTasksRequiredEnvVar =
  | 'GCP_PROJECT_ID'
  | 'CLOUD_TASKS_LOCATION'
  | 'CLOUD_TASKS_QUEUE'
  | 'MANGA_WORKER_URL'
  | 'CLOUD_RUN_SERVICE_ACCOUNT';

type CloudTasksConfig = {
  projectId?: string;
  location?: string;
  queueName?: string;
  workerUrl?: string;
  serviceAccountEmail?: string;
};

// Cloud Tasks クライアントを遅延初期化
let tasksClient: CloudTasksClient | null = null;

function readCloudTasksConfig(): CloudTasksConfig {
  return {
    projectId: process.env.GCP_PROJECT_ID,
    location: process.env.CLOUD_TASKS_LOCATION,
    queueName: process.env.CLOUD_TASKS_QUEUE,
    workerUrl: process.env.MANGA_WORKER_URL,
    serviceAccountEmail: process.env.CLOUD_RUN_SERVICE_ACCOUNT,
  };
}

function getMissingCloudTasksEnvVarsFromConfig(
  config: CloudTasksConfig
): CloudTasksRequiredEnvVar[] {
  const entries: Array<[CloudTasksRequiredEnvVar, string | undefined]> = [
    ['GCP_PROJECT_ID', config.projectId],
    ['CLOUD_TASKS_LOCATION', config.location],
    ['CLOUD_TASKS_QUEUE', config.queueName],
    ['MANGA_WORKER_URL', config.workerUrl],
    ['CLOUD_RUN_SERVICE_ACCOUNT', config.serviceAccountEmail],
  ];
  return entries.filter(([, value]) => !value).map(([key]) => key);
}

function resolveCloudTasksConfig(): {
  projectId: string;
  location: string;
  queueName: string;
  workerUrl: string;
  serviceAccountEmail: string;
} {
  const config = readCloudTasksConfig();
  const missing = getMissingCloudTasksEnvVarsFromConfig(config);
  if (missing.length > 0) {
    throw new Error(`Cloud Tasks configuration is incomplete: ${missing.join(', ')}`);
  }
  const { projectId, location, queueName, workerUrl, serviceAccountEmail } = config;
  if (!projectId || !location || !queueName || !workerUrl || !serviceAccountEmail) {
    throw new Error('Cloud Tasks configuration is incomplete');
  }
  return {
    projectId,
    location,
    queueName,
    workerUrl,
    serviceAccountEmail,
  };
}

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
  resultId: string;  // jobId から resultId に変更
  request: MangaRequest;
  userId: string;
}

/**
 * 漫画生成タスクを Cloud Tasks にエンキュー
 *
 * @param resultId 解析結果ID（Firestore のドキュメントID）
 * @param request 漫画生成リクエスト
 * @param userId 認証済みユーザーID
 */
export async function enqueueMangaTask(
  resultId: string,
  request: MangaRequest,
  userId: string
): Promise<string> {
  const { projectId, location, queueName, workerUrl, serviceAccountEmail } =
    resolveCloudTasksConfig();

  const client = getTasksClient();
  const parent = client.queuePath(projectId, location, queueName);

  const payload: MangaTaskPayload = {
    resultId,
    request,
    userId,
  };

  // タスクを作成
  const task: protos.google.cloud.tasks.v2.ITask = {
    httpRequest: {
      httpMethod: 'POST',
      url: workerUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      body: Buffer.from(JSON.stringify(payload)).toString('base64'),
      // OIDC トークンで Worker サービスを認証
      oidcToken: {
        serviceAccountEmail,
        audience: workerUrl,
      },
    },
    // タスク名を指定（重複防止）
    name: `${parent}/tasks/${resultId}`,
  };

  try {
    const [response] = await client.createTask({ parent, task });
    console.log(`[Cloud Tasks] タスク作成: ${response.name}`);
    return response.name ?? resultId;
  } catch (error) {
    // 同じ名前のタスクが既に存在する場合は無視
    if ((error as { code?: number }).code === GRPC_STATUS_ALREADY_EXISTS) {
      console.log(`[Cloud Tasks] タスク既存: ${resultId}`);
      return `${parent}/tasks/${resultId}`;
    }
    throw error;
  }
}

export function getMissingCloudTasksEnvVars(): CloudTasksRequiredEnvVar[] {
  return getMissingCloudTasksEnvVarsFromConfig(readCloudTasksConfig());
}
