#!/bin/bash
set -e

# Worker サービスのデプロイスクリプト（ローカルビルド方式）

PROJECT_ID="${GCP_PROJECT_ID:-zenn-ai-agent-hackathon-vol4}"
REGION="asia-northeast1"
SERVICE_NAME="komanavi-worker"
SERVICE_ACCOUNT="komanavi-cloud-run@${PROJECT_ID}.iam.gserviceaccount.com"
IMAGE_NAME="asia-northeast1-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/${SERVICE_NAME}:latest"

cd "$(dirname "$0")"

echo "=== Worker Deployment (Local Build) ==="
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service: ${SERVICE_NAME}"
echo "Image: ${IMAGE_NAME}"
echo ""

# 1. Artifact Registry 認証
echo "=== Step 1: Authenticating to Artifact Registry ==="
gcloud auth configure-docker asia-northeast1-docker.pkg.dev --quiet

# 2. Docker ビルド
echo ""
echo "=== Step 2: Building Docker image ==="
docker build -t "${IMAGE_NAME}" .

# 3. イメージをプッシュ
echo ""
echo "=== Step 3: Pushing image to Artifact Registry ==="
docker push "${IMAGE_NAME}"

# 4. Cloud Run デプロイ
echo ""
echo "=== Step 4: Deploying to Cloud Run ==="
gcloud run deploy "$SERVICE_NAME" \
  --image="${IMAGE_NAME}" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --memory 512Mi \
  --cpu 1 \
  --timeout 600 \
  --min-instances 0 \
  --max-instances 5 \
  --no-allow-unauthenticated \
  --service-account "$SERVICE_ACCOUNT" \
  --set-env-vars "GCP_PROJECT_ID=${PROJECT_ID},GCP_LOCATION=global,FIREBASE_PROJECT_ID=${PROJECT_ID},FIREBASE_DATABASE_ID=komanavi,GCS_MANGA_BUCKET=komanavi-manga-images,GCS_SIGNED_URL_TTL_MINUTES=60"

# 5. サービス URL 取得
echo ""
echo "=== Step 5: Getting Service URL ==="
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format "value(status.url)")

echo ""
echo "=========================================="
echo "Worker deployed successfully!"
echo "=========================================="
echo ""
echo "Service URL: ${SERVICE_URL}"
echo ""
echo "Next steps:"
echo ""
echo "1. Grant invoker permission to Cloud Tasks:"
echo "   gcloud run services add-iam-policy-binding ${SERVICE_NAME} \\"
echo "     --region=${REGION} \\"
echo "     --member=\"serviceAccount:${SERVICE_ACCOUNT}\" \\"
echo "     --role=\"roles/run.invoker\" \\"
echo "     --project=${PROJECT_ID}"
echo ""
echo "2. Update main app environment variable:"
echo "   MANGA_WORKER_URL=${SERVICE_URL}/process"
