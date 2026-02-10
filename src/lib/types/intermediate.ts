/**
 * 中間表現の型定義
 * 行政ドキュメントから抽出された構造化データ
 * 様々な種類の行政ドキュメントに対応できる汎用的な構造
 */

// ============================================
// ドキュメント分類
// ============================================

/** ドキュメントタイプ */
export type DocumentType =
  | 'benefit' // 給付・手当系（児童手当、介護保険など）
  | 'procedure' // 手続き系（転入届、パスポート申請など）
  | 'information' // 情報提供系（お知らせ、制度説明など）
  | 'faq' // よくある質問
  | 'guide' // ガイド・案内
  | 'other'; // その他

// ============================================
// 汎用コンテンツセクション
// ============================================

/** コンテンツセクション（汎用） */
export interface ContentSection {
  id: string;
  title: string;
  content: string;
  subsections?: ContentSection[];
}

/** キーポイント（重要な情報の抽出） */
export interface KeyPoint {
  id: string;
  text: string;
  importance: 'high' | 'medium' | 'low';
  sourceId?: string;
}

// ============================================
// 手続き関連（オプショナル）
// ============================================

/** 手続きステップ */
export interface ProcedureStep {
  order: number;
  action: string;
  details?: string;
  note?: string;
}

/** 手続き情報 */
export interface Procedure {
  steps: ProcedureStep[];
  required_documents?: string[];
  deadline?: string;
  contact?: string;
  location?: string;
  fee?: string;
  online_available?: boolean;
}

// ============================================
// 対象者関連（オプショナル）
// ============================================

/** 対象者情報 */
export interface Target {
  conditions: string[];
  exceptions?: string[];
  eligibility_summary?: string;
}

// ============================================
// 給付・支援関連（オプショナル）
// ============================================

/** 給付・支援内容 */
export interface Benefits {
  description: string;
  amount?: string;
  frequency?: string; // 月額、年額、一回限り等
  conditions?: string[];
}

// ============================================
// FAQ関連（オプショナル）
// ============================================

/** FAQ項目 */
export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

// ============================================
// 日程・期限関連（オプショナル）
// ============================================

/** 重要な日付・期限 */
export interface ImportantDate {
  id: string;
  description: string;
  date?: string;
  deadline_type?: 'absolute' | 'relative'; // 絶対日付 or 相対期限（〇日以内など）
  relative_to?: string; // 相対期限の起点（出生日、転入日など）
}

// ============================================
// 連絡先・問い合わせ
// ============================================

/** 連絡先情報 */
export interface ContactInfo {
  department?: string;
  phone?: string;
  email?: string;
  address?: string;
  hours?: string;
  website?: string;
}

// ============================================
// 根拠・出典
// ============================================

/** 根拠情報 */
export interface Source {
  source_id: string;
  section: string;
  original_text: string;
  location?: string; // ページ内の位置情報
}

// ============================================
// パーソナライズ
// ============================================

/** パーソナライズ質問の選択肢型 */
export type PersonalizationQuestionType = 'select' | 'multiselect' | 'text' | 'boolean';

/** パーソナライズ質問 */
export interface PersonalizationQuestion {
  id: string;
  question: string;
  type: PersonalizationQuestionType;
  options?: string[];
  affects: string[];
  required?: boolean;
}

/** パーソナライズ設定 */
export interface Personalization {
  questions: PersonalizationQuestion[];
}

/** パーソナライズ回答 */
export interface PersonalizationAnswer {
  questionId: string;
  answer: string | string[] | boolean;
}

/** ユーザプロフィール（パーソナライズ用に正規化された形式） */
export interface NormalizedUserProfile {
  age?: number;
  gender?: string;
  occupation?: string;
  isJapaneseNational?: boolean;
  location?: string;
}

/** パーソナライズ入力（LLM生成時に使用） */
export interface PersonalizationInput {
  userIntent: string;
  userProfile?: NormalizedUserProfile;
}

// ============================================
// Google Search Grounding
// ============================================

/** グラウンディングチャンク */
export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

