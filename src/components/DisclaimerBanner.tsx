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
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <span className="text-amber-600 text-xl flex-shrink-0" aria-hidden="true">
          ⚠️
        </span>
        <div className="flex-1">
          <p className="text-amber-800 font-medium mb-1">この情報は {formattedDate} 時点のものです</p>
          <p className="text-amber-700 text-base mb-3">
            正式な手続きの際は必ず公式情報をご確認ください。
          </p>
          <Link
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
          >
            公式サイトを開く
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
