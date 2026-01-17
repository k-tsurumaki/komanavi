'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { clearHistory, loadHistory } from '@/lib/storage';
import type { HistoryItem } from '@/lib/types/intermediate';

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setItems(loadHistory());
  }, []);

  const handleClear = () => {
    clearHistory();
    setItems([]);
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
          <div className="flex justify-end">
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
                    href={`/result?url=${encodeURIComponent(item.url)}`}
                    className="inline-flex items-center text-blue-600 hover:text-blue-800"
                  >
                    結果を見る →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
