import { auth } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { redirect } from 'next/navigation';
import { FlowStartTracker } from './FlowStartTracker';
import { ProfileForm } from './ProfileForm';

type TimestampLike = {
  toDate: () => Date;
};

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

function hasProfileStringValue(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasBirthDateValue(value: unknown): boolean {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  if (typeof value === 'string') {
    if (value.trim().length === 0) {
      return false;
    }
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime());
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    const parsed = (value as TimestampLike).toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime());
  }

  return false;
}

async function isMypageCompleted(userId: string): Promise<boolean> {
  const db = getAdminFirestore();
  const docSnap = await db.collection('users').doc(userId).get();

  if (!docSnap.exists) {
    return false;
  }

  const data = docSnap.data();
  if (!data) {
    return false;
  }

  return (
    hasProfileStringValue(data.displayName) &&
    hasBirthDateValue(data.birthDate) &&
    hasProfileStringValue(data.gender) &&
    hasProfileStringValue(data.occupation) &&
    hasProfileStringValue(data.nationality) &&
    hasProfileStringValue(data.location) &&
    hasProfileStringValue(data.visualTraits) &&
    hasProfileStringValue(data.personality)
  );
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
  let hasCompletedProfile = false;

  try {
    hasCompletedProfile = await isMypageCompleted(session.user.id);
  } catch (error) {
    console.error('Failed to resolve mypage completion status:', error);
  }

  const shouldShowCreationFlow = !hasCompletedProfile;
  const shouldUseCreationHeading = shouldShowCreationFlow;

  return (
    <div className="ui-page ui-shell-gap">
      {isCreationFlowStart && <FlowStartTracker />}
      {shouldShowCreationFlow && (
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
