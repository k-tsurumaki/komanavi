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
    <div className="ui-card rounded-2xl p-5 sm:p-6">
      <h3 className="ui-heading mb-4 flex items-center gap-2 text-lg">
        <span className="ui-badge" aria-hidden="true">
          SOURCE
        </span>
        根拠となる原文
      </h3>

      {hasGroundingUrls && (
        <div className="mb-6">
          <h4 className="mb-3 text-sm font-semibold text-slate-700">参照元URL</h4>
          <ul className="space-y-2">
            {groundingChunks.map((chunk, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="mt-0.5 text-slate-400" aria-hidden="true">
                  •
                </span>
                <a
                  href={chunk.web!.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900"
                >
                  {chunk.web!.title || chunk.web!.uri}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasSources && (
        <>
          <p className="mb-4 text-sm text-slate-600">
            この要約は以下の原文を基に作成されています。クリックすると原文を確認できます。
          </p>
          <ul className="space-y-3">
            {sources.map((source) => (
              <li
                key={source.source_id}
                className="overflow-hidden rounded-xl border border-slate-200/80"
              >
                <button
                  onClick={() => toggleExpand(source.source_id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-50"
                  aria-expanded={expandedId === source.source_id}
                >
                  <span className="font-medium text-slate-800">
                    <span className="mr-2 text-stone-700">[{source.source_id}]</span>
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
                  <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                    <blockquote className="border-l-2 border-slate-300 pl-4 text-sm italic text-slate-700">
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
