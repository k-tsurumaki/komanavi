import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ProfileForm } from './ProfileForm';

export default async function MyPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect('/login');
  }

  return (
    <div className="ui-page ui-shell-gap">
      <header className="mb-6">
        <span className="ui-kicker">Profile</span>
        <h1 className="ui-heading mt-3 text-2xl sm:text-3xl">アカウント設定</h1>
        <p className="ui-muted mt-2 text-sm">漫画生成で使うプロフィールを必要な範囲で入力できます。</p>
      </header>
      <ProfileForm user={session.user} />
    </div>
  );
}
