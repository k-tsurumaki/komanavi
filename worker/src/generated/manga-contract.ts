/**
 * AUTO-GENERATED FILE.
 * Source: shared/manga-contract.ts
 * Do not edit manually.
 */

/**
 * Manga request/response contract shared by app and worker.
 * This file is the single source of truth for manga-related payload shapes.
 */

export type MangaDocumentType =
  | 'benefit'
  | 'procedure'
  | 'information'
  | 'faq'
  | 'guide'
  | 'other';

export interface MangaTarget {
  conditions: string[];
  eligibility_summary?: string;
}

export interface MangaProcedure {
  steps: Array<{ order: number; action: string }>;
  required_documents?: string[];
  deadline?: string;
  fee?: string;
}

export interface MangaBenefits {
  description: string;
  amount?: string;
  frequency?: string;
}

export interface MangaContact {
  department?: string;
  phone?: string;
  hours?: string;
}

export interface MangaGroundingMetadata {
  webSearchQueries?: string[];
  groundingChunks?: Array<{
    web?: {
      uri: string;
      title: string;
    };
  }>;
}

export interface MangaPersonalizationProfile {
  age?: number;
  gender?: string;
  occupation?: string;
  isJapaneseNational?: boolean;
  location?: string;
  displayName?: string;
  visualTraits?: string;
  personality?: string;
}

export type MangaJobStatus = 'queued' | 'processing' | 'done' | 'error';

export interface MangaPanel {
  id: string;
  text: string;
}

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

export interface MangaRequest {
  url: string;
  title: string;
  summary: string;
  keyPoints?: string[];
  documentType?: MangaDocumentType;
  target?: MangaTarget;
  procedure?: MangaProcedure;
  benefits?: MangaBenefits;
  contact?: MangaContact;
  warnings?: string[];
  tips?: string[];
  userIntent?: string;
  userProfile?: MangaPersonalizationProfile;
  intentSearchMetadata?: MangaGroundingMetadata;
  resultId: string;
  historyId: string;
}
