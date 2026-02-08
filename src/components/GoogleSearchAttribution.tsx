'use client';

import type { GroundingMetadata } from '@/lib/types/intermediate';

interface GoogleSearchAttributionProps {
  groundingMetadata?: GroundingMetadata;
}

export function GoogleSearchAttribution({ groundingMetadata }: GoogleSearchAttributionProps) {
  if (!groundingMetadata) {
    return null;
  }

  const { webSearchQueries, groundingChunks, searchEntryPoint } = groundingMetadata;

  const hasContent =
    (webSearchQueries && webSearchQueries.length > 0) ||
    (groundingChunks && groundingChunks.length > 0);

  if (!hasContent) {
    return null;
  }

  return (
    <section className="mb-6 rounded-2xl border border-stone-300 bg-stone-100 p-5">
      <h3 className="mb-3 text-lg font-semibold text-stone-900">Google検索による情報取得</h3>

      {webSearchQueries && webSearchQueries.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-2 text-sm font-medium text-stone-700">使用した検索クエリ</h4>
          <div className="flex flex-wrap gap-2">
            {webSearchQueries.map((query, index) => (
              <span
                key={index}
                className="inline-flex rounded-full border border-stone-400 bg-white px-3 py-1 text-sm text-stone-700"
              >
                {query}
              </span>
            ))}
          </div>
        </div>
      )}

      {groundingChunks && groundingChunks.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-2 text-sm font-medium text-stone-700">参照した情報源</h4>
          <ul className="space-y-2">
            {groundingChunks
              .filter((chunk) => chunk.web)
              .map((chunk, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-1 text-stone-700">&#8226;</span>
                  <a
                    href={chunk.web!.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-sm text-stone-700 underline underline-offset-2 hover:text-stone-900"
                  >
                    {chunk.web!.title || chunk.web!.uri}
                  </a>
                </li>
              ))}
          </ul>
        </div>
      )}

      {searchEntryPoint?.renderedContent && (
        <div
          className="google-search-suggestions"
          dangerouslySetInnerHTML={{ __html: searchEntryPoint.renderedContent }}
        />
      )}

      <p className="mt-3 text-xs text-stone-700">この情報はGoogle検索を使用して取得されました。</p>
    </section>
  );
}
