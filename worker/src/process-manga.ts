import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { updateMangaJobStatus, updateMangaJobResult, updateMangaJobError } from './firestore.js';
import { uploadMangaImageAndGetUrl } from './cloud-storage.js';
import type { MangaRequest, MangaResult, MangaPanel } from './types.js';

// HTTPステータスコード
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;

const MAX_EDGE = 1200;

/**
 * プロンプトファイルを読み込む
 */
function loadPrompt(filename: string): string {
  try {
    const promptPath = join(process.cwd(), 'prompts', filename);
    return readFileSync(promptPath, 'utf-8');
  } catch (error) {
    console.error(`Failed to load prompt file: ${filename}`, error);
    throw new Error(`Prompt file not found or inaccessible: ${filename}`);
  }
}

// プロンプトをキャッシュ
let mangaPromptTemplate: string | null = null;

function getMangaPromptTemplate(): string {
  if (!mangaPromptTemplate) {
    mangaPromptTemplate = loadPrompt('manga.txt');
  }
  return mangaPromptTemplate;
}
const MODEL_ID = 'gemini-3-pro-image-preview';
const PROJECT_ID = process.env.GCP_PROJECT_ID;
const LOCATION = process.env.GCP_LOCATION;

if (!PROJECT_ID) {
  throw new Error('GCP_PROJECT_ID environment variable is required');
}

if (!LOCATION) {
  throw new Error('GCP_LOCATION environment variable is required');
}

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT_ID,
  location: LOCATION,
  apiVersion: 'v1',
});

/**
 * パーソナライズ情報をプロンプトに追加するためのテキストを生成
 */
function buildPersonalizationContext(
  userIntent?: string,
  userProfile?: MangaRequest['userProfile']
): string {
  if (!userIntent && !userProfile) {
    return '';
  }

  const lines: string[] = [];
  lines.push('\n## ユーザー情報（パーソナライズ用）');
  if (userIntent) {
    lines.push(`- ユーザーの意図: ${userIntent}`);
  }

  if (userProfile) {
    if (userProfile.displayName) {
      lines.push(`- 呼称: ${userProfile.displayName}`);
    }
    if (userProfile.visualTraits) {
      lines.push(`- 外見の特徴: ${userProfile.visualTraits}`);
    }
    if (userProfile.personality) {
      lines.push(`- 性格・口調: ${userProfile.personality}`);
    }
    if (userProfile.age !== undefined) {
      lines.push(`- 年齢: ${userProfile.age}歳`);
    }
    if (userProfile.gender) {
      lines.push(`- 性別: ${userProfile.gender}`);
    }
    if (userProfile.occupation) {
      lines.push(`- 職業: ${userProfile.occupation}`);
    }
    if (userProfile.isJapaneseNational !== undefined) {
      lines.push(`- 国籍: ${userProfile.isJapaneseNational ? '日本' : '外国籍'}`);
    }
    if (userProfile.location) {
      lines.push(`- 居住地: ${userProfile.location}`);
    }
  }

  lines.push('');
  lines.push('上記のユーザー情報を考慮して、このユーザーに最適化された内容を生成してください。');
  lines.push('特にユーザーの意図に合わせて、必要な情報を強調し、不要な情報は省略してください。');

  return lines.join('\n');
}

/**
 * 検索結果をコンテキストに追加するためのテキストを生成
 */
