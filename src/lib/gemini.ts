import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  IntermediateRepresentation,
  ChecklistItem,
  DocumentType,
  GroundingMetadata,
  ChatMessage,
  Overview,
  PersonalizationInput,
} from '@/lib/types/intermediate';

// Vertex AI クライアント初期化
const PROJECT_ID = 'zenn-ai-agent-hackathon-vol4';
const LOCATION = 'global';
const MODEL_NAME = 'gemini-3-flash-preview';

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT_ID,
  location: LOCATION,
  apiVersion: 'v1',
});

/** Google Search Groundingの結果 */
export interface GoogleSearchResult {
  content: string;
  url: string;
  groundingMetadata?: GroundingMetadata;
}

/**
 * プロンプトファイルを読み込む
 */
function loadPrompt(filename: string): string {
  const promptPath = join(process.cwd(), 'prompts', filename);
  return readFileSync(promptPath, 'utf-8');
}

// プロンプトをキャッシュ（初回読み込み時のみファイルアクセス）
let promptCache: Record<string, string> = {};

function getPrompt(filename: string): string {
  if (!promptCache[filename]) {
    promptCache[filename] = loadPrompt(filename);
  }
  return promptCache[filename];
}

/**
 * Google Searchを使用したURL情報取得のプロンプト
 */
const GOOGLE_SEARCH_PROMPT = `
あなたは行政ドキュメントの情報を取得するアシスタントです。

指定されたURLのページについて、以下の情報を詳しく調べて報告してください：

1. ページのタイトルと概要
2. 対象者・条件
3. 手続きの流れ・ステップ
4. 必要な書類
5. 期限・締め切り
6. 金額・費用
7. 問い合わせ先
8. 注意事項

できるだけ詳細に、原文に忠実に情報を抽出してください。
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenerateContentResponse = any;

/**
 * Vertex AI レスポンスからテキストを抽出
 */
function extractText(response: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }): string {
  return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * レスポンスからGroundingMetadataを抽出
 */
function extractGroundingMetadata(response: GenerateContentResponse): GroundingMetadata | undefined {
  const candidate = response.candidates?.[0];

  // デバッグ: groundingMetadata の存在確認
  console.log('[DEBUG] Grounding metadata available:', !!candidate?.groundingMetadata);
  if (candidate?.groundingMetadata) {
    console.log('[DEBUG] Grounding metadata keys:', Object.keys(candidate.groundingMetadata));
  }

  if (!candidate?.groundingMetadata) {
    return undefined;
  }

  const gm = candidate.groundingMetadata;
  return {
    webSearchQueries: gm.webSearchQueries,
    groundingChunks: gm.groundingChunks?.map((chunk: { web?: { uri: string; title: string } }) => ({
      web: chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : undefined,
    })),
    searchEntryPoint: gm.searchEntryPoint
      ? { renderedContent: gm.searchEntryPoint.renderedContent }
      : undefined,
  };
}

/**
 * Google Search Groundingを使用してURL情報を取得
 */
export async function fetchWithGoogleSearch(url: string): Promise<GoogleSearchResult> {
  const prompt = `${GOOGLE_SEARCH_PROMPT}\n\n対象URL: ${url}`;

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 1.0, // Google推奨設定
        tools: [{ googleSearch: {} }],
      },
    });

    const content = extractText(result);
    const groundingMetadata = extractGroundingMetadata(result);

    return {
      content,
      url,
      groundingMetadata,
    };
  } catch (error) {
    console.error('Google Search Grounding error:', error);
    throw error;
  }
}

/**
 * JSONをパースする（エラーハンドリング付き）
 */
function extractJsonSubstring(text: string): string | null {
  const cleaned = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  const startIndex = cleaned.search(/[\[{]/);
  if (startIndex === -1) {
    return null;
  }

  const openChar = cleaned[startIndex];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < cleaned.length; i += 1) {
    const char = cleaned[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === openChar) {
      depth += 1;
      continue;
    }

    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return cleaned.slice(startIndex, i + 1);
      }
    }
  }

  return null;
}

function parseJSON<T>(text: string): T | null {
  try {
    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    return JSON.parse(cleaned);
  } catch {
    const extracted = extractJsonSubstring(text);
    if (!extracted) {
      console.error('JSON parse error:', text);
      return null;
    }

    try {
      return JSON.parse(extracted);
    } catch {
      console.error('JSON parse error:', text);
      return null;
    }
  }
}

/**
 * パーソナライズ情報をプロンプトに追加するためのテキストを生成
 */
function buildPersonalizationContext(personalization?: PersonalizationInput): string {
  if (!personalization) {
    console.log('[DEBUG] buildPersonalizationContext: No personalization input');
    return '';
  }

  const lines: string[] = [];
  lines.push('\n## ユーザー情報（パーソナライズ用）');
  lines.push(`- ユーザーの意図: ${personalization.userIntent}`);

  if (personalization.userProfile) {
    const profile = personalization.userProfile;
    if (profile.age !== undefined) {
      lines.push(`- 年齢: ${profile.age}歳`);
    }
    if (profile.gender) {
      lines.push(`- 性別: ${profile.gender}`);
    }
    if (profile.occupation) {
      lines.push(`- 職業: ${profile.occupation}`);
    }
    if (profile.isJapaneseNational !== undefined) {
      lines.push(`- 国籍: ${profile.isJapaneseNational ? '日本' : '外国籍'}`);
    }
    if (profile.location) {
      lines.push(`- 居住地: ${profile.location}`);
    }
  }

  lines.push('');
  lines.push('上記のユーザー情報を考慮して、このユーザーに最適化された内容を生成してください。');
  lines.push('特にユーザーの意図に合わせて、必要な情報を強調し、不要な情報は省略してください。');

  const result = lines.join('\n');
  console.log('[DEBUG] buildPersonalizationContext result:\n', result);
  return result;
}

/**
 * 中間表現を生成（Google Search Groundingの結果から）
 */
export async function generateIntermediateRepresentation(
  searchResult: GoogleSearchResult
): Promise<IntermediateRepresentation | null> {
  const pageContent = `
