import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー */}
      <header className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-xl font-bold text-gray-900">KOMANAVI</div>
          <Link
            href="/login"
            className="px-4 py-2 text-blue-600 hover:text-blue-800 font-medium"
          >
            ログイン
          </Link>
        </div>
      </header>

      {/* ヒーローセクション */}
      <section className="bg-gradient-to-b from-blue-50 to-white py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            行政情報を、わかりやすく
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-8">
            難しい行政ページをAIがシンプルに解説。
            <br className="hidden sm:inline" />
            必要な手続きが一目でわかります。
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-4 bg-blue-600 text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg !text-white hover:no-underline"
          >
            無料で始める
          </Link>
        </div>
      </section>

      {/* 課題提起 */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-10">
            行政ページ、読みにくいと感じたことはありませんか？
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">専門用語が多い</h3>
              <p className="text-gray-600">法律用語や行政特有の表現が多く、理解しづらい</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">情報が多すぎる</h3>
              <p className="text-gray-600">ページが長く、必要な情報がどこにあるかわからない</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">何をすればいいかわからない</h3>
              <p className="text-gray-600">手続きの手順や必要書類が複雑で混乱する</p>
            </div>
          </div>
        </div>
      </section>

      {/* 機能紹介 */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-4">
            KOMANAVIができること
          </h2>
          <p className="text-center text-gray-600 mb-10">
            AIがあなたの代わりに行政ページを読み解きます
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">わかりやすい要約</h3>
              <p className="text-gray-600">専門用語を避けた「やさしい日本語」で内容を要約します</p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">やることチェックリスト</h3>
              <p className="text-gray-600">手続きに必要なステップをリスト化。漏れなく準備できます</p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">漫画で解説</h3>
              <p className="text-gray-600">複雑な手続きも4コマ漫画でビジュアルに理解できます</p>
            </div>
          </div>
        </div>
      </section>

      {/* 使い方 */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-10">
            3ステップで簡単に使える
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                1
              </div>
              <h3 className="font-bold text-gray-900 mb-2">URLを入力</h3>
              <p className="text-gray-600">調べたい行政ページのURLをコピーして貼り付けます</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                2
              </div>
              <h3 className="font-bold text-gray-900 mb-2">AIが解析</h3>
              <p className="text-gray-600">AIがページの内容を読み取り、要点を抽出します</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                3
              </div>
              <h3 className="font-bold text-gray-900 mb-2">結果を確認</h3>
              <p className="text-gray-600">わかりやすい要約とやることリストを確認できます</p>
            </div>
          </div>
        </div>
      </section>

      {/* 対象ユーザー */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-4">
            こんな方におすすめ
          </h2>
          <p className="text-center text-gray-600 mb-10">
            行政手続きで困っているすべての方へ
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              'ひとり親の方',
              '高齢者の介護をしている方',
              '外国人住民の方',
              '災害被災者の方',
              '子育て中のパパママ',
              '引っ越してきた方',
              '転職・失業中の方',
            ].map((user) => (
              <span
                key={user}
                className="px-5 py-2 bg-blue-50 text-blue-700 rounded-full text-base border border-blue-200"
              >
                {user}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* フッターCTA */}
      <section className="py-16 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            行政手続きをもっとシンプルに
          </h2>
          <p className="text-blue-100 mb-8">
            KOMANAVIで行政ページの理解を簡単にしましょう
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-4 bg-white text-lg font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-lg !text-blue-600 hover:no-underline"
          >
            無料で始める
          </Link>
        </div>
      </section>

      {/* フッター */}
      <footer className="py-8 border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>&copy; 2026 KOMANAVI. 行政情報をわかりやすく。</p>
        </div>
      </footer>
    </div>
  );
}