/** グラウンディングサポート（本文とチャンクの紐付け） */
export interface GroundingSupport {
  segment?: {
    startIndex?: number;
    endIndex?: number;
    text?: string;
  };
  groundingChunkIndices?: number[];
}

/** グラウンディングメタデータ */
export interface GroundingMetadata {
  webSearchQueries?: string[];
  groundingChunks?: GroundingChunk[];
  groundingSupports?: GroundingSupport[];
  searchEntryPoint?: {
    renderedContent: string;
  };
}

// ============================================
// メタデータ
// ============================================

/** メタデータ */
export interface Metadata {
  source_url: string;
  page_title?: string;
  fetched_at: string;
  cache_expires_at?: string;
  last_modified?: string; // 元ページの最終更新日
  language?: string;
  groundingMetadata?: GroundingMetadata;
}

// ============================================
// 中間表現（メイン型）
// ============================================

/** 中間表現（メイン型） - 汎用的な構造 */
export interface IntermediateRepresentation {
  // 必須フィールド
  title: string;
  summary: string;
  documentType: DocumentType;
  metadata: Metadata;

  // 汎用コンテンツ（どのタイプでも使用可能）
  keyPoints?: KeyPoint[];
  sections?: ContentSection[];

  // 専門フィールド（ドキュメントタイプに応じて使用）
  target?: Target; // 対象者情報
  procedure?: Procedure; // 手続き情報
  benefits?: Benefits; // 給付・支援内容
  faq?: FaqItem[]; // FAQ
  importantDates?: ImportantDate[]; // 重要な日付・期限
  contact?: ContactInfo; // 連絡先

  // 信頼性担保
  sources: Source[];

  // パーソナライズ
  personalization?: Personalization;

  // 関連情報
  relatedLinks?: { title: string; url: string }[];
  warnings?: string[]; // 注意事項
  tips?: string[]; // 便利な情報・ヒント
}

// ============================================
// 解析結果・リクエスト
// ============================================

/** チェックリスト項目 */
export interface ChecklistItem {
  id: string;
  text: string;
  category?: string;
  deadline?: string;
  sourceId?: string;
  completed: boolean;
  priority?: 'high' | 'medium' | 'low';
}

/** チェックリスト生成状態 */
export type ChecklistGenerationState = 'not_requested' | 'ready' | 'error';

/** ページ概要（構造化） */
export interface OverviewCriticalFact {
  item: string;
  value: string;
  reason: string;
}

export type OverviewBlockId =
  | 'conclusion'
  | 'targetAudience'
  | 'achievableOutcomes'
  | 'criticalFacts'
  | 'cautions'
  | 'contactInfo';

export type OverviewEvidenceByBlock = Partial<Record<OverviewBlockId, string[]>>;

export interface Overview {
  conclusion: string;
  targetAudience: string;
  purpose: string;
  topics: string[];
  cautions: string[];
  criticalFacts?: OverviewCriticalFact[];
  evidenceByBlock?: OverviewEvidenceByBlock;
}

/** 適用されたパーソナライズ情報 */
export interface AppliedPersonalization {
  appliedIntent: string;
  appliedProfile?: NormalizedUserProfile;
}

/** 解析結果 */
export interface AnalyzeResult {
  id: string;
  intermediate: IntermediateRepresentation;
  generatedSummary: string;
  userIntent?: string;
  intentAnswer?: string;
  guidanceUnlocked?: boolean;
  overview?: Overview;
  checklist: ChecklistItem[];
  checklistState?: ChecklistGenerationState;
  checklistError?: string;
  personalization?: AppliedPersonalization;
  status: 'success' | 'error';
  error?: string;
}

/** 深掘りチャット用メッセージ */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** 深掘りリクエスト */
export interface DeepDiveRequest {
  mode: 'deepDive';
  summary: string;
  messages: ChatMessage[];
  deepDiveSummary?: string;
  summaryOnly?: boolean;
}

/** 意図回答リクエスト */
export interface IntentAnswerRequest {
  mode: 'intent';
  userIntent: string;
  intermediate: IntermediateRepresentation;
  messages?: ChatMessage[];
  deepDiveSummary?: string;
  overviewTexts?: string[];
  checklistTexts?: string[];
}

