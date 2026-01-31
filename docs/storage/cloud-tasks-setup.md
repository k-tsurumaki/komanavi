# Cloud Tasks + Worker サービス セットアップ手順

## 概要

漫画生成の非同期処理を Cloud Tasks + 専用 Worker サービスで実行するための設定手順。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│  Cloud Run: komanavi (メインアプリ)                          │
│  POST /api/manga → Firestore作成 → Cloud Tasks enqueue      │
│  GET /api/manga/[jobId] → Firestore から取得                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Cloud Tasks    │
                    │  manga-generation│
                    └─────────────────┘
                              │ OIDC認証
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Cloud Run: komanavi-worker (Worker専用サービス)             │
│  POST /process                                               │
│    → Gemini Pro Image API                                    │
│    → Cloud Storage アップロード                               │
│    → Firestore 更新                                          │
└─────────────────────────────────────────────────────────────┘
```

## 前提条件

- メインアプリ (komanavi) がデプロイ済み
- Cloud Storage バケット (komanavi-manga-images) が作成済み
- Firestore データベース (komanavi) が作成済み

---

## Step 1: Cloud Tasks API 有効化

```bash
gcloud services enable cloudtasks.googleapis.com \
  --project=zenn-ai-agent-hackathon-vol4
```

## Step 2: Cloud Tasks キュー作成

```bash
gcloud tasks queues create manga-generation \
  --location=asia-northeast1 \
  --max-dispatches-per-second=1 \
  --max-concurrent-dispatches=2 \
  --max-attempts=5 \
  --min-backoff=10s \
  --max-backoff=300s \
  --project=zenn-ai-agent-hackathon-vol4
```

### キュー設定の説明

| 設定 | 値 | 説明 |
|------|-----|------|
| max-dispatches-per-second | 1 | 秒間最大ディスパッチ数（Gemini API保護） |
| max-concurrent-dispatches | 2 | 同時実行数（並列処理制限） |
| max-attempts | 5 | 最大リトライ回数 |
| min-backoff | 10s | 最小リトライ間隔 |
| max-backoff | 300s | 最大リトライ間隔（5分） |

## Step 3: IAM 権限付与

### 3-1. Cloud Tasks エンキュー権限

メインアプリがタスクをキューに追加できるようにする:

```bash
gcloud projects add-iam-policy-binding zenn-ai-agent-hackathon-vol4 \
  --member="serviceAccount:komanavi-cloud-run@zenn-ai-agent-hackathon-vol4.iam.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"
```

### 3-2. Firestore 権限（未設定の場合）

```bash
gcloud projects add-iam-policy-binding zenn-ai-agent-hackathon-vol4 \
  --member="serviceAccount:komanavi-cloud-run@zenn-ai-agent-hackathon-vol4.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

## Step 4: Worker サービスのデプロイ

```bash
cd worker
./deploy.sh
```

または手動で:

```bash
cd worker
npm ci
npm run build

gcloud run deploy komanavi-worker \
  --source . \
  --project zenn-ai-agent-hackathon-vol4 \
  --region asia-northeast1 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 5 \
  --no-allow-unauthenticated \
  --service-account komanavi-cloud-run@zenn-ai-agent-hackathon-vol4.iam.gserviceaccount.com \
  --set-env-vars "GCP_PROJECT_ID=zenn-ai-agent-hackathon-vol4,GCP_LOCATION=global,FIREBASE_PROJECT_ID=zenn-ai-agent-hackathon-vol4"
```

### Worker サービス設定

| 項目 | 値 |
|------|-----|
| サービス名 | `komanavi-worker` |
| リージョン | `asia-northeast1` |
| メモリ | 512MB |
| CPU | 1 |
| タイムアウト | 300秒（5分） |
| 最小インスタンス | 0 |
| 最大インスタンス | 5 |
| 認証 | 必須（OIDC） |

## Step 5: Worker 呼び出し権限の付与

Cloud Tasks から Worker を呼び出せるようにする:

