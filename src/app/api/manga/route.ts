import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import type { MangaJobResponse, MangaRequest, MangaResult, MangaPanel } from '@/lib/types/intermediate';
import { jobs, type MangaJob, usageByClient, type MangaUsageState } from './state';

const JOB_TTL_MS = 10 * 60 * 1000;
const POLL_TIMEOUT_MS = 60 * 1000;
const MAX_EDGE = 1200;
const MODEL_ID = 'gemini-3-pro-image-preview';
const PROJECT_ID = process.env.GCP_PROJECT_ID ?? 'zenn-ai-agent-hackathon-vol4';
const LOCATION = process.env.GCP_LOCATION ?? 'global';

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT_ID,
  location: LOCATION,
  apiVersion: 'v1',
});

type InlineData = {
  mimeType: string;
  data: string;
};

type Part =
  | { text: string }
  | {
      inlineData: InlineData;
    };

type GenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Part[];
    };
  }>;
};

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

function buildMangaPrompt(request: MangaRequest, panels: MangaPanel[]) {
  const panelTexts = panels.map((panel, index) => `(${index + 1}) ${panel.text}`).join('\n');
  return `以下の内容を4コマ漫画として1枚の画像で生成してください。\n\n` +
    `# タイトル\n${request.title}\n\n` +
    `# 要約\n${request.summary}\n\n` +
    `# 4コマ構成\n${panelTexts}\n\n` +
    `要件:\n- 日本語の吹き出し\n- 4コマが1枚の画像に収まる\n- 読みやすい配色\n- 行政情報の説明として誠実で分かりやすい表現\n`;
}

async function generateMangaImage(request: MangaRequest, panels: MangaPanel[]) {
  const prompt = buildMangaPrompt(request, panels);
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const result = (await ai.models.generateContent({
        model: MODEL_ID,
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: '16:9',
          },
        },
        safetySettings: [
          {
            method: 'PROBABILITY',
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          },
        ],
      } as any)) as GenerateContentResponse;

      const parts = result.candidates?.[0]?.content?.parts ?? [];
      const imageUrls = parts
        .filter((part): part is { inlineData: InlineData } => 'inlineData' in part)
        .map((part) => `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`)
        .filter(Boolean);

      const textParts = parts
        .filter((part): part is { text: string } => 'text' in part)
        .map((part) => part.text)
        .filter(Boolean);

      if (imageUrls.length === 0) {
        throw new Error(textParts.join('\n') || '画像データが生成されませんでした');
      }

      return { imageUrls, text: textParts.join('\n') };
    } catch (error) {
      lastError = error;
      const status = (error as { status?: number })?.status;
      if (status !== 429 || attempt >= maxAttempts - 1) {
        throw error;
      }
      const delayMs = 1000 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('画像生成に失敗しました');
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
    (async () => {
      try {
        current.status = 'processing';
        current.progress = 85;
        jobs.set(job.id, current);

        const baseResult = buildPanels(request);
        const { imageUrls } = await generateMangaImage(request, baseResult.panels);

        const latest = jobs.get(job.id);
        if (!latest || latest.status === 'error') return;

        latest.status = 'done';
        latest.progress = 100;
        latest.result = {
          ...baseResult,
          imageUrls,
        };
        jobs.set(job.id, latest);
      } catch (error) {
        console.error('Manga build error:', error);
        const latest = jobs.get(job.id);
        if (!latest) return;
        const status = (error as { status?: number })?.status;
        latest.status = 'error';
        latest.errorCode = status === 429 ? 'rate_limited' : 'api_error';
        latest.error =
          status === 429
            ? '現在アクセスが集中しています。時間をおいて再度お試しください。'
            : '漫画生成中にエラーが発生しました';
        latest.result = buildFallback(request);
        jobs.set(job.id, latest);
      } finally {
        const latest = jobs.get(job.id);
        if (latest?.clientId) {
          clearActiveJob(latest.clientId, latest.id);
        }
      }
    })();
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
      urlCooldowns: usage.urlCooldowns,
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
