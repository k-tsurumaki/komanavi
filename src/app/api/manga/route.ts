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
import { getUserProfileFromFirestore, toMangaPersonalizationInput } from '@/lib/user-profile';

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

const MAX_URL_LENGTH = 2000;
const MAX_TITLE_LENGTH = 200;
const MAX_SUMMARY_LENGTH = 2000;
const MAX_RESULT_ID_LENGTH = 128;
const MAX_HISTORY_ID_LENGTH = 128;
const MAX_USER_INTENT_LENGTH = 1000;
const MAX_KEYPOINTS = 20;
const MAX_KEYPOINT_TEXT_LENGTH = 300;
const MAX_WARNINGS = 20;
const MAX_TIPS = 20;
const MAX_NOTE_TEXT_LENGTH = 300;
const MAX_CONDITIONS = 20;
const MAX_STEPS = 20;
const MAX_REQUIRED_DOCUMENTS = 20;
const MAX_WEB_SEARCH_QUERIES = 20;
const MAX_GROUNDING_CHUNKS = 30;

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, maxLength);
}

function normalizeStringArray(
  value: unknown,
  maxItems: number,
  maxItemLength: number
): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value
    .map((item) => normalizeString(item, maxItemLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
  return items.length > 0 ? items : undefined;
}

function parseDocumentType(value: unknown): MangaRequest['documentType'] {
  if (
    value === 'benefit' ||
    value === 'procedure' ||
    value === 'information' ||
    value === 'faq' ||
    value === 'guide' ||
    value === 'other'
  ) {
    return value;
  }
  return undefined;
}

function parseTarget(value: unknown): MangaRequest['target'] {
  if (!isPlainObject(value)) {
    return undefined;
  }
  const conditions = Array.isArray(value.conditions)
    ? value.conditions
        .map((item) => normalizeString(item, MAX_NOTE_TEXT_LENGTH))
        .filter((item): item is string => Boolean(item))
        .slice(0, MAX_CONDITIONS)
    : [];
  if (conditions.length === 0) {
    return undefined;
  }
  const eligibilitySummary = normalizeString(value.eligibility_summary, MAX_NOTE_TEXT_LENGTH);
  return {
    conditions,
    ...(eligibilitySummary ? { eligibility_summary: eligibilitySummary } : {}),
  };
}

function parseProcedure(value: unknown): MangaRequest['procedure'] {
  if (!isPlainObject(value) || !Array.isArray(value.steps)) {
    return undefined;
  }
  const steps = value.steps
    .filter((step): step is Record<string, unknown> => isPlainObject(step))
    .map((step) => {
      const action = normalizeString(step.action, MAX_NOTE_TEXT_LENGTH);
      const order = typeof step.order === 'number' ? step.order : Number(step.order);
      if (!action || !Number.isFinite(order)) {
        return null;
      }
      return { order, action };
    })
    .filter((step): step is { order: number; action: string } => Boolean(step))
    .slice(0, MAX_STEPS);

  if (steps.length === 0) {
    return undefined;
  }

  const requiredDocuments = normalizeStringArray(
    value.required_documents,
    MAX_REQUIRED_DOCUMENTS,
    MAX_NOTE_TEXT_LENGTH
  );
  const deadline = normalizeString(value.deadline, MAX_NOTE_TEXT_LENGTH);
  const fee = normalizeString(value.fee, MAX_NOTE_TEXT_LENGTH);

  return {
    steps,
    ...(requiredDocuments ? { required_documents: requiredDocuments } : {}),
    ...(deadline ? { deadline } : {}),
    ...(fee ? { fee } : {}),
  };
}

function parseBenefits(value: unknown): MangaRequest['benefits'] {
  if (!isPlainObject(value)) {
    return undefined;
  }
  const description = normalizeString(value.description, MAX_NOTE_TEXT_LENGTH);
  if (!description) {
    return undefined;
  }
  const amount = normalizeString(value.amount, MAX_NOTE_TEXT_LENGTH);
  const frequency = normalizeString(value.frequency, MAX_NOTE_TEXT_LENGTH);
  return {
    description,
    ...(amount ? { amount } : {}),
    ...(frequency ? { frequency } : {}),
  };
}

function parseContact(value: unknown): MangaRequest['contact'] {
  if (!isPlainObject(value)) {
    return undefined;
  }
  const department = normalizeString(value.department, MAX_NOTE_TEXT_LENGTH);
  const phone = normalizeString(value.phone, MAX_NOTE_TEXT_LENGTH);
  const hours = normalizeString(value.hours, MAX_NOTE_TEXT_LENGTH);
  if (!department && !phone && !hours) {
    return undefined;
  }
  return {
    ...(department ? { department } : {}),
    ...(phone ? { phone } : {}),
    ...(hours ? { hours } : {}),
  };
}

function parseIntentSearchMetadata(value: unknown): MangaRequest['intentSearchMetadata'] {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const webSearchQueries = normalizeStringArray(
    value.webSearchQueries,
    MAX_WEB_SEARCH_QUERIES,
    MAX_NOTE_TEXT_LENGTH
  );

  const groundingChunks = Array.isArray(value.groundingChunks)
    ? value.groundingChunks
        .filter((chunk): chunk is Record<string, unknown> => isPlainObject(chunk))
        .map((chunk) => {
          const web = isPlainObject(chunk.web) ? chunk.web : undefined;
          if (!web) return null;
          const uri = normalizeString(web.uri, MAX_URL_LENGTH);
          const title = normalizeString(web.title, MAX_TITLE_LENGTH);
          if (!uri || !title) return null;
          return { web: { uri, title } };
        })
        .filter((chunk): chunk is { web: { uri: string; title: string } } => Boolean(chunk))
        .slice(0, MAX_GROUNDING_CHUNKS)
    : [];

  if (!webSearchQueries && groundingChunks.length === 0) {
    return undefined;
  }

  return {
    ...(webSearchQueries ? { webSearchQueries } : {}),
    ...(groundingChunks.length > 0 ? { groundingChunks } : {}),
  };
}

function parseMangaRequestBody(raw: unknown): { ok: true; data: MangaRequest } | { ok: false } {
  if (!isPlainObject(raw)) {
    return { ok: false };
  }

  const url = normalizeString(raw.url, MAX_URL_LENGTH);
  const title = normalizeString(raw.title, MAX_TITLE_LENGTH);
  const summary = normalizeString(raw.summary, MAX_SUMMARY_LENGTH);
  const resultId = normalizeString(raw.resultId, MAX_RESULT_ID_LENGTH);
  const historyId = normalizeString(raw.historyId, MAX_HISTORY_ID_LENGTH);

  if (!url || !title || !summary || !resultId || !historyId) {
    return { ok: false };
  }

  const keyPoints = normalizeStringArray(raw.keyPoints, MAX_KEYPOINTS, MAX_KEYPOINT_TEXT_LENGTH);
  const documentType = parseDocumentType(raw.documentType);
  const target = parseTarget(raw.target);
  const procedure = parseProcedure(raw.procedure);
  const benefits = parseBenefits(raw.benefits);
  const contact = parseContact(raw.contact);
  const warnings = normalizeStringArray(raw.warnings, MAX_WARNINGS, MAX_NOTE_TEXT_LENGTH);
  const tips = normalizeStringArray(raw.tips, MAX_TIPS, MAX_NOTE_TEXT_LENGTH);
  const userIntent = normalizeString(raw.userIntent, MAX_USER_INTENT_LENGTH);
  const intentSearchMetadata = parseIntentSearchMetadata(raw.intentSearchMetadata);

  return {
    ok: true,
    data: {
      url,
      title,
      summary,
      resultId,
      historyId,
      ...(keyPoints ? { keyPoints } : {}),
      ...(documentType ? { documentType } : {}),
      ...(target ? { target } : {}),
      ...(procedure ? { procedure } : {}),
      ...(benefits ? { benefits } : {}),
      ...(contact ? { contact } : {}),
      ...(warnings ? { warnings } : {}),
      ...(tips ? { tips } : {}),
      ...(userIntent ? { userIntent } : {}),
      ...(intentSearchMetadata ? { intentSearchMetadata } : {}),
    },
  };
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

    const parsedBody = parseMangaRequestBody(await request.json());
    if (!parsedBody.ok) {
      return NextResponse.json(
        { error: '必要な情報が不足しています', errorCode: 'validation_error' },
        { status: 400 }
      );
    }
    const body = parsedBody.data;

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
      const personalizationInput = toMangaPersonalizationInput(rawProfile, body.userIntent);
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
      enrichedBody = {
        ...body,
        intentSearchMetadata: undefined,
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
