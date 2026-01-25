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
- 参考：https://firebase.google.com/docs/firestore/data-model?hl=ja#collections

### 環境変数
| 変数名 | 必須 | 用途 | なぜ必要か | 参照箇所 |
| --- | --- | --- | --- | --- |
| AUTH_GOOGLE_ID | ✅ | Google OAuth クライアントID | Googleログインの認証要求に必須 | [src/lib/auth.config.ts](src/lib/auth.config.ts) |
| AUTH_GOOGLE_SECRET | ✅ | Google OAuth クライアントシークレット | Googleログインの認証要求に必須 | [src/lib/auth.config.ts](src/lib/auth.config.ts) |
| NEXT_PUBLIC_FIREBASE_API_KEY | ✅ | Firebase Web SDK 設定 | クライアント初期化に必須 | [src/lib/firebase.ts](src/lib/firebase.ts) |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | ✅ | Firebase Web SDK 設定 | 認証ドメイン設定に必須 | [src/lib/firebase.ts](src/lib/firebase.ts) |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | ✅ | Firebase Web SDK 設定 | プロジェクト特定に必須 | [src/lib/firebase.ts](src/lib/firebase.ts) |
| FIREBASE_PROJECT_ID | ✅ | Firebase Admin SDK のプロジェクトID | Admin SDK の初期化に必須 | [src/lib/firebase-admin.ts](src/lib/firebase-admin.ts) |

### ローカル履歴の削除フロー
- 対象: 旧実装でローカルストレージに保存された会話履歴
- 手順:
  1. Developer Consoleを開く（Chrome: 表示 > 開発/管理 > デベロッパーツール）
  2. Applicationタブ（Chrome）で、Storage > Local Storage を開く
  3. 対象ドメインを選択し、旧実装の履歴キーを確認
  4. 該当キーを削除（右クリック > Delete）
  5. アプリを再読み込みし、ローカル履歴が消えていることを確認
  6. 以降は履歴取得/削除をAPI経由に統一


