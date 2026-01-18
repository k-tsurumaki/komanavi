# 行ったこと

- Firebase SDK初期化（クライアント用）`src/lib/firebase.ts`
- Firebase Admin SDK初期化（サーバー用）`src/lib/firebase-admin.ts`
- Auth.js設定 `src/lib/auth.ts`, `src/lib/auth.config.ts`
- Auth.js APIルートハンドラー `src/app/api/auth/[...nextauth]/route.ts`
- ログイン/登録ページ作成 `src/app/login/page.tsx`
- SessionProviderラッパー `src/components/AuthProvider.tsx`
- ヘッダーのユーザーメニュー `src/components/UserMenu.tsx`
- 認証ミドルウェア `src/middleware.ts`
- layoutにAuthProvider追加
- AppShellにUserMenu追加
- next.config.tsに外部画像ホスト許可追加
- 環境変数設定（.env.local, .env.example）
- Auth.js型拡張 `src/lib/types/auth.d.ts`
- 未認証ユーザーの`/`, `/history`, `/result`アクセス時にログインリダイレクト設定

# TODO

> 最終更新: 2026-01-18

## 高優先度

- [ ] ログイン時にGoogleアカウントによる認証を選ぶとエラー`400: redirect_uri_mismatch`が出るバグを修正
  - GCPコンソールで以下のリダイレクトURIを追加: `http://localhost:3000/api/auth/callback/google`

## 中優先度

- [ ] Phase 3: Firestoreヘルパー関数の実装
- [ ] Phase 3: ユーザープロファイルCRUD
- [ ] Phase 3: 会話履歴の永続化

## 低優先度

- [ ] Phase 4: ユーザー属性入力フォーム
- [ ] Phase 4: パーソナライズ漫画生成フロー

## 完了

- [x] 未認証のアカウントが`/`にアクセスしようとするとログイン画面にリダイレクトされるように修正
