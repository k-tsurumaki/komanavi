import { NextRequest, NextResponse } from 'next/server';
import {
  fetchWithGoogleSearch,
  generateIntermediateRepresentation,
  generateChecklistWithState,
  generateSimpleSummary,
  generateDeepDiveResponse,
  generateIntentAnswer,
} from '@/lib/gemini';
import type {
  AnalyzeResult,
  AnalyzeRequest,
  ChecklistResponse,
  DeepDiveResponse,
  IntermediateRepresentation,
  IntentAnswerResponse,
  PersonalizationInput,
} from '@/lib/types/intermediate';
import { auth } from '@/lib/auth';
import {
  getUserProfileFromFirestore,
  toPersonalizationInput,
  DEFAULT_USER_INTENT,
} from '@/lib/user-profile';
import {
  ANALYZE_ERROR_MESSAGE,
  CHECKLIST_ERROR_MESSAGE,
  DEEP_DIVE_ERROR_MESSAGE,
  INTENT_ANSWER_ERROR_MESSAGE,
} from '@/lib/error-messages';

// インメモリキャッシュ（開発用）
const cache = new Map<string, { intermediate: IntermediateRepresentation; expiresAt: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24時間

/**
 * URLのハッシュを生成（キャッシュキー用）
 */
function hashUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * キャッシュから取得
 */
function getFromCache(url: string): IntermediateRepresentation | null {
  const key = hashUrl(url);
  const cached = cache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.intermediate;
  }

  if (cached) {
    cache.delete(key);
  }

  return null;
}

/**
 * キャッシュに保存
 */
function saveToCache(url: string, intermediate: IntermediateRepresentation): void {
  const key = hashUrl(url);
  cache.set(key, {
    intermediate,
    expiresAt: Date.now() + CACHE_TTL,
  });
}

async function buildPersonalizationInput(userIntent?: string): Promise<PersonalizationInput> {
  // パーソナライズ情報の取得
  let personalizationInput: PersonalizationInput = {
    userIntent: userIntent || DEFAULT_USER_INTENT,
  };

  // 認証セッションからユーザー情報を取得
  try {
    const session = await auth();

    if (session?.user?.id) {
      const userProfile = await getUserProfileFromFirestore(session.user.id);

      personalizationInput = toPersonalizationInput(userProfile, userIntent);
    }
  } catch (authError) {
    // 認証エラーは無視（未ログインでも動作する）
    console.warn('Auth check failed, continuing without personalization:', authError);
  }

  return personalizationInput;
}

function getUnexpectedAnalyzeErrorMessage(mode?: AnalyzeRequest['mode']): string {
  if (mode === 'deepDive') return DEEP_DIVE_ERROR_MESSAGE;
  if (mode === 'intent') return INTENT_ANSWER_ERROR_MESSAGE;
  if (mode === 'checklist') return CHECKLIST_ERROR_MESSAGE;
  return ANALYZE_ERROR_MESSAGE;
}

