
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
  const allPoints = overview?.topics ?? [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur mb-6">
      {/* タイトル */}
      {showTitle && (
        <div className="mb-5">
          <h2 className="text-2xl font-bold text-slate-900 leading-tight tracking-tight">
            {data.title}
          </h2>
        </div>
      )}

      {/* ページ概要 */}
      {overview ? (
        <div className="mb-6 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span aria-hidden="true">✨</span>
                かんたん結論
              </div>
            </div>
            <p className="mt-4 text-lg font-semibold text-slate-900 leading-relaxed">
              {overview.conclusion}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                <span aria-hidden="true">👥</span>
                対象者
              </h3>
              <p className="text-slate-800 leading-relaxed">{overview.targetAudience}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                <span aria-hidden="true">🎯</span>
                目的
              </h3>
              <p className="text-slate-800 leading-relaxed">{overview.purpose}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
              <span aria-hidden="true">✅</span>
              重要ポイント
            </h3>
            {allPoints.length > 0 ? (
              <div className="space-y-3">
                {allPoints.map((topic, index) => (
                  <div key={index} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-3">
                    <span className="mt-0.5 inline-flex h-6 min-w-[2.25rem] items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-semibold text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <p className="text-slate-800 leading-relaxed">{topic}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-600">特になし</p>
            )}
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-800 mb-3 flex items-center gap-2">
              <span aria-hidden="true">⚠️</span>
              注意点
            </h3>
            {overview.cautions.length > 0 ? (
              <div className="space-y-3">
                {overview.cautions.map((caution, index) => (
                  <div key={index} className="flex gap-3 rounded-lg border border-amber-100 bg-white/90 px-4 py-3 text-slate-800">
                    <span className="mt-0.5 inline-flex h-6 min-w-[2.25rem] items-center justify-center rounded-full border border-amber-200 bg-white text-[11px] font-semibold text-amber-700 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="leading-relaxed">{caution}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-600">特になし</p>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 mb-6">
          <p className="text-lg text-slate-700 leading-relaxed">{data.summary}</p>
        </div>
      )}

      {!hideDetails && (
        <>
          {/* キーポイント */}
          {data.keyPoints && data.keyPoints.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-3 text-slate-900">ポイント</h3>
              <ul className="space-y-4">
                {data.keyPoints.map((point) => (
                  <li key={point.id} className="flex items-start gap-4 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/60 p-4">
                    <span
                      className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-sm ${
                        point.importance === 'high'
                          ? 'bg-rose-500'
                          : point.importance === 'medium'
                            ? 'bg-amber-500'
                            : 'bg-slate-400'
                      }`}
                      aria-label={`重要度: ${point.importance}`}
                    >
                      !
                    </span>
                    <span className="text-slate-900 text-lg leading-relaxed">{point.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 対象者 */}
          {data.target && (
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-3 text-slate-900">対象となる方</h3>
              {data.target.eligibility_summary && (
                <p className="text-slate-700 mb-2">{data.target.eligibility_summary}</p>
              )}
              {data.target.conditions && data.target.conditions.length > 0 && (
                <ul className="space-y-2 text-slate-700">
                  {data.target.conditions.map((condition, index) => (
                    <li key={index} className="flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2">
                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600">
                        ●
                      </span>
                      <span>{condition}</span>
                    </li>
                  ))}
                </ul>
              )}
              {data.target.exceptions && data.target.exceptions.length > 0 && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-600 mb-1">例外・注意事項</p>
                  <ul className="space-y-2 text-slate-600 text-sm">
                    {data.target.exceptions.map((exception, index) => (
                      <li key={index} className="flex items-start gap-2 rounded-md bg-white px-3 py-2">
                        <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600">
                          ●
                        </span>
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
              <h3 className="text-lg font-bold mb-3 text-slate-900">給付・支援内容</h3>
              <p className="text-slate-700 mb-2">{data.benefits.description}</p>
              {data.benefits.amount && (
                <p className="text-xl font-bold text-slate-900">{data.benefits.amount}</p>
              )}
              {data.benefits.frequency && (
                <p className="text-slate-500 text-sm mt-1">{data.benefits.frequency}</p>
              )}
            </div>
          )}

          {/* 手続き */}
          {data.procedure && (
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-3 text-slate-900">手続きの流れ</h3>
              {data.procedure.steps && data.procedure.steps.length > 0 && (
                <ol className="space-y-3">
                  {data.procedure.steps.map((step) => (
                    <li key={step.order} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
                      <span className="flex-shrink-0 w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold">
                        {step.order}
                      </span>
                      <div>
                        <p className="font-medium text-slate-800">{step.action}</p>
                        {step.details && (
                          <p className="text-slate-600 text-sm mt-1">{step.details}</p>
                        )}
                        {step.note && (
                          <p className="text-emerald-700 text-sm mt-1">💡 {step.note}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {/* 必要書類 */}
              {data.procedure.required_documents &&
                data.procedure.required_documents.length > 0 && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h4 className="font-medium mb-2 text-slate-800">必要な書類</h4>
                    <ul className="space-y-2 text-slate-700">
                      {data.procedure.required_documents.map((doc, index) => (
                        <li key={index} className="flex items-start gap-2 rounded-md bg-white px-3 py-2">
                          <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                            📄
                          </span>
                          <span>{doc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* 期限 */}
              {data.procedure.deadline && (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
                  <p className="text-rose-700 font-medium">
                    📅 期限: {data.procedure.deadline}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 連絡先 */}
          {data.contact && (
            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-lg font-bold mb-2 text-slate-900">お問い合わせ</h3>
              {data.contact.department && (
                <p className="text-slate-700">{data.contact.department}</p>
              )}
              {data.contact.phone && (
                <p className="text-slate-700">
                  電話:{' '}
                  <a href={`tel:${data.contact.phone}`} className="text-slate-900 font-semibold">
                    {data.contact.phone}
                  </a>
                </p>
              )}
              {data.contact.hours && (
                <p className="text-slate-500 text-sm">{data.contact.hours}</p>
              )}
            </div>
          )}

          {/* 注意事項 */}
          {data.warnings && data.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h4 className="font-medium text-amber-800 mb-2">⚠️ 注意事項</h4>
              <ul className="space-y-2 text-amber-700">
                {data.warnings.map((warning, index) => (
                  <li key={index} className="flex items-start gap-2 rounded-md bg-white/80 px-3 py-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-700">
                      ⚠️
                    </span>
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
