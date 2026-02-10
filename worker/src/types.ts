/**
 * Worker 用の型定義
 * メインアプリの intermediate.ts から必要な型のみ抽出
 */

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

/** ドキュメントタイプ */
export type DocumentType = 'benefit' | 'procedure' | 'information' | 'faq' | 'guide' | 'other';

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
  userIntent?: string;
  userProfile?: {
    age?: number;
    gender?: string;
    occupation?: string;
    isJapaneseNational?: boolean;
    location?: string;
  };
}
