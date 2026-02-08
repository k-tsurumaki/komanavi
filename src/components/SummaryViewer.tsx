'use client';

import type {
  IntermediateRepresentation,
  Overview,
  OverviewBlockId,
} from '@/lib/types/intermediate';

interface SummaryViewerProps {
  data: IntermediateRepresentation;
  overview?: Overview;
  showTitle?: boolean;
  hideDetails?: boolean;
}

type SummaryHeadingIconName =
  | 'summary'
  | 'audience'
  | 'outcomes'
  | 'critical'
  | 'cautions'
  | 'contact'
  | 'evidence';

function SummaryHeadingIcon({
  name,
  className = 'text-slate-500',
}: {
  name: SummaryHeadingIconName;
  className?: string;
}) {
  if (name === 'summary') {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`h-4 w-4 flex-shrink-0 ${className}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m12 3 1.2 3.2L16.5 7.5l-3.3 1.3L12 12l-1.2-3.2L7.5 7.5l3.3-1.3L12 3Z" />
        <path d="m18.5 12 0.8 2.1 2.2 0.8-2.2 0.8-0.8 2.1-0.8-2.1-2.2-0.8 2.2-0.8 0.8-2.1Z" />
        <path d="m6 13.5 0.7 1.8 1.8 0.7-1.8 0.7L6 18.5l-0.7-1.8-1.8-0.7 1.8-0.7 0.7-1.8Z" />
      </svg>
    );
  }

  if (name === 'audience') {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`h-4 w-4 flex-shrink-0 ${className}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="9" cy="8" r="2.5" />
        <circle cx="16.5" cy="9.5" r="2" />
        <path d="M4.5 17.5c0-2.6 2-4.5 4.5-4.5s4.5 1.9 4.5 4.5" />
        <path d="M13.5 17.5c0-1.8 1.4-3.1 3.1-3.1 1.7 0 3.1 1.3 3.1 3.1" />
      </svg>
    );
  }

  if (name === 'outcomes') {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`h-4 w-4 flex-shrink-0 ${className}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="m8.8 12.3 2.2 2.2 4.2-4.2" />
      </svg>
    );
  }

  if (name === 'critical') {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`h-4 w-4 flex-shrink-0 ${className}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 7h10" />
        <path d="M7 12h10" />
        <path d="M7 17h10" />
        <circle cx="4.5" cy="7" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="4.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="4.5" cy="17" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (name === 'cautions') {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`h-4 w-4 flex-shrink-0 ${className}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 4 3.8 18h16.4L12 4Z" />
        <path d="M12 9v4.2" />
        <circle cx="12" cy="16.2" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (name === 'contact') {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`h-4 w-4 flex-shrink-0 ${className}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6.5 4.5h3l1 3.6-1.8 1.8a12.7 12.7 0 0 0 5.4 5.4l1.8-1.8 3.6 1v3c0 1-.8 1.8-1.8 1.8A15.4 15.4 0 0 1 4.7 6.3c0-1 .8-1.8 1.8-1.8Z" />
      </svg>
    );
  }

  if (name === 'evidence') {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`h-4 w-4 flex-shrink-0 ${className}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 14a4 4 0 0 1 0-5.7l1.7-1.7a4 4 0 0 1 5.7 5.7l-1.5 1.5" />
        <path d="M14 10a4 4 0 0 1 0 5.7l-1.7 1.7a4 4 0 1 1-5.7-5.7l1.5-1.5" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`h-4 w-4 flex-shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 14a4 4 0 0 1 0-5.7l1.7-1.7a4 4 0 0 1 5.7 5.7l-1.5 1.5" />
      <path d="M14 10a4 4 0 0 1 0 5.7l-1.7 1.7a4 4 0 1 1-5.7-5.7l1.5-1.5" />
    </svg>
  );
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
    overview?.cautions && overview.cautions.length > 0 ? overview.cautions : (data.warnings ?? []);
  const allCautions = baseCautions.filter((caution) => !hasContactKeyword(caution));

  const audienceText =
    overview?.targetAudience ||
    data.target?.eligibility_summary ||
    data.target?.conditions?.[0] ||
    fallbackAudienceText;
  const requiredDocuments = (data.procedure?.required_documents ?? [])
    .map((doc) => doc.trim())
    .filter(Boolean);
  const normalizeEvidenceUrl = (value?: string): string => {
    if (!value) {
      return '';
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return '';
      }
      url.hash = '';
      const normalized = url.toString();
      return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
    } catch {
      return '';
    }
  };
  const getHostnameLabel = (url: string): string => {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./i, '');
    } catch {
      return url;
    }
  };

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

  const knownEvidenceUrls = new Set<string>();
  const evidenceTitleByUrl = new Map<string, string>();
  const registerEvidenceUrl = (value?: string, title?: string) => {
    const normalized = normalizeEvidenceUrl(value);
    if (normalized) {
      knownEvidenceUrls.add(normalized);
      const normalizedTitle = title?.trim();
      if (normalizedTitle) {
        evidenceTitleByUrl.set(normalized, normalizedTitle);
      } else if (!evidenceTitleByUrl.has(normalized)) {
        evidenceTitleByUrl.set(normalized, getHostnameLabel(normalized));
      }
    }
  };

  registerEvidenceUrl(data.metadata.source_url, data.metadata.page_title || data.title);
  for (const chunk of data.metadata.groundingMetadata?.groundingChunks ?? []) {
    registerEvidenceUrl(chunk.web?.uri, chunk.web?.title);
  }
  for (const relatedLink of data.relatedLinks ?? []) {
    registerEvidenceUrl(relatedLink.url, relatedLink.title);
  }
  registerEvidenceUrl(
    data.contact?.website,
    data.contact?.department ? `${data.contact.department} の案内ページ` : undefined
  );

  const sourceEvidenceUrl = normalizeEvidenceUrl(data.metadata.source_url);
  const evidenceUrlPool = Array.from(knownEvidenceUrls);
  const evidenceUrlPoolWithoutSource = sourceEvidenceUrl
    ? evidenceUrlPool.filter((url) => url !== sourceEvidenceUrl)
    : evidenceUrlPool;
  const fallbackEvidenceByBlock: Partial<Record<OverviewBlockId, string[]>> =
    evidenceUrlPoolWithoutSource.length > 0
      ? {
          conclusion: evidenceUrlPoolWithoutSource.slice(0, 2),
          targetAudience: evidenceUrlPoolWithoutSource.slice(0, 2),
          achievableOutcomes: evidenceUrlPoolWithoutSource.slice(0, 3),
          criticalFacts: evidenceUrlPoolWithoutSource.slice(0, 3),
          cautions: evidenceUrlPoolWithoutSource.slice(0, 2),
          contactInfo: evidenceUrlPoolWithoutSource.slice(0, 2),
        }
      : {};

  const overviewEvidenceByBlock = overview?.evidenceByBlock ?? {};
  const getBlockEvidenceUrls = (blockId: OverviewBlockId): string[] => {
    const mappedUrls = overviewEvidenceByBlock[blockId];
    const candidateUrls =
      mappedUrls && mappedUrls.length > 0 ? mappedUrls : (fallbackEvidenceByBlock[blockId] ?? []);

    const deduped = new Set<string>();
    for (const candidateUrl of candidateUrls) {
      const normalized = normalizeEvidenceUrl(candidateUrl);
      if (!normalized) {
        continue;
      }
      if (knownEvidenceUrls.size > 0 && !knownEvidenceUrls.has(normalized)) {
        continue;
      }
      deduped.add(normalized);
      if (deduped.size >= 3) {
        break;
      }
    }

    const normalizedCandidates = Array.from(deduped);
    const nonSourceCandidates = sourceEvidenceUrl
      ? normalizedCandidates.filter((url) => url !== sourceEvidenceUrl)
      : normalizedCandidates;

    if (nonSourceCandidates.length > 0) {
      return nonSourceCandidates.slice(0, 3);
    }

    return [];
  };

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
    criticalFactsFromOverview.length > 0 ? criticalFactsFromOverview : fallbackCriticalFacts;
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
        data.benefits?.description || data.benefits?.amount ? '受けられる支援内容を把握できる' : '',
        data.contact?.department || data.contact?.phone ? '問い合わせ先を確認できる' : '',
      ].filter(Boolean)
    )
  );
  const compactAchievableOutcomes =
    achievableOutcomes.length > 0
      ? achievableOutcomes.slice(0, 3)
      : ['このページの要点を短時間で把握できる'];
  const conclusionText = overview?.conclusion || data.summary;
  const hasCriticalFactsSection = criticalFacts.length > 0;
  const hasContactInfoSection = contactDetails.length > 0;
  const evidenceSections = [
    { blockId: 'conclusion' as const, label: '30秒で把握', visible: true },
    { blockId: 'targetAudience' as const, label: 'だれ向けの情報か', visible: true },
    { blockId: 'achievableOutcomes' as const, label: 'このページで実現できること', visible: true },
    {
      blockId: 'criticalFacts' as const,
      label: 'このページの最重要ポイント',
      visible: hasCriticalFactsSection,
    },
    { blockId: 'cautions' as const, label: '見落とすと困る注意点', visible: true },
    { blockId: 'contactInfo' as const, label: '問い合わせ情報', visible: hasContactInfoSection },
  ]
    .filter((section) => section.visible)
    .map((section) => ({
      ...section,
      urls: getBlockEvidenceUrls(section.blockId),
    }))
    .filter((section) => section.urls.length > 0);

  return (
    <div className="mb-6 rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_16px_44px_rgba(13,13,13,0.11)]">
      {/* タイトル */}
      {showTitle && (
        <div className="mb-6 border-b border-slate-200/70 pb-4">
          <h2 className="text-2xl font-bold text-slate-900 leading-tight tracking-tight sm:text-[1.75rem]">
            {data.title}
          </h2>
        </div>
      )}

      {/* ページ概要 */}
      <div className="mb-6 rounded-[24px] border border-slate-200/80 bg-slate-50 p-5 sm:p-6">
        <div className="space-y-4 sm:space-y-5">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_22px_rgba(13,13,13,0.08)] sm:p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <SummaryHeadingIcon name="summary" />
              30秒で把握
            </h3>
            <p className="mt-3 text-lg font-semibold leading-relaxed text-slate-900 sm:text-xl">
              {conclusionText}
            </p>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(13,13,13,0.07)]">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <SummaryHeadingIcon name="audience" />
                だれ向けの情報か
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-900">{audienceText}</p>
            </section>
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(13,13,13,0.07)]">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <SummaryHeadingIcon name="outcomes" />
                このページで実現できること
              </h3>
              <ul className="mt-3 space-y-2">
                {compactAchievableOutcomes.map((outcome, index) => (
                  <li
                    key={`${outcome}-${index}`}
                    className="flex gap-2 text-[15px] leading-relaxed text-slate-900"
                  >
                    <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-stone-300 bg-stone-100 text-[11px] font-bold text-stone-700">
                      ✓
                    </span>
                    <span>{outcome}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {criticalFacts.length > 0 && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(13,13,13,0.07)]">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <SummaryHeadingIcon name="critical" />
                このページの最重要ポイント
              </h3>
              <div className="mt-3 overflow-x-auto rounded-xl">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr className="border-b border-slate-200">
                      <th className="w-[20%] px-3 py-2 text-left font-semibold">項目</th>
                      <th className="w-[45%] px-3 py-2 text-left font-semibold">内容</th>
                      <th className="w-[35%] px-3 py-2 text-left font-semibold">なぜ重要か</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {criticalFacts.map((fact, index) => (
                      <tr
                        key={`${fact.item}-${index}`}
                        className={`align-top text-slate-800 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                      >
                        <td className="px-3 py-2.5 font-semibold text-slate-900">{fact.item}</td>
                        <td className="px-3 py-2.5 leading-relaxed">{fact.value}</td>
                        <td className="px-3 py-2.5 leading-relaxed text-slate-700">
                          {fact.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-stone-300 bg-stone-100 p-5 shadow-[0_6px_18px_rgba(38,8,1,0.10)]">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
              <SummaryHeadingIcon name="cautions" className="text-stone-700" />
              見落とすと困る注意点
            </h3>
            {compactCautions.length > 0 ? (
              <div className="mt-3 space-y-2">
                {compactCautions.map((caution, index) => (
                  <div
                    key={`${caution}-${index}`}
                    className="grid grid-cols-[auto,1fr] items-start gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-slate-800"
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-stone-200 text-[11px] font-bold text-stone-900">
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{caution}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">特になし</p>
            )}
          </section>

          {contactDetails.length > 0 && (
            <section className="rounded-2xl border border-stone-300 bg-stone-100 p-5 shadow-[0_6px_18px_rgba(38,8,1,0.10)]">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                <SummaryHeadingIcon name="contact" className="text-stone-700" />
                問い合わせ情報
              </h3>
              <dl className="mt-3 space-y-2.5">
                {contactDetails.map((detail, index) => (
                  <div
                    key={`${detail.label}-${index}`}
                    className="grid gap-1.5 rounded-xl border border-stone-200 bg-white/95 px-4 py-3 sm:grid-cols-[150px,1fr] sm:gap-3"
                  >
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                      {detail.label}
                    </dt>
                    <dd className="min-w-0 text-sm text-slate-900">
                      {detail.href ? (
                        <a
                          href={detail.href}
                          target={detail.href.startsWith('http') ? '_blank' : undefined}
                          rel={detail.href.startsWith('http') ? 'noreferrer noopener' : undefined}
                          className="break-all font-medium text-stone-700 underline underline-offset-2 hover:text-stone-800"
                        >
                          {detail.value}
                        </a>
                      ) : (
                        <span className="break-words">{detail.value}</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {evidenceSections.length > 0 && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(13,13,13,0.07)]">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <SummaryHeadingIcon name="evidence" />
                証跡URL
              </h3>
              <div className="mt-3 space-y-4">
                {evidenceSections.map((section) => (
                  <div key={section.blockId}>
                    <p className="text-xs font-semibold text-slate-500">{section.label}</p>
                    <ul className="mt-2 space-y-1.5">
                      {section.urls.map((url, index) => (
                        <li key={`${section.blockId}-${index}`} className="flex items-start gap-2">
                          <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-1 text-[10px] font-semibold text-slate-500">
                            {index + 1}
                          </span>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-slate-600 underline underline-offset-2 hover:text-slate-900"
                          >
                            {evidenceTitleByUrl.get(url) || getHostnameLabel(url)}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {!hideDetails && (
        <>
          {/* キーポイント */}
          {data.keyPoints && data.keyPoints.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-3 text-slate-900">ポイント</h3>
              <ul className="space-y-4">
                {data.keyPoints.map((point) => (
                  <li
                    key={point.id}
                    className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <span
                      className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-sm ${
                        point.importance === 'high'
                          ? 'bg-stone-900'
                          : point.importance === 'medium'
                            ? 'bg-stone-700'
                            : 'bg-stone-500'
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
                    <li
                      key={index}
                      className="flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-slate-400"
                      />
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
                      <li
                        key={index}
                        className="flex items-start gap-2 rounded-md bg-white px-3 py-2"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-slate-400"
                        />
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
                    <li
                      key={step.order}
                      className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <span className="flex-shrink-0 w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold">
                        {step.order}
                      </span>
                      <div>
                        <p className="font-medium text-slate-800">{step.action}</p>
                        {step.details && (
                          <p className="text-slate-600 text-sm mt-1">{step.details}</p>
                        )}
                        {step.note && (
                          <p className="text-stone-700 text-sm mt-1">
                            <span className="font-semibold">注記:</span> {step.note}
                          </p>
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
                        <li
                          key={index}
                          className="flex items-start gap-2 rounded-md bg-white px-3 py-2"
                        >
                          <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                            {index + 1}
                          </span>
                          <span>{doc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* 期限 */}
              {data.procedure.deadline && (
                <div className="mt-3 rounded-lg border border-stone-300 bg-stone-100 p-3">
                  <p className="text-stone-700 font-medium">期限: {data.procedure.deadline}</p>
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
              {data.contact.hours && <p className="text-slate-500 text-sm">{data.contact.hours}</p>}
            </div>
          )}

          {/* 注意事項 */}
          {data.warnings && data.warnings.length > 0 && (
            <div className="rounded-xl border border-stone-300 bg-stone-100 p-4">
              <h4 className="font-medium text-stone-800 mb-2">注意事項</h4>
              <ul className="space-y-2 text-stone-700">
                {data.warnings.map((warning, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 rounded-md bg-white/80 px-3 py-2"
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-stone-200 text-xs font-semibold text-stone-700">
                      !
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
