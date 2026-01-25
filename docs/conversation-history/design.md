## 会話履歴機能 設計書

### 目的
- 解析結果をユーザー単位で永続化し、サイドバーと結果ページから再参照できるようにする。
- 解析結果・中間表現を紐づけて取得し、再解析の回数を最小化する。

### 全体構成
- 保存先: Firestore（Admin SDK）
- アクセス経路: Next.js Route Handlers
- 認証: NextAuth（`requireUserId()` によるユーザーID取得）
- UI: サイドバーで最新履歴表示、結果ページで履歴復元

関連実装:
- API: [src/app/api/history/route.ts](src/app/api/history/route.ts), [src/app/api/history/[historyId]/route.ts](src/app/api/history/[historyId]/route.ts)
- クライアントAPI: [src/lib/history-api.ts](src/lib/history-api.ts)
- サイドバー: [src/components/AppSidebar.tsx](src/components/AppSidebar.tsx)
- 結果ページ: [src/app/result/page.tsx](src/app/result/page.tsx)
- 解析ストア: [src/stores/analyzeStore.ts](src/stores/analyzeStore.ts)

### データモデル（Firestore）
#### コレクション
- `conversation_histories`
- `conversation_results`
- `conversation_intermediates`

#### conversation_histories
| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| userId | string | ✅ | 所有ユーザーID |
| url | string | ✅ | 解析対象URL |
| title | string | ✅ | 解析対象タイトル |
| createdAt | Timestamp | ✅ | 作成日時（サーバ時刻） |
| resultId | string | ✅ | 結果ドキュメントID |

#### conversation_results
| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| historyId | string | ✅ | 履歴ドキュメントID |
| userId | string | ✅ | 所有ユーザーID |
| createdAt | Timestamp | ✅ | 作成日時（サーバ時刻） |
| checklist | ChecklistItem[] | ⭕️ | チェックリスト |
| generatedSummary | string | ⭕️ | 生成要約 |

#### conversation_intermediates
| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| userId | string | ✅ | 所有ユーザーID |
| historyId | string | ✅ | 履歴ドキュメントID |
| resultId | string | ✅ | 結果ドキュメントID |
| createdAt | Timestamp | ✅ | 作成日時（サーバ時刻） |
| intermediate | IntermediateRepresentation | ✅ | 中間表現 |

### API 仕様
#### GET /api/history
最新履歴一覧を取得。

- 認証: 必須（未認証は 401）
- クエリ:
	- `limit` (number, 1〜100, 省略時50)
- レスポンス: `{ items, limit }`
	- `items`: `createdAt` 降順の履歴配列
	- `createdAt`: ISO 8601 文字列 or null

実装: [src/app/api/history/route.ts](src/app/api/history/route.ts)

#### POST /api/history
解析結果を保存（履歴・結果・中間表現の分割保存）。

- 認証: 必須（未認証は 401）
- リクエスト:
	- `resultId` (必須)
	- `url` (必須)
	- `title` (必須)
	- `historyId` (任意)
	- `checklist` (任意)
	- `generatedSummary` (任意)
	- `intermediate` (任意)
- 保存ルール:
	- `historyId` 未指定時はサーバで採番
	- `resultId` と `historyId` の整合性チェック
	- 既存リンクがある場合は再利用または競合エラー
	- `createdAt` はサーバ時刻
- レスポンス: `{ historyId, resultId }`

実装: [src/app/api/history/route.ts](src/app/api/history/route.ts)

#### GET /api/history/:historyId
履歴詳細を取得（履歴・結果・中間表現）。

- 認証: 必須（未認証は 401）
- レスポンス: `{ history, result, intermediate }`
	- `history`: null の場合は 404
	- `result` / `intermediate`: 存在しない場合は null
	- `createdAt`: ISO 8601 文字列

実装: [src/app/api/history/[historyId]/route.ts](src/app/api/history/[historyId]/route.ts)

#### DELETE /api/history/:historyId
履歴削除（結果・中間表現も同時削除）。

- 認証: 必須（未認証は 401）
- レスポンス: `{ deleted, historyId, resultId }`

実装: [src/app/api/history/[historyId]/route.ts](src/app/api/history/[historyId]/route.ts)

### 主要フロー
#### 解析 → 履歴保存
1. 解析API成功後、`saveHistoryFromResult()` を呼び出し
2. `/api/history` へ POST
3. `historyId` をストアに保存
4. `history:updated` イベントを通知

実装: [src/stores/analyzeStore.ts](src/stores/analyzeStore.ts), [src/lib/history-api.ts](src/lib/history-api.ts)

#### サイドバー表示
1. 起動時に `/api/history?limit=10` を取得
2. `history:updated` を受けて再取得
3. 履歴クリックで `/result?historyId=...` に遷移

実装: [src/components/AppSidebar.tsx](src/components/AppSidebar.tsx)

#### 結果ページ復元
1. `historyId` がある場合 `/api/history/:historyId` を取得
2. `result` と `intermediate` が揃えば復元して表示
3. 足りない場合は再解析へフォールバック

実装: [src/app/result/page.tsx](src/app/result/page.tsx)

#### 履歴削除
1. メニューから削除を実行
2. `/api/history/:historyId` DELETE
3. サイドバーの一覧から即時除去

実装: [src/components/AppSidebar.tsx](src/components/AppSidebar.tsx), [src/components/HistoryItemMenu.tsx](src/components/HistoryItemMenu.tsx)

### 認可・安全性
- 全APIで `requireUserId()` により認証必須
- 各ドキュメントは `userId` で所有チェック
- `historyId` / `resultId` の不整合は 409 で拒否

実装: [src/app/api/history/route.ts](src/app/api/history/route.ts), [src/app/api/history/[historyId]/route.ts](src/app/api/history/[historyId]/route.ts), [src/app/api/history/utils.ts](src/app/api/history/utils.ts)

### 現状の仕様上の注意点
- 一覧APIにページング/カーソルは未実装（`limit` のみ）
- `createdAt` は保存時に常にサーバ時刻を設定
- 履歴一覧の専用ページは現状存在しない（サイドバーのみ）
- ローカルストレージへの保存は現行実装に含まれない

### 今後の拡張候補（現状外）
- 一覧APIのカーソルページング対応
- `intermediate` 欠損時の表示強化
- 履歴一覧ページの再導入
