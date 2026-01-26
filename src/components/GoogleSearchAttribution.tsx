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
    <section className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <h3 className="text-lg font-semibold text-blue-800 mb-3">
        Google検索による情報取得
      </h3>

      {/* 検索クエリ */}
      {webSearchQueries && webSearchQueries.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-blue-700 mb-2">使用した検索クエリ</h4>
          <div className="flex flex-wrap gap-2">
            {webSearchQueries.map((query, index) => (
              <span
                key={index}
                className="inline-block px-3 py-1 bg-white text-blue-700 text-sm rounded-full border border-blue-300"
              >
                {query}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 参照元 */}
      {groundingChunks && groundingChunks.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-blue-700 mb-2">参照した情報源</h4>
          <ul className="space-y-2">
            {groundingChunks
              .filter((chunk) => chunk.web)
              .map((chunk, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">&#8226;</span>
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

      {/* Google検索サジェスション（renderedContent） */}
      {searchEntryPoint?.renderedContent && (
        <div
          className="google-search-suggestions"
          dangerouslySetInnerHTML={{ __html: searchEntryPoint.renderedContent }}
        />
      )}

      <p className="text-xs text-blue-600 mt-3">
        この情報はGoogle検索を使用して取得されました。
      </p>
    </section>
  );
}