/** チェックリスト再生成リクエスト */
export interface ChecklistRequest {
  mode: 'checklist';
  userIntent: string;
  intermediate: IntermediateRepresentation;
}

/** 深掘りレスポンス */
export interface DeepDiveResponse {
  status: 'success' | 'error';
  answer?: string;
  summary?: string;
  error?: string;
}

/** 意図回答レスポンス */
export interface IntentAnswerResponse {
  status: 'success' | 'error';
  intentAnswer?: string;
  checklist?: ChecklistItem[];
  checklistState?: Exclude<ChecklistGenerationState, 'not_requested'>;
  checklistError?: string;
  error?: string;
}

/** チェックリスト再生成レスポンス */
export interface ChecklistResponse {
  status: 'success' | 'error';
  checklist?: ChecklistItem[];
  checklistState?: Exclude<ChecklistGenerationState, 'not_requested'>;
  checklistError?: string;
  error?: string;
}

/** 解析リクエスト */
export type AnalyzeRequest =
  | {
      url: string;
      userIntent?: string;
      personalization?: PersonalizationAnswer[];
      mode?: 'default';
    }
  | DeepDiveRequest
  | IntentAnswerRequest
  | ChecklistRequest;

/** 解析ステータス */
export type AnalyzeStatus = 'idle' | 'loading' | 'success' | 'error';

// ============================================
// Phase 2: 漫画・履歴・フィードバック
// ============================================

/** 漫画ジョブステータス */
export type MangaJobStatus = 'queued' | 'processing' | 'done' | 'error';

/** 漫画パネル */
export interface MangaPanel {
  id: string;
  text: string;
}

/** 漫画生成結果 */
export interface MangaResult {
  title: string;
  panels: MangaPanel[];
  imageUrls?: string[];
  storageUrl?: string;
  meta?: {
    panelCount: number;
    generatedAt: string;
    sourceUrl?: string;
    format?: 'png';
    maxEdge?: number;
    title?: string;
  };
}

/** 漫画生成リクエスト */
export interface MangaRequest {
  url: string;
  title: string;
  summary: string;
  keyPoints?: string[];

  // 新規追加（すべてオプショナル）
  documentType?: DocumentType;
  target?: {
    conditions: string[];
    eligibility_summary?: string;
  };
  procedure?: {
    steps: Array<{ order: number; action: string }>;
    required_documents?: string[];
    deadline?: string;
    fee?: string;
  };
  benefits?: {
    description: string;
    amount?: string;
    frequency?: string;
  };
  contact?: {
    department?: string;
    phone?: string;
    hours?: string;
  };
  warnings?: string[];
  tips?: string[];

  // パーソナライズ（オプショナル）
  userIntent?: string;
  userProfile?: NormalizedUserProfile;

  // 会話履歴との紐づけ
  resultId: string; // 解析結果のID（必須）
  historyId: string; // 会話履歴のID（必須）
}

/** 漫画ジョブレスポンス */
export interface MangaJobResponse {
  jobId: string;
}

/** 漫画ジョブステータスレスポンス */
export interface MangaJobStatusResponse {
  status: MangaJobStatus;
  progress?: number;
  result?: MangaResult;
  error?: string;
  errorCode?:
    | 'timeout'
    | 'api_error'
    | 'validation_error'
    | 'unknown'
    | 'rate_limited'
    | 'cooldown'
    | 'concurrent';
}

/** 履歴アイテム */
export interface HistoryItem {
  id: string;
  url: string;
  title: string;
  createdAt: string | null;
  resultId: string;
}

/** 会話履歴に紐づく漫画ドキュメント */
export interface ConversationMangaDocument {
  id: string; // ドキュメントID = resultId
  resultId: string; // 解析結果のID
  historyId: string; // 会話履歴のID
  userId: string; // 所有ユーザーID
  status: MangaJobStatus;
  progress: number;
  request: MangaRequest;
  result?: MangaResult;
  error?: string;
  errorCode?: MangaJobStatusResponse['errorCode'];
  storageUrl?: string;
  createdAt: import('firebase-admin/firestore').Timestamp;
  updatedAt: import('firebase-admin/firestore').Timestamp;
}
