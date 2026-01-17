import { NextRequest, NextResponse } from 'next/server';
import type { MangaJobResponse, MangaRequest, MangaResult } from '@/lib/types/intermediate';
import { jobs, type MangaJob } from './state';
const JOB_TTL_MS = 10 * 60 * 1000;

function buildPanels(request: MangaRequest): MangaResult {
  const sentences = request.summary
    .split(/。|\n/)
    .map((text) => text.trim())
    .filter(Boolean);

  const points = request.keyPoints?.filter(Boolean) ?? [];
  const candidates = [
    ...points,
    ...sentences,
    '条件に当てはまるか確認しましょう。',
    '必要な手続きを整理しましょう。',
    '期限や必要書類をチェックしましょう。',
  ];

  const panels = candidates.slice(0, Math.min(8, Math.max(4, candidates.length))).map((text, index) => ({
    id: `panel-${index + 1}`,
    text,
  }));

  while (panels.length < 4) {
    panels.push({
      id: `panel-${panels.length + 1}`,
      text: '次のステップを確認しましょう。',
    });
  }

  return {
    title: request.title,
    panels,
  };
}

function scheduleJob(job: MangaJob, request: MangaRequest) {
  jobs.set(job.id, job);

  setTimeout(() => {
    const current = jobs.get(job.id);
    if (!current) return;
    current.status = 'processing';
    current.progress = 30;
    jobs.set(job.id, current);
  }, 500);

  setTimeout(() => {
    const current = jobs.get(job.id);
    if (!current) return;
    current.status = 'processing';
    current.progress = 70;
    jobs.set(job.id, current);
  }, 1500);

  setTimeout(() => {
    const current = jobs.get(job.id);
    if (!current) return;
    current.status = 'done';
    current.progress = 100;
    current.result = buildPanels(request);
    jobs.set(job.id, current);
  }, 2500);

  setTimeout(() => {
    jobs.delete(job.id);
  }, JOB_TTL_MS);
}

export async function POST(request: NextRequest) {
  try {
    const body: MangaRequest = await request.json();

    if (!body.url || !body.title || !body.summary) {
      return NextResponse.json(
        { error: '必要な情報が不足しています' },
        { status: 400 }
      );
    }

    const jobId = crypto.randomUUID();
    const job: MangaJob = {
      id: jobId,
      status: 'queued',
      progress: 0,
      createdAt: Date.now(),
    };

    scheduleJob(job, body);

    const response: MangaJobResponse = { jobId };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Manga API error:', error);
    return NextResponse.json(
      { error: '漫画生成の開始に失敗しました' },
      { status: 500 }
    );
  }
}
