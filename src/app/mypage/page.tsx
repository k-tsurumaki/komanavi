import { auth } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import {
  getEmptyMypageProfileFormValues,
  hasMypageStarted,
  toMypageProfileFormValues,
  type MypageProfileFormValues,
} from '@/lib/mypage-profile';
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

type MypageBootstrap = {
  hasStartedProfile: boolean;
  initialProfile: MypageProfileFormValues;
};

async function getMypageBootstrap(userId: string): Promise<MypageBootstrap> {
  const db = getAdminFirestore();
  const docSnap = await db.collection('users').doc(userId).get();

  if (!docSnap.exists) {
    return {
      hasStartedProfile: false,
      initialProfile: getEmptyMypageProfileFormValues(),
    };
  }

  const data = docSnap.data();
  if (!data) {
    return {
      hasStartedProfile: false,
      initialProfile: getEmptyMypageProfileFormValues(),
    };
  }

  return {
    hasStartedProfile: hasMypageStarted(data),
    initialProfile: toMypageProfileFormValues(data),
  };
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
  let initialProfile = getEmptyMypageProfileFormValues();
  let hasBootstrapError = false;

  try {
    const bootstrap = await getMypageBootstrap(session.user.id);
    hasStartedProfile = bootstrap.hasStartedProfile;
    initialProfile = bootstrap.initialProfile;
  } catch (error) {
    hasBootstrapError = true;
    console.error('Failed to resolve mypage started status:', error);
  }

  const shouldShowCreationFlow = !hasStartedProfile;
  const shouldUseCreationHeading = shouldShowCreationFlow;

  return (
    <div className="ui-page ui-shell-gap">
      {isCreationFlowStart && <FlowStartTracker />}
      {shouldShowCreationFlow && (
        <section className="ui-card mb-5 border-stone-300/80 bg-stone-50 p-4 sm:p-5">
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-stone-200 text-stone-700"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="5" y="3" width="14" height="18" rx="2" ry="2" />
                <path d="M9 7h6" />
                <path d="m9 13 2 2 4-4" />
              </svg>
            </span>
            まずは1項目だけ入力して保存
          </p>
          <p className="mt-1.5 text-sm text-slate-600">
            すべての項目は任意です。後からいつでも編集できます。
          </p>
        </section>
      )}
      <header className="mb-6">
        <h1 className="ui-heading text-2xl sm:text-3xl">
          {shouldUseCreationHeading ? 'マイページ設定' : 'アカウント設定'}
        </h1>
        <p className="ui-muted mt-2 text-sm">
          {shouldUseCreationHeading
            ? '必要な項目だけ入力して保存してください。回答やチェックリストがあなた向けに最適化されます。'
            : '漫画生成で使うプロフィールを必要な範囲で入力できます。'}
        </p>
      </header>
      <ProfileForm
        user={session.user}
        initialProfile={initialProfile}
        hasBootstrapError={hasBootstrapError}
      />
    </div>
  );
}
