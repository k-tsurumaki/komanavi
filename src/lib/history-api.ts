import type {
  AnalyzeResult,
  ChecklistGenerationState,
  ChecklistItem,
  HistoryItem,
  IntermediateRepresentation,
  Overview,
  MangaJobStatus,
  MangaResult,
  MangaJobStatusResponse,
} from '@/lib/types/intermediate';

type HistoryListItem = HistoryItem;

type HistoryListResponse = {
  items: HistoryListItem[];
  limit: number;
};

type HistoryDetailResponse = {
  history: HistoryListItem | null;
  result: {
    id: string;
    createdAt: string | null;
    updatedAt?: string | null;
    checklist?: ChecklistItem[];
    generatedSummary?: string;
    userIntent?: string;
    intentAnswer?: string;
    guidanceUnlocked?: boolean;
    checklistState?: ChecklistGenerationState;
    checklistError?: string;
    overview?: Overview;
    schemaVersion?: number;
  } | null;
  intermediate: {
    id: string;
    createdAt: string | null;
    intermediate: IntermediateRepresentation;
  } | null;
  manga: {
    id: string;
    resultId: string;
    historyId: string;
    userId: string;
    status: MangaJobStatus;
    progress: number;
    result?: MangaResult;
    error?: string;
    errorCode?: MangaJobStatusResponse['errorCode'];
    storageUrl?: string;
    createdAt: string | null;
    updatedAt: string | null;
  } | null;
};

export async function fetchHistoryList(params: { limit: number }): Promise<HistoryListResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('limit', String(params.limit));
  const response = await fetch(`/api/history?${searchParams.toString()}`, {
    method: 'GET',
  });
  if (!response.ok) {
    throw new Error('履歴一覧の取得に失敗しました');
  }
  return (await response.json()) as HistoryListResponse;
}

export async function fetchHistoryDetail(historyId: string): Promise<HistoryDetailResponse> {
  const response = await fetch(`/api/history/${historyId}`, {
    method: 'GET',
  });
  if (!response.ok) {
    if (response.status === 404) {
      return { history: null, result: null, intermediate: null, manga: null };
    }
    throw new Error('履歴詳細の取得に失敗しました');
  }
  return (await response.json()) as HistoryDetailResponse;
}

export async function deleteHistory(historyId: string): Promise<void> {
  const response = await fetch(`/api/history/${historyId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('履歴の削除に失敗しました');
  }
}

export async function saveHistoryFromResult(params: {
  url: string;
  title: string;
  result: AnalyzeResult;
}): Promise<{ historyId: string; resultId: string }> {
  const { url, title, result } = params;
  const payload = {
    resultId: result.id,
    url,
    title,
    checklist: result.checklist,
    generatedSummary: result.generatedSummary,
    userIntent: result.userIntent,
    intentAnswer: result.intentAnswer,
    guidanceUnlocked: result.guidanceUnlocked ?? false,
    checklistState: result.checklistState,
    checklistError: result.checklistError,
    overview: result.overview,
    intermediate: result.intermediate,
  };

  const response = await fetch('/api/history', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('履歴の保存に失敗しました');
  }

  return (await response.json()) as { historyId: string; resultId: string };
}

export async function patchHistoryResult(
  historyId: string,
  payload: {
    checklist?: ChecklistItem[];
    userIntent?: string;
    intentAnswer?: string;
    guidanceUnlocked?: boolean;
    checklistState?: ChecklistGenerationState;
    checklistError?: string;
    intermediate?: IntermediateRepresentation;
  },
  options?: {
    keepalive?: boolean;
  }
): Promise<void> {
  const response = await fetch(`/api/history/${historyId}`, {
    method: 'PATCH',
    keepalive: options?.keepalive,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('履歴の更新に失敗しました');
  }
}
