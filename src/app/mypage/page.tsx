import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { FlowStartTracker } from './FlowStartTracker';
import { ProfileForm } from './ProfileForm';

type MyPageSearchParams = {
  flow?: string | string[];
  step?: string | string[];
};

type MyPageProps = {
  searchParams: Promise<MyPageSearchParams>;
};

function getSingleParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0] ?? null;
  }
  return null;
}

export default async function MyPage({ searchParams }: MyPageProps) {
  const session = await auth();
  const params = await searchParams;

  if (!session || !session.user) {
    redirect('/login');
  }

  const flow = getSingleParam(params.flow);
  const step = getSingleParam(params.step);
  const isCreationFlowStart = flow === 'create' && step === '1';

  return (
    <div className="ui-page ui-shell-gap">
      {isCreationFlowStart && <FlowStartTracker />}
      {isCreationFlowStart && (
        <section className="ui-card mb-5 border-stone-300/80 bg-stone-50 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-stone-600">
            マイページ作成フロー
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">まずは基本情報から</p>
            <span className="ui-badge">1 / 3</span>
          </div>
          <p className="mt-1.5 text-sm text-slate-600">後からいつでも編集できます。</p>
        </section>
      )}
      <header className="mb-6">
        <h1 className="ui-heading text-2xl sm:text-3xl">
          {isCreationFlowStart ? 'マイページ作成' : 'アカウント設定'}
        </h1>
        <p className="ui-muted mt-2 text-sm">
          {isCreationFlowStart
            ? '表示名などの基本情報を入力して、マイページの作成を開始しましょう。'
            : '漫画生成で使うプロフィールを必要な範囲で入力できます。'}
        </p>
      </header>
      <ProfileForm user={session.user} />
    </div>
  );
}
