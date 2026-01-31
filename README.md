<div align="center">

# KOMANAVI（コマナビ）

**行政ドキュメントを、もっとわかりやすく。**

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Vertex AI](https://img.shields.io/badge/Vertex_AI-Gemini_3.0-4285F4?logo=googlecloud)](https://cloud.google.com/vertex-ai)

<br />

行政ページのURLを入力するだけで、**わかりやすい要約**・**チェックリスト**・**4コマ漫画**を自動生成

</div>

---

## Features

| 機能 | 説明 |
|------|------|
| **AI要約** | 行政文書を「やさしい日本語」で要約 |
| **チェックリスト** | 必要な手続き・書類を一覧化 |
| **4コマ漫画** | 手続きの流れを視覚的に説明 |
| **根拠表示** | 原文への参照リンクを常に表示 |
| **履歴管理** | 過去に解析した結果を保存・再表示 |

---

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Client    │────▶│   Next.js API   │────▶│   Vertex AI      │
│  (React)    │◀────│   Routes        │◀────│   Gemini 3.0     │
└─────────────┘     └─────────────────┘     └──────────────────┘
       │                    │
       ▼                    ▼
┌─────────────┐     ┌─────────────────┐
│ LocalStorage│     │  Firebase Auth  │
│  (履歴)     │     │  (認証)         │
└─────────────┘     └─────────────────┘
```

### Data Flow

```
URL入力 → scraper.ts（Cheerioでスクレイピング）
       → gemini.ts（Vertex AI Gemini 3.0 Flashで解析）
       → IntermediateRepresentation（中間表現JSON）
       → チェックリスト・要約生成
       → Zustand（analyzeStore）で状態管理
       → クライアント表示 + ローカルストレージに履歴保存
```

> アーキテクチャ図: [`docs/images/system_architecture.svg`](docs/images/system_architecture.svg)

---

## Tech Stack

| カテゴリ | 技術 |
|----------|------|
| **Frontend** | Next.js 16.1, React 19, Tailwind CSS 4 |
| **State Management** | Zustand |
| **AI/ML** | Vertex AI (Gemini 3.0 Flash / Pro Image) |
| **Authentication** | NextAuth v5 + Firebase Auth (Identity Platform) |
| **Scraping** | Cheerio |
| **Infrastructure** | Cloud Run (asia-northeast1) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- Google Cloud プロジェクト（Vertex AI API 有効化済み）
- Firebase プロジェクト（Identity Platform 有効化済み）

### Installation

```bash
# リポジトリをクローン
git clone https://github.com/k-tsurumaki/komanabi.git
cd komanabi

# 依存関係をインストール
npm install

# 環境変数を設定
cp .env.example .env.local
# .env.local を編集して必要な値を設定

# 開発サーバーを起動
npm run dev
```

### Development Commands

```bash
npm run dev           # 開発サーバー起動
npm run build         # 本番ビルド
npm run start         # 本番サーバー起動
npm run lint          # ESLint実行
npm run format        # Prettier整形
npm run format:check  # フォーマットチェック
```

---

## Environment Variables

<details>
<summary><b>必須環境変数一覧（クリックで展開）</b></summary>

| 変数名 | 説明 | 取得場所 |
|--------|------|----------|
| `GCP_PROJECT_ID` | Google Cloud プロジェクト ID | [Google Cloud Console](https://console.cloud.google.com/) |
| `GCP_LOCATION` | Vertex AI ロケーション | 固定値: `global`（previewモデル用） |
| `AUTH_SECRET` | Auth.js 署名用シークレット | `npx auth secret` で生成 |
| `AUTH_URL` | Auth.js ベース URL | ローカル: `http://localhost:3000` |
| `AUTH_GOOGLE_ID` | Google OAuth クライアント ID | GCP Console → APIとサービス → 認証情報 |
| `AUTH_GOOGLE_SECRET` | Google OAuth クライアントシークレット | 同上 |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web SDK API キー | Firebase Console |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth ドメイン | `{project-id}.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase プロジェクト ID | Firebase Console |
| `FIREBASE_PROJECT_ID` | Firebase Admin SDK 用 | Firebase Console |

</details>

---

## API Reference

### POST `/api/analyze`

行政ページを解析し、要約・チェックリストを生成

```json
// Request
{ "url": "https://example.gov.jp/procedure" }

// Response
{
  "intermediate": { ... },
  "checklist": [ ... ],
  "generatedSummary": "..."
}
```

### POST `/api/manga` / GET `/api/manga/[jobId]`

4コマ漫画を非同期生成（ジョブキュー方式）

---

## Design Principles

- **やさしい日本語** - 専門用語を避け、短文で表現
- **根拠の明示** - 原文への参照を常に表示
- **免責事項** - 参考情報であることを明示
- **アクセシビリティ** - WCAG 2.1 Level AA 準拠、18px以上のフォント

---

## Documentation

| ドキュメント | 説明 |
|-------------|------|
| [要件定義書](docs/要件定義書.md) | プロジェクトの要件定義 |
| [機能要件](docs/feature/機能要件.md) | 機能要件の詳細 |
| [認証機能設計書](docs/auth/認証機能設計書.md) | 認証システムの設計 |
| [デプロイ手順書](docs/deploy/デプロイ手順書.md) | Cloud Run へのデプロイ手順 |
| [テスト計画書](docs/テスト計画書.md) | テスト計画 |

---

## License

This project is licensed under the MIT License.

---

<div align="center">

**Built with Vertex AI Gemini 3.0**

</div>
