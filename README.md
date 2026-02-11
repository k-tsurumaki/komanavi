# KOMANAVI（コマナビ）

行政手続きページの URL から、行動に移しやすい情報を生成する Web アプリです。  
現在の実装では、要約・深掘り対話・意図ベース回答・チェックリスト・漫画生成・履歴管理・プロフィール連携までを含みます。

## 主な機能

- URL 解析: 行政ページを解析し、平易化サマリーを生成
- 深掘り対話: 解析結果について追加質問（`/api/analyze` の `deepDive` モード）
- 意図ベース回答: 「最終的に実現したいこと」を入力して回答とチェックリストを生成
- 漫画生成: Cloud Tasks + Worker で非同期生成し、Cloud Storage 経由で配信
- 履歴管理: 解析結果・中間表現・漫画結果を Firestore に保存
- パーソナライズ: Myページのプロフィールを回答と漫画生成に反映

## アーキテクチャ（実装準拠）

```text
Browser (Next.js UI)
  -> Next.js App Router API
      - /api/analyze (Gemini + Google Search Grounding)
      - /api/history, /api/history/[historyId] (Firestore)
      - /api/manga, /api/manga/[resultId] (ジョブ投入・状態取得)
      - /api/user/profile (プロフィール)
  -> Cloud Tasks
      -> Worker (Express /process)
          -> Gemini 画像生成
          -> Cloud Storage 保存
          -> Firestore ジョブ更新
```

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
