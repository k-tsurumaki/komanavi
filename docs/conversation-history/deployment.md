## Firestore/Storage デプロイ手順

### 前提
- Firebase CLI がインストール済み
- 対象のFirebaseプロジェクトが作成済み
- ルール/インデックス/設定ファイルがリポジトリに存在
  - [firestore.rules](firestore.rules)
  - [firestore.indexes.json](firestore.indexes.json)
  - [storage.rules](storage.rules)
  - [firebase.json](firebase.json)

### 手順
1. Firebaseにログイン
	- 実行: `firebase login`

2. 対象プロジェクトを設定
	- 実行: `firebase use <PROJECT_ID>`

3. Firestoreルールとインデックスをデプロイ
	- 実行: `firebase deploy --only firestore:rules,firestore:indexes`

4. Storageルールをデプロイ
	- 実行: `firebase deploy --only storage`

### 確認
- Firebase Consoleで以下を確認
  - Firestoreルールが反映されている
  - 複合インデックスが作成済み
  - Storageルールが反映されている

