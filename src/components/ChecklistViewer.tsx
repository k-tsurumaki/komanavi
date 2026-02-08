'use client';

import type { ChecklistItem } from '@/lib/types/intermediate';

interface ChecklistViewerProps {
  items: ChecklistItem[];
  onToggle?: (id: string, completed: boolean) => void;
}

export function ChecklistViewer({ items, onToggle }: ChecklistViewerProps) {
  const handleToggle = (id: string) => {
    const item = items.find((current) => current.id === id);
    if (!item) return;
    const newValue = !item.completed;
    onToggle?.(id, newValue);
  };

  const completedCount = items.filter((item) => item.completed).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // カテゴリでグループ化
  const groupedItems = items.reduce(
    (acc, item) => {
      const category = item.category || 'その他';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    },
    {} as Record<string, ChecklistItem[]>
  );

  return (
    <div className="ui-card rounded-2xl p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="ui-heading flex items-center gap-2 text-lg">
          <span className="ui-badge" aria-hidden="true">
            TODO
          </span>
          やることチェックリスト
        </h3>
        <span className="text-sm text-slate-600">
          {completedCount} / {totalCount} 完了
        </span>
      </div>

      <div className="mb-6 h-2 w-full rounded-full bg-slate-200">
        <div
          className="h-2 rounded-full bg-stone-1000 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={totalCount}
        />
      </div>

      <div className="space-y-6">
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <div key={category}>
            {Object.keys(groupedItems).length > 1 && (
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                {category}
              </h4>
            )}
            <ul className="space-y-3">
              {categoryItems.map((item) => (
                <li key={item.id}>
                  <label className="group flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 px-3 py-3 transition hover:border-slate-300 hover:bg-white">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => handleToggle(item.id)}
                      className="mt-0.5 h-5 w-5 rounded border-slate-300 text-stone-700 focus:ring-stone-1000"
                    />
                    <div className="flex-1">
                      <span
                        className={`text-sm text-slate-800 ${
                          item.completed ? 'text-slate-400 line-through' : ''
                        }`}
                      >
                        {item.text}
                      </span>
                      {item.deadline && (
                        <p className="mt-1 text-xs text-stone-700">
                          期限: {item.deadline}
                        </p>
                      )}
                      {item.priority === 'high' && !item.completed && (
                        <span className="mt-1 inline-block rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold text-stone-700">
                          重要
                        </span>
                      )}
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {completedCount === totalCount && totalCount > 0 && (
        <div className="mt-6 rounded-xl border border-stone-300 bg-stone-100 p-4 text-center">
          <p className="text-sm font-semibold text-stone-700">すべてのタスクが完了しました。</p>
        </div>
      )}
    </div>
  );
}
