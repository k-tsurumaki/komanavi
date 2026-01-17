# KOMANAVI Phase 1 (MVP) TODO

## 決定事項
- **ORM**: Prisma
- **ホスティング**: Vercel（無料版）
- **データベース/キャッシュ**: MVPではなし（ローカル開発のみ）
- **LLM**: Vertex AI経由 Gemini 2.5 Flash（quota_project_id: zenn-ai-agent-hackathon-vol4）
- **対象サイト**: 汎用対応（特定サイトに依存しない実装）
- **優先順位**: コア機能優先（URL入力→解析→要約表示の基本フロー）

---

## Step 1: プロジェクト基盤

### 1.1 プロジェクトセットアップ
- [x] Next.js プロジェクトの初期化 (App Router, TypeScript)
- [x] Tailwind CSS のセットアップ
- [x] ESLint の設定
- [x] Prettier の設定
- [ ] 環境変数の設定 (.env.local) - GOOGLE_CLOUD_PROJECT / GOOGLE_APPLICATION_CREDENTIALS など

### 1.2 基本レイアウト
- [x] app/layout.tsx の作成
- [x] フォント設定（Noto Sans JP）
- [x] グローバルスタイル設定

---

## Step 2: UI実装（モックデータで動作確認）

### 2.1 型定義・モックデータ
- [x] 中間表現の型定義 (lib/types/intermediate.ts)
- [x] モックデータの作成 (lib/mocks/sampleData.ts)

### 2.2 トップページ
- [x] app/page.tsx - URL入力フォーム
- [x] components/UrlInput.tsx

### 2.3 結果表示ページ
- [x] app/result/page.tsx
- [x] components/SummaryViewer.tsx - 要約表示
- [x] components/ChecklistViewer.tsx - チェックリスト表示
- [x] components/SourceReference.tsx - 根拠表示リンク
- [x] components/DisclaimerBanner.tsx - 免責表示

### 2.4 状態管理
- [x] Zustand インストール
- [x] stores/analyzeStore.ts

---

## Step 3: バックエンド実装

### 3.1 スクレイピング機能
- [x] cheerio インストール
- [x] lib/scraper.ts - HTML取得・解析

### 3.2 Gemini API連携（Vertex AI移行）
- [x] @google/generative-ai インストール（旧）
- [x] @google-cloud/vertexai インストール（移行先）
- [x] lib/gemini.ts - クライアント設定（旧）
- [x] lib/gemini.ts - Vertex AI対応に修正
- [x] 中間表現生成プロンプト
- [x] 要約生成プロンプト
- [ ] 環境変数設定（GOOGLE_CLOUD_PROJECT, GOOGLE_APPLICATION_CREDENTIALS等）

### 3.3 API Routes
- [x] app/api/analyze/route.ts - URL解析・要約生成（インメモリキャッシュ含む）

### 3.4 キャッシュ
- [x] lib/cache.ts - インメモリキャッシュ（API Route内に実装）

---

## Step 4: 仕上げ

### 4.1 信頼性担保機能
- [x] 免責同意モーダル（初回表示）
- [x] 原文リンクの常時表示（DisclaimerBanner）
- [x] 情報取得日時の表示（DisclaimerBanner）
- [x] 根拠表示機能（SourceReference）

### 4.2 アクセシビリティ・UX
- [x] 大きな文字サイズ対応（18px+）
- [x] 高コントラストカラー
- [x] レスポンシブデザイン
- [x] ローディング状態のフィードバック
- [x] スキップリンク（キーボードナビゲーション）
- [x] ARIA属性の適切な使用

### 4.3 テスト・動作確認
- [x] ローカル開発サーバーでの動作確認
- [x] モックデータでUI表示確認
- [x] 実際の行政サイトURLでスクレイピング動作確認（Vertex AIの認証設定後）
- [x] Vertex AI連携後、実際の要約生成確認（認証設定後）
- [ ] モバイル表示確認

---

## ファイル構成（実際）

```
komanavi/
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── result/
│   │   │   └── page.tsx
│   │   └── api/
│   │       └── analyze/
│   │           └── route.ts
│   ├── components/
│   │   ├── UrlInput.tsx
│   │   ├── SummaryViewer.tsx
│   │   ├── ChecklistViewer.tsx
│   │   ├── SourceReference.tsx
│   │   ├── DisclaimerBanner.tsx
│   │   └── DisclaimerModal.tsx
│   ├── lib/
│   │   ├── types/
│   │   │   └── intermediate.ts
│   │   ├── mocks/
│   │   │   └── sampleData.ts
│   │   ├── scraper.ts
│   │   └── gemini.ts
│   └── stores/
│       └── analyzeStore.ts
├── public/
├── .env.example
├── .env.local (要作成)
└── ...
```
