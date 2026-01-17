'use client';

import { useMemo, useState } from 'react';
import { saveFeedbackItem, loadFeedback } from '@/lib/storage';
import type { FeedbackItem } from '@/lib/types/intermediate';

interface FeedbackSectionProps {
  url: string;
  resultId: string;
}

export function FeedbackSection({ url, resultId }: FeedbackSectionProps) {
  const [rating, setRating] = useState<'accurate' | 'inaccurate' | null>(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const alreadySubmitted = useMemo(() => {
    const items = loadFeedback();
    return items.some((item) => item.resultId === resultId);
  }, [resultId]);

  const handleSubmit = () => {
    if (!rating) return;
    const item: FeedbackItem = {
      id: crypto.randomUUID(),
      url,
      resultId,
      rating,
      comment: comment.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    saveFeedbackItem(item);
    setSubmitted(true);
  };

  if (alreadySubmitted || submitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <p className="text-green-700">フィードバックありがとうございました！</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
      <p className="text-gray-700 mb-4 text-center">この情報は正しいですか？</p>
      <div className="flex flex-wrap justify-center gap-4 mb-4">
        <button
          type="button"
          className={`px-6 py-2 rounded-lg transition-colors ${
            rating === 'accurate'
              ? 'bg-green-600 text-white'
              : 'bg-green-100 text-green-700 hover:bg-green-200'
          }`}
          onClick={() => setRating('accurate')}
        >
          👍 はい
        </button>
        <button
          type="button"
          className={`px-6 py-2 rounded-lg transition-colors ${
            rating === 'inaccurate'
              ? 'bg-red-600 text-white'
              : 'bg-red-100 text-red-700 hover:bg-red-200'
          }`}
          onClick={() => setRating('inaccurate')}
        >
          👎 いいえ
        </button>
      </div>
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="理由や改善点があればご記入ください（任意）"
        className="w-full min-h-[96px] p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200"
      />
      <div className="mt-4 text-center">
        <button
          type="button"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          disabled={!rating}
          onClick={handleSubmit}
        >
          送信する
        </button>
      </div>
    </div>
  );
}
