import { auth } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { hasMypageStarted } from '@/lib/mypage-profile';
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

async function hasStartedMypage(userId: string): Promise<boolean> {
  const db = getAdminFirestore();
  const docSnap = await db.collection('users').doc(userId).get();

  if (!docSnap.exists) {
    return false;
  }

  const data = docSnap.data();
  if (!data) {
    return false;
  }

  return hasMypageStarted(data);
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
  let hasStartedProfile = false;

  try {
    hasStartedProfile = await hasStartedMypage(session.user.id);
  } catch (error) {
    console.error('Failed to resolve mypage started status:', error);
  }

  const shouldShowCreationFlow = !hasStartedProfile;
  const shouldUseCreationHeading = shouldShowCreationFlow;

  return (
    <div className="ui-page ui-shell-gap">
      {isCreationFlowStart && <FlowStartTracker />}
      {shouldShowCreationFlow && (
        <section className="ui-card mb-5 border-stone-300/80 bg-stone-50 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-stone-600">
            マイページ作成ガイド
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">まずは1項目だけ入力して開始</p>
          <p className="mt-1.5 text-sm text-slate-600">
            すべての項目は任意です。後からいつでも編集できます。
          </p>
        </section>
      )}
      <header className="mb-6">
        <h1 className="ui-heading text-2xl sm:text-3xl">
          {shouldUseCreationHeading ? 'マイページ作成' : 'アカウント設定'}
        </h1>
        <p className="ui-muted mt-2 text-sm">
          {shouldUseCreationHeading
            ? '表示名などの基本情報を入力して、マイページの作成を開始しましょう。'
            : '漫画生成で使うプロフィールを必要な範囲で入力できます。'}
        </p>
      </header>
      <ProfileForm user={session.user} />
    </div>
  );
}
