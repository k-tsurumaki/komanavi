import { NextRequest, NextResponse } from 'next/server';
import type { MangaJobResponse, MangaRequest } from '@/lib/types/intermediate';
import { auth } from '@/lib/auth';
import { createMangaJob, getMangaJob } from '@/lib/manga-job-store';
import { enqueueMangaTask, isCloudTasksEnabled } from '@/lib/cloud-tasks';

const POLL_TIMEOUT_MS = 60 * 1000;

// レート制限用のインメモリ状態（同一クライアントからの並行リクエスト制限）
interface ActiveJobInfo {
  jobId: string;
  startedAt: number;
  url: string;
}

interface UsageState {
  date: string;
  activeJob?: ActiveJobInfo;
}

const globalState = globalThis as typeof globalThis & {
  __mangaUsageByClient?: Map<string, UsageState>;
};

const usageByClient = globalState.__mangaUsageByClient ?? new Map<string, UsageState>();
globalState.__mangaUsageByClient = usageByClient;

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function extractUserId(): Promise<string | null> {
  try {
    const session = await auth();
    return session?.user?.id ?? null;
  } catch (error) {
    console.error('Session retrieval failed:', error);
    return null;
  }
}

function getClientId(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'anonymous';
}

function getUsage(clientId: string): UsageState {
  const today = getTodayKey();
  const current = usageByClient.get(clientId);
  if (!current || current.date !== today) {
    const fresh: UsageState = { date: today };
    usageByClient.set(clientId, fresh);
    return fresh;
  }
  return current;
}

function setActiveJob(clientId: string, jobId: string, url: string) {
  const usage = getUsage(clientId);
  usage.activeJob = { jobId, startedAt: Date.now(), url };
  usageByClient.set(clientId, usage);
}

function clearActiveJob(clientId: string, jobId: string) {
  const usage = usageByClient.get(clientId);
  if (!usage || !usage.activeJob || usage.activeJob.jobId !== jobId) return;
  delete usage.activeJob;
  usageByClient.set(clientId, usage);
}

/**
 * 並行ジョブをチェック
 * Firestore のジョブ状態も確認して、完了していたらクリア
 */
async function hasActiveJob(clientId: string): Promise<boolean> {
  const usage = usageByClient.get(clientId);
  if (!usage?.activeJob) return false;

  const { jobId, startedAt } = usage.activeJob;

  // タイムアウト経過していたらクリア
  if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
    clearActiveJob(clientId, jobId);
    return false;
  }

  // Firestore でジョブの状態を確認
  try {
    const job = await getMangaJob(jobId);
    if (!job || job.status === 'done' || job.status === 'error') {
      clearActiveJob(clientId, jobId);
      return false;
    }
  } catch {
    // Firestore エラー時はインメモリ状態を信頼
  }

  return true;
}

export async function POST(request: NextRequest) {
  try {
    // 認証検証（オプショナル：認証済みなら Cloud Storage に保存）
    const userId = await extractUserId();

    const body: MangaRequest = await request.json();

    if (!body.url || !body.title || !body.summary) {
      return NextResponse.json(
        { error: '必要な情報が不足しています', errorCode: 'validation_error' },
        { status: 400 }
      );
    }

    const clientId = getClientId(request.headers);

    // 並行リクエストチェック
    if (await hasActiveJob(clientId)) {
      return NextResponse.json(
        { error: '現在ほかの漫画生成が進行中です。完了後に再度お試しください。', errorCode: 'concurrent' },
        { status: 409 }
      );
    }

    const jobId = crypto.randomUUID();

    // Firestore にジョブを作成
    await createMangaJob(jobId, body, userId ?? undefined, clientId);

    // Cloud Tasks にタスクをエンキュー
    if (isCloudTasksEnabled()) {
      try {
        await enqueueMangaTask(jobId, body, userId ?? undefined);
        console.log(`[Manga API] Task enqueued: ${jobId}`);
      } catch (enqueueError) {
        console.error('[Manga API] Failed to enqueue task:', enqueueError);
        // エンキュー失敗時は 500 エラーを返す
        // Firestore のジョブは残るが、処理されないのでエラー状態にする
        return NextResponse.json(
          { error: '漫画生成の開始に失敗しました', errorCode: 'api_error' },
          { status: 500 }
        );
      }
    } else {
      // Cloud Tasks が無効の場合はエラー
      // 開発時は Firebase エミュレータ + Worker のローカル起動で対応
      console.warn('[Manga API] Cloud Tasks is not enabled. Set MANGA_WORKER_URL and CLOUD_TASKS_QUEUE.');
      return NextResponse.json(
        { error: 'Cloud Tasks が設定されていません', errorCode: 'api_error' },
        { status: 500 }
      );
    }

    // アクティブジョブとして記録
    setActiveJob(clientId, jobId, body.url);

    const response: MangaJobResponse = { jobId };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Manga API error:', error);
    return NextResponse.json(
      { error: '漫画生成の開始に失敗しました', errorCode: 'api_error' },
      { status: 500 }
    );
  }
}
