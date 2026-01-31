# Cloud Tasks 移行 TODO

## 残作業

### メインアプリ環境変数更新

Worker デプロイ後、メインアプリに環境変数を追加してデプロイする必要あり。

```bash
gcloud run services update komanavi \
  --region=asia-northeast1 \
  --update-env-vars "CLOUD_TASKS_QUEUE=manga-generation,CLOUD_TASKS_LOCATION=asia-northeast1,MANGA_WORKER_URL=https://komanavi-worker-30981781876.asia-northeast1.run.app/process" \
  --project=zenn-ai-agent-hackathon-vol4
```

または、次回メインアプリのデプロイ時に `--set-env-vars` に追加:

```
CLOUD_TASKS_QUEUE=manga-generation
CLOUD_TASKS_LOCATION=asia-northeast1
MANGA_WORKER_URL=https://komanavi-worker-30981781876.asia-northeast1.run.app/process
```
