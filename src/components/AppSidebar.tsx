'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loadHistoryPage } from '@/lib/storage';
import type { HistoryItem } from '@/lib/types/intermediate';
import { useAnalyzeStore } from '@/stores/analyzeStore';

const SIDEBAR_PAGE_SIZE = 10;

type AppSidebarProps = {
  className?: string;
  showCloseButton?: boolean;
  onClose?: () => void;
};

export function AppSidebar({ className, showCloseButton = false, onClose }: AppSidebarProps) {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const router = useRouter();
  const reset = useAnalyzeStore((state) => state.reset);

  useEffect(() => {
    const { items } = loadHistoryPage(1, SIDEBAR_PAGE_SIZE);
    setHistoryItems(items);
  }, []);

  return (
    <aside
      className={`flex flex-col w-72 lg:w-80 bg-white text-gray-900 border-r border-gray-200 min-h-screen ${
        className || ''
      }`}
    >
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link href="/analyze" className="text-lg font-semibold text-gray-900">
              KOMANAVI
            </Link>
            <p className="text-xs text-gray-500 mt-1">行政情報をわかりやすく</p>
          </div>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-600"
              aria-label="メニューを閉じる"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-4 w-4 text-gray-600"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 6l12 12" />
                <path d="M18 6l-12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="px-5 py-4 space-y-3">
        <button
          type="button"
          onClick={() => {
            reset();
            router.push('/analyze');
          }}
          className="inline-flex w-full items-center justify-center rounded-lg bg-white px-3 py-2 text-sm font-semibold text-blue-700 border border-blue-200 shadow-sm hover:bg-blue-50"
        >
          新規解析
        </button>
      </div>
      <div className="px-5 pb-2 text-xs font-semibold text-gray-500">解析履歴</div>
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {historyItems.length === 0 ? (
          <p className="text-sm text-gray-500">履歴はまだありません。</p>
        ) : (
          <ul className="space-y-2">
            {historyItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/result?historyId=${item.id}&url=${encodeURIComponent(item.url)}`}
                  className="block rounded-lg border border-transparent px-3 py-2 text-sm text-gray-800 hover:border-blue-200 hover:bg-blue-50"
                >
                  <p className="line-clamp-2 font-medium">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(item.createdAt).toLocaleDateString('ja-JP')}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
