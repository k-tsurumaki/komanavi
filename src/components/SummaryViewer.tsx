
'use client';

import type { IntermediateRepresentation, Overview } from '@/lib/types/intermediate';

interface SummaryViewerProps {
  data: IntermediateRepresentation;
  overview?: Overview;
  showTitle?: boolean;
  hideDetails?: boolean;
}

export function SummaryViewer({
  data,
  overview,
  showTitle = true,
  hideDetails = false,
}: SummaryViewerProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      {/* タイトル */}
      {showTitle && <h2 className="text-2xl font-bold mb-4">{data.title}</h2>}

      {/* ページ概要 */}
      {overview ? (
        <div className="mb-6 grid gap-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <h3 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-2">
              <span aria-hidden="true">👥</span>
              対象者
            </h3>
            <p className="text-gray-800 leading-relaxed">{overview.targetAudience}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
              <span aria-hidden="true">🎯</span>
              目的
            </h3>
            <div className="space-y-2 text-gray-800">
              <p className="leading-relaxed">{overview.purpose}</p>
              <p className="leading-relaxed text-gray-700">{overview.conclusion}</p>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
              <span aria-hidden="true">✅</span>
              ポイント
            </h3>
            {overview.topics.length > 0 ? (
              <div className="grid gap-2">
                {overview.topics.map((topic, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-800"
                  >
                    {topic}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-700">特になし</p>
            )}
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
            <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
              <span aria-hidden="true">⚠️</span>
              気をつけること
            </h3>
            {overview.cautions.length > 0 ? (
              <div className="grid gap-2">
                {overview.cautions.map((caution, index) => (
                  <div key={index} className="rounded-lg bg-white/70 px-3 py-2 text-gray-800">
                    {caution}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-700">特になし</p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-lg text-gray-700 mb-6 leading-relaxed">{data.summary}</p>
      )}

      {!hideDetails && (
        <>
          {/* キーポイント */}
          {data.keyPoints && data.keyPoints.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-3">ポイント</h3>
              <ul className="space-y-4">
                {data.keyPoints.map((point) => (
                  <li key={point.id} className="flex items-start gap-4">
                    <span
                      className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white text-lg font-bold ${
                        point.importance === 'high'
                          ? 'bg-red-500'
                          : point.importance === 'medium'
                            ? 'bg-yellow-500'
                            : 'bg-gray-400'
                      }`}
                      aria-label={`重要度: ${point.importance}`}
                    >
                      !
                    </span>
                    <span className="text-gray-900 text-lg leading-relaxed">{point.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 対象者 */}
          {data.target && (
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-3">対象となる方</h3>
              {data.target.eligibility_summary && (
                <p className="text-gray-700 mb-2">{data.target.eligibility_summary}</p>
              )}
              {data.target.conditions && data.target.conditions.length > 0 && (
                <ul className="space-y-2 text-gray-700">
                  {data.target.conditions.map((condition, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="mt-1 text-gray-500" aria-hidden="true">🔹</span>
                      <span>{condition}</span>
                    </li>
                  ))}
                </ul>
              )}
              {data.target.exceptions && data.target.exceptions.length > 0 && (
                <div className="mt-3 p-3 bg-gray-50 rounded">
                  <p className="text-sm font-medium text-gray-600 mb-1">例外・注意事項</p>
                  <ul className="space-y-2 text-gray-600 text-sm">
                    {data.target.exceptions.map((exception, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="mt-1 text-gray-500" aria-hidden="true">🔹</span>
                        <span>{exception}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 給付内容 */}
          {data.benefits && (
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-3">給付・支援内容</h3>
              <p className="text-gray-700 mb-2">{data.benefits.description}</p>
              {data.benefits.amount && (
                <p className="text-xl font-bold text-blue-600">{data.benefits.amount}</p>
              )}
              {data.benefits.frequency && (
                <p className="text-gray-600 text-sm mt-1">{data.benefits.frequency}</p>
              )}
            </div>
          )}

          {/* 手続き */}
          {data.procedure && (
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-3">手続きの流れ</h3>
              {data.procedure.steps && data.procedure.steps.length > 0 && (
                <ol className="space-y-3">
                  {data.procedure.steps.map((step) => (
                    <li key={step.order} className="flex gap-3">
                      <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                        {step.order}
                      </span>
                      <div>
                        <p className="font-medium text-gray-800">{step.action}</p>
                        {step.details && (
                          <p className="text-gray-600 text-sm mt-1">{step.details}</p>
                        )}
                        {step.note && (
                          <p className="text-blue-600 text-sm mt-1">💡 {step.note}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {/* 必要書類 */}
              {data.procedure.required_documents &&
                data.procedure.required_documents.length > 0 && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-2">必要な書類</h4>
                    <ul className="space-y-2 text-gray-700">
                      {data.procedure.required_documents.map((doc, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="mt-1 text-blue-500" aria-hidden="true">📄</span>
                          <span>{doc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* 期限 */}
              {data.procedure.deadline && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                  <p className="text-red-700 font-medium">
                    📅 期限: {data.procedure.deadline}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 連絡先 */}
          {data.contact && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-lg font-bold mb-2">お問い合わせ</h3>
              {data.contact.department && (
                <p className="text-gray-700">{data.contact.department}</p>
              )}
              {data.contact.phone && (
                <p className="text-gray-700">
                  電話:{' '}
                  <a href={`tel:${data.contact.phone}`} className="text-blue-600">
                    {data.contact.phone}
                  </a>
                </p>
              )}
              {data.contact.hours && <p className="text-gray-600 text-sm">{data.contact.hours}</p>}
            </div>
          )}

          {/* 注意事項 */}
          {data.warnings && data.warnings.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h4 className="font-medium text-amber-800 mb-2">⚠️ 注意事項</h4>
              <ul className="space-y-2 text-amber-700">
                {data.warnings.map((warning, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="mt-1 text-amber-500" aria-hidden="true">⚠️</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
