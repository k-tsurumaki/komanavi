## 現状の会話履歴（解析履歴）実装の整理

### 概要
- 現状はDBやサーバ保存ではなく、ブラウザの`localStorage`に履歴を保存している。
- 保存対象は「解析履歴（History）」で、会話履歴の永続化は未対応。
- 保存期間は直近90日で、期限切れは読み込み時に自動で間引き。
- ユーザー識別や権限管理はなく、同一ブラウザ（端末・プロファイル）単位でのみ参照可能。

### データ保存先・キー
- 保存先: ブラウザ`localStorage`
- キー
	- `komanavi-history`（履歴一覧）
	- `komanavi-history-results`（履歴に紐づく解析結果）

### データスキーマ
- `HistoryItem`（[src/lib/types/intermediate.ts](src/lib/types/intermediate.ts#L282)）
	- `id`: string（UUID）
	- `url`: string
	- `title`: string
	- `createdAt`: Firestore `Timestamp`
	- `resultId`: string

- `StoredHistoryResult`（[src/lib/storage.ts](src/lib/storage.ts#L7)）
	- `historyId`: string
	- `resultId`: string
	- `createdAt`: Firestore `Timestamp`
	- `result`: AnalyzeResult

### 保存・更新のタイミング
- 解析成功時に`useAnalyzeStore.analyze()`内で保存
	- `HistoryItem`を生成し保存（`saveHistoryItem`）
	- 解析結果を`StoredHistoryResult`として保存（`saveHistoryResult`）
	- 実装: [src/stores/analyzeStore.ts](src/stores/analyzeStore.ts#L62)

### 参照・表示の流れ
- サイドバー最新履歴
	- 起動時に`loadHistoryPage(1, 10)`で直近10件を表示
	- 実装: [src/components/AppSidebar.tsx](src/components/AppSidebar.tsx#L17)

- 履歴一覧ページ
	- `loadHistoryPage(page, 12)`でページング表示
	- `clearHistory()`で全削除
	- 実装: [src/app/history/page.tsx](src/app/history/page.tsx#L1)

- 結果ページ
	- `historyId`がURLにある場合、`loadHistoryDetail(historyId)`で履歴を復元
	- 保存済み`AnalyzeResult`があれば即表示、なければ再解析
	- 実装: [src/app/result/page.tsx](src/app/result/page.tsx#L20)

### 補足挙動
- SSR時は`isBrowser()`でガードされるため、履歴は空扱い
  - 実装: [src/lib/storage.ts](src/lib/storage.ts#L11)
- `loadHistoryDetail`は`historyId`一致が無い場合、`resultId`一致で復元するフォールバックを持つ
  - 実装: [src/lib/storage.ts](src/lib/storage.ts#L63)
- サイドバーの履歴は初回マウント時のみ取得するため、解析後にリアルタイム更新されない
  - 実装: [src/components/AppSidebar.tsx](src/components/AppSidebar.tsx#L17)

### 有効期限（保持期間）
- `HISTORY_RETENTION_DAYS = 90`
- 読み込み時に90日より古い履歴を除外し、`localStorage`を上書き
- 実装: [src/lib/storage.ts](src/lib/storage.ts#L5)

### 現状の制約
- ブラウザローカルのみで永続化され、ユーザー間共有・ログイン連携は未対応。
- 端末/ブラウザ変更で履歴は引き継がれない。
- サーバ側の履歴スキーマ・権限管理は未実装。

### 現状実装の問題点
- 永続性が弱い
	- `localStorage`はユーザー操作やブラウザ設定で容易に削除され、消失リスクが高い（[src/lib/storage.ts](src/lib/storage.ts)）。
- マルチデバイス/再インストールに非対応
	- 端末・ブラウザごとに履歴が分断され、継続利用の体験が成立しない。
- 認可・スコープ管理がない
	- ユーザー単位の所有権や閲覧権限が無く、将来的なログイン連携に繋がらない。
- データ完全性・改ざん耐性がない
	- `localStorage`はクライアント側で容易に改変可能。履歴・結果の信頼性が担保されない（[src/lib/storage.ts](src/lib/storage.ts)）。
- 容量制約とパフォーマンス
	- `AnalyzeResult`全体を`localStorage`に保存するため、データ量が膨らみやすい（[src/stores/analyzeStore.ts](src/stores/analyzeStore.ts#L62)）。
	- ブラウザ容量制限（数MB程度）で上限に達しやすく、保存失敗や古い履歴の喪失が起こり得る。
- SSR/初期描画で履歴が空になる
	- `isBrowser()`ガードによりサーバ側では常に空で、初期表示とクライアントの表示が不一致になり得る（[src/lib/storage.ts](src/lib/storage.ts#L11)）。
- 参照の一貫性が弱い
	- `historyId`が消失しても`resultId`フォールバックで復元するため、履歴の一意性が曖昧になる可能性（[src/lib/storage.ts](src/lib/storage.ts#L63)）。
- UIの即時性不足
	- サイドバー履歴が初回読み込みのみで、解析後に即時反映されない（[src/components/AppSidebar.tsx](src/components/AppSidebar.tsx#L17)）。

## データベースの方式比較（暫定結論）

| 方式 | 永続性/同期 | 認可/権限 | 実装/運用コスト | スケール/性能 | コスト予測 | データサイズ制約 | まとめ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Firestore | 高い（マルチデバイス） | ルールで強制可 | 中（Firebase前提で低め） | 高（自動スケール） | 従量課金で変動 | 1ドキュメント上限 | 本件と相性が良いが、サイズ分割が必須 |
| Postgres（RDB） | 高い | アプリ層で強制 | 中〜高（運用含む） | 高（設計次第） | 予測しやすい | 行サイズ/JSONB制約 | 柔軟だが運用負荷が増える |
| Supabase（Postgres） | 高い | RLSで強制可 | 中（運用は軽め） | 高 | 予測しやすい | 行サイズ/JSONB制約 | RLSが強力、既存Firebase依存が弱いなら有力 |
| MongoDB | 高い | ルール/アプリ層 | 中 | 高 | 従量課金で変動 | ドキュメント上限 | JSONの親和性は高いが運用増 | 
| ローカル永続化継続 | 低い | なし | 低 | 低 | 低 | 端末依存 | 既存課題を解決できない |

### 結論（暫定）
- 既存のFirebase基盤を活かせる前提なら、**Firestore + ルール強制 + 結果の分割保存（またはStorage併用）**が最適。
- ただし、`AnalyzeResult`が大きい場合は**メタと本文を分割**し、本文はStorage/別コレクションに退避する設計が必須。

## 最適化した設計（確定案）

### 0) 認証方式と`userId`正規化（現状）
- 認証基盤は **Auth.js (NextAuth v5) + Firebase Auth** の併用。
	- **Googleログイン**: Auth.jsのGoogle Providerでログイン。
	- **メール/パスワード**: Firebase AuthでIDトークン取得 → Auth.jsのCredentials Providerでセッション作成。
	- 実装: [src/lib/auth.config.ts](src/lib/auth.config.ts), [src/lib/auth.ts](src/lib/auth.ts), [src/app/login/page.tsx](src/app/login/page.tsx)
- `userId`正規化ルール（現状）
	- **`userId = session.user.id`** を唯一の正規化IDとして採用。
	- `session.user.id` は **JWTの`token.id`** を引き継ぐ。
	- `token.id` は **`user.id`** をそのまま保存。
	- `user.id` の実体
		- **Firebase（メール/パスワード）**: `decodedToken.uid`（Firebase UID）
		- **Google（OAuth）**: Auth.jsのGoogle Providerが返す`user.id`（Googleのsub/プロバイダーアカウントID）
- 重要な現状の含意
	- **プロバイダー間でID空間が異なる**（Firebase UIDとGoogle subが混在）。
	- 追加の名前空間付与（例: `firebase:{uid}`, `google:{sub}`）は**現状未実装**。
	- 履歴保存の`userId`は上記の`session.user.id`をそのまま使う前提。

### 1) 要件適合
- 明確なSLOを定義
	- 保持期間: 1年（デフォルト）
	- 一覧取得: 1ページ50件、P95 < 300ms
	- 詳細取得: P95 < 800ms
	- 同時ユーザー: 1,000/日（初期）
	- 解析結果最大サイズ: 200KB（本文は別保存）

### 2) データ設計
- **メタ/本文/付帯情報を分割**し、ドキュメント上限を絶対に超えない構成にする。

**コレクション設計（確定）**

| コレクション/ストレージ | 目的 | 主なフィールド/内容 | 備考 |
| --- | --- | --- | --- |
| `conversation_histories/{historyId}` | 履歴のメタ情報 | `userId`, `url`, `title`, `createdAt`, `resultId`, `summary`, `status`, `sourceDomain`, `tags` | 一覧はこのコレクションを参照 |
| `conversation_results/{resultId}` | 解析結果（構造化） | `historyId`, `userId`, `createdAt`, `checklist`, `intermediateRef`, `mangaRef`, `schemaVersion` | 詳細表示の入口 |
| `conversation_intermediates/{resultId}` | 本文・sources | `intermediate`（本文/根拠） | 大きい本文の分離先 |
| `conversation_manga/{resultId}` | 漫画生成結果 | `manga`（画像URL/パネル） | 画像本体はStorage参照 |
| Storage | 長文/画像 | 長文JSON/画像ファイル | Firestoreは参照URLのみ保持 |

### 3) 書き込み一貫性
- 解析完了時に**Cloud Functions or Server API**で**バッチ/トランザクション**保存。
- 冪等性キー: `resultId`を**解析IDとして固定**し、二重保存を防止。
- 失敗時は**再試行（指数バックオフ）**、最大N回で失敗ログ。

### 4) 認可/セキュリティ
- 書き込みは**サーバ経由のみ**（クライアント直書き禁止）。
- Firestoreルール
	- 読み取り/更新/削除: `request.auth.uid == resource.data.userId`
	- 作成: `request.auth.uid == request.resource.data.userId`
- 監査用に`audit_logs`を追加（誰が何をいつしたか）。

### 5) クエリ/インデックス
- 代表クエリ
	- 一覧: `where(userId) + orderBy(createdAt desc) + limit`
	- 詳細: `historyId`直取得 + `resultId`直取得
- 複合インデックスを事前作成（`userId, createdAt`）。

### 6) コスト/性能
- 一覧は**メタのみ取得**（`summary`まで）。本文は詳細で遅延取得。
- 結果本文はStorage/別コレクションに分離し、読取課金を最小化。
- キャッシュ
	- サーバ: CDN/Edgeキャッシュ
	- クライアント: SWR/React Queryで短期キャッシュ

### 7) SSR整合性
- Next.jsのサーバコンポーネント or APIで**サーバ側取得**を標準化。
- 初期表示はサーバデータを優先し、クライアントは差分更新のみ。

### 8) 移行設計
- 初回ログイン時に`localStorage`履歴を**サーバへ移行**。
- 移行フロー
	1. クライアントが履歴を読み出し
	2. サーバAPIへまとめて送信
	3. サーバ側で`userId`付与し保存
	4. 成功後に`localStorage`をクリア

### 9) 障害耐性/冪等性
- 保存APIは**冪等**（同一`resultId`は更新 or no-op）。
- 解析APIと保存APIを分離し、保存失敗時の再実行を可能にする。
- 失敗ログとリトライキューを用意。

### 10) 運用/監視
- 監視指標: 書込/読取回数、失敗率、P95応答、ストレージ容量。
- 監査ログ/バックアップ方針を明文化。
- TTLルールで古い履歴を自動削除（ユーザー設定で期間変更可）。

## 作業手順（実装タスク分解）

### フェーズ0: 合意事項の確定
1. 既存の認証方式（NextAuth/Firebase Auth）と`userId`の正規化ルールを確定。✅
2. 履歴保持期間・削除ポリシー・サマリー保存方針を最終決定。
	- 保持期間: **1年（デフォルト）**。ユーザー削除は即時反映。
	- 削除ポリシー: **TTL（1年）+ ユーザーによる明示削除**。
	- サマリー保存方針: **`conversation_histories.summary`に300文字以内の要約を保存**。
		- 生成元: 解析結果の要約（既存のサマリーが無い場合は本文先頭から要約生成）。
3. 解析結果の最大サイズ見積もり（$200\,\mathrm{KB}$以内か）を確認。
	- 目標値: **構造化結果は$200\,\mathrm{KB}$以内**、本文/根拠は`conversation_intermediates`またはStorageへ分離。
	- 超過時は本文をStorageへ退避し、メタのみをFirestoreに保存。

### フェーズ1: データ層の準備（Firestore/Storage）
1. Firestoreにコレクションを作成（`conversation_histories`/`conversation_results`/`conversation_intermediates`/`conversation_manga`）。
2. ルールと複合インデックス（`userId + createdAt desc`）を追加。
3. Storageバケットを用意し、本文/画像の格納先を確定。

**実装物（リポジトリ内）**
- Firestore ルール: [firestore.rules](firestore.rules)
- Firestore インデックス: [firestore.indexes.json](firestore.indexes.json)
- Storage ルール: [storage.rules](storage.rules)
- Firebase 設定: [firebase.json](firebase.json)

**Storageパス（確定）**
- `conversation-results/{userId}/{resultId}/...`

### フェーズ2: サーバAPIの実装
1. **保存API**（解析結果の分割保存・冪等）
	- `resultId`を冪等キーとしてアップサート。
	- `history`/`result`/`intermediate`/`manga`を分割保存。
2. **一覧API**（`userId` + `createdAt`降順 + ページング）
3. **詳細API**（`historyId`から`resultId`取得 → 本文参照）
4. **削除API**（論理削除 or TTL前提の削除）
5. 失敗時の再試行（指数バックオフ・最大回数）を実装。

**実装内容（現状）**
- ルート: [src/app/api/history/route.ts](src/app/api/history/route.ts)
	- `GET /api/history`: 一覧取得（`createdAt desc` + `__name__ desc`）
		- クエリ: `limit`（1〜100）、`cursor`（`{createdAtMillis}:{docId}`）
		- レスポンスの`nextCursor`は同形式
	- `POST /api/history`: 保存（分割保存 + バッチ）
		- `historyId`/`resultId`の整合性チェックを実施
		- `createdAt`は**原則サーバ時刻**
		- 移行用途のみ`allowClientCreatedAt`を許可
			- ヘッダー: `x-migration-token`
			- 環境変数: `MIGRATION_TOKEN`
- ルート: [src/app/api/history/[historyId]/route.ts](src/app/api/history/%5BhistoryId%5D/route.ts)
	- `GET /api/history/{historyId}`: 詳細取得（不整合時は409）
	- `DELETE /api/history/{historyId}`: 履歴/関連ドキュメント削除

### フェーズ3: クライアント切替
1. 履歴一覧ページをサーバAPI参照に切替。
2. サイドバー履歴をAPI参照に切替し、解析完了後に再取得。
3. 結果ページの`historyId`復元をサーバAPI参照に切替。
4. キャッシュ戦略（SWR/React Query）を導入。

**実装内容（現状）**
- 履歴APIクライアント: [src/lib/history-api.ts](src/lib/history-api.ts)
- 解析成功時の保存をAPI経由に変更し、`historyId`を保持
	- 実装: [src/stores/analyzeStore.ts](src/stores/analyzeStore.ts#L1)
	- 結果遷移で`historyId`を利用: [src/app/analyze/page.tsx](src/app/analyze/page.tsx#L1)
- サイドバー履歴をAPI参照に切替（`history:updated`で再取得）
	- 実装: [src/components/AppSidebar.tsx](src/components/AppSidebar.tsx#L1)
- 履歴一覧ページをAPI参照に切替（前へ/次へナビ）
	- 実装: [src/app/history/page.tsx](src/app/history/page.tsx#L1)
- 結果ページの履歴復元をAPI参照に切替
	- 実装: [src/app/result/page.tsx](src/app/result/page.tsx#L1)

**追加API（フェーズ3対応）**
- 一括削除: `DELETE /api/history/clear`
	- 実装: [src/app/api/history/clear/route.ts](src/app/api/history/clear/route.ts)

**UI変更点**
- 履歴一覧はページ番号ではなく前へ/次へナビに変更
- `createdAt`が未取得の場合は「-」表示

### フェーズ4: 移行フロー
1. 初回ログイン時に`localStorage`履歴をまとめて送信。
2. サーバ保存成功後に`localStorage`を削除。
3. 移行失敗時の再試行UI/ログを実装。

**実装内容（現状）**
- 移行API: `POST /api/history/migrate`
	- 実装: [src/app/api/history/migrate/route.ts](src/app/api/history/migrate/route.ts)
	- 受信: `historyItems`/`historyResults`
	- 書込み: `conversation_histories`/`conversation_results`/`conversation_intermediates` をバッチ保存
- クライアント移行処理
	- 実装: [src/lib/history-migration.ts](src/lib/history-migration.ts), [src/components/AppShell.tsx](src/components/AppShell.tsx#L1)
	- 初回ログイン時に実行（`userId`単位で一度だけ）
	- 成功後に`localStorage`を削除し、`history:updated`を発火
	- 失敗時は`localStorage`にエラーを記録し、次回ログインで再試行
	- 失敗時に再試行UIを表示（ヘッダー直下）

### フェーズ5: 監視・運用
1. 書込/読取失敗率とP95を監視ダッシュボード化。
2. 監査ログ（`audit_logs`）の保存と保全。
3. TTL/保持期間の変更手順をドキュメント化。

### フェーズ6: 受け入れテスト
1. マルチデバイスで同一ユーザーの履歴同期を確認。
2. `resultId`重複保存の冪等性を検証。
3. 期限超過データの自動削除が行われることを確認。
