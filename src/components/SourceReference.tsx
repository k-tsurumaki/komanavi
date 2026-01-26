'use client';

import { useState } from 'react';
import type { Source, GroundingMetadata } from '@/lib/types/intermediate';

interface SourceReferenceProps {
  sources: Source[];
  groundingMetadata?: GroundingMetadata;
}

export function SourceReference({ sources, groundingMetadata }: SourceReferenceProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const groundingChunks = groundingMetadata?.groundingChunks?.filter((chunk) => chunk.web) || [];
  const hasGroundingUrls = groundingChunks.length > 0;
  const hasSources = sources.length > 0;

  if (!hasSources && !hasGroundingUrls) {
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

      {/* 参照元URL（Google Search グラウンディング） */}
      {hasGroundingUrls && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">参照元URL</h4>
          <ul className="space-y-2">
            {groundingChunks.map((chunk, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5" aria-hidden="true">🔗</span>
                <a
                  href={chunk.web!.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline text-sm break-all"
                >
                  {chunk.web!.title || chunk.web!.uri}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 原文の引用 */}
      {hasSources && (
        <>
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
        </>
      )}
    </div>
  );
}
