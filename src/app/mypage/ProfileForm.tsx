'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from 'next-auth';
import type { MypageProfileFormValues } from '@/lib/mypage-profile';

interface ProfileFormProps {
  user: User;
  initialProfile: MypageProfileFormValues;
  hasBootstrapError: boolean;
}

export function ProfileForm({ user, initialProfile, hasBootstrapError }: ProfileFormProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<MypageProfileFormValues>(initialProfile);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profile),
      });

      if (!res.ok) {
        throw new Error('Failed to save profile');
      }

      setMessage({ type: 'success', text: 'プロフィールを保存しました。' });
      router.refresh();
    } catch (error) {
      console.error('Error saving profile:', error);
      setMessage({ type: 'error', text: '保存に失敗しました。' });
    } finally {
      setSaving(false);
    }
  };

  if (hasBootstrapError) {
    return (
      <div className="ui-card p-6">
        <p className="text-sm font-semibold text-slate-900">
          プロフィールの読み込みに失敗したため、現在は編集できません。
        </p>
        <p className="mt-2 text-sm text-slate-600">
          通信状況を確認して、再読み込みしてください。
        </p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="ui-btn ui-btn-primary px-4 py-2 text-sm !text-white"
          >
            再読み込み
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="ui-btn ui-btn-secondary px-4 py-2 text-sm"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-card-float p-5 sm:p-6">
      <div className="mb-5 border-b border-slate-200/80 pb-4">
        <h2 className="ui-heading text-xl">プロフィール情報</h2>
        <p className="ui-subtle mt-1 text-xs">
          ログイン中: {user.email || user.name || 'ユーザー'}
        </p>
      </div>

      {message && (
        <div
          className={`ui-callout mb-5 ${
            message.type === 'success' ? 'ui-callout-success' : 'ui-callout-error'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="displayName" className="mb-1 block text-sm font-semibold text-slate-700">
            名前（表示名）
          </label>
          <input
            type="text"
            id="displayName"
            name="displayName"
            value={profile.displayName}
            onChange={handleChange}
            placeholder="例：山田 太郎"
            className="ui-input"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="birthDate" className="mb-1 block text-sm font-semibold text-slate-700">
              生年月日
            </label>
            <input
              type="date"
              id="birthDate"
              name="birthDate"
              value={profile.birthDate}
              onChange={handleChange}
              className="ui-input"
            />
          </div>
          <div>
            <label htmlFor="gender" className="mb-1 block text-sm font-semibold text-slate-700">
              性別
            </label>
            <select
              id="gender"
              name="gender"
              value={profile.gender}
              onChange={handleChange}
              className="ui-select"
            >
              <option value="">選択してください</option>
              <option value="男性">男性</option>
              <option value="女性">女性</option>
              <option value="その他">その他</option>
              <option value="無回答">無回答</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="occupation" className="mb-1 block text-sm font-semibold text-slate-700">
              職業
            </label>
            <input
              type="text"
              id="occupation"
              name="occupation"
              value={profile.occupation}
              onChange={handleChange}
              placeholder="例：会社員、学生"
              className="ui-input"
            />
          </div>
          <div>
            <label
              htmlFor="nationality"
              className="mb-1 block text-sm font-semibold text-slate-700"
            >
              国籍
            </label>
            <select
              id="nationality"
              name="nationality"
              value={profile.nationality}
              onChange={handleChange}
              className="ui-select"
            >
              <option value="">選択してください</option>
              <option value="日本">日本</option>
              <option value="アメリカ">アメリカ</option>
              <option value="イギリス">イギリス</option>
              <option value="中国">中国</option>
              <option value="韓国">韓国</option>
              <option value="フランス">フランス</option>
              <option value="ドイツ">ドイツ</option>
              <option value="その他">その他</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="location" className="mb-1 block text-sm font-semibold text-slate-700">
            居住地
          </label>
          <input
            type="text"
            id="location"
            name="location"
            value={profile.location}
            onChange={handleChange}
            placeholder="例：東京都"
            className="ui-input"
          />
        </div>

        <div>
          <label htmlFor="visualTraits" className="mb-1 block text-sm font-semibold text-slate-700">
            外見の特徴
          </label>
          <textarea
            id="visualTraits"
            name="visualTraits"
            value={profile.visualTraits}
            onChange={handleChange}
            rows={3}
            placeholder="例：黒髪ショートヘア、眼鏡をかけている"
            className="ui-textarea"
          />
        </div>

        <div>
          <label htmlFor="personality" className="mb-1 block text-sm font-semibold text-slate-700">
            性格・口調
          </label>
          <textarea
            id="personality"
            name="personality"
            value={profile.personality}
            onChange={handleChange}
            rows={3}
            placeholder="例：冷静沈着、丁寧語で話す"
            className="ui-textarea"
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-4 sm:flex-row">
          <button
            type="button"
            onClick={() => router.back()}
            className="ui-btn ui-btn-secondary flex-1 py-2.5 text-sm"
          >
            戻る
          </button>
          <button
            type="submit"
            disabled={saving}
            className="ui-btn ui-btn-primary flex-1 py-2.5 text-sm !text-white"
          >
            {saving ? '保存中...' : '保存する'}
          </button>
        </div>
      </form>
    </div>
  );
}
