import { NextRequest, NextResponse } from 'next/server';
import type { MangaJobResponse, MangaRequest } from '@/lib/types/intermediate';
import { requireUserId } from '@/app/api/history/utils';
import {
  createConversationManga,
  getConversationManga,
  updateConversationMangaError,
} from '@/lib/manga-job-store';
import { enqueueMangaTask, getMissingCloudTasksEnvVars } from '@/lib/cloud-tasks';
import { getAdminFirestore } from '@/lib/firebase-admin';

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
    const manga = await getConversationManga(jobId);
    if (!manga || manga.status === 'done' || manga.status === 'error') {
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
    // 認証検証（必須）
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json(
        { error: '認証が必要です', errorCode: 'unauthorized' },
        { status: 401 }
      );
    }

    const body: MangaRequest = await request.json();

    // resultId, historyId のバリデーション
    if (!body.url || !body.title || !body.summary || !body.resultId || !body.historyId) {
      return NextResponse.json(
        { error: '必要な情報が不足しています', errorCode: 'validation_error' },
        { status: 400 }
      );
    }

    const missingCloudTasksEnvVars = getMissingCloudTasksEnvVars();
    if (missingCloudTasksEnvVars.length > 0) {
      console.warn(
        '[Manga API] Cloud Tasks is not enabled. Missing env vars:',
        missingCloudTasksEnvVars
      );
      return NextResponse.json(
        { error: 'Cloud Tasks が設定されていません', errorCode: 'api_error' },
        { status: 500 }
      );
    }

    const clientId = getClientId(request.headers);

    // 並行リクエストチェック
    if (await hasActiveJob(clientId)) {
      return NextResponse.json(
        {
          error: '現在ほかの漫画生成が進行中です。完了後に再度お試しください。',
          errorCode: 'concurrent',
        },
        { status: 409 }
      );
    }

    const { resultId, historyId } = body;

    // resultId と historyId の整合性を検証
    const db = getAdminFirestore();
    const resultRef = db.collection('conversation_results').doc(resultId);
    const resultSnap = await resultRef.get();

    if (!resultSnap.exists) {
      return NextResponse.json(
        { error: '指定された解析結果が見つかりません', errorCode: 'not_found' },
        { status: 404 }
      );
    }

    const resultData = resultSnap.data();
    if (resultData?.userId !== userId) {
      return NextResponse.json(
        { error: '不正な resultId が指定されました', errorCode: 'forbidden' },
        { status: 403 }
      );
    }

    if (resultData?.historyId && resultData.historyId !== historyId) {
      return NextResponse.json(
        { error: '不正な historyId が指定されました', errorCode: 'forbidden' },
        { status: 403 }
      );
    }

    // Firestore に conversation_manga を作成
    await createConversationManga(resultId, historyId, body, userId);

    // Cloud Tasks にタスクをエンキュー
    try {
      await enqueueMangaTask(resultId, body, userId);
      console.log(`[Manga API] Task enqueued: ${resultId}`);
    } catch (enqueueError) {
      console.error('[Manga API] Failed to enqueue task:', enqueueError);
      try {
        await updateConversationMangaError(
          resultId,
          'api_error',
          'Cloud Tasks への登録に失敗したため、漫画生成を開始できませんでした。'
        );
      } catch (updateError) {
        console.error('[Manga API] Failed to update job status to error:', updateError);
      }
      return NextResponse.json(
        { error: '漫画生成の開始に失敗しました', errorCode: 'api_error' },
        { status: 500 }
      );
    }

    // アクティブジョブとして記録（resultId を使用）
    setActiveJob(clientId, resultId, body.url);

    const response: MangaJobResponse = { jobId: resultId };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Manga API error:', error);
    return NextResponse.json(
      { error: '漫画生成の開始に失敗しました', errorCode: 'api_error' },
      { status: 500 }
    );
  }
}
