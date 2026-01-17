'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { clearHistory, loadHistoryPage } from '@/lib/storage';
import type { HistoryItem } from '@/lib/types/intermediate';

const PAGE_SIZE = 12;

interface HistoryState {
  items: HistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function HistoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageParam = searchParams.get('page');
  const pageNumber = useMemo(() => {
    const value = Number(pageParam || '1');
    return Number.isNaN(value) || value < 1 ? 1 : value;
  }, [pageParam]);

  const [state, setState] = useState<HistoryState>(() => loadHistoryPage(1, PAGE_SIZE));

  useEffect(() => {
    const next = loadHistoryPage(pageNumber, PAGE_SIZE);
    setState(next);
    if (next.page !== pageNumber) {
      router.replace(`/history?page=${next.page}`);
    }
  }, [pageNumber]);

  const handleClear = () => {
    clearHistory();
    const next = loadHistoryPage(1, PAGE_SIZE);
    setState(next);
    router.replace('/history?page=1');
  };

  const goToPage = (nextPage: number) => {
    router.push(`/history?page=${nextPage}`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold">解析履歴</h2>
          <p className="text-sm text-gray-600">直近90日分を保存しています。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="px-4 py-2 bg-white text-blue-700 rounded-lg border border-blue-200 shadow-sm hover:bg-blue-50"
          >
            新規解析
          </Link>
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={state.total === 0}
          >
            履歴を削除
          </button>
        </div>
      </div>

      {state.total === 0 ? (
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
                  {new Date(item.createdAt).toLocaleString('ja-JP')}
                </p>
              </Link>
            ))}
          </div>

          {state.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                type="button"
                onClick={() => goToPage(state.page - 1)}
                disabled={state.page <= 1}
                className="px-3 py-2 rounded-lg border border-gray-300 disabled:text-gray-400"
              >
                前へ
              </button>
              <span className="text-sm text-gray-600">
                {state.page} / {state.totalPages}
              </span>
              <button
                type="button"
                onClick={() => goToPage(state.page + 1)}
                disabled={state.page >= state.totalPages}
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
