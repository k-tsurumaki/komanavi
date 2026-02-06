
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
  const fallbackAudienceText = '対象条件は本文を確認してください';
  const hasContactKeyword = (text: string): boolean =>
    /(問い合わせ|連絡先|窓口|電話|相談|コールセンター|contact)/i.test(text);
  const baseCautions =
    overview?.cautions && overview.cautions.length > 0
      ? overview.cautions
      : (data.warnings ?? []);
  const allCautions = baseCautions.filter((caution) => !hasContactKeyword(caution));

  const audienceText =
    overview?.targetAudience ||
    data.target?.eligibility_summary ||
    data.target?.conditions?.[0] ||
    fallbackAudienceText;
  const requiredDocuments = (data.procedure?.required_documents ?? [])
    .map((doc) => doc.trim())
    .filter(Boolean);

  const contactDetails: Array<{ label: string; value: string; href?: string }> = [];
  const seenContacts = new Set<string>();
  const pushContactDetail = (label: string, value?: string, href?: string) => {
    const normalizedValue = value?.trim();
    if (!normalizedValue) {
      return;
    }
    const key = `${label}:${normalizedValue}`;
    if (seenContacts.has(key)) {
      return;
    }
    seenContacts.add(key);
    contactDetails.push({ label, value: normalizedValue, href });
  };

  pushContactDetail('担当部署', data.contact?.department);
  pushContactDetail(
    '電話番号',
    data.contact?.phone,
    data.contact?.phone ? `tel:${data.contact.phone.replace(/\s+/g, '')}` : undefined
  );
  pushContactDetail(
    'メール',
    data.contact?.email,
    data.contact?.email ? `mailto:${data.contact.email}` : undefined
  );
  pushContactDetail('受付時間', data.contact?.hours);
  pushContactDetail('住所', data.contact?.address);
  pushContactDetail('Webサイト', data.contact?.website, data.contact?.website);
  pushContactDetail('手続き窓口', data.procedure?.contact);
  pushContactDetail('窓口場所', data.procedure?.location);

  const fallbackFactCandidates = [
    ...(data.keyPoints ?? []).map((point) => point.text),
    ...(overview?.topics ?? []),
    ...(data.procedure?.steps ?? []).map((step) => step.action),
    ...(data.importantDates ?? []).map((date) =>
      date.date ? `${date.description}: ${date.date}` : date.description
    ),
    data.procedure?.deadline ? `期限: ${data.procedure.deadline}` : '',
    data.benefits?.amount ? `支援額: ${data.benefits.amount}` : '',
    data.procedure?.fee ? `費用: ${data.procedure.fee}` : '',
    requiredDocuments.length > 0
      ? `必要書類: ${requiredDocuments.length}点（${requiredDocuments.slice(0, 2).join('、')}など）`
      : '',
  ].filter(Boolean);

  const fallbackCriticalFacts = fallbackFactCandidates
    .slice(0, 8)
    .map((text, index) => {
      const normalized = text.replace(/\s+/g, ' ').trim();
      const segments = normalized.split(/[:：]/);
      const hasStructuredLabel = segments.length > 1 && segments[0].trim().length <= 18;
      return {
        item: hasStructuredLabel ? segments[0].trim() : `重要事項${index + 1}`,
        value: hasStructuredLabel ? segments.slice(1).join('：').trim() : normalized,
        reason: '見落とすと制度利用の判断や手続きに影響するため',
      };
    })
    .filter((fact) => fact.item && fact.value)
    .filter((fact) => !hasContactKeyword(`${fact.item} ${fact.value}`))
    .slice(0, 5);

  const compactCautions = allCautions.slice(0, 3);
  const criticalFactsFromOverview =
    overview?.criticalFacts && overview.criticalFacts.length > 0
      ? overview.criticalFacts
          .filter((fact) => fact.item && fact.value)
          .filter((fact) => !hasContactKeyword(`${fact.item} ${fact.value}`))
      : [];
  const criticalFacts =
    criticalFactsFromOverview.length > 0
      ? criticalFactsFromOverview
      : fallbackCriticalFacts;
  const targetCondition = data.target?.conditions?.[0] || data.target?.eligibility_summary;
  const achievableOutcomes = Array.from(
    new Set(
      [
        targetCondition || audienceText !== fallbackAudienceText
          ? '自分が対象かどうかを確認できる'
          : '',
        data.procedure?.deadline ||
        (data.importantDates?.length ?? 0) > 0 ||
        requiredDocuments.length > 0
          ? '必要書類と期限を把握できる'
          : '',
        (data.procedure?.steps?.length ?? 0) > 0 ? '手続きの流れを把握できる' : '',
        data.benefits?.description || data.benefits?.amount
          ? '受けられる支援内容を把握できる'
          : '',
        data.contact?.department || data.contact?.phone
          ? '問い合わせ先を確認できる'
          : '',
      ].filter(Boolean)
    )
  );
  const compactAchievableOutcomes =
    achievableOutcomes.length > 0
      ? achievableOutcomes.slice(0, 3)
      : ['このページの要点を短時間で把握できる'];

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
      <div className="mb-6 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span aria-hidden="true">📌</span>
              30秒で把握
            </div>
          </div>
          <p className="mt-4 text-lg font-semibold text-slate-900 leading-relaxed">
            {overview?.conclusion || data.summary}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-700 mb-3 flex items-center gap-2">
              <span aria-hidden="true">👥</span>
              だれ向けの情報か
            </h3>
            <p className="text-slate-800 leading-relaxed">{audienceText}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-700 mb-3 flex items-center gap-2">
              <span aria-hidden="true">🧭</span>
              このページで実現できること
            </h3>
            <ul className="space-y-2 text-slate-800 text-sm">
              {compactAchievableOutcomes.map((outcome, index) => (
                <li key={`${outcome}-${index}`} className="flex gap-2">
                  <span className="text-slate-400" aria-hidden="true">
                    •
                  </span>
                  <span>{outcome}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {criticalFacts.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-700 mb-3 flex items-center gap-2">
              <span aria-hidden="true">🔎</span>
              このページの最重要ポイント
            </h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm text-slate-800">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">項目</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">内容</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">なぜ重要か</th>
                  </tr>
                </thead>
                <tbody>
                  {criticalFacts.map((fact, index) => (
                    <tr key={`${fact.item}-${index}`} className="border-t border-slate-200 align-top">
                      <td className="px-3 py-2 font-medium text-slate-900">{fact.item}</td>
                      <td className="px-3 py-2">{fact.value}</td>
                      <td className="px-3 py-2 text-slate-700">{fact.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-amber-900 mb-3 flex items-center gap-2">
            <span aria-hidden="true">⚠️</span>
            先に知っておく注意点
          </h3>
          {compactCautions.length > 0 ? (
            <div className="space-y-3">
              {compactCautions.map((caution, index) => (
                <div
                  key={`${caution}-${index}`}
                  className="rounded-lg border border-amber-100 bg-white/90 px-4 py-3 text-sm text-slate-800 leading-relaxed"
                >
                  {caution}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-600">特になし</p>
          )}
        </div>

        {contactDetails.length > 0 && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-sky-900 mb-3 flex items-center gap-2">
              <span aria-hidden="true">📞</span>
              問い合わせ情報
            </h3>
            <div className="overflow-x-auto rounded-lg border border-sky-200 bg-white">
              <table className="min-w-full text-sm text-slate-800">
                <thead className="bg-sky-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">項目</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">内容</th>
                  </tr>
                </thead>
                <tbody>
                  {contactDetails.map((detail, index) => (
                    <tr key={`${detail.label}-${index}`} className="border-t border-sky-100 align-top">
                      <td className="px-3 py-2 font-medium text-slate-900">{detail.label}</td>
                      <td className="px-3 py-2">
                        {detail.href ? (
                          <a
                            href={detail.href}
                            target={detail.href.startsWith('http') ? '_blank' : undefined}
                            rel={detail.href.startsWith('http') ? 'noreferrer noopener' : undefined}
                            className="text-sky-700 underline underline-offset-2 break-all"
                          >
                            {detail.value}
                          </a>
                        ) : (
                          <span className="break-words">{detail.value}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

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
