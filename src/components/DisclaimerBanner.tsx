import Link from 'next/link';

interface DisclaimerBannerProps {
  sourceUrl: string;
  fetchedAt: string;
}

export function DisclaimerBanner({ sourceUrl, fetchedAt }: DisclaimerBannerProps) {
  const formattedDate = new Date(fetchedAt).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="mb-5 rounded-2xl border border-stone-300 bg-stone-100 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-stone-200 text-sm font-semibold text-stone-700">
          !
        </span>
        <div className="flex-1">
          <p className="mb-1 text-sm font-semibold text-stone-900">
            この情報は {formattedDate} 時点のものです
          </p>
          <p className="mb-3 text-sm text-stone-800">
            正式な手続きの際は必ず公式情報をご確認ください。
          </p>
          <Link
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-btn ui-btn-secondary px-3 py-2 text-xs"
          >
            公式サイトを開く
          </Link>
        </div>
      </div>
    </div>
  );
}
