# 会話履歴機能 設計書

> **⚠️ セキュリティ課題**: 会話履歴管理に関する既知の課題は [セキュリティ課題](../security/セキュリティ課題.md) を参照してください。

## 目的
- 解析結果をユーザー単位で永続化し、サイドバーと結果ページから再参照できる状態にする。
- 解析結果と中間表現を紐づけて取得し、再解析の回数を最小化する。
- 将来的な「お気に入り」などの機能拡張につなげる。

## 全体構成
- 保存先: Firestore（Admin SDK）
   - 参照：[komanavi - Cloud Firestore](https://console.firebase.google.com/u/1/project/zenn-ai-agent-hackathon-vol4/firestore/databases/komanavi/data/~2Fconversation_histories~2F7c5eb35f-17b7-4223-9249-8bacb0dbc92c)
- アクセス経路: Next.js Route Handlers
- 認証: NextAuth
   - `requireUserId()` が `auth()` のセッションから `session.user.id` を取得
- UI: サイドバーで最新履歴表示、結果ページで履歴復元


## データモデル（Firestore）
### コレクション
- `conversation_histories`
- `conversation_results`
- `conversation_intermediates`

### ドキュメントIDの方針
- `conversation_histories`: `historyId` をドキュメントIDとして使用
- `conversation_results`: `resultId` をドキュメントIDとして使用
- `conversation_intermediates`: `resultId` をドキュメントIDとして使用

### conversation_histories
| フィールド | 型 | 必須 | 説明 | 取得方法 |
|---|---|---|---|---|
| userId | string | ✅ | 所有ユーザーID | `requireUserId()` が `session.user.id` から取得 |
| url | string | ✅ | 解析対象URL | POST `/api/history` のリクエストから取得 |
| title | string | ✅ | 解析対象タイトル | POST `/api/history` のリクエストから取得 |
| createdAt | Timestamp | ✅ | 作成日時（サーバ時刻） | サーバで `new Date()` を設定 |
| resultId | string | ✅ | 結果ドキュメントID | POST `/api/history` のリクエストから取得 |

### conversation_results
| フィールド | 型 | 必須 | 説明 | 取得方法 |
|---|---|---|---|---|
| historyId | string | ✅ | 履歴ドキュメントID | POST `/api/history` の `historyId`（採番 or 既存紐づけ） |
| userId | string | ✅ | 所有ユーザーID | `requireUserId()` が `session.user.id` から取得 |
| createdAt | Timestamp | ✅ | 作成日時（サーバ時刻） | サーバで `new Date()` を設定 |
| updatedAt | Timestamp | ✅ | 更新日時（サーバ時刻） | POST/PATCH 時にサーバで `new Date()` を設定 |
| checklist | ChecklistItem[] | ⭕️ | チェックリスト | POST `/api/history` のリクエストから取得 |
| generatedSummary | string | ⭕️ | 生成要約 | POST `/api/history` のリクエストから取得 |
| userIntent | string | ⭕️ | ユーザーの意図入力 | POST/PATCH `/api/history` のリクエストから取得 |
| intentAnswer | string | ⭕️ | 意図ベース回答 | POST/PATCH `/api/history` のリクエストから取得 |
| guidanceUnlocked | boolean | ⭕️ | 意図入力後のガイド表示フラグ | POST/PATCH `/api/history` のリクエストから取得（未指定時は `false`） |
| overview | Overview | ⭕️ | 構造化されたページ概要 | POST `/api/history` のリクエストから取得 |

### conversation_intermediates
| フィールド | 型 | 必須 | 説明 | 取得方法 |
|---|---|---|---|---|
| userId | string | ✅ | 所有ユーザーID | `requireUserId()` が `session.user.id` から取得 |
| historyId | string | ✅ | 履歴ドキュメントID | POST `/api/history` の `historyId`（採番 or 既存紐づけ） |
| resultId | string | ✅ | 結果ドキュメントID | POST `/api/history` のリクエストから取得 |
| createdAt | Timestamp | ✅ | 作成日時（サーバ時刻） | サーバで `new Date()` を設定 |
| intermediate | IntermediateRepresentation | ✅ | 中間表現 | POST `/api/history` のリクエストから取得 |

## API 仕様
### GET /api/history
**最新履歴一覧を取得。**

- 認証: 必須（未認証は 401）
- クエリ:
	- `limit` (number, 1〜100, 省略時50)
- レスポンス: `{ items, limit }`
	- `items`: `createdAt` 降順の履歴配列
	- `items[i]`: `{ id, url, title, resultId, createdAt }`
	- `createdAt`: ISO 8601 文字列 or null

- 実装: [src/app/api/history/route.ts](src/app/api/history/route.ts)

### POST /api/history
**解析結果を保存（履歴・結果・中間表現の分割保存）。**

- 認証: 必須（未認証は 401）
- リクエスト:
	- `resultId` (必須)
	- `url` (必須)
	- `title` (必須)
	- `historyId` (任意)
	- `checklist` (任意)
	- `generatedSummary` (任意)
	- `userIntent` (任意)
	- `intentAnswer` (任意)
	- `guidanceUnlocked` (任意。未指定時は `false`)
	- `overview` (任意)
	- `intermediate` (任意)
- 保存ルール:
	- `historyId` 未指定時はサーバで採番（UUID）
	- `resultId` は必須、`resultId` をドキュメントIDとして使用
	- `checklist` / `userIntent` / `intentAnswer` / `guidanceUnlocked` は型検証し、不正時は 400 を返す
	- `overview` は現行実装では型検証せず、そのまま保存する
	- 既存の `resultId` が別 `historyId` に紐付いている場合は再利用または 409
	- 既存の `historyId` が別 `resultId` に紐付いている場合は再採番または 409
	- `intermediate` が無い場合は中間表現ドキュメントは作成しない
	- `createdAt` はサーバ時刻で毎回更新（履歴・結果・中間表現）
- レスポンス: `{ historyId, resultId }`

- 実装: [src/app/api/history/route.ts](src/app/api/history/route.ts)

### PATCH /api/history/:historyId
**履歴結果を部分更新（チェック状態・意図回答・表示フラグ）。**

- 認証: 必須（未認証は 401）
- リクエスト:
	- `checklist` (任意)
	- `userIntent` (任意)
	- `intentAnswer` (任意)
	- `guidanceUnlocked` (任意)
	- ※ いずれか1つ以上必須
- 更新ルール:
	- `historyId` から `resultId` を解決して `conversation_results` を更新
	- `checklist` / `userIntent` / `intentAnswer` / `guidanceUnlocked` は型検証し、不正時は 400 を返す
	- 所有ユーザーが一致しない場合は 403
	- 不整合（history/result mismatch）は 409

- 実装: [src/app/api/history/[historyId]/route.ts](src/app/api/history/[historyId]/route.ts)

### GET /api/history/:historyId
**履歴詳細を取得（履歴・結果・中間表現）。**

- 認証: 必須（未認証は 401）
- レスポンス: `{ history, result, intermediate }`
	- `history`: 存在しない場合は 404
	- `result` / `intermediate`: 存在しない場合は null
	- `createdAt`: ISO 8601 文字列 or null
	- `history` / `result` / `intermediate` は `id` を含む

- 実装: [src/app/api/history/[historyId]/route.ts](src/app/api/history/[historyId]/route.ts)

### DELETE /api/history/:historyId
**履歴削除（結果・中間表現も同時削除）。**

- 認証: 必須（未認証は 401）
- 削除ルール:
	- `conversation_histories` の `userId` を確認し、所有者のみ削除可能
	- `history.resultId` が存在する場合、同じ `resultId` の `conversation_results` / `conversation_intermediates` を削除
	- 現行実装では `conversation_results` / `conversation_intermediates` の追加所有チェックや不整合チェックは行わない
- レスポンス: `{ deleted, historyId, resultId }`

- 実装: [src/app/api/history/[historyId]/route.ts](src/app/api/history/[historyId]/route.ts)

## 主要フロー
### 解析 → 履歴保存
1. 解析API成功後、`saveHistoryFromResult()` を呼び出し
2. `/api/history` へ POST
3. `historyId` をストアに保存
4. `history:updated` イベントを通知

- 実装: 
   - [src/stores/analyzeStore.ts](src/stores/analyzeStore.ts)
   - [src/lib/history-api.ts](src/lib/history-api.ts)

#### サイドバー表示
1. 起動時に `/api/history?limit=10` を取得
2. `history:updated` を受けて再取得
3. 履歴クリックで `/result?historyId=...` に遷移

- 実装: [src/components/AppSidebar.tsx](src/components/AppSidebar.tsx)

### 結果ページ復元
1. `historyId` がある場合 `/api/history/:historyId` を取得
2. `result` と `intermediate` が揃えば復元して表示（`guidanceUnlocked` を含む）
3. 足りない場合は再解析へフォールバック

- 実装: [src/app/result/page.tsx](src/app/result/page.tsx)

### 履歴削除
1. メニューから削除を実行
2. `/api/history/:historyId` DELETE
3. サイドバーの一覧から即時除去

- 実装: 
   - [src/components/AppSidebar.tsx](src/components/AppSidebar.tsx)
   - [src/components/HistoryItemMenu.tsx](src/components/HistoryItemMenu.tsx)

## 認可・安全性
- 全APIで `requireUserId()` により認証必須
- `conversation_histories` は全APIで `userId` 所有チェック
- `conversation_results` は GET/PATCH で `userId` 所有チェック
- `historyId` / `resultId` の不整合は GET/PATCH で 409、POST は競合時に 409（条件により再利用/再採番あり）
- 既存ドキュメントが別ユーザーの場合は 403（GET/POST/PATCH）

- 実装: 
   - [src/app/api/history/route.ts](src/app/api/history/route.ts)
   - [src/app/api/history/[historyId]/route.ts](src/app/api/history/[historyId]/route.ts), [src/app/api/history/utils.ts](src/app/api/history/utils.ts)

## 認証設定の補足（auth.config.ts）
- OAuth（Googleなど）は `providerAccountId` を安定識別子として採用（プロバイダ側で割り当てられる一意ID）。
- Credentials（Firebaseメール/パスワード）は `user.id` を安定識別子として採用（Firebase UID）。

- 実装: [src/lib/auth.config.ts](src/lib/auth.config.ts)

## 現状の仕様上の注意点
- 一覧APIにページング/カーソルは未実装（`limit` のみ）
- `createdAt` は保存時に常にサーバ時刻を設定（既存ドキュメントも更新される）
- 履歴一覧の専用ページは削除し、現在は存在しない（サイドバーのみ）
- ローカルストレージへの保存は現行実装に含まれない
