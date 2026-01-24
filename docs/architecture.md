# アーキテクチャ概要

## アーキテクチャ図
![system_architecture.svg](images/system_architecture.svg)

## 全体構成
- フロントエンドは Next.js（App Router）で構成
- バックエンドは Next.js Route Handlers で API を提供
- 生成系は Vertex AI（Gemini 3.0 Flash / Pro Image）を利用

## 認証
- NextAuth と Firebase Auth による Google ログインを採用
- セッション確立・検証はサーバー側で実行

## データストア
- Cloud Firestore に会話履歴・ユーザーデータを保存
- Cloud Storage に漫画画像を保存

## 非同期処理
- Cloud Tasks で非同期ジョブをキューイング
- Cloud Run Jobs でバッチ処理（漫画生成など）を実行

## 運用・セキュリティ
- Secret Manager に機密情報を保管
- Cloud Logging / Monitoring で監視

## CI/CD
- Cloud Build → Artifact Registry → Cloud Deploy を利用

## 備考
- 図の構成は現状実装と将来予定の双方を含む
- 汎用ロゴの出典: https://fonts.google.com/icons?selected=Material+Symbols+Outlined:computer:FILL@0;wght@400;GRAD@0;opsz@24&icon.size=24&icon.color=%231f1f1f
- Google Cloud の各種アイコンの出典: https://cloud.google.com/icons?hl=ja