function buildSearchResultContext(searchMetadata?: MangaRequest['intentSearchMetadata']): string {
  if (!searchMetadata) {
    return '';
  }

  const lines: string[] = [];

  if (searchMetadata.webSearchQueries?.length) {
    lines.push('\n### 関連するWeb検索クエリ:');
    searchMetadata.webSearchQueries.forEach((query) => {
      lines.push(`- ${query}`);
    });
  }

  if (searchMetadata.groundingChunks?.length) {
    lines.push('\n### 最新のWeb情報（参考）:');
    searchMetadata.groundingChunks.forEach((chunk, idx) => {
      if (chunk.web) {
        lines.push(`[${idx + 1}] ${chunk.web.title}`);
        lines.push(`    URL: ${chunk.web.uri}`);
      }
    });
  }

  return lines.join('\n');
}

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
  const panels: MangaPanel[] = [];
  let nextPanelId = 1;

  // 1. warnings（最大2件、最優先）
  if (request.warnings && request.warnings.length > 0) {
    request.warnings.slice(0, 2).forEach((warning) => {
      panels.push({
        id: `panel-${nextPanelId++}`,
        text: warning,
      });
    });
  }

  // 2. documentType別の優先情報
  if (request.documentType === 'benefit') {
    // 給付金: 金額 → 対象者 → 期限
    if (request.benefits?.amount) {
      panels.push({
        id: `panel-${nextPanelId++}`,
        text: `給付額: ${request.benefits.amount}`,
      });
    }
    if (request.target?.eligibility_summary) {
      panels.push({
        id: `panel-${nextPanelId++}`,
        text: `対象: ${request.target.eligibility_summary}`,
      });
    }
    if (request.procedure?.deadline) {
      panels.push({
        id: `panel-${nextPanelId++}`,
        text: `期限: ${request.procedure.deadline}`,
      });
    }
  } else if (request.documentType === 'procedure') {
    // 手続き: 手順（最大2件） → 必要書類 → 期限
    if (request.procedure?.steps && request.procedure.steps.length > 0) {
      request.procedure.steps.slice(0, 2).forEach((step) => {
        panels.push({
          id: `panel-${nextPanelId++}`,
          text: `${step.order}. ${step.action}`,
        });
      });
    }
    if (request.procedure?.required_documents && request.procedure.required_documents.length > 0) {
      panels.push({
        id: `panel-${nextPanelId++}`,
        text: `必要書類: ${request.procedure.required_documents.slice(0, 3).join('、')}`,
      });
    }
    if (request.procedure?.deadline) {
      panels.push({
        id: `panel-${nextPanelId++}`,
        text: `期限: ${request.procedure.deadline}`,
      });
    }
  } else {
    // その他: keyPoints優先
    if (request.keyPoints && request.keyPoints.length > 0) {
      request.keyPoints.slice(0, 3).forEach((point) => {
        panels.push({
          id: `panel-${nextPanelId++}`,
          text: point,
        });
      });
    }
  }

  // 3. 連絡先（最大1件）
  if (panels.length < 7 && request.contact?.department) {
    const contactParts = [request.contact.department];
    if (request.contact.phone) contactParts.push(request.contact.phone);
    panels.push({
      id: `panel-${nextPanelId++}`,
      text: `問い合わせ: ${contactParts.join(' ')}`,
    });
  }

  // 4. tips（最大1件）
  if (panels.length < 7 && request.tips && request.tips.length > 0) {
    panels.push({
      id: `panel-${nextPanelId++}`,
      text: request.tips[0],
    });
  }

  // 5. summaryで補填
  if (panels.length < 4) {
    const sentences = request.summary
      .split(/。|\n/)
      .map((text) => text.trim())
      .filter(Boolean);
    sentences.slice(0, 4 - panels.length).forEach((sentence) => {
      panels.push({
        id: `panel-${nextPanelId++}`,
        text: sentence,
      });
    });
  }

  // 6. 汎用フォールバック（最終手段）
  const fallbacks = [
    '条件に当てはまるか確認しましょう。',
    '必要な手続きを整理しましょう。',
    '期限や必要書類をチェックしましょう。',
    '詳しくは問い合わせ窓口へ。',
  ];
  while (panels.length < 4) {
    panels.push({
      id: `panel-${nextPanelId++}`,
      text: fallbacks[panels.length] || '次のステップを確認しましょう。',
    });
  }

  // 最大8コマに制限
  const finalPanels = panels.slice(0, 8);

  return {
    title: request.title,
    panels: finalPanels,
    imageUrls: [],
    meta: {
      panelCount: finalPanels.length,
      generatedAt: new Date().toISOString(),
      sourceUrl: request.url,
      format: 'png',
      maxEdge: MAX_EDGE,
      title: request.title,
    },
  };
}

