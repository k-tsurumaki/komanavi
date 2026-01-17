import type { MangaResult, MangaJobStatusResponse } from '@/lib/types/intermediate';

export interface MangaJob {
  id: string;
  status: MangaJobStatusResponse['status'];
  progress: number;
  result?: MangaResult;
  error?: string;
  createdAt: number;
}

export const jobs = new Map<string, MangaJob>();
