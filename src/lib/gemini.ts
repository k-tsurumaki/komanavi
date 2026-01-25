import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  IntermediateRepresentation,
  ChecklistItem,
  DocumentType,
} from '@/lib/types/intermediate';
import type { ScrapedContent } from '@/lib/scraper';

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
 * Vertex AI レスポンスからテキストを抽出
 */
function extractText(response: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }): string {
  return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
 * 中間表現を生成
 */
export async function generateIntermediateRepresentation(
  content: ScrapedContent
): Promise<IntermediateRepresentation | null> {
  const pageContent = `
# ページ情報
- URL: ${content.url}
- タイトル: ${content.title}

# ページ内容
${content.sections.length > 0 ? content.sections.map((s) => `## ${s.heading}\n${s.content}`).join('\n\n') : content.mainContent}
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
      title: intermediateData.title || content.title,
      summary: intermediateData.summary || '',
      documentType,
      metadata: {
        source_url: content.url,
        page_title: content.title,
        fetched_at: content.metadata.fetchedAt,
        last_modified: content.metadata.lastModified,
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
  intermediate: IntermediateRepresentation
): Promise<ChecklistItem[]> {
  const context = JSON.stringify(intermediate, null, 2);

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: getPrompt('checklist.txt') + '\n\n---\n\n' + context }] }],
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
  intermediate: IntermediateRepresentation
): Promise<string> {
  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: getPrompt('simple-summary.txt') + '\n\n---\n\n' + JSON.stringify(intermediate, null, 2) }] }],
    });
    return extractText(result);
  } catch (error) {
    console.error('Summary generation error:', error);
    return '';
  }
}
