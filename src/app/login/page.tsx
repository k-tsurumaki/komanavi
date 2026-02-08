'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

type AuthMode = 'login' | 'register';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/analyze';

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn('google', { callbackUrl });
    } catch {
      setError('Googleログインに失敗しました');
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      let userCredential;
      if (mode === 'register') {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }

      const idToken = await userCredential.user.getIdToken();
      const result = await signIn('firebase', {
        idToken,
        redirect: false,
      });

      if (result?.error) {
        setError('認証に失敗しました');
      } else {
        router.push(callbackUrl);
      }
    } catch (err) {
      const errorMessage = getFirebaseErrorMessage(err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ui-card-float p-6 sm:p-8">
      <div className="mb-6 text-center">
        <span className="ui-kicker">Account</span>
        <h1 className="ui-heading mt-3 text-2xl">{mode === 'login' ? 'ログイン' : '新規登録'}</h1>
      </div>

      {error && <div className="ui-callout ui-callout-error mb-5">{error}</div>}

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="ui-btn ui-btn-secondary w-full py-3 text-sm disabled:opacity-60"
      >
        <GoogleIcon />
        Googleでログイン
      </button>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium uppercase tracking-[0.13em] text-slate-400">
          または
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={handleEmailLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-semibold text-slate-700">
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="ui-input"
            placeholder="example@mail.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-semibold text-slate-700">
            パスワード
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="ui-input"
            placeholder="6文字以上"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="ui-btn ui-btn-primary w-full py-3 text-sm !text-white"
        >
          {isLoading ? '処理中...' : mode === 'login' ? 'ログイン' : 'アカウントを作成'}
        </button>
      </form>

      <div className="mt-5 text-center text-sm text-slate-600">
        {mode === 'login' ? (
          <p>
            アカウントをお持ちでない方は{' '}
            <button
              type="button"
              onClick={() => setMode('register')}
              className="font-semibold text-stone-700 hover:text-stone-800"
            >
              新規登録
            </button>
          </p>
        ) : (
          <p>
            すでにアカウントをお持ちの方は{' '}
            <button
              type="button"
              onClick={() => setMode('login')}
              className="font-semibold text-stone-700 hover:text-stone-800"
            >
              ログイン
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="ui-card-float p-8">
      <div className="mx-auto mb-7 h-8 w-32 animate-pulse rounded-lg bg-slate-200" />
      <div className="mb-6 h-12 animate-pulse rounded-xl bg-slate-200" />
      <div className="space-y-4">
        <div className="h-11 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-11 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-11 animate-pulse rounded-xl bg-slate-200" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="ui-page max-w-lg py-12">
      <Suspense fallback={<LoginFormSkeleton />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9.003 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332A8.997 8.997 0 0 0 9.003 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.712A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.96A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.96 4.042l3.004-2.33z"
        fill="#FBBC05"
      />
      <path
        d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.428 0 9.002 0A8.997 8.997 0 0 0 .96 4.958L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z"
        fill="#EA4335"
      />
    </svg>
  );
}

function getFirebaseErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    switch (code) {
      case 'auth/email-already-in-use':
        return 'このメールアドレスは既に使用されています';
      case 'auth/invalid-email':
        return '無効なメールアドレスです';
      case 'auth/operation-not-allowed':
        return 'この認証方法は許可されていません';
      case 'auth/weak-password':
        return 'パスワードが弱すぎます（6文字以上必要）';
      case 'auth/user-disabled':
        return 'このアカウントは無効化されています';
      case 'auth/user-not-found':
        return 'アカウントが見つかりません';
      case 'auth/wrong-password':
        return 'パスワードが正しくありません';
      case 'auth/invalid-credential':
        return 'メールアドレスまたはパスワードが正しくありません';
      case 'auth/too-many-requests':
        return 'リクエストが多すぎます。しばらく待ってからお試しください';
      case 'auth/popup-closed-by-user':
        return 'ログインがキャンセルされました';
      default:
        return '認証エラーが発生しました';
    }
  }
  return 'エラーが発生しました';
}