/**
 * Gemini 用のプロンプトを生成
 */
function buildMangaPrompt(request: MangaRequest, panels: MangaPanel[]): string {
  const template = getMangaPromptTemplate();

  const panelTexts = panels.map((panel, index) => `(${index + 1}) ${panel.text}`).join('\n');

  // 補足情報（コンテキスト）を構築
  const context: string[] = [];

  if (request.documentType) {
    const typeLabels: Record<NonNullable<typeof request.documentType>, string> = {
      benefit: '給付・支援制度',
      procedure: '手続き案内',
      information: '一般情報',
      faq: 'よくある質問',
      guide: '利用ガイド',
      other: '行政情報',
    };
    context.push(`種類: ${typeLabels[request.documentType]}`);
  }

  if (request.benefits?.amount) {
    context.push(`給付額: ${request.benefits.amount}`);
  }

  if (request.procedure?.deadline) {
    context.push(`期限: ${request.procedure.deadline}`);
  }

  if (request.target?.eligibility_summary) {
    context.push(`対象: ${request.target.eligibility_summary}`);
  }

  const searchResultContext = buildSearchResultContext(request.intentSearchMetadata);
  if (searchResultContext) {
    context.push(searchResultContext);
  }

  const contextText = context.length > 0 ? context.join('\n') : 'なし';

  const personalizationContext = buildPersonalizationContext(
    request.userIntent,
    request.userProfile
  );

  // テンプレートのプレースホルダーを置換
  return template
    .replace('{title}', request.title)
    .replace('{summary}', request.summary)
    .replace('{panels}', panelTexts)
    .replace('{context}', contextText)
    .replace('{personalization}', personalizationContext);
}

/**
 * Gemini API で漫画画像を生成
 */
async function generateMangaImage(
  request: MangaRequest,
  panels: MangaPanel[]
): Promise<{ imageUrls: string[]; text: string }> {
  const prompt = buildMangaPrompt(request, panels);

  // プロンプトサイズをログ出力
  const promptSizeBytes = Buffer.byteLength(prompt, 'utf8');
  const promptSizeKB = (promptSizeBytes / 1024).toFixed(2);
  console.log(`[Worker] Manga prompt size: ${promptSizeBytes} bytes (${promptSizeKB} KB)`);
  console.log(`[Worker] Prompt character count: ${prompt.length}`);

  // プロンプトのプレビュー（最初の500文字と最後の500文字）
  const previewLength = 500;
  if (prompt.length > previewLength * 2) {
    console.log(`[Worker] Prompt preview (first ${previewLength} chars):`);
    console.log(prompt.substring(0, previewLength));
    console.log(`[Worker] Prompt preview (last ${previewLength} chars):`);
    console.log(prompt.substring(prompt.length - previewLength));
  } else {
    console.log('[Worker] Full prompt:');
    console.log(prompt);
  }

  console.log(`[Worker] Calling Gemini API with model: ${MODEL_ID}`);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
}

/**
 * 漫画生成のメイン処理
 */
