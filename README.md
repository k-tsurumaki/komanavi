# komanavi
sandbox for gcp-ai-agent-hackathon-vol4

## Cloud Run デプロイ手順

## 必要な環境変数

| 変数名 | 説明 | 本プロジェクトの設定値 |
| --- | --- | --- |
| GCP_PROJECT_ID | Google Cloud のプロジェクト ID。Cloud Run から Vertex AI を呼び出す際に利用。 | `zenn-ai-agent-hackathon-vol4` |
| GCP_LOCATION | Vertex AI のロケーション。本プロジェクトは `global` を使用（※ previewモデルは `global` のみ対応）。 | `global` |
| AUTH_SECRET | Auth.js の署名用シークレット。認証機能を使う場合に必須。 | .env.local参照 |
| AUTH_URL | Auth.js のベース URL。認証機能を使う場合に必須。 | .env.local参照 |
| AUTH_GOOGLE_ID | Google OAuth クライアント ID。認証機能を使う場合に必須。 | .env.local参照 |
| AUTH_GOOGLE_SECRET | Google OAuth クライアントシークレット。認証機能を使う場合に必須。 | .env.local参照 |
| NEXT_PUBLIC_FIREBASE_API_KEY | Firebase Web SDK の API キー（クライアント用）。認証機能を使う場合に必須。 | .env.local参照 |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | Firebase Web SDK の authDomain（クライアント用）。認証機能を使う場合に必須。 | .env.local参照 |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | Firebase Web SDK の projectId（クライアント用）。認証機能を使う場合に必須。 | `zenn-ai-agent-hackathon-vol4` |
| FIREBASE_PROJECT_ID | Firebase Admin SDK の projectId（サーバー用）。認証機能を使う場合に必須。 | `zenn-ai-agent-hackathon-vol4` |

### 1. 前提条件
- GCP プロジェクト作成済み
- 請求先（Billing）有効化済み
- gcloud CLI インストール済み
- 利用リージョンの棲み分け
	- Cloud Run：asia-northeast1（参考：[komanavi](https://console.cloud.google.com/run/detail/asia-northeast1/komanavi/observability/metrics?project=zenn-ai-agent-hackathon-vol4&authuser=1)）
	- Vertex AI（Gemini 3.0 Flash / Gemini 3.0 Image）：global（※ previewモデルはglobalでしか使えない）

### 2. 初期セットアップ
1) gcloud にログイン
	```
	gcloud auth login
	```
2) 既定プロジェクトとリージョンを設定
	```
	gcloud config set project <YOUR_PROJECT_ID>
	gcloud config set run/region asia-northeast1
	```

### 3. Cloud Run にデプロイ
Dockerfile を使ったデプロイ:

1) Cloud Run サービスを作成・更新
	```
	gcloud run deploy komanavi \
	  --source . \
	  --allow-unauthenticated \
	  --set-env-vars GCP_PROJECT_ID=<YOUR_PROJECT_ID>,GCP_LOCATION=global
	```

補足:
- `gcloud run deploy ... --source .` は本リポジトリのルート（Dockerfile とプロジェクトファイルがある階層）で実行してください。別階層で実行する場合は `--source` にルートのパスを指定します。
- 本リポジトリは Next.js の `output: "standalone"` を利用しており、Cloud Run の `PORT=8080` で起動します（Dockerfile で設定済み）。
- `GCP_LOCATION` は Vertex AI のロケーションです（本プロジェクトは `global` を使用）。

### 4. デフォルトの環境変数の更新
デプロイ後に環境変数を更新する場合:
```
gcloud run services update komanavi \
	--set-env-vars GCP_PROJECT_ID=<YOUR_PROJECT_ID>,GCP_LOCATION=global
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
