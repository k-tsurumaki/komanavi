import { NextRequest, NextResponse } from 'next/server';
import type { MangaJobStatusResponse } from '@/lib/types/intermediate';
import { jobs } from '../state';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = jobs.get(jobId);

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
}
