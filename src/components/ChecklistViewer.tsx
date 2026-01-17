'use client';

import { useState } from 'react';
import type { ChecklistItem } from '@/lib/types/intermediate';

interface ChecklistViewerProps {
  items: ChecklistItem[];
  onToggle?: (id: string, completed: boolean) => void;
}

export function ChecklistViewer({ items, onToggle }: ChecklistViewerProps) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(
    items.reduce(
      (acc, item) => {
        acc[item.id] = item.completed;
        return acc;
      },
      {} as Record<string, boolean>
    )
  );

  const handleToggle = (id: string) => {
    const newValue = !checkedItems[id];
    setCheckedItems((prev) => ({ ...prev, [id]: newValue }));
    onToggle?.(id, newValue);
  };

  const completedCount = Object.values(checkedItems).filter(Boolean).length;
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
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <span aria-hidden="true">✅</span>
          やることチェックリスト
        </h3>
        <span className="text-sm text-gray-600">
          {completedCount} / {totalCount} 完了
        </span>
      </div>

      {/* プログレスバー */}
      <div className="w-full h-2 bg-gray-200 rounded-full mb-6">
        <div
          className="h-2 bg-green-500 rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={totalCount}
        />
      </div>

      {/* チェックリスト */}
      <div className="space-y-6">
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <div key={category}>
            {Object.keys(groupedItems).length > 1 && (
              <h4 className="text-sm font-medium text-gray-500 mb-2">{category}</h4>
            )}
            <ul className="space-y-3">
              {categoryItems.map((item) => (
                <li key={item.id}>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={checkedItems[item.id] || false}
                      onChange={() => handleToggle(item.id)}
                      className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <span
                        className={`text-gray-800 ${
                          checkedItems[item.id] ? 'line-through text-gray-400' : ''
                        }`}
                      >
                        {item.text}
                      </span>
                      {item.deadline && (
                        <p className="text-sm text-red-600 mt-1">
                          📅 {item.deadline}
                        </p>
                      )}
                      {item.priority === 'high' && !checkedItems[item.id] && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
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

      {/* 完了メッセージ */}
      {completedCount === totalCount && totalCount > 0 && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
          <p className="text-green-700 font-medium">
            🎉 すべてのタスクが完了しました！
          </p>
        </div>
      )}
    </div>
  );
}
