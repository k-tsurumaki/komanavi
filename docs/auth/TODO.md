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
- 未認証ユーザーの`/analyze`, `/history`, `/result`アクセス時にログインリダイレクト設定
- GCPコンソールでリダイレクトURI追加（redirect_uri_mismatchエラー修正）
- ランディングページ作成 `src/app/page.tsx`（公開ページ）
- URL入力ページを `/analyze` に移動 `src/app/analyze/page.tsx`
- AppShellでランディングページ・ログインページを独立レイアウト化
- ログイン後のリダイレクト先を `/analyze` に変更
- 各ページのリンクを `/analyze` に修正（result, history, AppSidebar）

# TODO

> 最終更新: 2026-01-24

## 高優先度

- [x] ログインボタンのデザインを修正
- [x] ログイン画面にも履歴が表示されるバグを修正
- [x] ランディングページを作成する

## 中優先度

- [ ] Phase 3: Firestoreヘルパー関数の実装
- [ ] Phase 3: ユーザープロファイルCRUD
- [ ] Phase 3: 会話履歴の永続化

## 低優先度

- [ ] Phase 4: ユーザー属性入力フォーム
- [ ] Phase 4: パーソナライズ漫画生成フロー
