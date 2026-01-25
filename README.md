# komanavi
sandbox for gcp-ai-agent-hackathon-vol4

## Cloud Run デプロイ手順

## 必要な環境変数

| 変数名 | 説明 | 取得場所 | 本プロジェクトの設定値 |
| --- | --- | --- | --- |
| GCP_PROJECT_ID | Google Cloud のプロジェクト ID。Cloud Run から Vertex AI を呼び出す際に利用。 | [Google Cloud Console](https://console.cloud.google.com/) → プロジェクト選択 | `zenn-ai-agent-hackathon-vol4` |
| GCP_LOCATION | Vertex AI のロケーション。本プロジェクトは `global` を使用（※ previewモデルは `global` のみ対応）。 | 固定値（`global` または `asia-northeast1` 等） | `global` |
| AUTH_SECRET | Auth.js の署名用シークレット。認証機能を使う場合に必須。 | `npx auth secret` または `openssl rand -base64 32` で生成 | .env.local参照 |
| AUTH_URL | Auth.js のベース URL。認証機能を使う場合に必須。 | 自分で設定（ローカル: `http://localhost:3000`、本番: デプロイ先URL） | .env.local参照 |
| AUTH_GOOGLE_ID | Google OAuth クライアント ID。認証機能を使う場合に必須。 | [Google Cloud Console](https://console.cloud.google.com/) → APIとサービス → 認証情報 → OAuth 2.0 クライアントID | .env.local参照 |
| AUTH_GOOGLE_SECRET | Google OAuth クライアントシークレット。認証機能を使う場合に必須。 | 同上（OAuth 2.0 クライアントID作成時に表示） | .env.local参照 |
| NEXT_PUBLIC_FIREBASE_API_KEY | Firebase Web SDK の API キー（クライアント用）。認証機能を使う場合に必須。 | [Identity Platform Console](https://console.cloud.google.com/customer-identity/providers?project=zenn-ai-agent-hackathon-vol4) → アプリケーション設定の詳細 | .env.local参照 |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | Firebase Web SDK の authDomain（クライアント用）。認証機能を使う場合に必須。 | 同上（自動生成: `{project-id}.firebaseapp.com`） | .env.local参照 |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | Firebase Web SDK の projectId（クライアント用）。認証機能を使う場合に必須。 | 同上 | `zenn-ai-agent-hackathon-vol4` |
| FIREBASE_PROJECT_ID | Firebase Admin SDK の projectId（サーバー用）。認証機能を使う場合に必須。 | 同上 | `zenn-ai-agent-hackathon-vol4` |
