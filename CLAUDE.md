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

アーキテクチャ図: `docs/images/system_architecture.svg`

### データフロー

```
URL入力 → scraper.ts（Cheerioでスクレイピング）
       → gemini.ts（Vertex AI Gemini 3.0 Flashで解析）
       → IntermediateRepresentation（中間表現JSON）
       → チェックリスト・要約生成
       → Zustand（analyzeStore）で状態管理
       → クライアント表示 + ローカルストレージに履歴保存
```

### 主要コンポーネント

| ファイル | 役割 |
|---------|------|
| `src/lib/scraper.ts` | Cheerioを使用したWebスクレイピング |
| `src/lib/gemini.ts` | Vertex AI（Gemini）連携。`@google/genai`を使用 |
| `src/lib/types/intermediate.ts` | 全型定義（中間表現、API型、漫画関連） |
| `src/stores/analyzeStore.ts` | Zustand状態管理（解析結果、チェックリスト状態） |
| `src/lib/storage.ts` | ローカルストレージ操作（履歴保存） |

### 認証システム

- **NextAuth + Firebase Auth**: Google OAuth + メール/パスワード認証
- `src/lib/auth.ts`: NextAuth設定（Credentialsプロバイダー、Firebase IDトークン検証）
- `src/lib/firebase.ts`: クライアント側Firebase SDK
- `src/lib/firebase-admin.ts`: サーバー側Firebase Admin SDK

### API仕様

**POST /api/analyze**
- リクエスト: `{ url: string }`
- レスポンス: `AnalyzeResult`（intermediate, checklist, generatedSummary）
- インメモリキャッシュ（24時間TTL）

**POST /api/manga** / **GET /api/manga/[jobId]**
- 非同期ジョブキュー方式
- Gemini 3.0 Pro Imageで4コマ漫画生成

### 外部サービス

- **Vertex AI**: `gemini-3-flash-preview`（解析）、`gemini-3-pro-image-preview`（漫画）
- **Firebase**: 認証（Identity Platform）
- **Cloud Run**: 本番デプロイ先（asia-northeast1）

### 環境変数

必須環境変数は `.env.local` で設定。詳細は `README.md` 参照。

| 変数名 | 用途 |
|--------|------|
| `GCP_PROJECT_ID` | Vertex AI呼び出し用 |
| `GCP_LOCATION` | Vertex AIロケーション（`global`） |
| `AUTH_SECRET` | NextAuth署名用 |
| `AUTH_GOOGLE_ID/SECRET` | Google OAuth |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase Web SDK（クライアント） |
| `FIREBASE_PROJECT_ID` | Firebase Admin SDK（サーバー） |

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
