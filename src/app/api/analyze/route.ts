import { NextRequest, NextResponse } from 'next/server';
import {
  fetchWithGoogleSearch,
  generateIntermediateRepresentation,
  generateChecklist,
  generateSimpleSummary,
  generateOverview,
  generateDeepDiveResponse,
} from '@/lib/gemini';
import type {
  AnalyzeResult,
  AnalyzeRequest,
  DeepDiveResponse,
  PersonalizationInput,
} from '@/lib/types/intermediate';
import { auth } from '@/lib/auth';
import {
  getUserProfileFromFirestore,
  toPersonalizationInput,
  DEFAULT_USER_INTENT,
} from '@/lib/user-profile';

// インメモリキャッシュ（開発用）
const cache = new Map<string, { result: AnalyzeResult; expiresAt: number }>();
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
function getFromCache(url: string): AnalyzeResult | null {
  const key = hashUrl(url);
  const cached = cache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  if (cached) {
    cache.delete(key);
  }

  return null;
}

/**
 * キャッシュに保存
 */
function saveToCache(url: string, result: AnalyzeResult): void {
  const key = hashUrl(url);
  cache.set(key, {
    result,
    expiresAt: Date.now() + CACHE_TTL,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json();
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
        focus: body.focus,
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

    const { url, userIntent } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URLが指定されていません' },
        { status: 400 }
      );
    }

    // パーソナライズ情報の取得
    let personalizationInput: PersonalizationInput = {
      userIntent: userIntent || DEFAULT_USER_INTENT,
    };

    // 認証セッションからユーザー情報を取得
    try {
      const session = await auth();
      console.log('[DEBUG] Session:', session?.user?.id ? `User ID: ${session.user.id}` : 'No session');

      if (session?.user?.id) {
        const userProfile = await getUserProfileFromFirestore(session.user.id);
        console.log('[DEBUG] User profile from Firestore:', JSON.stringify(userProfile, null, 2));

        personalizationInput = toPersonalizationInput(userProfile, userIntent);
        console.log('[DEBUG] Personalization input:', JSON.stringify(personalizationInput, null, 2));
      }
    } catch (authError) {
      // 認証エラーは無視（未ログインでも動作する）
      console.warn('Auth check failed, continuing without personalization:', authError);
    }

    // キャッシュ確認（パーソナライズなしの基本結果のみキャッシュ）
    // 注意: パーソナライズ結果はキャッシュしない
    const cached = getFromCache(url);
    let intermediate = cached?.intermediate;

    if (!intermediate) {
      // Google Search Groundingで情報取得
      const searchResult = await fetchWithGoogleSearch(url);

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

    // チェックリスト生成（パーソナライズ適用）
    const checklist = await generateChecklist(intermediate, personalizationInput);

    // 要約生成（パーソナライズ適用）
    const generatedSummary = await generateSimpleSummary(intermediate, personalizationInput);

    // 概要（構造化）生成
    const overview = await generateOverview(intermediate);

    const result: AnalyzeResult = {
      id: crypto.randomUUID(),
      intermediate,
      generatedSummary,
      overview: overview || undefined,
      checklist,
      personalization: {
        appliedIntent: personalizationInput.userIntent,
        appliedProfile: personalizationInput.userProfile,
      },
      status: 'success',
    };

    // キャッシュに保存（中間表現のみ、パーソナライズ結果は保存しない）
    if (!cached) {
      saveToCache(url, result);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Analyze API error:', error);
    return NextResponse.json(
      {
        id: crypto.randomUUID(),
        status: 'error',
        error: '予期しないエラーが発生しました',
      } satisfies Partial<AnalyzeResult>,
      { status: 500 }
    );
  }
}
