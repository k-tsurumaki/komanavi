# Cloud Storage セットアップ手順書

## 前提条件

- GCP プロジェクト: `zenn-ai-agent-hackathon-vol4`
- サービスアカウント: `komanavi-sa@zenn-ai-agent-hackathon-vol4.iam.gserviceaccount.com`
- gcloud CLI がインストール済み

## 1. バケット作成

```bash
gcloud storage buckets create gs://komanavi-manga-images \
  --project=zenn-ai-agent-hackathon-vol4 \
  --location=asia-northeast1 \
  --uniform-bucket-level-access
```

## 2. ライフサイクルルール設定（90日削除）

```bash
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
```

## 3. 権限付与

サービスアカウントに `Storage Object Admin` 権限を付与:

```bash
gcloud projects add-iam-policy-binding zenn-ai-agent-hackathon-vol4 \
  --member="serviceAccount:komanavi-sa@zenn-ai-agent-hackathon-vol4.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

## 4. 環境変数設定

`.env.local` に追加:

```
GCS_MANGA_BUCKET=komanavi-manga-images
GCS_SIGNED_URL_TTL_MINUTES=60
```

## 5. ローカル動作検証

### 開発サーバー起動

```bash
npm run dev
```

### 検証手順

1. ブラウザで http://localhost:3000 にアクセス
2. **ログイン**（Google OAuth または メール/パスワード）
3. 任意の行政URLを入力して解析
4. 「漫画を生成する」ボタンをクリック
5. DevTools でレスポンスを確認
   - `imageUrls[0]` が `https://storage.googleapis.com/...` 形式であること
6. GCP コンソールで画像保存を確認
   - パスが `users/{uid}/manga/...` になっていること

### 未ログイン時の動作確認

1. ログアウト状態で漫画を生成
2. `imageUrls[0]` が `data:image/png;base64,...` 形式であること（従来動作）

## 6. ビルド確認

```bash
npm run lint && npm run build
```

## トラブルシューティング

### 署名付きURL生成エラー

```
Error: Error occurred during signUrl process
```

**原因**: サービスアカウントに署名権限がない

**対処**:
```bash
gcloud projects add-iam-policy-binding zenn-ai-agent-hackathon-vol4 \
  --member="serviceAccount:komanavi-sa@zenn-ai-agent-hackathon-vol4.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"
```

### バケットアクセスエラー

```
Error: The specified bucket does not exist
```

**原因**: バケットが存在しない、または名前が間違っている

**対処**:
1. バケット名を確認: `gcloud storage buckets list --project=zenn-ai-agent-hackathon-vol4`
2. 環境変数 `GCS_MANGA_BUCKET` が正しいことを確認

### 認証エラー

```
Error: ID token verification failed
```

**原因**: Firebase Admin SDK の初期化に失敗

**対処**:
1. `GOOGLE_APPLICATION_CREDENTIALS` が正しく設定されているか確認
2. サービスアカウントキーが有効か確認

## ローカル開発用設定

### サービスアカウント Impersonation 設定

ローカル開発でサービスアカウントになりすまして動作確認する場合:

```bash
# 自分のアカウントに Token Creator 権限を付与
gcloud iam service-accounts add-iam-policy-binding komanavi-cloud-run@zenn-ai-agent-hackathon-vol4.iam.gserviceaccount.com \
  --member="user:gotokohei9714@gmail.com" \
  --role="roles/iam.serviceAccountTokenCreator"

# Impersonation を有効にしてログイン
gcloud auth application-default login \
  --impersonate-service-account=komanavi-cloud-run@zenn-ai-agent-hackathon-vol4.iam.gserviceaccount.com
```

### CORS 設定（ローカル開発用）

localhost からの画像取得を許可:

```bash
cat > /tmp/cors.json << 'EOF'
[
  {
    "origin": ["http://localhost:3000","https://komanavi-worker-30981781876.asia-northeast1.run.app"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Content-Length", "Content-Disposition", "Cache-Control"],
    "maxAgeSeconds": 3600
  }
]
EOF

# バケットに適用
gcloud storage buckets update gs://komanavi-manga-images --cors-file=/tmp/cors.json

export PROJECT_ID="zenn-ai-agent-hackathon-vol4"
export SERVICE_ACCOUNT="komanavi-cloud-run@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" --member="serviceAccount:${SERVICE_ACCOUNT}" --role="roles/iam.serviceAccountTokenCreator"
```
