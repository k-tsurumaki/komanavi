'use client';

import { useState, FormEvent } from 'react';

interface UrlInputProps {
  onSubmit: (url: string) => void;
  isLoading?: boolean;
}

export function UrlInput({ onSubmit, isLoading = false }: UrlInputProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const validateUrl = (value: string): boolean => {
    if (!value.trim()) {
      setError('URLを入力してください');
      return false;
    }

    try {
      const urlObj = new URL(value);
      // HTTPSまたはHTTPのみ許可
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        setError('http:// または https:// で始まるURLを入力してください');
        return false;
      }
      setError('');
      return true;
    } catch {
      setError('正しいURLの形式で入力してください');
      return false;
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (validateUrl(url)) {
      onSubmit(url);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col gap-3">
        <label htmlFor="url-input" className="sr-only">
          行政ページのURLを入力してください
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="url-input"
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError('');
            }}
            autoComplete="off"
            spellCheck={false}
            placeholder="https://www.city.example.lg.jp/..."
            className="ui-input flex-1 px-4 py-3 text-base"
            disabled={isLoading}
            aria-describedby={error ? 'url-error' : undefined}
            aria-invalid={error ? 'true' : 'false'}
          />
          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="ui-btn ui-btn-primary min-w-32 px-6 py-3 text-sm font-semibold text-white"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                解析中...
              </span>
            ) : (
              '解析する'
            )}
          </button>
        </div>
        {error && (
          <p id="url-error" className="text-sm text-stone-700" role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
