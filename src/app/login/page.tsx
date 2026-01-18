"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

type AuthMode = "login" | "register";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Googleログイン（Auth.js経由）
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("google", { callbackUrl });
    } catch {
      setError("Googleログインに失敗しました");
      setIsLoading(false);
    }
  };

  // メール/パスワードログイン（Firebase経由 → Auth.js）
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      let userCredential;
      if (mode === "register") {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }

      // FirebaseのIDトークンを取得
      const idToken = await userCredential.user.getIdToken();

      // Auth.jsでセッションを作成
      const result = await signIn("firebase", {
        idToken,
        redirect: false,
      });

      if (result?.error) {
        setError("認証に失敗しました");
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h1 className="text-2xl font-bold text-center mb-8">
        {mode === "login" ? "ログイン" : "新規登録"}
      </h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Google ログインボタン */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <GoogleIcon />
        <span>Googleでログイン</span>
      </button>

      <div className="my-6 flex items-center">
        <div className="flex-1 border-t border-gray-300" />
        <span className="px-4 text-gray-500 text-sm">または</span>
        <div className="flex-1 border-t border-gray-300" />
      </div>

      {/* メール/パスワードフォーム */}
      <form onSubmit={handleEmailLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="example@mail.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            パスワード
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="6文字以上"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isLoading
            ? "処理中..."
            : mode === "login"
              ? "ログイン"
              : "アカウントを作成"}
        </button>
      </form>

      {/* モード切り替え */}
      <div className="mt-6 text-center">
        {mode === "login" ? (
          <p className="text-gray-600">
            アカウントをお持ちでない方は{" "}
            <button
              type="button"
              onClick={() => setMode("register")}
              className="text-blue-600 hover:underline font-medium"
            >
              新規登録
            </button>
          </p>
        ) : (
          <p className="text-gray-600">
            すでにアカウントをお持ちの方は{" "}
            <button
              type="button"
              onClick={() => setMode("login")}
              className="text-blue-600 hover:underline font-medium"
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div className="h-8 bg-gray-200 rounded w-32 mx-auto mb-8 animate-pulse" />
      <div className="h-12 bg-gray-200 rounded mb-6 animate-pulse" />
      <div className="space-y-4">
        <div className="h-12 bg-gray-200 rounded animate-pulse" />
        <div className="h-12 bg-gray-200 rounded animate-pulse" />
        <div className="h-12 bg-gray-200 rounded animate-pulse" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <Suspense fallback={<LoginFormSkeleton />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
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

// Firebase エラーメッセージの日本語化
function getFirebaseErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: string }).code;
    switch (code) {
      case "auth/email-already-in-use":
        return "このメールアドレスは既に使用されています";
      case "auth/invalid-email":
        return "無効なメールアドレスです";
      case "auth/operation-not-allowed":
        return "この認証方法は許可されていません";
      case "auth/weak-password":
        return "パスワードが弱すぎます（6文字以上必要）";
      case "auth/user-disabled":
        return "このアカウントは無効化されています";
      case "auth/user-not-found":
        return "アカウントが見つかりません";
      case "auth/wrong-password":
        return "パスワードが正しくありません";
      case "auth/invalid-credential":
        return "メールアドレスまたはパスワードが正しくありません";
      case "auth/too-many-requests":
        return "リクエストが多すぎます。しばらく待ってからお試しください";
      case "auth/popup-closed-by-user":
        return "ログインがキャンセルされました";
      default:
        return "認証エラーが発生しました";
    }
  }
  return "エラーが発生しました";
}
