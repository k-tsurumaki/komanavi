import type { AnalyzeResult, ChecklistItem, IntermediateRepresentation } from '@/lib/types/intermediate';

type HistoryListItem = {
  id: string;
  url: string;
  title: string;
  createdAt: string | null;
  resultId: string;
};

type HistoryListResponse = {
  items: HistoryListItem[];
  nextCursor: string | null;
  limit: number;
};

type HistoryDetailResponse = {
  history: HistoryListItem | null;
  result: {
    id: string;
    createdAt: string | null;
    checklist?: ChecklistItem[];
    generatedSummary?: string;
    schemaVersion?: number;
  } | null;
  intermediate: {
    id: string;
    createdAt: string | null;
    intermediate: IntermediateRepresentation;
  } | null;
};


export async function fetchHistoryList(params: {
  limit: number;
  cursor?: string | null;
}): Promise<HistoryListResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('limit', String(params.limit));
  if (params.cursor) {
    searchParams.set('cursor', params.cursor);
  }
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
      return { history: null, result: null, intermediate: null };
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
    intermediate: result.intermediate,
    schemaVersion: 1,
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
