import { NextRequest, NextResponse } from 'next/server';
import {
  fetchWithGoogleSearch,
  generateIntermediateRepresentation,
  generateChecklist,
  generateSimpleSummary,
  generateOverview,
  generateDeepDiveResponse,
} from '@/lib/gemini';
import type { AnalyzeResult, AnalyzeRequest, DeepDiveResponse } from '@/lib/types/intermediate';

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

    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URLが指定されていません' },
        { status: 400 }
      );
    }

    // キャッシュ確認
    const cached = getFromCache(url);
    if (cached) {
      return NextResponse.json(cached);
    }

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
    const intermediate = await generateIntermediateRepresentation(searchResult);

    if (!intermediate) {
      return NextResponse.json(
        {
          id: crypto.randomUUID(),
          status: 'error',
          error: 'ページの解析に失敗しました',
        } satisfies Partial<AnalyzeResult>,
        { status: 500 }
      );
    }

    // チェックリスト生成
    const checklist = await generateChecklist(intermediate);

    // 要約生成
    const generatedSummary = await generateSimpleSummary(intermediate);

    // 概要（構造化）生成
    const overview = await generateOverview(intermediate);

    const result: AnalyzeResult = {
      id: crypto.randomUUID(),
      intermediate,
      generatedSummary,
      overview: overview || undefined,
      checklist,
      status: 'success',
    };

    // キャッシュに保存
    saveToCache(url, result);

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
