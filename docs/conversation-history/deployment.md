## Firestore/Storage デプロイ手順

### 前提
- ルール/インデックス/設定ファイルがリポジトリに存在
  - [firestore.rules](firestore.rules)
  - [firestore.indexes.json](firestore.indexes.json)
  - [firebase.json](firebase.json)

### Firestore データベース作成時の設定（実施済み）
- データベースID：komanavi
- エディション：Standard Edition
- モード：Firestoreネイティブ
- 場所：asia-northeast1（東京）

### コレクション作成
- Firestore は初回書き込み時にコレクションが自動作成されるため、作成コマンドは使用していない


