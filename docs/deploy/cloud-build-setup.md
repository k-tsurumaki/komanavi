# Cloud Build 自動デプロイ セットアップ手順書

このドキュメントでは、dev ブランチへの push 時に自動的に Cloud Run へデプロイする仕組みを構築する手順を説明します。

## 目次

1. [概要](#概要)
2. [前提条件](#前提条件)
3. [Phase 1: IAM 権限設定](#phase-1-iam-権限設定初回のみ)
4. [Phase 2: Cloud Build トリガー作成](#phase-2-cloud-build-トリガー作成初回のみ)
5. [Phase 3: 動作確認](#phase-3-動作確認)
6. [トラブルシューティング](#トラブルシューティング)
7. [運用方法](#運用方法)

---

## 概要

### デプロイ対象

dev ブランチへの push/merge 時に以下の2つのサービスが自動デプロイされます：

| サービス名 | Cloud Build 設定ファイル | 説明 |
|-----------|----------------------|------|
| **komanavi** | `/cloudbuild.yaml` | メインアプリケーション |
| **komanavi-worker** | `/worker/cloudbuild.yaml` | 漫画生成 Worker サービス |

### アーキテクチャ

```
GitHub (dev ブランチへの push/merge)
  ↓
Cloud Build トリガー（自動起動）
  ↓
cloudbuild.yaml 読み込み
  ↓
① Docker イメージビルド（メインアプリ + Worker）
  ↓
② Artifact Registry へ push
  ↓
③ Cloud Run へデプロイ（2サービス）
```

### デプロイフロー

1. **イメージビルド**: Docker イメージを `${COMMIT_SHA}` と `latest` タグでビルド
2. **イメージ push**: Artifact Registry (`asia-northeast1-docker.pkg.dev`) へ push
3. **Cloud Run デプロイ**: 環境変数・シークレット付きでデプロイ
4. **自動ロールアウト**: トラフィックが新しいリビジョンに自動的に切り替わる

---

## 前提条件

### 1. 必要な GCP API の有効化

以下の API が有効化されていることを確認してください：

```bash
# API 有効化状態を確認
gcloud services list --enabled --project=zenn-ai-agent-hackathon-vol4 | grep -E "cloudbuild|run|artifactregistry|secretmanager"

# 必要に応じて有効化
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  --project=zenn-ai-agent-hackathon-vol4
```

### 2. 必要な Secret Manager シークレット

以下のシークレットが Secret Manager に作成されていることを確認してください：

| シークレット名 | 用途 |
|--------------|------|
| `auth-secret` | NextAuth セッション署名キー |
| `auth-google-id` | Google OAuth クライアント ID |
| `auth-google-secret` | Google OAuth クライアントシークレット |

```bash
# シークレット一覧確認
gcloud secrets list --project=zenn-ai-agent-hackathon-vol4
```

### 3. GitHub リポジトリ

- リポジトリ: `komanabi`
- ブランチ: `dev`（自動デプロイ対象）
- Cloud Build と GitHub の連携設定が必要（初回のみ）

---

## Phase 1: IAM 権限設定（初回のみ）

Cloud Build のサービスアカウントに必要な権限を付与します。

### 1-1. プロジェクト番号を取得

```bash
PROJECT_NUMBER=$(gcloud projects describe zenn-ai-agent-hackathon-vol4 --format="value(projectNumber)")
echo "Project Number: $PROJECT_NUMBER"
```

### 1-2. Cloud Build サービスアカウントに権限を付与

```bash
# Cloud Run Admin（デプロイに必要）
gcloud projects add-iam-policy-binding zenn-ai-agent-hackathon-vol4 \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

# Service Account User（Cloud Run のサービスアカウントとして実行）
gcloud projects add-iam-policy-binding zenn-ai-agent-hackathon-vol4 \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Secret Manager Secret Accessor（シークレット取得）
gcloud projects add-iam-policy-binding zenn-ai-agent-hackathon-vol4 \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Artifact Registry Writer（イメージ push）
# ※ 通常は Cloud Build API 有効化時に自動付与されるが、念のため確認
gcloud projects add-iam-policy-binding zenn-ai-agent-hackathon-vol4 \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

### 1-3. 権限付与の確認

```bash
# Cloud Build サービスアカウントの権限を確認
gcloud projects get-iam-policy zenn-ai-agent-hackathon-vol4 \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --format="table(bindings.role)"
```

期待される出力：
```
ROLE
roles/artifactregistry.writer
roles/cloudbuild.builds.builder
roles/iam.serviceAccountUser
roles/run.admin
roles/secretmanager.secretAccessor
```

---

## Phase 2: Cloud Build トリガー作成（初回のみ）

### オプション A: GCP Console で作成（推奨・初回）

初回セットアップ時は GCP Console での作成を推奨します（GitHub OAuth 認証が必要なため）。

#### A-1. Cloud Build と GitHub を接続

1. [GCP Console > Cloud Build > トリガー](https://console.cloud.google.com/cloud-build/triggers?project=zenn-ai-agent-hackathon-vol4) にアクセス
2. 「トリガーを作成」をクリック
3. 「ソースを接続」で GitHub を選択
4. GitHub アカウントで認証し、リポジトリへのアクセスを許可
5. リポジトリ `komanabi` を選択

#### A-2. メインアプリ用トリガーを作成

| 項目 | 設定値 |
|------|-------|
| **名前** | `deploy-komanavi-dev` |
| **説明** | `dev ブランチへの push 時にメインアプリをデプロイ` |
| **イベント** | ブランチに push |
| **ソース** | GitHub リポジトリ `komanabi` |
| **ブランチ** | `^dev$`（正規表現） |
| **ビルド構成** | Cloud Build 構成ファイル（yaml または json） |
| **Cloud Build 構成ファイルの場所** | `/cloudbuild.yaml` |
| **置換変数** | `_FIREBASE_API_KEY` = `AIzaSyC29gGNXK7v-mJdcUHRPu8oMDuFYmfeaVA` |

#### A-3. Worker 用トリガーを作成

| 項目 | 設定値 |
|------|-------|
| **名前** | `deploy-komanavi-worker-dev` |
| **説明** | `dev ブランチへの push 時に Worker をデプロイ` |
| **イベント** | ブランチに push |
| **ソース** | GitHub リポジトリ `komanabi` |
| **ブランチ** | `^dev$` |
| **ビルド構成** | Cloud Build 構成ファイル（yaml または json） |
| **Cloud Build 構成ファイルの場所** | `/worker/cloudbuild.yaml` |
| **置換変数** | なし |

### オプション B: gcloud CLI で作成（GitHub 接続済みの場合）

GitHub との接続が完了している場合、CLI でトリガーを作成できます。

#### B-1. GitHub リポジトリ接続名を確認

```bash
# 接続済みリポジトリ一覧を確認
gcloud builds repositories list --project=zenn-ai-agent-hackathon-vol4
```

#### B-2. メインアプリ用トリガーを作成

```bash
gcloud builds triggers create github \
  --name=deploy-komanavi-dev \
  --description="dev ブランチへの push 時にメインアプリをデプロイ" \
  --repo-name=komanabi \
  --repo-owner=<GitHub ユーザー名> \
  --branch-pattern=^dev$ \
  --build-config=cloudbuild.yaml \
  --substitutions=_FIREBASE_API_KEY=AIzaSyC29gGNXK7v-mJdcUHRPu8oMDuFYmfeaVA \
  --project=zenn-ai-agent-hackathon-vol4
```

#### B-3. Worker 用トリガーを作成

```bash
gcloud builds triggers create github \
  --name=deploy-komanavi-worker-dev \
  --description="dev ブランチへの push 時に Worker をデプロイ" \
  --repo-name=komanabi \
  --repo-owner=<GitHub ユーザー名> \
  --branch-pattern=^dev$ \
  --build-config=worker/cloudbuild.yaml \
  --project=zenn-ai-agent-hackathon-vol4
```

### トリガー作成の確認

```bash
# トリガー一覧を確認
gcloud builds triggers list --project=zenn-ai-agent-hackathon-vol4
```

期待される出力：
```
NAME                         CREATE_TIME                STATUS
deploy-komanavi-dev          2026-02-01T...             ENABLED
deploy-komanavi-worker-dev   2026-02-01T...             ENABLED
```

---

## Phase 3: 動作確認

### 3-1. 手動トリガー実行（初回テスト）

初回は手動でトリガーを実行してビルドが成功することを確認します。

```bash
# メインアプリのトリガーを手動実行
gcloud builds triggers run deploy-komanavi-dev \
  --branch=dev \
  --project=zenn-ai-agent-hackathon-vol4

# Worker のトリガーを手動実行
gcloud builds triggers run deploy-komanavi-worker-dev \
  --branch=dev \
  --project=zenn-ai-agent-hackathon-vol4
```

### 3-2. ビルドログ確認

```bash
# 最新のビルド一覧を表示
gcloud builds list --limit=5 --project=zenn-ai-agent-hackathon-vol4

# 特定ビルドの詳細ログを表示
gcloud builds log <BUILD_ID> --project=zenn-ai-agent-hackathon-vol4
```

または [GCP Console > Cloud Build > 履歴](https://console.cloud.google.com/cloud-build/builds?project=zenn-ai-agent-hackathon-vol4) でビルドログを確認。

### 3-3. デプロイされたイメージ確認

```bash
# メインアプリの最新イメージタグ確認
gcloud run services describe komanavi \
  --region=asia-northeast1 \
  --project=zenn-ai-agent-hackathon-vol4 \
  --format="value(spec.template.spec.containers[0].image)"

# Worker の最新イメージタグ確認
gcloud run services describe komanavi-worker \
  --region=asia-northeast1 \
  --project=zenn-ai-agent-hackathon-vol4 \
  --format="value(spec.template.spec.containers[0].image)"
```

イメージタグが `${COMMIT_SHA}` になっていることを確認してください。

### 3-4. アプリケーション動作確認

1. https://komanavi-30981781876.asia-northeast1.run.app にアクセス
2. Google ログインが正常に動作することを確認
3. `/analyze` ページで URL 解析が動作することを確認
4. 漫画生成機能が動作することを確認（Worker との連携確認）

### 3-5. 自動デプロイ確認

dev ブランチに試験的な変更を push して、自動デプロイが動作することを確認します。

```bash
# 1. feature ブランチで試験的な変更を作成
git checkout -b test-auto-deploy
echo "# Auto deploy test" >> README.md
git add README.md
git commit -m "test: Cloud Build 自動デプロイテスト"
git push origin test-auto-deploy

# 2. GitHub でプルリクエストを作成し、dev ブランチにマージ

# 3. Cloud Build の履歴を確認
gcloud builds list --limit=5 --project=zenn-ai-agent-hackathon-vol4
```

---

## トラブルシューティング

### ビルドが失敗する場合

#### 1. IAM 権限エラー

**エラー例:**
```
ERROR: (gcloud.run.deploy) PERMISSION_DENIED: Permission 'run.services.update' denied
```

**解決方法:**
- [Phase 1](#phase-1-iam-権限設定初回のみ) の権限設定を再確認
- Cloud Build サービスアカウントに `roles/run.admin` があるか確認

```bash
PROJECT_NUMBER=$(gcloud projects describe zenn-ai-agent-hackathon-vol4 --format="value(projectNumber)")
gcloud projects get-iam-policy zenn-ai-agent-hackathon-vol4 \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --format="table(bindings.role)"
```

#### 2. Secret Manager アクセスエラー

**エラー例:**
```
ERROR: Failed to access secret 'auth-secret'
```

**解決方法:**
- Secret Manager にシークレットが存在するか確認
- Cloud Build サービスアカウントに `roles/secretmanager.secretAccessor` があるか確認

```bash
# シークレット一覧確認
gcloud secrets list --project=zenn-ai-agent-hackathon-vol4

# シークレットへのアクセス権限確認
gcloud secrets get-iam-policy auth-secret --project=zenn-ai-agent-hackathon-vol4
```

#### 3. Docker ビルドエラー

**エラー例:**
```
ERROR: failed to build: executing step 0: building image
```

**解決方法:**
- Dockerfile の構文を確認
- ローカルで `docker build` が成功するか確認

```bash
# メインアプリのビルド確認
docker build \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyC29gGNXK7v-mJdcUHRPu8oMDuFYmfeaVA \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=zenn-ai-agent-hackathon-vol4.firebaseapp.com \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID=zenn-ai-agent-hackathon-vol4 \
  -t test-komanavi:local \
  .

# Worker のビルド確認
cd worker
docker build -t test-worker:local .
```

#### 4. 置換変数エラー

**エラー例:**
```
ERROR: build arg NEXT_PUBLIC_FIREBASE_API_KEY not set
```

**解決方法:**
- Cloud Build トリガーの置換変数 `_FIREBASE_API_KEY` が設定されているか確認

```bash
# トリガー詳細を確認
gcloud builds triggers describe deploy-komanavi-dev \
  --project=zenn-ai-agent-hackathon-vol4 \
  --format="yaml(substitutions)"
```

期待される出力:
```yaml
substitutions:
  _FIREBASE_API_KEY: AIzaSyC29gGNXK7v-mJdcUHRPu8oMDuFYmfeaVA
```

### デプロイが失敗する場合

#### 1. Cloud Run クォータエラー

**エラー例:**
```
ERROR: Quota exceeded for quota metric 'revisions.count'
```

**解決方法:**
- 古いリビジョンを削除してクォータを解放

```bash
# 古いリビジョン一覧を表示
gcloud run revisions list \
  --service=komanavi \
  --region=asia-northeast1 \
  --project=zenn-ai-agent-hackathon-vol4 \
  --sort-by="~metadata.creationTimestamp"

# 古いリビジョンを削除（トラフィックを受けていないもの）
gcloud run revisions delete <REVISION_NAME> \
  --region=asia-northeast1 \
  --project=zenn-ai-agent-hackathon-vol4 \
  --quiet
```

#### 2. 環境変数が反映されない

**解決方法:**
- `gcloud run services describe` で環境変数を確認

```bash
gcloud run services describe komanavi \
  --region=asia-northeast1 \
  --project=zenn-ai-agent-hackathon-vol4 \
  --format="yaml(spec.template.spec.containers[0].env)"
```

### トリガーが起動しない場合

#### 1. GitHub 接続エラー

**解決方法:**
- Cloud Build と GitHub の接続状態を確認
- [GCP Console > Cloud Build > トリガー](https://console.cloud.google.com/cloud-build/triggers?project=zenn-ai-agent-hackathon-vol4) でリポジトリ接続を確認
- 必要に応じて再接続

#### 2. ブランチパターンが一致しない

**解決方法:**
- トリガーのブランチパターンが `^dev$` になっているか確認

```bash
gcloud builds triggers describe deploy-komanavi-dev \
  --project=zenn-ai-agent-hackathon-vol4 \
  --format="yaml(triggerTemplate.branchName)"
```

---

## 運用方法

### 1. 通常のデプロイフロー

```bash
# 1. feature ブランチで開発
git checkout -b feature/new-feature
# ... 開発作業 ...
git add .
git commit -m "feat: 新機能を追加"
git push origin feature/new-feature

# 2. GitHub でプルリクエストを作成

# 3. レビュー・承認後、dev ブランチにマージ

# 4. 自動的に Cloud Build が起動し、デプロイが実行される
```

### 2. デプロイ状況の監視

```bash
# リアルタイムでビルドログを確認
gcloud builds list --ongoing --project=zenn-ai-agent-hackathon-vol4

# 最新のビルド詳細を確認
BUILD_ID=$(gcloud builds list --limit=1 --project=zenn-ai-agent-hackathon-vol4 --format="value(id)")
gcloud builds log $BUILD_ID --stream --project=zenn-ai-agent-hackathon-vol4
```

### 3. ロールバック

問題が発生した場合、前回のイメージにロールバックできます。

```bash
# 前回のリビジョンを確認
gcloud run revisions list \
  --service=komanavi \
  --region=asia-northeast1 \
  --project=zenn-ai-agent-hackathon-vol4 \
  --limit=5

# 特定のリビジョンにロールバック
gcloud run services update-traffic komanavi \
  --to-revisions=<REVISION_NAME>=100 \
  --region=asia-northeast1 \
  --project=zenn-ai-agent-hackathon-vol4
```

### 4. コスト管理

Cloud Build の無料枠:
- **1日あたり 120 分のビルド時間** が無料
- 超過分は $0.003/ビルド分

**コスト削減のヒント:**
- 不要なトリガーは無効化
- ビルドマシンのスペックを適切に設定（現在: `E2_HIGHCPU_8`）
- キャッシュを活用（Docker layer cache）

```bash
# Cloud Build の使用状況を確認
gcloud builds list \
  --filter="createTime>$(date -d '1 month ago' --iso-8601)" \
  --format="table(id,createTime,duration)" \
  --project=zenn-ai-agent-hackathon-vol4 \
  --limit=100
```

### 5. セキュリティのベストプラクティス

- **シークレット管理**: Secret Manager を使用し、ソースコードにシークレットを含めない
- **最小権限の原則**: Cloud Build サービスアカウントには必要最小限のロールのみ付与
- **イメージスキャン**: Artifact Registry の脆弱性スキャンを有効化（推奨）

```bash
# Artifact Registry の脆弱性スキャンを有効化
gcloud artifacts repositories add-iam-policy-binding cloud-run-source-deploy \
  --location=asia-northeast1 \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-artifactregistry.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.reader" \
  --project=zenn-ai-agent-hackathon-vol4
```

---

## 追加の改善案（オプション）

### 1. Slack/Email 通知

Cloud Build の成功・失敗を Slack に通知する設定例:

```yaml
# cloudbuild.yaml に追加
availableSecrets:
  secretManager:
    - versionName: projects/PROJECT_ID/secrets/slack-webhook/versions/latest
      env: 'SLACK_WEBHOOK_URL'

steps:
  # ... 既存のステップ ...

  # 通知ステップ
  - name: 'gcr.io/cloud-builders/curl'
    secretEnv: ['SLACK_WEBHOOK_URL']
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        curl -X POST $$SLACK_WEBHOOK_URL \
          -H 'Content-Type: application/json' \
          -d '{"text":"✅ komanavi デプロイ成功: ${COMMIT_SHA}"}'
```

### 2. タグベースのデプロイ

`v*` タグにも対応する場合:

```bash
# 本番用トリガーを作成（タグベース）
gcloud builds triggers create github \
  --name=deploy-komanavi-production \
  --repo-name=komanabi \
  --repo-owner=<GitHub ユーザー名> \
  --tag-pattern=^v[0-9]+\.[0-9]+\.[0-9]+$ \
  --build-config=cloudbuild.yaml \
  --substitutions=_FIREBASE_API_KEY=AIzaSyC29gGNXK7v-mJdcUHRPu8oMDuFYmfeaVA \
  --project=zenn-ai-agent-hackathon-vol4
```

### 3. 並列ビルド

メインアプリと Worker を並列ビルドする場合、親 `cloudbuild.yaml` を作成:

```yaml
# cloudbuild-parallel.yaml
steps:
  # メインアプリのビルドを起動
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'gcloud'
    args:
      - 'builds'
      - 'submit'
      - '--config=cloudbuild.yaml'
      - '--substitutions=_FIREBASE_API_KEY=${_FIREBASE_API_KEY}'
    id: 'build-main'
    waitFor: ['-']

  # Worker のビルドを起動
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'gcloud'
    args:
      - 'builds'
      - 'submit'
      - '--config=worker/cloudbuild.yaml'
    id: 'build-worker'
    waitFor: ['-']
```

---

## まとめ

この手順書に従うことで、dev ブランチへの push/merge 時に自動的に Cloud Run へデプロイされる仕組みが構築されます。

**セットアップ後の確認事項:**

1. ✅ Cloud Build トリガーが正しく作成されているか（`gcloud builds triggers list`）
2. ✅ IAM 権限が正しく設定されているか
3. ✅ dev ブランチへの push でビルドが自動起動するか
4. ✅ ビルドログにエラーが無いか
5. ✅ Cloud Run サービスが正しく更新されているか（イメージタグが COMMIT_SHA になっているか）
6. ✅ 本番 URL でアプリが正常に動作するか
7. ✅ 漫画生成機能（Worker との連携）が正常に動作するか

**問題が発生した場合:**
- [トラブルシューティング](#トラブルシューティング) セクションを参照
- Cloud Build のビルドログを確認
- GCP Console で Cloud Run のログを確認

**参考リンク:**
- [Cloud Build ドキュメント](https://cloud.google.com/build/docs)
- [Cloud Run ドキュメント](https://cloud.google.com/run/docs)
- [GitHub トリガーの設定](https://cloud.google.com/build/docs/automating-builds/github/build-repos-from-github)
