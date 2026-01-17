'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppSidebar } from '@/components/AppSidebar';

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  return (
    <div className="min-h-screen flex">
      <AppSidebar
        className={isSidebarVisible ? 'hidden md:flex' : 'hidden md:hidden'}
        showCloseButton={isSidebarVisible}
        onClose={() => setIsSidebarVisible(false)}
      />

      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200">
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="inline-flex items-center justify-center rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 md:hidden"
                aria-label="メニューを開く"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-5 w-5 text-gray-700"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h16" />
                </svg>
              </button>
              {!isSidebarVisible && (
                <button
                  type="button"
                  onClick={() => setIsSidebarVisible(true)}
                  className="hidden md:inline-flex items-center justify-center rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700"
                  aria-label="サイドバーを開く"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-5 w-5 text-gray-700"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 6h16" />
                    <path d="M4 12h16" />
                    <path d="M4 18h16" />
                  </svg>
                </button>
              )}
            </div>
            <h1 className="text-lg font-bold text-blue-600">
              <Link href="/">KOMANAVI</Link>
            </h1>
            <span className="w-[64px]" aria-hidden="true" />
          </div>
        </header>

        <main id="main-content" className="flex-1">
          {children}
        </main>
        <footer className="bg-white border-t border-gray-200 mt-auto">
          <div className="max-w-4xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
            <p>
              ※ 本サービスは参考情報を提供するものであり、正確性を保証するものではありません。
              <br />
              正式な手続きの際は必ず公式情報をご確認ください。
            </p>
          </div>
        </footer>
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="メニューを閉じる"
            onClick={() => setIsSidebarOpen(false)}
          />
          <AppSidebar
            className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl"
            showCloseButton
            onClose={() => setIsSidebarOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
