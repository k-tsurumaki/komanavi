# 環境変数の追加方法

新しい環境変数を追加する際は、以下の手順に従ってください。

## 1. クライアント側環境変数（`NEXT_PUBLIC_*`）

ブラウザのJavaScriptで使用する環境変数。

### 手順

1. **Dockerfile を編集** (builder ステージに追加)
   ```dockerfile
   ARG NEXT_PUBLIC_NEW_VAR
   ENV NEXT_PUBLIC_NEW_VAR=$NEXT_PUBLIC_NEW_VAR
   ```

2. **cloudbuild.yaml を編集** (build-main ステップに追加)
   ```yaml
   - '--build-arg'
   - 'NEXT_PUBLIC_NEW_VAR=${_NEW_VAR}'
   ```

3. **GCP Console の Cloud Build トリガー設定**
   - 置換変数 `_NEW_VAR` に値を設定

---

## 2. サーバー側環境変数（ランタイム）

サーバー側でのみ使用する環境変数（API ルート、サーバーコンポーネントなど）。

### 手順

**cloudbuild.yaml の `--set-env-vars` に追加**

```yaml
# メインアプリのデプロイ (deploy-main ステップ)
- '--set-env-vars'
- 'GCP_PROJECT_ID=${PROJECT_ID},GCP_LOCATION=global,...,NEW_VAR=value'

# Worker のデプロイ (deploy-worker ステップ、必要に応じて)
- '--set-env-vars'
- 'GCP_PROJECT_ID=${PROJECT_ID},...,NEW_VAR=value'
```

**重要**: ビルド時には不要。ランタイム（Cloud Run）でのみ使用される。

---

## 3. 機密情報（シークレット）

パスワード、APIキー、トークンなど機密性の高い情報。

### 手順

1. **Secret Manager にシークレットを作成**
   ```bash
   echo -n "secret-value" | \
     gcloud secrets create secret-name \
       --data-file=- \
       --project=zenn-ai-agent-hackathon-vol4
   ```

2. **cloudbuild.yaml の `--set-secrets` に追加**
   ```yaml
   - '--set-secrets'
   - 'AUTH_SECRET=auth-secret:latest,NEW_SECRET=secret-name:latest'
   ```

---

## コードでの環境変数チェック

### ❌ 悪い例（ビルド時エラー）

```typescript
// ファイルのトップレベルで即座にチェック
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY is required");
}
```

**問題**: Next.js のビルド時に評価され、環境変数がないとビルドが失敗する。

### ✅ 良い例（遅延評価）

```typescript
// 関数内で遅延チェック
function getApiKey(): string {
  const value = process.env.API_KEY;
  if (!value) {
    throw new Error("API_KEY is required");
  }
  return value;
}

// 使用時に呼び出す
export async function someFunction() {
  const apiKey = getApiKey();
  // ...
}
```

**理由**: 関数内で遅延評価することで、ビルド時にはチェックされず、ランタイム（実際に関数が呼ばれた時）のみチェックされる。
