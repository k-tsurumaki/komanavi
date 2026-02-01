import { NextRequest, NextResponse } from 'next/server';
import type { MangaJobStatusResponse } from '@/lib/types/intermediate';
import { getMangaJob } from '@/lib/manga-job-store';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  try {
    const job = await getMangaJob(jobId);

    if (!job) {
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
        status: job.status,
        progress: job.progress,
        result: job.result,
        error: job.error,
        errorCode: job.errorCode,
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
