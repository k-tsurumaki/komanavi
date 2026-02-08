# セットアップ・デプロイ手順

> **注意**: このドキュメントは初回インフラ構築時の手順です（参考用）。
>
> **本番環境は既にデプロイ済みのため、以下の手順を実施する必要はありません。**
>
> 新規開発者がローカル開発環境をセットアップする場合は、[ローカル開発環境](#ローカル開発環境)セクションのみ参照してください。

---

## 前提条件（初回構築時）

- GCPプロジェクト: `zenn-ai-agent-hackathon-vol4`
- メインアプリ (komanavi) がデプロイ済み
- サービスアカウント: `komanavi-cloud-run@zenn-ai-agent-hackathon-vol4.iam.gserviceaccount.com`
- Firestore データベース (komanavi) が作成済み

---

## Firestore データ構造

### コレクション: `mangaJobs`

ジョブの永続化とステータス管理を行います。

```typescript
{
  // ドキュメントID: jobId (UUID)

  id: string;              // ジョブID（ドキュメントIDと同じ）
  status: "queued" | "processing" | "done" | "error";
  progress: number;        // 0-100

  userId?: string;         // Firebase Auth UID（認証済みユーザーのみ）
  clientId: string;        // クライアントIP（レート制限用）

  request: {               // 漫画生成リクエスト
    url: string;           // 元のURL
    title: string;         // タイトル
    summary: string;       // 要約
    keyPoints?: string[];  // キーポイント
  };

  result?: {               // 生成結果（完了時）
    title: string;
    panels: Array<{
      id: string;
      text: string;
    }>;
    imageUrls?: string[];  // 署名付きURLまたはBase64
    storageUrl?: string;   // gs://... 形式
    meta: {
      panelCount: number;
      generatedAt: string;
      sourceUrl: string;
      format: string;
      maxEdge: number;
      title: string;
    };
  };

  error?: string;          // エラーメッセージ
  errorCode?: "timeout" | "rate_limited" | "api_error" | "concurrent" | "validation_error";

  storageUrl?: string;     // Cloud Storage URL (gs://...)

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**例:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "done",
  "progress": 100,
  "userId": "abc123xyz",
  "clientId": "203.0.113.42",
  "request": {
    "url": "https://example.gov/procedure",
    "title": "児童手当の申請について",
    "summary": "児童手当は...",
    "keyPoints": ["申請期限", "必要書類"]
  },
  "result": {
    "title": "児童手当の申請について",
    "panels": [
      { "id": "panel-1", "text": "申請期限を確認しましょう" },
      { "id": "panel-2", "text": "必要書類を準備しましょう" }
    ],
    "imageUrls": ["https://storage.googleapis.com/...?Expires=..."],
    "storageUrl": "gs://komanavi-manga-images/users/abc123xyz/manga/1706140800000-550e8400.png",
    "meta": {
      "panelCount": 4,
      "generatedAt": "2025-01-25T10:00:00Z",
      "sourceUrl": "https://example.gov/procedure",
      "format": "png",
      "maxEdge": 1200,
      "title": "児童手当の申請について"
    }
  },
  "createdAt": "2025-01-25T10:00:00Z",
  "updatedAt": "2025-01-25T10:00:30Z"
}
```

### インデックス

以下のインデックスを作成してください（Firestore コンソールまたは `firestore.indexes.json`）:

```json
{
  "indexes": [
    {
      "collectionGroup": "mangaJobs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "mangaJobs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

### 1. Cloud Storage バケット作成（実施済み）

```bash
# バケット作成
gcloud storage buckets create gs://komanavi-manga-images \
  --project=zenn-ai-agent-hackathon-vol4 \
  --location=asia-northeast1 \
  --uniform-bucket-level-access

# ライフサイクルルール設定（90日削除）
cat > /tmp/lifecycle.json << 'EOF'
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 90}
      }
    ]
  }
}
EOF

gcloud storage buckets update gs://komanavi-manga-images \
  --lifecycle-file=/tmp/lifecycle.json

