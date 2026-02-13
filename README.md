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

## 主な機能

| 機能 | 説明 |
| --- | --- |
| **AI要約** | 行政文書を「やさしい日本語」で要約 |
| **チェックリスト** | 必要な手続き・書類を一覧化 |
| **4コマ漫画** | 手続きの流れを視覚的に説明 |
| **根拠表示** | 原文への参照リンクを常に表示 |
| **履歴管理** | 過去に解析した結果を保存・再表示 |

## アーキテクチャ
![`docs/images/system_architecture.svg`](docs/images/system_architecture.svg)

## 技術スタック

| 項目 | 技術 |
| --- | --- |
| App | Next.js 16.1.1, React 19.2, TypeScript |
| UI | Tailwind CSS 4 |
| Auth | NextAuth v5 + Google OAuth / Firebase Email-Password |
| AI | Google Gen AI SDK（Gemini 3 Flash Preview / Gemini 3 Pro Image Preview） |
| Data | Firestore |
| Async Job | Cloud Tasks + Worker（Express） |
| Storage | Cloud Storage（署名付き URL 配信） |

## クイックスタート

### 1. 前提

- Node.js 20+
- Firebase プロジェクト（Auth / Firestore）
- GCP プロジェクト（Vertex AI / Cloud Tasks / Cloud Storage）
- ローカル実行時は ADC（`gcloud auth application-default login` など）

### 2. アプリ起動

```bash
npm install
cp .env.example .env.local
# .env.local を編集
npm run dev
```

`http://localhost:3000` を開いて利用します。

### 3. Worker（漫画生成）をローカルで動かす場合

```bash
cd worker
npm install
npm run dev
```

## 主要な環境変数

詳細は `.env.example` を参照してください。ここでは実装上の主要項目のみ示します。

| 変数 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` ほか `NEXT_PUBLIC_FIREBASE_*` | Firebase クライアント SDK |
| `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_ID` | Firebase Admin SDK / Firestore |
| `AUTH_SECRET`, `AUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | NextAuth |
| `GCP_PROJECT_ID`, `GCP_LOCATION` | Worker / Storage / 一部 GCP SDK |
| `GCS_MANGA_BUCKET`, `GCS_SIGNED_URL_TTL_MINUTES` | 漫画画像保存と署名 URL |
| `CLOUD_TASKS_QUEUE`, `CLOUD_TASKS_LOCATION`, `CLOUD_RUN_SERVICE_ACCOUNT`, `MANGA_WORKER_URL` | 漫画生成ジョブ投入 |

> 注意: 現在 `src/lib/gemini.ts` は `PROJECT_ID` と `LOCATION` を固定値で参照しています。別プロジェクトで使う場合はこのファイルの値を調整してください。

## 開発コマンド

### App（ルート）

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run format
npm run format:check
```

### Worker（`worker/`）

```bash
npm run dev
npm run build
npm run start
```

## API エンドポイント（主要）

| Method | Path | 概要 |
| --- | --- | --- |
| `POST` | `/api/analyze` | URL 解析 / 深掘り / 意図回答 / チェックリスト再生成 |
| `GET` | `/api/history` | 履歴一覧取得 |
| `POST` | `/api/history` | 解析結果保存 |
| `GET` `PATCH` `DELETE` | `/api/history/[historyId]` | 履歴詳細取得・更新・削除 |
| `POST` | `/api/manga` | 漫画生成ジョブ投入（Cloud Tasks） |
| `GET` | `/api/manga/[resultId]` | 漫画ジョブ状態取得 |
| `GET` `PUT` | `/api/user/profile` | プロフィール取得・更新 |

## Firestore コレクション（主要）

- `users`
- `conversation_histories`
- `conversation_results`
- `conversation_intermediates`
- `conversation_manga`

## 関連ドキュメント

- `docs/architecture.md`
- `docs/deploy/デプロイ手順書.md`
- `docs/storage/README.md`
- `docs/auth/認証機能設計書.md`
