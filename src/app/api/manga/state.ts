import type { MangaResult, MangaJobStatusResponse } from '@/lib/types/intermediate';

export interface MangaJob {
  id: string;
  status: MangaJobStatusResponse['status'];
  progress: number;
  result?: MangaResult;
  error?: string;
  errorCode?: MangaJobStatusResponse['errorCode'];
  createdAt: number;
  clientId?: string;
}

export interface MangaUsageState {
  date: string;
  count: number;
  urlCooldowns: Record<string, number>;
  activeJob?: {
    jobId: string;
    startedAt: number;
    url: string;
  };
}

export const jobs = new Map<string, MangaJob>();
export const usageByClient = new Map<string, MangaUsageState>();
