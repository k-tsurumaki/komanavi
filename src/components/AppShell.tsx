'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AppSidebar } from '@/components/AppSidebar';
import { UserMenu } from '@/components/UserMenu';
import {
  clearMigrationError,
  getMigrationError,
  migrateLocalHistoryIfNeeded,
} from '@/lib/history-migration';

type AppShellProps = {
  children: React.ReactNode;
};

// AppShellを使用しないルート（独立レイアウト）
const standaloneRoutes = ['/', '/login'];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    migrateLocalHistoryIfNeeded(session.user.id).finally(() => {
      setMigrationError(getMigrationError(session.user.id));
    });
  }, [session?.user?.id]);

  const handleRetryMigration = async () => {
    if (!session?.user?.id) return;
    clearMigrationError(session.user.id);
    setMigrationError(null);
    await migrateLocalHistoryIfNeeded(session.user.id);
    setMigrationError(getMigrationError(session.user.id));
  };

  // ランディングページとログインページは独立レイアウト
  if (standaloneRoutes.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex">
      {session && (
        <AppSidebar
          className={isSidebarVisible ? 'hidden md:flex' : 'hidden md:hidden'}
          showCloseButton={isSidebarVisible}
          onClose={() => setIsSidebarVisible(false)}
        />
      )}

      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200">
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {session && (
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
              )}
              {session && !isSidebarVisible && (
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
            <UserMenu />
          </div>
        </header>

        {migrationError && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900">
            <div className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                履歴の移行に失敗しました。再試行してください。
              </p>
              <button
                type="button"
                onClick={handleRetryMigration}
                className="px-3 py-1.5 text-sm font-semibold rounded-md border border-amber-300 bg-white hover:bg-amber-100"
              >
                再試行
              </button>
            </div>
          </div>
        )}

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

      {session && isSidebarOpen && (
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
