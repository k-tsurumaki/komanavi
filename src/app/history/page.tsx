'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { clearHistory, loadHistoryPage } from '@/lib/storage';
import type { HistoryItem } from '@/lib/types/intermediate';

const PAGE_SIZE = 8;

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const { items: loaded, totalPages: pages, total: count, page: safePage } =
      loadHistoryPage(page, PAGE_SIZE);
    setItems(loaded);
    setTotalPages(pages);
    setTotal(count);
    setPage(safePage);
  }, [page]);

  const handleClear = () => {
    clearHistory();
    setItems([]);
    setTotalPages(0);
    setTotal(0);
    setPage(1);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">解析履歴</h2>
        <Link href="/" className="text-blue-600 hover:text-blue-800">
          トップへ戻る
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-600">
          履歴はまだありません。
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-gray-500">
              全{total}件 / {page}ページ目
            </p>
            <button
              type="button"
              className="text-sm text-gray-600 hover:text-gray-800"
              onClick={handleClear}
            >
              履歴をすべて削除
            </button>
          </div>
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-800">{item.title}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(item.createdAt).toLocaleString('ja-JP')}
                    </p>
                  </div>
                  <Link
                    href={`/result?historyId=${item.id}&url=${encodeURIComponent(item.url)}`}
                    className="inline-flex items-center text-blue-600 hover:text-blue-800"
                  >
                    結果を見る →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                type="button"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:text-gray-400 disabled:border-gray-200"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
              >
                前へ
              </button>
              <span className="text-sm text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:text-gray-400 disabled:border-gray-200"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
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
