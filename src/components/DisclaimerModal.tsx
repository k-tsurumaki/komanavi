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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 id="disclaimer-title" className="text-xl font-bold mb-4 text-center">
          ご利用にあたって
        </h2>

        <div className="space-y-4 text-gray-700 mb-6">
          <p className="font-medium text-lg">
            KOMANAVI（コマナビ）は、行政情報をわかりやすくお伝えするサービスです。
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="font-bold text-amber-800 mb-2">重要なお知らせ</h3>
            <ul className="list-disc list-inside space-y-2 text-amber-700">
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
          className="w-full py-3 px-6 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          同意して利用する
        </button>
      </div>
    </div>
  );
}
