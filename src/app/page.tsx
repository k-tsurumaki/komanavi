import Link from 'next/link';

const useCases = [
  '児童手当',
  '転入・転出手続き',
  '介護保険',
  '国民健康保険',
  'パスポート申請',
  '各種届出',
];

const onboardingSteps = [
  '行政ページのURLを入力して解析',
  '1分でわかる要点ガイドで全体像を確認',
  '必要に応じて深掘りする（任意）',
  '意図を入力して、求める条件を明確化',
  'まずは漫画で全体像をつかむ',
  'あなた向けの回答を確認',
  'チェックリストで次の行動を整理',
];

export default function LandingPage() {
  return (
    <div className="min-h-screen pb-12">
      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="ui-page-wide flex h-16 items-center justify-between">
          <div className="text-sm font-semibold tracking-[0.16em] text-slate-700">KOMANAVI</div>
          <Link href="/login" className="ui-btn ui-btn-secondary text-sm">
            ログイン
          </Link>
        </div>
      </header>

      <main className="ui-page-wide space-y-10 pt-8 sm:pt-10">
        <section className="ui-card-float animate-fade-up overflow-hidden p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.25fr_0.95fr] lg:items-center">
            <div>
              <h1 className="ui-heading text-3xl leading-tight sm:text-4xl">
                必要な手続きを、
                <br />
                迷わず進めるための
                <br />
                AIアシスタント
              </h1>
              <p className="ui-muted mt-4 max-w-2xl text-sm sm:text-base">
                URLを入力すると、要約・チェックリスト・漫画の3つで情報を再構成。
                <br />
                読みにくい行政情報を、行動できる形に変換します。
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/login" className="ui-btn ui-btn-primary px-6 py-3 text-sm !text-white">
                  無料で始める
                </Link>
                <Link href="/analyze" className="ui-btn ui-btn-secondary px-6 py-3 text-sm">
                  解析画面を見る
                </Link>
              </div>
            </div>

            <div className="ui-card-soft space-y-4 p-5 sm:p-6">
              <p className="text-sm font-semibold text-slate-700">7ステップで、あなたの希望をかたちに</p>
              <ol className="space-y-3">
                {onboardingSteps.map((step, index) => (
                  <li key={step} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
                    <span className="ui-badge">{index + 1}</span>
                    <p className="text-sm text-slate-700">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="ui-card p-6 sm:p-7">
          <h2 className="ui-heading text-lg">よく使われる手続き</h2>
          <p className="ui-subtle mt-2 text-sm">次のような行政情報での利用が増えています。</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {useCases.map((item) => (
              <span key={item} className="ui-chip">
                {item}
              </span>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
