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

const globalState = globalThis as typeof globalThis & {
  __mangaJobs?: Map<string, MangaJob>;
  __mangaUsageByClient?: Map<string, MangaUsageState>;
};

export const jobs = globalState.__mangaJobs ?? new Map<string, MangaJob>();
export const usageByClient = globalState.__mangaUsageByClient ?? new Map<string, MangaUsageState>();

globalState.__mangaJobs = jobs;
globalState.__mangaUsageByClient = usageByClient;
