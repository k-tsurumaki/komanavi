'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AppSidebar } from '@/components/AppSidebar';
import { UserMenu } from '@/components/UserMenu';
import { useAnalyzeStore } from '@/stores/analyzeStore';

type AppShellProps = {
  children: React.ReactNode;
};

// AppShellを使用しないルート（独立レイアウト）
const standaloneRoutes = ['/', '/login'];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const resetAnalyze = useAnalyzeStore((state) => state.reset);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const showQuickAnalyzeButton = pathname === '/result' && !isSidebarOpen;
  const shouldHideQuickAnalyzeOnDesktop = Boolean(session && isSidebarVisible);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleMediaQueryChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsSidebarOpen(false);
      }
    };

    mediaQuery.addEventListener('change', handleMediaQueryChange);
    return () => {
      mediaQuery.removeEventListener('change', handleMediaQueryChange);
    };
  }, []);

  const handleSidebarOpen = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
      setIsSidebarVisible(true);
      setIsSidebarOpen(false);
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
            <div className="z-10 flex items-center gap-2">
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
              {showQuickAnalyzeButton && (
                <Link
                  href="/analyze"
                  onClick={() => {
                    resetAnalyze();
                  }}
                  className={`ui-btn ui-btn-secondary h-12 w-12 p-0 ${shouldHideQuickAnalyzeOnDesktop ? 'md:!hidden' : ''}`}
                  aria-label="新しいURLを解析"
                  title="新しいURLを解析"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-10 w-10 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 4H6.8C5.81 4 5 4.81 5 5.8v11.4C5 18.19 5.81 19 6.8 19h11.4c0.99 0 1.8-.81 1.8-1.8V15" />
                    <path d="M15.1 5.9 18.1 8.9" />
                    <path d="m10 14 1 .1c.3 0 .6-.1.8-.3l6.6-6.6a1.3 1.3 0 0 0 0-1.8l-.8-.8a1.3 1.3 0 0 0-1.8 0l-6.6 6.6c-.2.2-.3.5-.3.8z" />
                  </svg>
                </Link>
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
              <span className="block sm:inline">
                正式な手続きの際は必ず公式情報をご確認ください。
              </span>
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
