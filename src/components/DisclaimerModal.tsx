'use client';

import { useState, useSyncExternalStore, useCallback } from 'react';

const CONSENT_KEY = 'komanavi-disclaimer-consent';

// localStorageのsubscribe関数
function subscribeToStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

// localStorageからconsentを取得
function getConsentSnapshot(): boolean {
  if (typeof window === 'undefined') return true; // SSR時は同意済みとして扱う
  return localStorage.getItem(CONSENT_KEY) === 'true';
}

// SSR時のスナップショット
function getServerSnapshot(): boolean {
  return true; // SSR時は同意済みとして扱う（モーダル非表示）
}

interface DisclaimerModalProps {
  onAccept?: () => void;
}

export function DisclaimerModal({ onAccept }: DisclaimerModalProps) {
  const hasConsent = useSyncExternalStore(
    subscribeToStorage,
    getConsentSnapshot,
    getServerSnapshot
  );

  const [dismissed, setDismissed] = useState(false);

  const handleAccept = useCallback(() => {
    localStorage.setItem(CONSENT_KEY, 'true');
    setDismissed(true);
    onAccept?.();
  }, [onAccept]);

  // 同意済みまたは今回のセッションで閉じた場合は表示しない
  if (hasConsent || dismissed) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div className="ui-card-float max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <h2 id="disclaimer-title" className="ui-heading mb-4 text-center text-xl">
          ご利用にあたって
        </h2>

        <div className="mb-6 space-y-4 text-sm text-slate-700">
          <p className="text-base font-semibold text-slate-800">
            KOMANAVI（コマナビ）は、行政情報をわかりやすくお伝えするサービスです。
          </p>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="mb-2 text-sm font-bold text-amber-900">重要なお知らせ</h3>
            <ul className="list-disc space-y-2 pl-5 text-sm text-amber-800">
              <li>
                本サービスはAIによる要約であり、<strong>正確性を保証するものではありません</strong>
              </li>
              <li>
                正式な手続きの際は、必ず<strong>公式サイトや窓口で最新情報をご確認ください</strong>
              </li>
              <li>
                本サービスの利用により生じた損害について、当サービスは責任を負いかねます
              </li>
            </ul>
          </div>

          <p>
            以上をご理解いただいた上で、「同意して利用する」ボタンを押してください。
          </p>
        </div>

        <button
          onClick={handleAccept}
          className="ui-btn ui-btn-primary w-full py-3 text-sm !text-white"
        >
          同意して利用する
        </button>
      </div>
    </div>
  );
}
