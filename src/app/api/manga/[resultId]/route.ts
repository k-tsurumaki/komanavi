import { NextRequest, NextResponse } from 'next/server';
import type { MangaJobStatusResponse } from '@/lib/types/intermediate';
import { getConversationManga } from '@/lib/manga-job-store';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ resultId: string }> }
) {
  const { resultId } = await params;

  try {
    const manga = await getConversationManga(resultId);

    if (!manga) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'ジョブが見つかりません',
          errorCode: 'unknown',
        } satisfies MangaJobStatusResponse,
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        status: manga.status,
        progress: manga.progress,
        result: manga.result,
        error: manga.error,
        errorCode: manga.errorCode,
      } satisfies MangaJobStatusResponse
    );
  } catch (error) {
    console.error('[Manga Job GET] Firestore error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: 'ジョブの取得に失敗しました',
        errorCode: 'api_error',
      } satisfies MangaJobStatusResponse,
      { status: 500 }
    );
  }
}
