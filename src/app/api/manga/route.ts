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
import { getUserProfileFromFirestore, toPersonalizationInput } from '@/lib/user-profile';

const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10分（フロントエンドと整合）

// レート制限用のインメモリ状態（同一ユーザーからの並行リクエスト制限）
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
  __mangaUsageByUser?: Map<string, UsageState>;
};

const usageByUser = globalState.__mangaUsageByUser ?? new Map<string, UsageState>();
globalState.__mangaUsageByUser = usageByUser;

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getUsage(userId: string): UsageState {
  const today = getTodayKey();
  const current = usageByUser.get(userId);
  if (!current || current.date !== today) {
    const fresh: UsageState = { date: today };
    usageByUser.set(userId, fresh);
    return fresh;
  }
  return current;
}

function setActiveJob(userId: string, jobId: string, url: string) {
  const usage = getUsage(userId);
  usage.activeJob = { jobId, startedAt: Date.now(), url };
  usageByUser.set(userId, usage);
}

function clearActiveJob(userId: string, jobId: string) {
  const usage = usageByUser.get(userId);
  if (!usage || !usage.activeJob || usage.activeJob.jobId !== jobId) return;
  delete usage.activeJob;
  usageByUser.set(userId, usage);
}

/**
 * 並行ジョブをチェック
 * Firestore のジョブ状態も確認して、完了していたらクリア
 */
async function hasActiveJob(userId: string): Promise<boolean> {
  const usage = usageByUser.get(userId);
  if (!usage?.activeJob) return false;

  const { jobId, startedAt } = usage.activeJob;

  // タイムアウト経過していたらクリア
  if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
    clearActiveJob(userId, jobId);
    return false;
  }

  // Firestore でジョブの状態を確認
  try {
    const manga = await getConversationManga(jobId);
    if (!manga || manga.status === 'done' || manga.status === 'error') {
      clearActiveJob(userId, jobId);
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

    // 同一ユーザーの並行ジョブチェック
    if (await hasActiveJob(userId)) {
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

    // ユーザープロファイルを取得してリクエストに追加
    let enrichedBody: MangaRequest;
    try {
      const rawProfile = await getUserProfileFromFirestore(userId);
      const personalizationInput = toPersonalizationInput(rawProfile, body.userIntent);
      enrichedBody = {
        ...body,
        userIntent: personalizationInput.userIntent,
        userProfile: personalizationInput.userProfile,
      };
    } catch (profileError) {
      console.warn(
        'Failed to fetch user profile, proceeding without personalization:',
        profileError
      );
      // プロファイル取得に失敗した場合はクライアント送信の userProfile / intentSearchMetadata を信頼しない
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { userProfile, intentSearchMetadata, ...rest } = body;
      enrichedBody = {
        ...rest,
        userProfile: undefined,
      };
    }

    // Firestore に conversation_manga を作成
    try {
      await createConversationManga(resultId, historyId, enrichedBody, userId);
    } catch (createError) {
      const errorMessage = createError instanceof Error ? createError.message : 'Unknown error';
      if (errorMessage.includes('already in progress')) {
        return NextResponse.json(
          {
            error: '現在この解析結果の漫画生成が進行中です。完了後に再度お試しください。',
            errorCode: 'concurrent',
          },
          { status: 409 }
        );
      }
      throw createError;
    }

    // Cloud Tasks にタスクをエンキュー
    try {
      await enqueueMangaTask(resultId, enrichedBody, userId);
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
    setActiveJob(userId, resultId, body.url);

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