# CORS設定
cat > /tmp/cors.json << 'EOF'
[
  {
    "origin": ["http://localhost:3000","https://komanavi-worker-30981781876.asia-northeast1.run.app","https://komanavi-30981781876.asia-northeast1.run.app/"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Content-Length", "Content-Disposition", "Cache-Control"],
    "maxAgeSeconds": 3600
  }
]
EOF

gcloud storage buckets update gs://komanavi-manga-images \
  --cors-file=/tmp/cors.json
```

---

### 2. IAM 権限付与（実施済み）

```bash
export PROJECT_ID="zenn-ai-agent-hackathon-vol4"
export SERVICE_ACCOUNT="komanavi-cloud-run@${PROJECT_ID}.iam.gserviceaccount.com"

# Storage Object Admin
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/storage.objectAdmin"

# Service Account Token Creator（署名付きURL生成用）
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/iam.serviceAccountTokenCreator"

# Firestore User
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/datastore.user"

# Cloud Tasks Enqueuer
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudtasks.enqueuer"
```

---

### 3. Cloud Tasks セットアップ（実施済み）

### 3-1. API 有効化

```bash
gcloud services enable cloudtasks.googleapis.com \
  --project=${PROJECT_ID}
```

### 3-2. キュー作成

```bash
gcloud tasks queues create manga-generation \
  --location=asia-northeast1 \
  --max-dispatches-per-second=1 \
  --max-concurrent-dispatches=2 \
  --max-attempts=5 \
  --min-backoff=10s \
  --max-backoff=300s \
  --project=${PROJECT_ID}
```

**設定の説明:**
- `max-dispatches-per-second=1`: 秒間最大1タスク（Gemini API保護）
- `max-concurrent-dispatches=2`: 同時実行数2
- `max-attempts=5`: 最大5回リトライ
- `min-backoff=10s`, `max-backoff=300s`: リトライ間隔10秒〜5分

---

### 4. Worker サービスのデプロイ（実施済み）

### 4-1. ビルド

```bash
cd worker
npm ci
npm run build
```

### 4-2. デプロイ

デプロイスクリプトを使用:

```bash
./deploy.sh
```

または手動で:

```bash
gcloud run deploy komanavi-worker \
  --source . \
  --project ${PROJECT_ID} \
  --region asia-northeast1 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 5 \
  --no-allow-unauthenticated \
  --service-account ${SERVICE_ACCOUNT} \
  --set-env-vars "\
GCP_PROJECT_ID=${PROJECT_ID},\
GCP_LOCATION=global,\
FIREBASE_PROJECT_ID=${PROJECT_ID},\
FIREBASE_DATABASE_ID=komanavi,\
GCS_MANGA_BUCKET=komanavi-manga-images,\
GCS_SIGNED_URL_TTL_MINUTES=60"
```

### 4-3. Worker 呼び出し権限付与

```bash
gcloud run services add-iam-policy-binding komanavi-worker \
  --region=asia-northeast1 \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/run.invoker" \
  --project=${PROJECT_ID}
```

---

### 5. メインアプリの環境変数更新（実施済み）

### 5-1. Worker URL 取得

```bash
WORKER_URL=$(gcloud run services describe komanavi-worker \
  --project=${PROJECT_ID} \
  --region=asia-northeast1 \
  --format="value(status.url)")

echo "Worker URL: ${WORKER_URL}"
```

### 5-2. 環境変数更新

```bash
gcloud run services update komanavi \
  --region=asia-northeast1 \
  --update-env-vars "\
GCP_PROJECT_ID=${PROJECT_ID},\
GCP_LOCATION=global,\
GCS_MANGA_BUCKET=komanavi-manga-images,\
GCS_SIGNED_URL_TTL_MINUTES=60,\
CLOUD_TASKS_QUEUE=manga-generation,\
CLOUD_TASKS_LOCATION=asia-northeast1,\
CLOUD_RUN_SERVICE_ACCOUNT=${SERVICE_ACCOUNT},\
MANGA_WORKER_URL=${WORKER_URL}/process,\
FIREBASE_DATABASE_ID=komanavi" \
  --project=${PROJECT_ID}
```

---

### 6. 動作確認

### 6-1. Worker ヘルスチェック

```bash
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "${WORKER_URL}/health"
```

期待結果: `OK`

### 6-2. Cloud Tasks キュー確認

```bash
gcloud tasks queues describe manga-generation \
  --location=asia-northeast1 \
  --project=${PROJECT_ID}
```

### 6-3. 漫画生成テスト

1. アプリで漫画生成を実行
2. Cloud Tasksコンソールでタスクが処理されることを確認
3. Workerログで処理が実行されることを確認:
   ```bash
   gcloud run logs read komanavi-worker \
     --region=asia-northeast1 \
     --limit=50 \
     --project=${PROJECT_ID}
   ```
4. Firestoreで `mangaJobs` コレクションにジョブが作成されることを確認
5. Cloud Storageで `gs://komanavi-manga-images/users/` 配下に画像が保存されることを確認

---

## ローカル開発環境

> **新規開発者の方へ**: 本番環境は既にデプロイ済みです。
> 以下の手順で `.env.local` を設定するだけでローカル開発を開始できます。

### 最小構成（推奨）

```bash
# 1. 依存関係インストール
npm install

# 2. .env.local に以下を設定
```

`.env.local`:
```bash
# GCP
GCP_PROJECT_ID=zenn-ai-agent-hackathon-vol4
GCP_LOCATION=global

# Firebase
FIREBASE_PROJECT_ID=zenn-ai-agent-hackathon-vol4
FIREBASE_DATABASE_ID=komanavi

# Cloud Storage
GCS_MANGA_BUCKET=komanavi-manga-images
GCS_SIGNED_URL_TTL_MINUTES=60

# Cloud Tasks（本番Workerを使用）
CLOUD_TASKS_QUEUE=manga-generation
CLOUD_TASKS_LOCATION=asia-northeast1
CLOUD_RUN_SERVICE_ACCOUNT=komanavi-cloud-run@zenn-ai-agent-hackathon-vol4.iam.gserviceaccount.com
MANGA_WORKER_URL=https://komanavi-worker-30981781876.asia-northeast1.run.app/process

# Firebase Auth（クライアント）
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=zenn-ai-agent-hackathon-vol4

# Auth.js
AUTH_SECRET=your-auth-secret
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret
```

```bash
# 3. 開発サーバー起動
npm run dev
```

これで漫画生成を含むすべての機能が動作します（本番Workerを使用）。

---

### ADCセットアップ（Workerをローカル起動する場合のみ）

> **注意**: 通常は上記の最小構成で十分です。
> Workerのコードを修正する場合のみ以下が必要です。

#### 前提条件

- Node.js 20以上
- gcloud CLI インストール済み

#### サービスアカウント偽装

```bash
# 自分のアカウントにToken Creator権限を付与
gcloud iam service-accounts add-iam-policy-binding ${SERVICE_ACCOUNT} \
  --member="user:あなたのGoogleアカウント@gmail.com" \
  --role="roles/iam.serviceAccountTokenCreator"

# ADCでサービスアカウント偽装
gcloud auth application-default login \
  --impersonate-service-account=${SERVICE_ACCOUNT}
```

#### Worker をローカル起動する場合の環境変数

`.env.local` の `MANGA_WORKER_URL` をローカルWorkerに変更:

```bash
# 上記の最小構成から以下のみ変更
MANGA_WORKER_URL=http://localhost:8080/process
```

#### Worker ローカル起動

```bash
# ターミナル1: Worker起動
cd worker
npm run dev

# ターミナル2: メインアプリ起動
npm run dev
```

**注意**: ローカルWorker起動時は Cloud Tasks は使用されず、Worker に直接HTTPリクエストが送信されます。

---

## 初回インフラ構築手順（参考用）

> **注意**: 以下は既に実施済みです。新規開発者は実施不要です。

---

## トラブルシューティング

### 署名付きURL生成エラー

```
Error: Error occurred during signUrl process
```

**原因**: サービスアカウントに署名権限がない

**対処**:
```bash
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/iam.serviceAccountTokenCreator"
```

### Cloud Tasks認証エラー (403)

**原因**: Worker への呼び出し権限がない

**対処**:
```bash
gcloud run services add-iam-policy-binding komanavi-worker \
  --region=asia-northeast1 \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/run.invoker" \
  --project=${PROJECT_ID}
```

### タスクがリトライし続ける

**原因**: Worker がエラーを返している

**対処**:
1. Worker ログで詳細なエラーを確認
2. Gemini API のレート制限を確認
3. Firestore のジョブドキュメントでエラー内容を確認

### 環境変数が設定されていないエラー

```
Error: GCP_PROJECT_ID environment variable is required
```

**対処**: 上記「メインアプリの環境変数更新」を実行し、すべての必須環境変数が設定されていることを確認

---

## 関連ドキュメント

- [README.md](./README.md) - アーキテクチャと実装内容
- [../deploy/デプロイ手順書.md](../deploy/デプロイ手順書.md) - 全体デプロイ手順
