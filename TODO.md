# KOMANAVI Phase 1 (MVP) TODO

## 決定事項
- **ORM**: Prisma
- **ホスティング**: Vercel（無料版）
- **データベース/キャッシュ**: MVPではなし（ローカル開発のみ）
- **LLM**: Gemini API（Google AI Hackathonのため）※当面はモックデータで開発
- **対象サイト**: 汎用対応（特定サイトに依存しない実装）
- **優先順位**: コア機能優先（URL入力→解析→要約表示の基本フロー）

---

## Step 1: プロジェクト基盤

### 1.1 プロジェクトセットアップ
- [x] Next.js プロジェクトの初期化 (App Router, TypeScript)
- [x] Tailwind CSS のセットアップ
- [x] ESLint の設定
- [ ] Prettier の設定
- [ ] 環境変数の設定 (.env.local)

### 1.2 基本レイアウト
- [ ] app/layout.tsx の作成
- [ ] フォント設定（Noto Sans JP）
- [ ] グローバルスタイル設定

---

## Step 2: UI実装（モックデータで動作確認）

### 2.1 型定義・モックデータ
- [ ] 中間表現の型定義 (lib/types/intermediate.ts)
- [ ] モックデータの作成 (lib/mocks/sampleData.ts)

### 2.2 トップページ
- [ ] app/page.tsx - URL入力フォーム
- [ ] components/UrlInput.tsx

### 2.3 結果表示ページ
- [ ] app/result/page.tsx
- [ ] components/SummaryViewer.tsx - 要約表示
- [ ] components/ChecklistViewer.tsx - チェックリスト表示
- [ ] components/SourceReference.tsx - 根拠表示リンク
- [ ] components/DisclaimerBanner.tsx - 免責表示

### 2.4 状態管理
- [ ] Zustand インストール
- [ ] stores/analyzeStore.ts

---

## Step 3: バックエンド実装

### 3.1 スクレイピング機能
- [ ] cheerio インストール
- [ ] lib/scraper.ts - HTML取得・解析

### 3.2 Gemini API連携
- [ ] @google/generative-ai インストール
- [ ] lib/gemini.ts - クライアント設定
- [ ] 中間表現生成プロンプト
- [ ] 要約生成プロンプト

### 3.3 API Routes
- [ ] app/api/analyze/route.ts - URL解析・要約生成
- [ ] app/api/mock/result/route.ts - モックデータ返却（開発用）

### 3.4 キャッシュ
- [ ] lib/cache.ts - インメモリキャッシュ

---

## Step 4: 仕上げ

### 4.1 信頼性担保機能
- [ ] 免責同意モーダル（初回表示）
- [ ] 原文リンクの常時表示
- [ ] 情報取得日時の表示
- [ ] 根拠表示機能

### 4.2 アクセシビリティ・UX
- [ ] 大きな文字サイズ対応（18px+）
- [ ] 高コントラストカラー
- [ ] レスポンシブデザイン
- [ ] ローディング状態のフィードバック

### 4.3 テスト・動作確認
- [ ] ローカル開発サーバーでの動作確認
- [ ] モックデータでUI表示確認
- [ ] 実際の行政サイトURLでスクレイピング動作確認
- [ ] Gemini API連携後、実際の要約生成確認
- [ ] モバイル表示確認

---

## ファイル構成

```
komanavi/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── result/
│   │   │   └── page.tsx
│   │   └── api/
│   │       ├── analyze/
│   │       │   └── route.ts
│   │       └── mock/
│   │           └── result/
│   │               └── route.ts
│   ├── components/
│   │   ├── UrlInput.tsx
│   │   ├── SummaryViewer.tsx
│   │   ├── ChecklistViewer.tsx
│   │   ├── SourceReference.tsx
│   │   └── DisclaimerBanner.tsx
│   ├── lib/
│   │   ├── types/
│   │   │   └── intermediate.ts
│   │   ├── mocks/
│   │   │   └── sampleData.ts
│   │   ├── scraper.ts
│   │   ├── gemini.ts
│   │   └── cache.ts
│   └── stores/
│       └── analyzeStore.ts
├── public/
├── .env.local
└── ...
```
