# Cloud Storage 漫画永続化 + 非同期処理

## 概要

漫画生成機能で生成した画像を Cloud Storage に保存し、署名付きURLで配信する機能。
Cloud Tasks + 専用 Worker サービスによる非同期処理で、メインアプリのレスポンスを高速化。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js App (Cloud Run: komanavi)                          │
│                                                              │
│  POST /api/manga                                             │
│    1. ユーザー認証（オプショナル）                            │
│    2. Firestore にジョブ作成 (mangaJobs/{jobId})             │
│    3. Cloud Tasks にタスクをエンキュー                        │
│    4. jobId を即座に返却（非同期処理開始）                    │
│                                                              │
│  GET /api/manga/[jobId]                                      │
│    - Firestore からジョブステータス取得                        │
│    - 完了時は署名付きURL返却                                   │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────┐
              │  Cloud Tasks    │
              │  manga-generation│  ← レート制限・リトライ制御
              └─────────────────┘
                         │ OIDC認証付きHTTPリクエスト
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Worker Service (Cloud Run: komanavi-worker)                 │
│                                                              │
│  POST /process                                               │
│    1. Gemini Pro Image API で漫画画像生成                     │
│    2. 認証済みユーザーの場合:                                  │
│       - Cloud Storage にアップロード                          │
│       - 署名付きURL生成                                       │
│    3. Firestore のジョブステータス更新                         │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
           ┌──────────────────────────┐
           │  Cloud Storage           │
           │  gs://komanavi-manga-    │
           │  images/users/{userId}/  │
           │  manga/{timestamp}.png   │
           └──────────────────────────┘
```

## 実装内容

### 1. Cloud Storage 連携

**ファイル**: `src/lib/cloud-storage.ts`, `worker/src/cloud-storage.ts`

- Base64画像を Cloud Storage にアップロード
- ユーザーIDごとにパスを分離 (`users/{userId}/manga/`)
- 署名付きURL生成（有効期限60分）
- メタデータ保存（source-url, title, generated-at）

### 2. Cloud Tasks 統合

**ファイル**: `src/lib/cloud-tasks.ts`

- タスクをキューにエンキュー
- OIDC認証によるセキュアな呼び出し
- レート制限とリトライ制御

### 3. Firestore ジョブ管理

**ファイル**: `src/lib/manga-job-store.ts`, `worker/src/firestore.ts`

- ジョブの永続化（`mangaJobs` コレクション）
- ステータス管理（queued → processing → done/error）
- 進捗状況の記録

### 4. Worker サービス

**ディレクトリ**: `worker/`

- Express ベースの専用サービス
- Gemini API 呼び出し
- Cloud Storage アップロード
- Firestore 更新
- エラーハンドリング・リトライ判定

### 5. API 変更

**変更ファイル**:
- `src/app/api/manga/route.ts` - インメモリ → Firestore + Cloud Tasks
- `src/app/api/manga/[jobId]/route.ts` - Firestore からジョブ取得

**削除ファイル**:
- `src/app/api/manga/state.ts` - インメモリ状態管理（不要）

### 6. フロントエンド対応

**ファイル**: `src/components/MangaViewer.tsx`

- Firebase IDトークン送信（認証済みユーザー）
- Cloud Storage URL対応
- ポーリング間隔2秒、タイムアウト10分

## ストレージ設計

### バケット構成

| 項目 | 値 |
|------|-----|
| バケット名 | `komanavi-manga-images` |
| リージョン | `asia-northeast1` |
| アクセス | 非公開（署名付きURLのみ） |
| ライフサイクル | 90日後自動削除 |

### オブジェクトパス

```
gs://komanavi-manga-images/
└── users/
    └── {userId}/              ← Firebase Auth UID
        └── manga/
            └── {timestamp}-{uuid}.png
```

### 署名付きURL

- **有効期限**: 60分
- **HTTPメソッド**: GET のみ
- **認証**: IAM signBlob API使用

## 認証フロー

- **認証済み**: Cloud Storage保存 → 署名付きURL返却
- **未認証**: Base64 Data URL返却（従来動作）

## 環境変数

### メインアプリ

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `GCP_PROJECT_ID` | GCPプロジェクトID | ✅ |
| `GCP_LOCATION` | Vertex AIロケーション | ✅ |
| `GCS_MANGA_BUCKET` | 漫画画像バケット名 | ✅ |
| `GCS_SIGNED_URL_TTL_MINUTES` | 署名付きURL有効期限 | ❌ (デフォルト: 60) |
| `CLOUD_TASKS_QUEUE` | Cloud Tasksキュー名 | ✅ |
| `CLOUD_TASKS_LOCATION` | Cloud Tasksリージョン | ✅ |
| `CLOUD_RUN_SERVICE_ACCOUNT` | サービスアカウントメール | ✅ |
| `MANGA_WORKER_URL` | Worker処理エンドポイント | ✅ |
| `FIREBASE_DATABASE_ID` | Firestoreデータベース名 | ✅ |

### Worker サービス

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `GCP_PROJECT_ID` | GCPプロジェクトID | ✅ |
| `GCP_LOCATION` | Vertex AIロケーション | ✅ |
| `FIREBASE_PROJECT_ID` | FirebaseプロジェクトID | ✅ |
| `FIREBASE_DATABASE_ID` | Firestoreデータベース名 | ✅ |
| `GCS_MANGA_BUCKET` | 漫画画像バケット名 | ✅ |
| `GCS_SIGNED_URL_TTL_MINUTES` | 署名付きURL有効期限 | ❌ (デフォルト: 60) |

## エラーハンドリング

### Cloud Storage アップロード失敗時

Base64 Data URLにフォールバック。ユーザー体験は損なわれず、画像は正常に表示される。

### Gemini API レート制限時

- Worker側で指数バックオフによるリトライ（最大3回）
- Cloud Tasksレベルでもリトライ制御
- Firestoreに `rate_limited` エラーを記録

### Cloud Tasks リトライ制御

- **最大試行回数**: 5回
- **バックオフ**: 10秒〜300秒（指数バックオフ）
- **レート制限**: 秒間最大1ディスパッチ、同時2実行

## セットアップ・デプロイ

詳細は [SETUP.md](./SETUP.md) を参照。
