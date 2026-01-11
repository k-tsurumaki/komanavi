'use client';

import type { IntermediateRepresentation } from '@/lib/types/intermediate';

interface SummaryViewerProps {
  data: IntermediateRepresentation;
}

export function SummaryViewer({ data }: SummaryViewerProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      {/* タイトル */}
      <h2 className="text-2xl font-bold mb-4">{data.title}</h2>

      {/* 概要 */}
      <p className="text-lg text-gray-700 mb-6 leading-relaxed">{data.summary}</p>

      {/* キーポイント */}
      {data.keyPoints && data.keyPoints.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-bold mb-3">ポイント</h3>
          <ul className="space-y-2">
            {data.keyPoints.map((point) => (
              <li key={point.id} className="flex items-start gap-2">
                <span
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm ${
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
                <span className="text-gray-800">{point.text}</span>
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
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            {data.target.conditions.map((condition, index) => (
              <li key={index}>{condition}</li>
            ))}
          </ul>
          {data.target.exceptions && data.target.exceptions.length > 0 && (
            <div className="mt-3 p-3 bg-gray-50 rounded">
              <p className="text-sm font-medium text-gray-600 mb-1">例外・注意事項</p>
              <ul className="list-disc list-inside space-y-1 text-gray-600 text-sm">
                {data.target.exceptions.map((exception, index) => (
                  <li key={index}>{exception}</li>
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
          <ol className="space-y-3">
            {data.procedure.steps.map((step) => (
              <li key={step.order} className="flex gap-3">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                  {step.order}
                </span>
                <div>
                  <p className="font-medium text-gray-800">{step.action}</p>
                  {step.details && <p className="text-gray-600 text-sm mt-1">{step.details}</p>}
                  {step.note && (
                    <p className="text-blue-600 text-sm mt-1">💡 {step.note}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {/* 必要書類 */}
          {data.procedure.required_documents && data.procedure.required_documents.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">必要な書類</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {data.procedure.required_documents.map((doc, index) => (
                  <li key={index}>{doc}</li>
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
          {data.contact.department && <p className="text-gray-700">{data.contact.department}</p>}
          {data.contact.phone && (
            <p className="text-gray-700">
              電話: <a href={`tel:${data.contact.phone}`} className="text-blue-600">{data.contact.phone}</a>
            </p>
          )}
          {data.contact.hours && <p className="text-gray-600 text-sm">{data.contact.hours}</p>}
        </div>
      )}

      {/* 注意事項 */}
      {data.warnings && data.warnings.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h4 className="font-medium text-amber-800 mb-2">⚠️ 注意事項</h4>
          <ul className="list-disc list-inside space-y-1 text-amber-700">
            {data.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