export async function processManga(
  resultId: string,
  request: MangaRequest,
  userId: string
): Promise<void> {
  console.log(`[Worker] Starting job ${resultId}`, {
    title: request.title,
    userId,
  });

  // リクエストのサイズと構造をログ出力
  const requestJson = JSON.stringify(request);
  const requestSizeBytes = Buffer.byteLength(requestJson, 'utf8');
  const requestSizeKB = (requestSizeBytes / 1024).toFixed(2);
  console.log(
    `[Worker] Job ${resultId}: Request size: ${requestSizeBytes} bytes (${requestSizeKB} KB)`
  );
  console.log(`[Worker] Job ${resultId}: Document type: ${request.documentType}`);
  console.log(`[Worker] Job ${resultId}: Summary length: ${request.summary?.length || 0} chars`);
  console.log(
    `[Worker] Job ${resultId}: Has personalization: ${!!(request.userIntent || request.userProfile)}`
  );

  try {
    // 1. ステータス更新: processing (30%)
    await updateMangaJobStatus(resultId, 'processing', 30);
    console.log(`[Worker] Job ${resultId}: Status updated to processing (30%)`);

    // 2. パネル構成を生成
    const baseResult = buildPanels(request);
    console.log(`[Worker] Job ${resultId}: Generated ${baseResult.panels.length} panels`);
    console.log(
      `[Worker] Job ${resultId}: Panel texts:`,
      baseResult.panels.map((p) => p.text)
    );

    // 3. ステータス更新: processing (50%)
    await updateMangaJobStatus(resultId, 'processing', 50);

    // 4. Gemini API で漫画画像を生成
    console.log(`[Worker] Job ${resultId}: Calling Gemini API...`);
    const { imageUrls } = await generateMangaImage(request, baseResult.panels);
    console.log(`[Worker] Job ${resultId}: Generated ${imageUrls.length} images`);

    // 5. ステータス更新: processing (70%)
    await updateMangaJobStatus(resultId, 'processing', 70);

    // 6. Cloud Storage へアップロード
    console.log(`[Worker] Job ${resultId}: Uploading to Cloud Storage...`);
    await updateMangaJobStatus(resultId, 'processing', 85);

    const uploadResult = await uploadMangaImageAndGetUrl(userId, imageUrls[0], {
      sourceUrl: request.url,
      title: request.title,
      generatedAt: new Date().toISOString(),
    });

    const finalImageUrls = [uploadResult.signedUrl];
    const storageUrl = uploadResult.storageUrl;
    console.log(`[Worker] Job ${resultId}: Uploaded to ${uploadResult.storageUrl}`);

    // 7. 完了
    const finalResult: MangaResult = {
      ...baseResult,
      imageUrls: finalImageUrls,
      storageUrl,
    };

    await updateMangaJobResult(resultId, finalResult, storageUrl);
    console.log(`[Worker] Job ${resultId}: Completed successfully`);
  } catch (error) {
    console.error(`[Worker] ジョブ ${resultId}: 処理エラー:`, error);

    // エラーの詳細をログ出力
    if (error instanceof Error) {
      console.error(`[Worker] Job ${resultId}: Error name: ${error.name}`);
      console.error(`[Worker] Job ${resultId}: Error message: ${error.message}`);
      console.error(`[Worker] Job ${resultId}: Error stack:`, error.stack);
    }

    // APIエラーの詳細を出力
    const status = (error as { status?: number })?.status;
    const response = (error as { response?: unknown })?.response;
    const details = (error as { details?: unknown })?.details;

    console.error(`[Worker] Job ${resultId}: Error status code: ${status || 'N/A'}`);
    if (response) {
      console.error(`[Worker] Job ${resultId}: Error response:`, JSON.stringify(response, null, 2));
    }
    if (details) {
      console.error(`[Worker] Job ${resultId}: Error details:`, JSON.stringify(details, null, 2));
    }

    const errorCode = status === HTTP_STATUS_TOO_MANY_REQUESTS ? 'rate_limited' : 'api_error';
    const errorMessage =
      status === HTTP_STATUS_TOO_MANY_REQUESTS
        ? '現在アクセスが集中しています。時間をおいて再度お試しください。'
        : '漫画生成中にエラーが発生しました';

    // エラーを Firestore に記録（フォールバックなし）
    await updateMangaJobError(resultId, errorCode, errorMessage);

    // エラーを再スロー（リトライ判定のため）
    throw error;
  }
}
