import { NextRequest, NextResponse } from 'next/server';
import { scrapeUrl } from '@/lib/scraper';
import {
  generateIntermediateRepresentation,
  generateChecklist,
  generateSimpleSummary,
} from '@/lib/gemini';
import type { AnalyzeResult, AnalyzeRequest } from '@/lib/types/intermediate';

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

    // スクレイピング
    const scrapeResult = await scrapeUrl(url);

    if (!scrapeResult.success) {
      return NextResponse.json(
        {
          id: crypto.randomUUID(),
          status: 'error',
          error: scrapeResult.error.message,
        } satisfies Partial<AnalyzeResult>,
        { status: 400 }
      );
    }

    // 中間表現生成（Vertex AI使用）
    const intermediate = await generateIntermediateRepresentation(scrapeResult.data);

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

    const result: AnalyzeResult = {
      id: crypto.randomUUID(),
      intermediate,
      generatedSummary,
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