export async function POST(request: NextRequest) {
  let mode: AnalyzeRequest['mode'] | undefined;

  try {
    const body: AnalyzeRequest = await request.json();
    mode = body.mode;
    if (body.mode === 'deepDive') {
      if (!body.summary) {
        return NextResponse.json(
          { status: 'error', error: 'summaryが指定されていません' } satisfies DeepDiveResponse,
          { status: 400 }
        );
      }

      const response = await generateDeepDiveResponse({
        summary: body.summary,
        messages: body.messages || [],
        deepDiveSummary: body.deepDiveSummary,
        summaryOnly: body.summaryOnly,
      });

      if (!response) {
        return NextResponse.json(
          { status: 'error', error: '深掘り回答の生成に失敗しました' } satisfies DeepDiveResponse,
          { status: 500 }
        );
      }

      return NextResponse.json({
        status: 'success',
        answer: response.answer,
        summary: response.summary,
      } satisfies DeepDiveResponse);
    }

    if (body.mode === 'intent') {
      if (!body.userIntent?.trim()) {
        return NextResponse.json(
          {
            status: 'error',
            error: 'userIntentが指定されていません',
          } satisfies IntentAnswerResponse,
          { status: 400 }
        );
      }
      if (!body.intermediate) {
        return NextResponse.json(
          {
            status: 'error',
            error: 'intermediateが指定されていません',
          } satisfies IntentAnswerResponse,
          { status: 400 }
        );
      }

      // 意図ベース検索を実行
      const intentSearchResult = await fetchWithGoogleSearch(
        body.intermediate.metadata.source_url,
        body.userIntent
      );

      // intermediate を更新
      const updatedIntermediate = {
        ...body.intermediate,
        metadata: {
          ...body.intermediate.metadata,
          intentSearchMetadata: intentSearchResult.groundingMetadata,
        },
      };

      const personalizationInput = await buildPersonalizationInput(body.userIntent);
      const checklistPromise = generateChecklistWithState(
        updatedIntermediate,
        personalizationInput
      );
      const intentAnswer = await generateIntentAnswer(
        updatedIntermediate,
        body.userIntent,
        personalizationInput,
        {
          deepDiveSummary: body.deepDiveSummary,
          messages: body.messages || [],
          overviewTexts: body.overviewTexts || [],
          checklistTexts: body.checklistTexts || [],
        }
      );

      if (!intentAnswer) {
        return NextResponse.json(
          { status: 'error', error: '意図回答の生成に失敗しました' } satisfies IntentAnswerResponse,
          { status: 500 }
        );
      }

      const checklistGeneration = await checklistPromise;

      return NextResponse.json({
        status: 'success',
        intentAnswer,
        checklist: checklistGeneration.checklist,
        checklistState: checklistGeneration.state,
        checklistError: checklistGeneration.error,
        intermediate: updatedIntermediate,
      } satisfies IntentAnswerResponse);
    }

    if (body.mode === 'checklist') {
      if (!body.userIntent?.trim()) {
        return NextResponse.json(
          { status: 'error', error: 'userIntentが指定されていません' } satisfies ChecklistResponse,
          { status: 400 }
        );
      }
      if (!body.intermediate) {
        return NextResponse.json(
          {
            status: 'error',
            error: 'intermediateが指定されていません',
          } satisfies ChecklistResponse,
          { status: 400 }
        );
      }

      const personalizationInput = await buildPersonalizationInput(body.userIntent);
      const checklistGeneration = await generateChecklistWithState(
        body.intermediate,
        personalizationInput
      );

      return NextResponse.json({
        status: 'success',
        checklist: checklistGeneration.checklist,
        checklistState: checklistGeneration.state,
        checklistError: checklistGeneration.error,
      } satisfies ChecklistResponse);
    }

    const { url, userIntent } = body;

    if (!url) {
      return NextResponse.json({ error: 'URLが指定されていません' }, { status: 400 });
    }

    const personalizationInput = await buildPersonalizationInput(userIntent);

    // キャッシュ確認（パーソナライズなしの基本結果のみキャッシュ）
    // 注意: パーソナライズ結果はキャッシュしない
    const cachedIntermediate = getFromCache(url);
    let intermediate = cachedIntermediate;

    if (!intermediate) {
      // Google Search Groundingで情報取得
      console.log('[API /analyze] Starting Google Search for URL:', url);
      const searchResult = await fetchWithGoogleSearch(url);
      console.log('[API /analyze] Google Search completed');
      console.log('[API /analyze] Search result content length:', searchResult.content?.length);
      console.log('[API /analyze] Has grounding metadata:', !!searchResult.groundingMetadata);

      if (!searchResult.content) {
        return NextResponse.json(
          {
            id: crypto.randomUUID(),
            status: 'error',
            error: 'ページ情報の取得に失敗しました',
          } satisfies Partial<AnalyzeResult>,
          { status: 400 }
        );
      }

      // 中間表現生成（Vertex AI使用）
      const generatedIntermediate = await generateIntermediateRepresentation(searchResult);

      if (!generatedIntermediate) {
        return NextResponse.json(
          {
            id: crypto.randomUUID(),
            status: 'error',
            error: 'ページの解析に失敗しました',
          } satisfies Partial<AnalyzeResult>,
          { status: 500 }
        );
      }

      intermediate = generatedIntermediate;
    }

    // 初回解析では要約の初回表示を優先する（checklist は意図入力時に生成）
    const generatedSummary = await generateSimpleSummary(intermediate, personalizationInput);

    // 意図ベース回答生成（意図がある場合のみ）
    const intentAnswer = userIntent
      ? await generateIntentAnswer(intermediate, userIntent, personalizationInput)
      : '';

    const result: AnalyzeResult = {
      id: crypto.randomUUID(),
      intermediate,
      generatedSummary,
      userIntent: userIntent?.trim() || undefined,
      intentAnswer: intentAnswer || undefined,
      guidanceUnlocked: false,
      overview: undefined,
      checklist: [],
      checklistState: 'not_requested',
      personalization: {
        appliedIntent: personalizationInput.userIntent,
        appliedProfile: personalizationInput.userProfile,
      },
      status: 'success',
    };

    // キャッシュに保存（中間表現のみ、パーソナライズ結果は保存しない）
    if (!cachedIntermediate) {
      saveToCache(url, intermediate);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Analyze API error:', error);

    const errorMessage = getUnexpectedAnalyzeErrorMessage(mode);

    if (mode === 'deepDive') {
      return NextResponse.json(
        {
          status: 'error',
          error: errorMessage,
        } satisfies DeepDiveResponse,
        { status: 500 }
      );
    }

    if (mode === 'intent') {
      return NextResponse.json(
        {
          status: 'error',
          error: errorMessage,
        } satisfies IntentAnswerResponse,
        { status: 500 }
      );
    }

    if (mode === 'checklist') {
      return NextResponse.json(
        {
          status: 'error',
          error: errorMessage,
        } satisfies ChecklistResponse,
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        id: crypto.randomUUID(),
        status: 'error',
        error: errorMessage,
      } satisfies Partial<AnalyzeResult>,
      { status: 500 }
    );
  }
}
