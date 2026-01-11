'use client';

import { useState } from 'react';
import type { Source } from '@/lib/types/intermediate';

interface SourceReferenceProps {
  sources: Source[];
}

export function SourceReference({ sources }: SourceReferenceProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (sources.length === 0) {
    return null;
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span aria-hidden="true">📄</span>
        根拠となる原文
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        この要約は以下の原文を基に作成されています。クリックすると原文を確認できます。
      </p>
      <ul className="space-y-3">
        {sources.map((source) => (
          <li key={source.source_id} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleExpand(source.source_id)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              aria-expanded={expandedId === source.source_id}
            >
              <span className="font-medium text-gray-800">
                <span className="text-blue-600 mr-2">[{source.source_id}]</span>
                {source.section}
              </span>
              <span
                className={`transform transition-transform ${
                  expandedId === source.source_id ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              >
                ▼
              </span>
            </button>
            {expandedId === source.source_id && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                <blockquote className="text-gray-700 italic border-l-4 border-blue-400 pl-4">
                  {source.original_text}
                </blockquote>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