# ページ情報
- URL: ${searchResult.url}

# 取得した情報
${searchResult.content}
`;

  try {
    // ドキュメントタイプ判定
    const typeResult = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: getPrompt('document-type.txt') + '\n\n---\n\n' + pageContent }] }],
    });
    const typeText = extractText(typeResult);
    const typeData = parseJSON<{ documentType: DocumentType }>(typeText);
    const documentType = typeData?.documentType || 'other';

    // 中間表現生成
    const intermediateResult = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: getPrompt('intermediate.txt') + '\n\n---\n\n' + pageContent }] }],
    });
    const intermediateText = extractText(intermediateResult);
    const intermediateData = parseJSON<Partial<IntermediateRepresentation>>(intermediateText);

    if (!intermediateData) {
      return null;
    }

    // 根拠情報抽出
    const sourcesResult = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: getPrompt('sources.txt') + '\n\n---\n\n' + pageContent }] }],
    });
    const sourcesText = extractText(sourcesResult);
    const sources = parseJSON<IntermediateRepresentation['sources']>(sourcesText) || [];

    return {
      title: intermediateData.title || '',
      summary: intermediateData.summary || '',
      documentType,
      metadata: {
        source_url: searchResult.url,
        fetched_at: new Date().toISOString(),
        groundingMetadata: searchResult.groundingMetadata,
      },
      keyPoints: intermediateData.keyPoints,
      target: intermediateData.target,
      procedure: intermediateData.procedure,
      benefits: intermediateData.benefits,
      contact: intermediateData.contact,
      warnings: intermediateData.warnings,
      tips: intermediateData.tips,
      sources,
    };
  } catch (error) {
    console.error('Google Gen AI error:', error);
    return null;
  }
}

/**
 * チェックリストを生成
 */
export async function generateChecklist(
  intermediate: IntermediateRepresentation,
  personalization?: PersonalizationInput
): Promise<ChecklistItem[]> {
  const context = JSON.stringify(intermediate, null, 2);
  const personalizationContext = buildPersonalizationContext(personalization);

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: getPrompt('checklist.txt') + personalizationContext + '\n\n---\n\n' + context }] }],
    });
    const text = extractText(result);
    const items = parseJSON<Omit<ChecklistItem, 'completed'>[]>(text);

    if (!items) {
      return [];
    }

    return items.map((item) => ({
      ...item,
      completed: false,
    }));
  } catch (error) {
    console.error('Checklist generation error:', error);
    return [];
  }
}

/**
 * やさしい要約を生成（Markdown形式）
 */
export async function generateSimpleSummary(
  intermediate: IntermediateRepresentation,
  personalization?: PersonalizationInput
): Promise<string> {
  const personalizationContext = buildPersonalizationContext(personalization);

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: getPrompt('simple-summary.txt') + personalizationContext + '\n\n---\n\n' + JSON.stringify(intermediate, null, 2) }] }],
    });
    return extractText(result);
  } catch (error) {
    console.error('Summary generation error:', error);
    return '';
  }
}

/**
 * 構造化されたページ概要を生成
 */
export async function generateOverview(
  intermediate: IntermediateRepresentation
): Promise<Overview | null> {
  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: getPrompt('overview.txt') + '\n\n---\n\n' + JSON.stringify(intermediate, null, 2),
            },
          ],
        },
      ],
    });
    const text = extractText(result);
    const overview = parseJSON<Overview>(text);
    if (!overview) {
      return null;
    }
    return {
      conclusion: overview.conclusion || '',
      targetAudience: overview.targetAudience || '',
      purpose: overview.purpose || '',
      topics: Array.isArray(overview.topics) ? overview.topics : [],
      cautions: Array.isArray(overview.cautions) ? overview.cautions : [],
    };
  } catch (error) {
    console.error('Overview generation error:', error);
    return null;
  }
}

/**
 * 意図ベースの回答を生成
 */
export async function generateIntentAnswer(
  intermediate: IntermediateRepresentation,
  userIntent: string,
  personalization?: PersonalizationInput
): Promise<string> {
  const personalizationContext = buildPersonalizationContext(personalization);
  const payload = JSON.stringify(
    {
      userIntent,
      intermediate,
    },
    null,
    2
  );

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                getPrompt('intent-answer.txt') +
                personalizationContext +
                '\n\n---\n\n' +
                payload,
            },
          ],
        },
      ],
    });
    return extractText(result);
  } catch (error) {
    console.error('Intent answer generation error:', error);
    return '';
  }
}

/**
 * 深掘り回答と要点要約を生成
 */
export async function generateDeepDiveResponse(params: {
  summary: string;
  messages: ChatMessage[];
  focus?: string;
  deepDiveSummary?: string;
  summaryOnly?: boolean;
}): Promise<{ answer: string; summary: string } | null> {
  const payload = JSON.stringify(
    {
      summary: params.summary,
      deepDiveSummary: params.deepDiveSummary || '',
      focus: params.focus || '',
      messages: params.messages || [],
      summaryOnly: Boolean(params.summaryOnly),
    },
    null,
    2
  );

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: getPrompt('deep-dive.txt') + '\n\n---\n\n' + payload }] }],
    });
    const text = extractText(result);
    const data = parseJSON<{ answer?: string; summary?: string }>(text);
    if (!data?.summary) {
      return null;
    }
    return {
      answer: data.answer || '',
      summary: data.summary,
    };
  } catch (error) {
    console.error('Deep dive generation error:', error);
    return null;
  }
}
