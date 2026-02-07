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
  OverviewBlockId,
  OverviewEvidenceByBlock,
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
const promptCache: Record<string, string> = {};

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
  const overviewBlockIds: OverviewBlockId[] = [
    'conclusion',
    'targetAudience',
    'achievableOutcomes',
    'criticalFacts',
    'cautions',
    'contactInfo',
  ];

  const normalizeUrl = (value: unknown): string => {
    if (typeof value !== 'string') {
      return '';
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return '';
      }
      url.hash = '';
      const normalized = url.toString();
      return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
    } catch {
      return '';
    }
  };

  const allowedEvidenceUrlByKey = new Map<string, string>();
  const pushAllowedEvidenceUrl = (url?: string) => {
    const normalized = normalizeUrl(url);
    if (!normalized || allowedEvidenceUrlByKey.has(normalized)) {
      return;
    }
    allowedEvidenceUrlByKey.set(normalized, normalized);
  };

  pushAllowedEvidenceUrl(intermediate.metadata.source_url);
  for (const chunk of intermediate.metadata.groundingMetadata?.groundingChunks ?? []) {
    pushAllowedEvidenceUrl(chunk.web?.uri);
  }
  for (const link of intermediate.relatedLinks ?? []) {
    pushAllowedEvidenceUrl(link.url);
  }
  pushAllowedEvidenceUrl(intermediate.contact?.website);

  const allowedEvidenceUrls = Array.from(allowedEvidenceUrlByKey.values());

  const normalizeEvidenceByBlock = (value: unknown): OverviewEvidenceByBlock => {
    if (!value || typeof value !== 'object') {
      return {};
    }

    const objectValue = value as Record<string, unknown>;
    const normalized: OverviewEvidenceByBlock = {};

    for (const blockId of overviewBlockIds) {
      const blockUrls = objectValue[blockId];
      if (!Array.isArray(blockUrls)) {
        continue;
      }

      const deduped = new Set<string>();
      for (const blockUrl of blockUrls) {
        const normalizedUrl = normalizeUrl(blockUrl);
        if (!normalizedUrl) {
          continue;
        }
        const allowedUrl = allowedEvidenceUrlByKey.get(normalizedUrl);
        if (!allowedUrl || deduped.has(allowedUrl)) {
          continue;
        }
        deduped.add(allowedUrl);
      }

      const normalizedUrls = Array.from(deduped).slice(0, 3);
      if (normalizedUrls.length > 0) {
        normalized[blockId] = normalizedUrls;
      }
    }

    return normalized;
  };

  const buildFallbackEvidenceByBlock = (): OverviewEvidenceByBlock => {
    if (allowedEvidenceUrls.length === 0) {
      return {};
    }

    const primaryEvidence = allowedEvidenceUrls.slice(0, 2);
    const detailedEvidence = allowedEvidenceUrls.slice(0, 3);
    const contactEvidence = allowedEvidenceUrls
      .filter((url) => /(contact|inquiry|faq|madoguchi|sodan|toiawase)/i.test(url))
      .slice(0, 2);

    const fallback: OverviewEvidenceByBlock = {
      conclusion: primaryEvidence,
      targetAudience: primaryEvidence,
      achievableOutcomes: detailedEvidence,
      criticalFacts: detailedEvidence,
      cautions: primaryEvidence,
      contactInfo: contactEvidence.length > 0 ? contactEvidence : primaryEvidence,
    };

    return fallback;
  };

  const normalizeSentence = (value: unknown, maxLength: number): string => {
    if (typeof value !== 'string') {
      return '';
    }
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return '';
    }
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
  };

  const normalizeList = (
    value: unknown,
    maxItems: number,
    maxLengthPerItem: number
  ): string[] => {
    if (!Array.isArray(value)) {
      return [];
    }

    const deduped = new Set<string>();
    for (const item of value) {
      const normalized = normalizeSentence(item, maxLengthPerItem);
      if (normalized) {
        deduped.add(normalized);
      }
    }

    return Array.from(deduped).slice(0, maxItems);
  };

  const normalizeCriticalFacts = (
    value: unknown,
    maxItems: number
  ): Array<{ item: string; value: string; reason: string }> => {
    if (!Array.isArray(value)) {
      return [];
    }

    const deduped = new Map<string, { item: string; value: string; reason: string }>();

    for (const row of value) {
      if (!row || typeof row !== 'object') {
        continue;
      }

      const rowObject = row as Record<string, unknown>;
      const item = normalizeSentence(rowObject.item, 40);
      const rowValue = normalizeSentence(rowObject.value, 100);
      const reason = normalizeSentence(rowObject.reason, 80);

      if (!item || !rowValue) {
        continue;
      }

      const key = `${item}:${rowValue}`;
      if (!deduped.has(key)) {
        deduped.set(key, {
          item,
          value: rowValue,
          reason: reason || '見落とすと手続きの失敗につながるため',
        });
      }
    }

    return Array.from(deduped.values()).slice(0, maxItems);
  };

  const hasContactKeyword = (text: string): boolean =>
    /(問い合わせ|連絡先|窓口|電話|相談|コールセンター|contact)/i.test(text);

  const buildFallbackCriticalFacts = (): Array<{ item: string; value: string; reason: string }> => {
    const fallbackFactTexts = [
      ...(intermediate.keyPoints ?? []).map((point) => point.text),
      ...(intermediate.procedure?.steps ?? []).map((step) => step.action),
      ...(intermediate.importantDates ?? []).map((date) =>
        date.date ? `${date.description}: ${date.date}` : date.description
      ),
      intermediate.benefits?.amount ? `支援額: ${intermediate.benefits.amount}` : '',
      intermediate.procedure?.deadline ? `期限: ${intermediate.procedure.deadline}` : '',
      ...(intermediate.warnings ?? []),
    ].filter(Boolean);

    const rows = fallbackFactTexts.map((text, index) => {
      const sentence = normalizeSentence(text, 100);
      const segments = sentence.split(/[:：]/);
      const hasStructuredLabel = segments.length > 1 && segments[0].trim().length <= 18;
      const item = hasStructuredLabel ? segments[0].trim() : `重要事項${index + 1}`;
      const value = hasStructuredLabel ? segments.slice(1).join('：').trim() : sentence;
      return {
        item,
        value,
        reason: '見落とすと制度利用の判断や手続きに影響するため',
      };
    });

    return normalizeCriticalFacts(rows, 5).filter(
      (row) => !hasContactKeyword(`${row.item} ${row.value}`)
    );
  };

  const buildFallbackOverview = (): Overview => {
    const fallbackConclusion = normalizeSentence(
      intermediate.summary || `${intermediate.title || 'このページ'}の内容を短く整理しました。`,
      90
    );
    const fallbackTarget = normalizeSentence(
      intermediate.target?.eligibility_summary ||
        intermediate.target?.conditions?.[0] ||
        '対象条件は本文で確認してください。',
      90
    );
    const fallbackPurpose = normalizeSentence(
      intermediate.benefits?.description ||
        intermediate.summary ||
        '制度の内容と手続き条件を確認するための案内です。',
      90
    );
    const requiredDocCount = (intermediate.procedure?.required_documents ?? []).filter(Boolean).length;
    const fallbackTopics = [
      requiredDocCount > 0 ? `必要書類は${requiredDocCount}点あります。` : '',
      intermediate.procedure?.deadline ? `期限は${intermediate.procedure.deadline}です。` : '',
      ...(intermediate.keyPoints ?? []).map((point) => point.text),
      ...(intermediate.procedure?.steps ?? []).map((step) => step.action),
    ];
    const fallbackCautions = [
      ...(intermediate.warnings ?? []),
      ...(intermediate.target?.exceptions ?? []),
    ];
    const fallbackCriticalFacts = buildFallbackCriticalFacts();
    const fallbackEvidenceByBlock = buildFallbackEvidenceByBlock();

    return {
      conclusion: fallbackConclusion,
      targetAudience: fallbackTarget,
      purpose: fallbackPurpose,
      topics: normalizeList(fallbackTopics, 5, 90),
      cautions: normalizeList(fallbackCautions, 3, 90).filter(
        (caution) => !hasContactKeyword(caution)
      ),
      criticalFacts: fallbackCriticalFacts,
      evidenceByBlock: fallbackEvidenceByBlock,
    };
  };

  try {
    const fallback = buildFallbackOverview();
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
      return fallback;
    }

    const normalizedTopics = normalizeList(overview.topics, 5, 90);
    const normalizedCautions = normalizeList(overview.cautions, 3, 90).filter(
      (caution) => !hasContactKeyword(caution)
    );
    const normalizedCriticalFacts = normalizeCriticalFacts(overview.criticalFacts, 5).filter(
      (row) => !hasContactKeyword(`${row.item} ${row.value}`)
    );
    const normalizedEvidenceByBlock = normalizeEvidenceByBlock(overview.evidenceByBlock);
    const fallbackEvidenceByBlock = fallback.evidenceByBlock ?? {};

    return {
      conclusion: normalizeSentence(overview.conclusion, 90) || fallback.conclusion,
      targetAudience: normalizeSentence(overview.targetAudience, 90) || fallback.targetAudience,
      purpose: normalizeSentence(overview.purpose, 90) || fallback.purpose,
      topics: normalizedTopics.length > 0 ? normalizedTopics : fallback.topics,
      cautions: normalizedCautions.length > 0 ? normalizedCautions : fallback.cautions,
      criticalFacts:
        normalizedCriticalFacts.length > 0
          ? normalizedCriticalFacts
          : (fallback.criticalFacts ?? []),
      evidenceByBlock:
        Object.keys(normalizedEvidenceByBlock).length > 0
          ? normalizedEvidenceByBlock
          : fallbackEvidenceByBlock,
    };
  } catch (error) {
    console.error('Overview generation error:', error);
    return buildFallbackOverview();
  }
}

/**
 * 意図ベースの回答を生成
 */
export async function generateIntentAnswer(
  intermediate: IntermediateRepresentation,
  userIntent: string,
  personalization?: PersonalizationInput,
  context?: {
    deepDiveSummary?: string;
    focus?: string;
    messages?: ChatMessage[];
  }
): Promise<string> {
  const personalizationContext = buildPersonalizationContext(personalization);
  const payload = JSON.stringify(
    {
      userIntent,
      intermediate,
      deepDiveContext: {
        deepDiveSummary: context?.deepDiveSummary || '',
        focus: context?.focus || '',
        messages: context?.messages ?? [],
      },
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
