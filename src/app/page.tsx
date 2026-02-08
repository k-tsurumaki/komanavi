import Link from 'next/link';

const valueProps = [
  {
    title: '平易な要約',
    description: '専門用語をかみ砕き、行政ページの要点を短時間で把握できます。',
  },
  {
    title: '実行できるチェックリスト',
    description: '必要な準備をステップで整理し、漏れを防ぎます。',
  },
  {
    title: '漫画で再確認',
    description: '複雑な流れを視覚化して、理解を定着させます。',
  },
];

const useCases = [
  '児童手当',
  '転入・転出手続き',
  '介護保険',
  '国民健康保険',
  'パスポート申請',
  '各種届出',
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
              <p className="text-sm font-semibold text-slate-700">3ステップで利用可能</p>
              <ol className="space-y-3">
                <li className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <span className="ui-badge">1</span>
                  <p className="text-sm text-slate-700">行政ページのURLを入力</p>
                </li>
                <li className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <span className="ui-badge">2</span>
                  <p className="text-sm text-slate-700">AIが内容を解析して再整理</p>
                </li>
                <li className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <span className="ui-badge">3</span>
                  <p className="text-sm text-slate-700">要約と手順を確認して行動</p>
                </li>
              </ol>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {valueProps.map((value) => (
            <article key={value.title} className="ui-card p-5 sm:p-6">
              <h2 className="ui-heading text-lg">{value.title}</h2>
              <p className="ui-muted mt-2 text-sm">{value.description}</p>
            </article>
          ))}
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
