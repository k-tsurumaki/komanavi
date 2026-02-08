'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteHistory, fetchHistoryList } from '@/lib/history-api';
import type { HistoryItem } from '@/lib/types/intermediate';
import { useAnalyzeStore } from '@/stores/analyzeStore';
import { HistoryItemMenu } from '@/components/HistoryItemMenu';

const SIDEBAR_PAGE_SIZE = 10;

type AppSidebarProps = {
  className?: string;
  showCloseButton?: boolean;
  onClose?: () => void;
  closeOnNavigate?: boolean;
};

export function AppSidebar({
  className,
  showCloseButton = false,
  onClose,
  closeOnNavigate = false,
}: AppSidebarProps) {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const router = useRouter();
  const reset = useAnalyzeStore((state) => state.reset);
  const handleNavigate = () => {
    if (closeOnNavigate) {
      onClose?.();
    }
  };

  const handleDelete = async (historyId: string) => {
    const confirmed = typeof window === 'undefined'
      ? false
      : window.confirm('この履歴を削除しますか？');
    if (!confirmed) return;

    try {
      await deleteHistory(historyId);
      setHistoryItems((prev) => prev.filter((item) => item.id !== historyId));
    } catch {
      if (typeof window !== 'undefined') {
        window.alert('履歴の削除に失敗しました');
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const response = await fetchHistoryList({ limit: SIDEBAR_PAGE_SIZE });
        if (isMounted) {
          setHistoryItems(response.items);
        }
      } catch {
        if (isMounted) {
          setHistoryItems([]);
        }
      }
    };

    load();
    const handleUpdate = () => {
      load();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('history:updated', handleUpdate);
    }

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('history:updated', handleUpdate);
      }
    };
  }, []);

  return (
    <aside
      className={`flex min-h-screen w-72 flex-col border-r border-slate-200/80 bg-[#f7f9fc]/95 text-slate-900 backdrop-blur ${
        className || ''
      }`}
    >
      <div className="border-b border-slate-200/80 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link
              href="/analyze"
              className="text-[0.95rem] font-semibold tracking-[0.12em] text-slate-800"
            >
              KOMANAVI
            </Link>
            <p className="mt-1 text-xs text-slate-500">行政情報をわかりやすく</p>
          </div>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="ui-btn ui-btn-secondary h-12 w-12 p-0"
              aria-label="サイドバーを閉じる"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-9 w-9 text-slate-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6.5 6.5l11 11" />
                <path d="M17.5 6.5 6.5 17.5" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="space-y-3 px-5 py-4">
        <button
          type="button"
          onClick={() => {
            reset();
            router.push('/analyze');
            handleNavigate();
          }}
          className="ui-btn ui-btn-primary w-full justify-center py-2.5 text-sm"
        >
          新しい解析を開始
        </button>
      </div>
      <div className="px-5 pb-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
        履歴
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-5">
        {historyItems.length === 0 ? (
          <div className="ui-card-soft rounded-2xl px-4 py-5 text-sm text-slate-500">
            履歴はまだありません。
          </div>
        ) : (
          <ul className="space-y-1.5">
            {historyItems.map((item) => (
              <li key={item.id}>
                <div className="group relative">
                  <Link
                    href={`/result?historyId=${item.id}`}
                    onClick={handleNavigate}
                    className="block rounded-xl border border-transparent px-3.5 py-3 pr-10 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  >
                    <p className="line-clamp-2 text-[0.83rem] font-medium leading-5 text-slate-800">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[0.7rem] text-slate-500">
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleDateString('ja-JP')
                        : '-'}
                    </p>
                  </Link>
                  <HistoryItemMenu
                    className="absolute right-2 top-2 z-10"
                    buttonClassName="opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
                    onDelete={() => handleDelete(item.id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
