'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { deleteAllHistory, fetchHistoryList } from '@/lib/history-api';
import type { HistoryItem } from '@/lib/types/intermediate';

const PAGE_SIZE = 12;

interface HistoryState {
  items: HistoryItem[];
  nextCursor: string | null;
}

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        </div>
      }
    >
      <HistoryPageContent />
    </Suspense>
  );
}

function HistoryPageContent() {
  const [state, setState] = useState<HistoryState>({
    items: [],
    nextCursor: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursorStackRef = useRef<(string | null)[]>([]);
  const currentCursorRef = useRef<string | null>(null);

  const loadPage = async (cursor: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchHistoryList({ limit: PAGE_SIZE, cursor });
      currentCursorRef.current = cursor;
      setState({
        items: response.items.map((item) => ({
          id: item.id,
          url: item.url,
          title: item.title,
          createdAt: item.createdAt ?? '',
          resultId: item.resultId,
        })),
        nextCursor: response.nextCursor,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '履歴の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPage(null);
  }, []);

  const handleClear = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await deleteAllHistory();
      cursorStackRef.current = [];
      currentCursorRef.current = null;
      await loadPage(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('history:updated'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '履歴の削除に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const goToNext = async () => {
    if (!state.nextCursor || isLoading) return;
    cursorStackRef.current.push(currentCursorRef.current);
    await loadPage(state.nextCursor);
  };

  const goToPrev = async () => {
    if (cursorStackRef.current.length === 0 || isLoading) return;
    const prevCursor = cursorStackRef.current.pop() ?? null;
    await loadPage(prevCursor ?? null);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold">解析履歴</h2>
          <p className="text-sm text-gray-600">履歴はサーバに保存されます。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/analyze"
            className="px-4 py-2 bg-white text-blue-700 rounded-lg border border-blue-200 shadow-sm hover:bg-blue-50"
          >
            新規解析
          </Link>
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={isLoading || state.items.length === 0}
          >
            履歴を削除
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading && state.items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">読み込み中...</p>
        </div>
      ) : state.items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">まだ履歴がありません。</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {state.items.map((item) => (
              <Link
                key={item.id}
                href={`/result?historyId=${item.id}&url=${encodeURIComponent(item.url)}`}
                className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400"
              >
                <p className="font-semibold text-gray-900 line-clamp-2">{item.title}</p>
                <p className="text-sm text-gray-600 mt-2 break-all">{item.url}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {item.createdAt ? new Date(item.createdAt).toLocaleString('ja-JP') : '-'}
                </p>
              </Link>
            ))}
          </div>

          {(cursorStackRef.current.length > 0 || state.nextCursor) && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                type="button"
                onClick={goToPrev}
                disabled={isLoading || cursorStackRef.current.length === 0}
                className="px-3 py-2 rounded-lg border border-gray-300 disabled:text-gray-400"
              >
                前へ
              </button>
              <button
                type="button"
                onClick={goToNext}
                disabled={isLoading || !state.nextCursor}
                className="px-3 py-2 rounded-lg border border-gray-300 disabled:text-gray-400"
              >
                次へ
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
