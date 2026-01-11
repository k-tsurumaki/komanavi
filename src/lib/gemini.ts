import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  IntermediateRepresentation,
  ChecklistItem,
  DocumentType,
} from '@/lib/types/intermediate';
import type { ScrapedContent } from '@/lib/scraper';

// Gemini クライアント初期化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// 使用するモデル
const MODEL_NAME = 'gemini-1.5-flash';

/**
 * ドキュメントタイプを判定するプロンプト
 */
const DOCUMENT_TYPE_PROMPT = `
あなたは行政ドキュメントの分類エキスパートです。
以下のページ内容を分析し、最も適切なドキュメントタイプを1つ選んでください。

ドキュメントタイプ:
- benefit: 給付・手当系（児童手当、介護保険、各種給付金など）
- procedure: 手続き系（転入届、パスポート申請、各種届出など）
- information: 情報提供系（お知らせ、制度説明など）
- faq: よくある質問
- guide: ガイド・案内
- other: その他

回答は以下のJSON形式で返してください:
{"documentType": "benefit"}
`;

/**
 * 中間表現を生成するプロンプト
 */
const INTERMEDIATE_PROMPT = `
あなたは行政ドキュメントを分析し、市民にわかりやすく情報を整理するエキスパートです。

以下のページ内容を分析し、構造化されたJSONデータを生成してください。

## 出力形式

以下のJSON形式で出力してください。すべてのフィールドは日本語で記入してください。

{
  "title": "ページのタイトル（簡潔に）",
  "summary": "このページの内容を2-3文で要約（やさしい日本語で）",
  "keyPoints": [
    {
      "id": "kp-001",
      "text": "重要なポイント",
      "importance": "high" | "medium" | "low"
    }
  ],
  "target": {
    "conditions": ["対象となる条件1", "対象となる条件2"],
    "exceptions": ["例外・注意事項"],
    "eligibility_summary": "対象者を一言で説明"
  },
  "procedure": {
    "steps": [
      {
        "order": 1,
        "action": "やること",
        "details": "詳細説明",
        "note": "補足情報"
      }
    ],
    "required_documents": ["必要な書類1", "必要な書類2"],
    "deadline": "期限があれば記載",
    "fee": "費用があれば記載",
    "online_available": true | false
  },
  "benefits": {
    "description": "給付・支援の説明",
    "amount": "金額",
    "frequency": "支給頻度"
  },
  "contact": {
    "department": "担当部署",
    "phone": "電話番号",
    "hours": "受付時間"
  },
  "warnings": ["注意事項1", "注意事項2"],
  "tips": ["便利な情報1"]
}

## 注意事項

1. 情報がない項目は省略してください
2. 「やさしい日本語」を心がけてください（難しい言葉は避ける、短い文で）
3. 重要な情報は必ず含めてください（期限、金額、必要書類など）
4. 推測で情報を追加しないでください。ページに書かれていることのみを抽出してください
`;

/**
 * 根拠情報を抽出するプロンプト
 */
const SOURCES_PROMPT = `
あなたは行政ドキュメントから根拠となる原文を抽出するエキスパートです。

以下のページ内容から、重要な情報の根拠となる原文を抽出してください。

## 出力形式

以下のJSON配列形式で出力してください:

[
  {
    "source_id": "src-001",
    "section": "セクション名（対象者、支給額、期限など）",
    "original_text": "原文をそのまま引用"
  }
]

## 注意事項

1. 原文は改変せずにそのまま引用してください
2. 重要な情報（対象者、金額、期限、必要書類など）の根拠を優先してください
3. 最大10件まで抽出してください
`;

/**
 * チェックリストを生成するプロンプト
 */
const CHECKLIST_PROMPT = `
あなたは行政手続きのチェックリストを作成するエキスパートです。

以下の構造化データを基に、ユーザーがやるべきことのチェックリストを作成してください。

## 出力形式

以下のJSON配列形式で出力してください:

[
  {
    "id": "check-001",
    "text": "やること（具体的に）",
    "category": "カテゴリ（準備、申請、確認など）",
    "deadline": "期限があれば記載",
    "priority": "high" | "medium" | "low"
  }
]

## 注意事項

1. 時系列順に並べてください
2. 具体的で行動可能な項目にしてください
3. 重要な項目は priority: "high" にしてください
4. 最大15件程度に収めてください
`;

/**
 * JSONをパースする（エラーハンドリング付き）
 */
function parseJSON<T>(text: string): T | null {
  try {
    // コードブロックを削除
    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    return JSON.parse(cleaned);
  } catch {
    console.error('JSON parse error:', text);
    return null;
  }
}

/**
 * 中間表現を生成
 */
export async function generateIntermediateRepresentation(
  content: ScrapedContent
): Promise<IntermediateRepresentation | null> {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const pageContent = `
# ページ情報
- URL: ${content.url}
- タイトル: ${content.title}

# ページ内容
${content.sections.length > 0 ? content.sections.map((s) => `## ${s.heading}\n${s.content}`).join('\n\n') : content.mainContent}
`;

  try {
    // ドキュメントタイプ判定
    const typeResult = await model.generateContent(
      DOCUMENT_TYPE_PROMPT + '\n\n---\n\n' + pageContent
    );
    const typeText = typeResult.response.text();
    const typeData = parseJSON<{ documentType: DocumentType }>(typeText);
    const documentType = typeData?.documentType || 'other';

    // 中間表現生成
    const intermediateResult = await model.generateContent(
      INTERMEDIATE_PROMPT + '\n\n---\n\n' + pageContent
    );
    const intermediateText = intermediateResult.response.text();
    const intermediateData = parseJSON<Partial<IntermediateRepresentation>>(intermediateText);

    if (!intermediateData) {
      return null;
    }

    // 根拠情報抽出
    const sourcesResult = await model.generateContent(
      SOURCES_PROMPT + '\n\n---\n\n' + pageContent
    );
    const sourcesText = sourcesResult.response.text();
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
    console.error('Gemini API error:', error);
    return null;
  }
}

/**
 * チェックリストを生成
 */
export async function generateChecklist(
  intermediate: IntermediateRepresentation
): Promise<ChecklistItem[]> {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const context = JSON.stringify(intermediate, null, 2);

  try {
    const result = await model.generateContent(
      CHECKLIST_PROMPT + '\n\n---\n\n' + context
    );
    const text = result.response.text();
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
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const prompt = `
あなたは行政情報を市民にわかりやすく説明するエキスパートです。

以下の構造化データを基に、やさしい日本語で要約を作成してください。

## 出力形式

Markdown形式で出力してください。以下の構成を参考にしてください:

## タイトル

簡潔な説明（2-3文）

## 主なポイント
- ポイント1
- ポイント2

## 必要な手続き（ある場合）
1. ステップ1
2. ステップ2

## 注意事項（ある場合）
- 注意点

## 注意事項

1. 難しい言葉は使わない（専門用語は避ける）
2. 短い文で書く
3. 重要な情報（期限、金額など）は必ず含める
4. 推測で情報を追加しない
`;

  try {
    const result = await model.generateContent(
      prompt + '\n\n---\n\n' + JSON.stringify(intermediate, null, 2)
    );
    return result.response.text();
  } catch (error) {
    console.error('Summary generation error:', error);
    return '';
  }
}
