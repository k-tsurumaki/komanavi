import { GoogleGenAI } from "@google/genai";
import {
  updateMangaJobStatus,
  updateMangaJobResult,
  updateMangaJobError,
} from "./firestore.js";
import { uploadMangaImageAndGetUrl } from "./cloud-storage.js";
import type { MangaRequest, MangaResult, MangaPanel } from "./types.js";

const MAX_EDGE = 1200;
const MODEL_ID = "gemini-3-pro-image-preview";
const PROJECT_ID = process.env.GCP_PROJECT_ID ?? "zenn-ai-agent-hackathon-vol4";
const LOCATION = process.env.GCP_LOCATION ?? "global";

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT_ID,
  location: LOCATION,
  apiVersion: "v1",
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

/**
 * リクエストからパネル構成を生成
 */
function buildPanels(request: MangaRequest): MangaResult {
  const sentences = request.summary
    .split(/。|\n/)
    .map((text) => text.trim())
    .filter(Boolean);

  const points = request.keyPoints?.filter(Boolean) ?? [];
  const candidates = [
    ...points,
    ...sentences,
    "条件に当てはまるか確認しましょう。",
    "必要な手続きを整理しましょう。",
    "期限や必要書類をチェックしましょう。",
  ];

  const panels = candidates
    .slice(0, Math.min(8, Math.max(4, candidates.length)))
    .map((text, index) => ({
      id: `panel-${index + 1}`,
      text,
    }));

  while (panels.length < 4) {
    panels.push({
      id: `panel-${panels.length + 1}`,
      text: "次のステップを確認しましょう。",
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
      format: "png",
      maxEdge: MAX_EDGE,
      title: request.title,
    },
  };
}

/**
 * フォールバック結果を生成（エラー時用）
 */
function buildFallback(request: MangaRequest): MangaResult {
  const panels = (request.keyPoints ?? [])
    .filter(Boolean)
    .slice(0, 6)
    .map((text, index) => ({ id: `fallback-${index + 1}`, text }));

  if (panels.length === 0) {
    panels.push({ id: "fallback-1", text: request.summary });
  }

  return {
    title: request.title,
    panels,
    imageUrls: [],
    meta: {
      panelCount: panels.length,
      generatedAt: new Date().toISOString(),
      sourceUrl: request.url,
      format: "png",
      maxEdge: MAX_EDGE,
      title: request.title,
    },
  };
}

/**
 * Gemini 用のプロンプトを生成
 */
function buildMangaPrompt(request: MangaRequest, panels: MangaPanel[]): string {
  const panelTexts = panels
    .map((panel, index) => `(${index + 1}) ${panel.text}`)
    .join("\n");

  return (
    `以下の内容を4コマ漫画として1枚の画像で生成してください。\n\n` +
    `# タイトル\n${request.title}\n\n` +
    `# 要約\n${request.summary}\n\n` +
    `# 4コマ構成\n${panelTexts}\n\n` +
    `要件:\n- 日本語の吹き出し\n- 4コマが1枚の画像に収まる\n- 読みやすい配色\n- 行政情報の説明として誠実で分かりやすい表現\n`
  );
}

/**
 * Gemini API で漫画画像を生成
 */
async function generateMangaImage(
  request: MangaRequest,
  panels: MangaPanel[]
): Promise<{ imageUrls: string[]; text: string }> {
  const prompt = buildMangaPrompt(request, panels);
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const result = (await ai.models.generateContent({
        model: MODEL_ID,
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: "16:9",
          },
        },
        safetySettings: [
          {
            method: "PROBABILITY",
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
        ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)) as GenerateContentResponse;

      const parts = result.candidates?.[0]?.content?.parts ?? [];
      const imageUrls = parts
        .filter(
          (part): part is { inlineData: InlineData } => "inlineData" in part
        )
        .map(
          (part) =>
            `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
        )
        .filter(Boolean);

      const textParts = parts
        .filter((part): part is { text: string } => "text" in part)
        .map((part) => part.text)
        .filter(Boolean);

      if (imageUrls.length === 0) {
        throw new Error(
          textParts.join("\n") || "画像データが生成されませんでした"
        );
      }

      return { imageUrls, text: textParts.join("\n") };
    } catch (error) {
      lastError = error;
      const status = (error as { status?: number })?.status;
      if (status !== 429 || attempt >= maxAttempts - 1) {
        throw error;
      }
      const delayMs = 1000 * Math.pow(2, attempt);
      console.log(
        `[Worker] Rate limited, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxAttempts})`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("画像生成に失敗しました");
}

/**
 * 漫画生成のメイン処理
 */
export async function processManga(
  jobId: string,
  request: MangaRequest,
  userId?: string
): Promise<void> {
  console.log(`[Worker] Starting job ${jobId}`, {
    title: request.title,
    hasUserId: !!userId,
  });

  try {
    // 1. ステータス更新: processing (30%)
    await updateMangaJobStatus(jobId, "processing", 30);
    console.log(`[Worker] Job ${jobId}: Status updated to processing (30%)`);

    // 2. パネル構成を生成
    const baseResult = buildPanels(request);

    // 3. ステータス更新: processing (50%)
    await updateMangaJobStatus(jobId, "processing", 50);

    // 4. Gemini API で漫画画像を生成
    console.log(`[Worker] Job ${jobId}: Calling Gemini API...`);
    const { imageUrls } = await generateMangaImage(request, baseResult.panels);
    console.log(`[Worker] Job ${jobId}: Generated ${imageUrls.length} images`);

    // 5. ステータス更新: processing (70%)
    await updateMangaJobStatus(jobId, "processing", 70);

    // 6. Cloud Storage へアップロード（認証済みユーザーのみ）
    let finalImageUrls = imageUrls;
    let storageUrl: string | undefined;

    if (userId && imageUrls.length > 0) {
      console.log(`[Worker] Job ${jobId}: Uploading to Cloud Storage...`);
      await updateMangaJobStatus(jobId, "processing", 85);

      try {
        const uploadResult = await uploadMangaImageAndGetUrl(
          userId,
          imageUrls[0],
          {
            sourceUrl: request.url,
            title: request.title,
            generatedAt: new Date().toISOString(),
          }
        );

        finalImageUrls = [uploadResult.signedUrl];
        storageUrl = uploadResult.storageUrl;
        console.log(
          `[Worker] Job ${jobId}: Uploaded to ${uploadResult.storageUrl}`
        );
      } catch (uploadError) {
        // アップロード失敗時は Base64 Data URL をそのまま使用
        console.error(
          `[Worker] Job ${jobId}: Cloud Storage upload failed, using fallback:`,
          uploadError
        );
      }
    }

    // 7. 完了
    const finalResult: MangaResult = {
      ...baseResult,
      imageUrls: finalImageUrls,
      storageUrl,
    };

    await updateMangaJobResult(jobId, finalResult, storageUrl);
    console.log(`[Worker] Job ${jobId}: Completed successfully`);
  } catch (error) {
    console.error(`[Worker] Job ${jobId}: Processing error:`, error);

    const status = (error as { status?: number })?.status;
    const errorCode = status === 429 ? "rate_limited" : "api_error";
    const errorMessage =
      status === 429
        ? "現在アクセスが集中しています。時間をおいて再度お試しください。"
        : "漫画生成中にエラーが発生しました";

    // エラーを Firestore に記録
    await updateMangaJobError(
      jobId,
      errorCode,
      errorMessage,
      buildFallback(request)
    );

    // エラーを再スロー（リトライ判定のため）
    throw error;
  }
}
