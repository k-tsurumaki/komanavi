import { NextRequest, NextResponse } from 'next/server';
import type { MangaJobResponse, MangaRequest, MangaResult } from '@/lib/types/intermediate';
import { jobs, type MangaJob, usageByClient, type MangaUsageState } from './state';

const JOB_TTL_MS = 10 * 60 * 1000;
const POLL_TIMEOUT_MS = 60 * 1000;
const DAILY_LIMIT = 3;
const COOLDOWN_MS = 10 * 60 * 1000;
const MAX_EDGE = 1200;

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getClientId(headers: Headers) {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'anonymous';
}

function getUsage(clientId: string): MangaUsageState {
  const today = getTodayKey();
  const current = usageByClient.get(clientId);
  if (!current || current.date !== today) {
    const fresh: MangaUsageState = { date: today, count: 0, urlCooldowns: {} };
    usageByClient.set(clientId, fresh);
    return fresh;
  }
  return current;
}

function saveUsage(clientId: string, usage: MangaUsageState) {
  usageByClient.set(clientId, usage);
}

function clearActiveJob(clientId: string, jobId: string) {
  const usage = usageByClient.get(clientId);
  if (!usage || !usage.activeJob || usage.activeJob.jobId !== jobId) return;
  delete usage.activeJob;
  usageByClient.set(clientId, usage);
}

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
    imageUrls: [],
    meta: {
      panelCount: panels.length,
      generatedAt: new Date().toISOString(),
      sourceUrl: request.url,
      format: 'png',
      maxEdge: MAX_EDGE,
      title: request.title,
    },
  };
}

function buildFallback(request: MangaRequest): MangaResult {
  const panels = (request.keyPoints ?? [])
    .filter(Boolean)
    .slice(0, 6)
    .map((text, index) => ({ id: `fallback-${index + 1}`, text }));

  if (panels.length === 0) {
    panels.push({ id: 'fallback-1', text: request.summary });
  }

  return {
    title: request.title,
    panels,
    imageUrls: [],
    meta: {
      panelCount: panels.length,
      generatedAt: new Date().toISOString(),
      sourceUrl: request.url,
      format: 'png',
      maxEdge: MAX_EDGE,
      title: request.title,
    },
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
    if (!current || current.status === 'error') return;
    try {
      current.status = 'done';
      current.progress = 100;
      current.result = buildPanels(request);
      jobs.set(job.id, current);
    } catch (error) {
      console.error('Manga build error:', error);
      current.status = 'error';
      current.errorCode = 'api_error';
      current.error = '漫画生成中にエラーが発生しました';
      current.result = buildFallback(request);
      jobs.set(job.id, current);
    } finally {
      if (current.clientId) {
        clearActiveJob(current.clientId, current.id);
      }
    }
  }, 2500);

  setTimeout(() => {
    const current = jobs.get(job.id);
    if (!current || current.status === 'done') return;
    current.status = 'error';
    current.errorCode = 'timeout';
    current.error = '漫画生成がタイムアウトしました';
    current.result = buildFallback(request);
    jobs.set(job.id, current);
    if (current.clientId) {
      clearActiveJob(current.clientId, current.id);
    }
  }, POLL_TIMEOUT_MS);

  setTimeout(() => {
    const current = jobs.get(job.id);
    if (current?.clientId) {
      clearActiveJob(current.clientId, current.id);
    }
    jobs.delete(job.id);
  }, JOB_TTL_MS);
}

export async function POST(request: NextRequest) {
  try {
    const body: MangaRequest = await request.json();

    if (!body.url || !body.title || !body.summary) {
      return NextResponse.json(
        { error: '必要な情報が不足しています', errorCode: 'validation_error' },
        { status: 400 }
      );
    }

    const clientId = getClientId(request.headers);
    const usage = getUsage(clientId);

    if (usage.count >= DAILY_LIMIT) {
      return NextResponse.json(
        { error: '本日の漫画生成回数の上限に達しました（最大3回）', errorCode: 'rate_limited' },
        { status: 429 }
      );
    }

    const last = usage.urlCooldowns[body.url];
    if (last && Date.now() - last < COOLDOWN_MS) {
      return NextResponse.json(
        { error: '同じURLの再生成は10分後にお試しください', errorCode: 'cooldown' },
        { status: 429 }
      );
    }

    if (usage.activeJob && Date.now() - usage.activeJob.startedAt < POLL_TIMEOUT_MS) {
      return NextResponse.json(
        { error: '現在ほかの漫画生成が進行中です。完了後に再度お試しください。', errorCode: 'concurrent' },
        { status: 409 }
      );
    }

    const jobId = crypto.randomUUID();
    const job: MangaJob = {
      id: jobId,
      status: 'queued',
      progress: 0,
      createdAt: Date.now(),
      clientId,
    };

    scheduleJob(job, body);

    const nextUsage: MangaUsageState = {
      ...usage,
      count: usage.count + 1,
      urlCooldowns: { ...usage.urlCooldowns, [body.url]: Date.now() },
      activeJob: { jobId, startedAt: Date.now(), url: body.url },
    };
    saveUsage(clientId, nextUsage);

    const response: MangaJobResponse = { jobId };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Manga API error:', error);
    return NextResponse.json(
      { error: '漫画生成の開始に失敗しました', errorCode: 'api_error' },
      { status: 500 }
    );
  }
}