```bash
# Worker サービスの URL を取得
WORKER_URL=$(gcloud run services describe komanavi-worker \
  --project=zenn-ai-agent-hackathon-vol4 \
  --region=asia-northeast1 \
  --format="value(status.url)")

echo "Worker URL: ${WORKER_URL}"

# 呼び出し権限を付与
gcloud run services add-iam-policy-binding komanavi-worker \
  --region=asia-northeast1 \
  --member="serviceAccount:komanavi-cloud-run@zenn-ai-agent-hackathon-vol4.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=zenn-ai-agent-hackathon-vol4
```

## Step 6: メインアプリの環境変数更新

Worker の URL を使用してメインアプリを更新:

```bash
# Worker URL を取得（Step 5 で取得済みの場合はスキップ）
WORKER_URL=$(gcloud run services describe komanavi-worker \
  --project=zenn-ai-agent-hackathon-vol4 \
  --region=asia-northeast1 \
  --format="value(status.url)")

# メインアプリの環境変数を更新
gcloud run services update komanavi \
  --region=asia-northeast1 \
  --update-env-vars "CLOUD_TASKS_QUEUE=manga-generation,CLOUD_TASKS_LOCATION=asia-northeast1,MANGA_WORKER_URL=${WORKER_URL}/process" \
  --project=zenn-ai-agent-hackathon-vol4
```

---

## 検証方法

### 1. Worker ヘルスチェック

```bash
# サービスアカウントのトークンを取得して呼び出し
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "${WORKER_URL}/health"
```

期待結果: `OK`

### 2. Cloud Tasks キュー確認

```bash
gcloud tasks queues describe manga-generation \
  --location=asia-northeast1 \
  --project=zenn-ai-agent-hackathon-vol4
```

### 3. 漫画生成テスト

1. アプリで漫画生成を実行
2. Cloud Tasks コンソールでタスクが処理されることを確認
3. Worker の Cloud Run ログで処理が実行されることを確認
4. Firestore でジョブステータスが更新されることを確認

### 4. Firestore ジョブ確認

Firebase コンソールまたは:

```bash
# gcloud firestore documents list は直接サポートされていないため
# Firebase コンソールで確認: https://console.firebase.google.com/
# Database → Firestore → mangaJobs コレクション
```

---

## トラブルシューティング

### タスクが処理されない

1. **キューの状態確認**:
   ```bash
   gcloud tasks queues describe manga-generation \
     --location=asia-northeast1 \
     --format="yaml(state,rateLimits,retryConfig)"
   ```

2. **Worker ログ確認**:
   ```bash
   gcloud run logs read komanavi-worker \
     --region=asia-northeast1 \
     --limit=50
   ```

3. **Cloud Tasks ログ確認**:
   Cloud Console → Cloud Tasks → manga-generation → ログを表示

### 認証エラー (403)

Worker への呼び出しが拒否される場合:

```bash
# 権限が正しく設定されているか確認
gcloud run services get-iam-policy komanavi-worker \
  --region=asia-northeast1
```

### タスクがリトライし続ける

Worker がエラーを返している場合:

1. Worker ログで詳細なエラーを確認
2. Gemini API のレート制限を確認
3. Firestore のジョブドキュメントでエラー内容を確認

---

## 環境変数一覧

### メインアプリ (komanavi)

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `CLOUD_TASKS_QUEUE` | Cloud Tasks キュー名 | `manga-generation` |
| `CLOUD_TASKS_LOCATION` | Cloud Tasks リージョン | `asia-northeast1` |
| `MANGA_WORKER_URL` | Worker サービスの処理エンドポイント | `https://komanavi-worker-xxx.run.app/process` |

### Worker (komanavi-worker)

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `GCP_PROJECT_ID` | GCP プロジェクト ID | `zenn-ai-agent-hackathon-vol4` |
| `GCP_LOCATION` | Vertex AI ロケーション | `global` |
| `FIREBASE_PROJECT_ID` | Firebase プロジェクト ID | `zenn-ai-agent-hackathon-vol4` |
| `GCS_MANGA_BUCKET` | 漫画画像バケット名 | `komanavi-manga-images` |

---

## 関連ドキュメント

- [Cloud Storage 設計書](./design.md)
- [Cloud Storage セットアップ](./setup.md)
- [デプロイ手順書](../deploy/デプロイ手順書.md)
