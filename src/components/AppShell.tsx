'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AppSidebar } from '@/components/AppSidebar';
import { UserMenu } from '@/components/UserMenu';

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

  const handleSidebarOpen = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
      setIsSidebarVisible(true);
      return;
    }
    setIsSidebarOpen(true);
  };

  // ランディングページとログインページは独立レイアウト
  if (standaloneRoutes.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex text-slate-900">
      {session && (
        <AppSidebar
          className={isSidebarVisible ? 'hidden md:flex' : 'hidden'}
          showCloseButton={isSidebarVisible}
          onClose={() => setIsSidebarVisible(false)}
        />
      )}

      <div className="relative flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/88 backdrop-blur-xl">
          <div className="relative flex h-16 items-center px-3 sm:px-4">
            <div className="z-10 flex items-center">
              {session && (
                <div className={isSidebarVisible ? 'md:hidden' : ''}>
                  <button
                    type="button"
                    onClick={handleSidebarOpen}
                    className="ui-btn ui-btn-secondary h-12 w-12 p-0"
                    aria-label="サイドバーを開く"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-10 w-10 text-slate-500"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 6h16" />
                      <path d="M4 12h16" />
                      <path d="M4 18h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            <h1 className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold tracking-[0.16em] text-slate-700 sm:text-[0.85rem]">
              <Link href="/analyze" className="pointer-events-auto hover:text-slate-900">
                KOMANAVI
              </Link>
            </h1>

            <div className="z-10 ml-auto">
              <UserMenu />
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1 pb-6">
          {children}
        </main>
        <footer className="mt-auto border-t border-slate-200/70 bg-white/75">
          <div className="ui-page-wide py-3 text-center text-[0.72rem] text-slate-500">
            <p>
              ※ 本サービスは参考情報を提供するものであり、正確性を保証するものではありません。
              <span className="mx-1 hidden sm:inline">/</span>
              <span className="block sm:inline">正式な手続きの際は必ず公式情報をご確認ください。</span>
            </p>
          </div>
        </footer>
      </div>

      {session && isSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            aria-label="メニューを閉じる"
            onClick={() => setIsSidebarOpen(false)}
          />
          <AppSidebar
            className="absolute left-0 top-0 h-full w-80 max-w-[90vw] shadow-2xl"
            showCloseButton
            closeOnNavigate
            onClose={() => setIsSidebarOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
