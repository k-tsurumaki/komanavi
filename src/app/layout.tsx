import type { Metadata } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import Link from 'next/link';
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
      <body className={`${notoSansJP.variable} font-sans antialiased bg-gray-50 text-gray-900`}>
        <div className="min-h-screen flex flex-col">
          <header className="bg-white border-b border-gray-200">
            <div className="max-w-4xl mx-auto px-4 py-4">
              <h1 className="text-xl font-bold text-blue-600">
                <Link href="/">KOMANAVI</Link>
              </h1>
            </div>
          </header>
          <main className="flex-1">{children}</main>
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
      </body>
    </html>
  );
}
