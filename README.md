# komanabi
sandbox for gcp-ai-agent-hackathon-vol4

## Cloud Run デプロイ手順

### 1. 前提条件
- GCP プロジェクト作成済み
- 請求先（Billing）有効化済み
- gcloud CLI インストール済み

### 2. 初期セットアップ
1) gcloud にログイン
	```
	gcloud auth login
	```
2) 既定プロジェクトとリージョンを設定
	```
	gcloud config set project <YOUR_PROJECT_ID>
	gcloud config set run/region <YOUR_REGION>
	```

### 3. Cloud Run にデプロイ
Dockerfile を使ったデプロイ:

1) Cloud Run サービスを作成・更新
	```
	gcloud run deploy komanabi \
	  --source . \
	  --allow-unauthenticated \
	  --set-env-vars GCP_PROJECT_ID=<YOUR_PROJECT_ID>,GCP_LOCATION=<YOUR_LOCATION>
	```

補足:
- 本リポジトリは Next.js の `output: "standalone"` を利用しており、Cloud Run の `PORT=8080` で起動します（Dockerfile で設定済み）。
- `GCP_LOCATION` は Vertex AI のロケーションです（例: `global`, `us-central1`）。

### 4. デフォルトの環境変数の更新
デプロイ後に環境変数を更新する場合:
```
gcloud run services update komanabi \
	--set-env-vars GCP_PROJECT_ID=<YOUR_PROJECT_ID>,GCP_LOCATION=<YOUR_LOCATION>
```

### 5. 動作確認
デプロイ完了後、表示される URL にアクセスして動作確認します。



## 備考（実施済み）

### API を有効化
以下の API を有効化します。
- Cloud Run
- Cloud Build
- Artifact Registry
- Vertex AI

コマンド例:
```
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com aiplatform.googleapis.com
```

### 実行サービスアカウントの権限付与
Cloud Run が Vertex AI を呼び出せるように、実行サービスアカウントに権限を付与します。

1) 使用するサービスアカウントを確認
	- 既定は `<PROJECT_NUMBER>-compute@developer.gserviceaccount.com`
2) Vertex AI への権限を付与
	```
	gcloud projects add-iam-policy-binding <YOUR_PROJECT_ID> \
	  --member="serviceAccount:<SERVICE_ACCOUNT_EMAIL>" \
	  --role="roles/aiplatform.user"
	```
