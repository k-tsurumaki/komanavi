/**
 * Worker 用の型定義
 * メインアプリの intermediate.ts から必要な型のみ抽出
 */

/** 漫画ジョブステータス */
export type MangaJobStatus = "queued" | "processing" | "done" | "error";

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
    format?: "png";
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
}
