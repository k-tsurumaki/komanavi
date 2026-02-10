import type { Metadata } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import { AppShell } from '@/components/AppShell';
import { AuthProvider } from '@/components/AuthProvider';
import './globals.css';

const notoSansJP = Noto_Sans_JP({
  variable: '--font-noto-sans-jp',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'KOMANAVI - 行政情報をわかりやすく',
  description:
    '行政ドキュメントを分かりやすく要約し、チェックリストを生成します。児童手当、転入届、各種申請などの手続きをサポートします。',
  keywords: ['行政', '手続き', '要約', 'チェックリスト', '児童手当', '転入届'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.variable} font-sans antialiased`}>
        {/* スキップリンク（キーボードナビゲーション用） */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[80] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-slate-900 focus:text-white"
        >
          メインコンテンツへスキップ
        </a>

        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
