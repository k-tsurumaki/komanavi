# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KOMANAVI (コマナビ) は行政ドキュメントを簡素化するアプリケーション。行政ページのURLを入力すると、わかりやすい要約、チェックリスト、漫画形式の視覚的説明を生成する。

## Development Commands

```bash
npm run dev       # 開発サーバー起動
npm run build     # 本番ビルド
npm run lint      # ESLint実行
npm run format    # Prettier整形
npm run format:check  # フォーマットチェック
```

## Architecture

### データフロー

```
URL入力 → scraper.ts（スクレイピング）
       → gemini.ts（Vertex AI解析）
       → IntermediateRepresentation（中間表現JSON）
       → 要約・チェックリスト生成
       → クライアント表示
```

### ディレクトリ構造

```
src/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts   # メイン解析API（POST /api/analyze）
│   │   └── manga/             # 漫画生成API（Phase 2）
│   │       ├── route.ts       # POST /api/manga（ジョブ作成）
│   │       └── [jobId]/route.ts  # GET /api/manga/[jobId]（ステータス取得）
│   ├── page.tsx               # トップページ（URL入力）
│   ├── result/page.tsx        # 結果表示ページ
│   └── history/page.tsx       # 履歴ページ
├── components/                # UIコンポーネント
├── lib/
│   ├── scraper.ts            # Webスクレイピング（Cheerio使用）
│   ├── gemini.ts             # Vertex AI（Gemini）連携
│   ├── storage.ts            # ローカルストレージ操作
│   └── types/intermediate.ts  # 型定義（中間表現、API型）
└── stores/
    └── analyzeStore.ts       # Zustand状態管理
```

### 主要な型定義（`src/lib/types/intermediate.ts`）

- `IntermediateRepresentation`: 中間表現（title, summary, documentType, target, procedure, benefits, sources等）
- `AnalyzeResult`: 解析結果（intermediate, checklist, generatedSummary）
- `ChecklistItem`: チェックリスト項目
- `MangaResult`, `MangaJobStatus`: 漫画生成関連

### API仕様

**POST /api/analyze**
- リクエスト: `{ url: string }`
- レスポンス: `AnalyzeResult`
- インメモリキャッシュ（24時間TTL）

**POST /api/manga** / **GET /api/manga/[jobId]**
- 非同期ジョブキュー方式
- Gemini 3 Pro Imageで4コマ漫画生成

### 外部サービス

- **Vertex AI (Gemini)**: `gemini-3-flash-preview`（解析）、`gemini-3-pro-image-preview`（漫画）
- **Cloud Run**: 本番デプロイ先
- 環境変数: `GCP_PROJECT_ID`, `GCP_LOCATION`

## Development Workflow

各タスク完了後:
1. `npm run lint` でリントエラーがないことを確認
2. `npm run build` でビルドが成功することを確認
3. 適切な粒度でコミットを作成

## Key Design Principles

- 原文への根拠参照を常に表示（`sources`フィールド）
- 免責事項を表示（参考情報であることを明示）
- 「やさしい日本語」を使用（専門用語を避ける、短文で）
- アクセシビリティ（WCAG 2.1 Level AA、18px以上のフォント）

## Target Users

1. **高優先**: ひとり親、高齢者介護者、外国人住民、災害被災者
2. **中優先**: 新米パパママ、転入者、失業者
3. **一般**: 一般市民

## Language

主言語は日本語。コメントとドキュメントも日本語で可。
