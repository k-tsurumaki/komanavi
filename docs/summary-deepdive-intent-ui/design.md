# ページ理解モード・深掘りチャット・意図入力 実装設計書

## 1. 目的
ページ理解モード・深掘りチャット・意図入力まわりの実装内容を、現行コードと一致する形でレビュー可能に整理する。

- 差分基準: 現行ブランチの実装
- 対象: 「1分でわかる！平易化されたWebページ」「深掘りチャット」「意図入力」

## 2. 差分スコープ（現行実装）

- 代表ファイル:
  - `prompts/deep-dive.txt`
  - `prompts/intent-answer.txt`
  - `prompts/intermediate.txt`
  - `prompts/overview.txt`
  - `prompts/simple-summary.txt`
  - `src/app/analyze/page.tsx`
  - `src/app/api/analyze/route.ts`
  - `src/app/api/history/route.ts`
  - `src/app/api/history/[historyId]/route.ts`
  - `src/app/result/page.tsx`
  - `src/components/ChecklistViewer.tsx`
  - `src/components/SummaryViewer.tsx`
  - `src/lib/gemini.ts`
  - `src/lib/history-api.ts`
  - `src/lib/types/intermediate.ts`
  - `src/stores/analyzeStore.ts`

## 3. エンドツーエンドフロー

1. `/analyze` で URL を入力して解析を実行
2. `/api/analyze` default mode で以下を順次生成
   1. `fetchWithGoogleSearch` — Google Search 取得結果
   2. `generateIntermediateRepresentation` — 中間表現
   3. `generateChecklist` — チェックリスト
   4. `generateSimpleSummary` — 平易化要約
   5. `generateOverview` — 構造化ページ概要
   6. （`userIntent` があれば）`generateIntentAnswer` — 意図回答
3. 解析成功後、`/analyze` → `/result` へ遷移（常に `url` を付与）
   - 履歴保存は非同期で継続し、成功時は `historyId` をクエリへ追記（UX優先）
4. `/result` でページ理解モードを表示
5. 同一画面で深掘りチャット（タブ切替）
6. 意図入力タブへ切替→意図確定で `mode: intent` により回答を再生成
7. 意図回答確定後にチェックリスト・漫画・Google検索引用・出典を表示（`guidanceUnlocked=true`）

補足:
- `/result?url=...` のみでアクセスした場合、自動解析せず手動ボタンで解析を開始する
- `/result?historyId=...&url=...` の場合、履歴復元を試み、失敗時は `url` で手動再解析導線にフォールバックする

## 4. フロントエンド設計

### 4.1 Resultページ (`src/app/result/page.tsx`)

レイアウト:

| 順序 | コンポーネント | 表示条件 |
|------|--------------|----------|
| 1 | `DisclaimerBanner` | 常時 |
| 2 | `SummaryViewer`（`hideDetails` 付き） | 常時 |
| 3 | 深掘り / 意図入力タブ切替カード | 常時（`chatMode` で切替） |
| 4 | 意図回答カード | `guidanceUnlocked \|\| isIntentGenerating` |
| 5 | チェックリスト・漫画・`GoogleSearchAttribution`・`SourceReference` | `guidanceUnlocked && !isIntentGenerating` |

主な挙動:
- `url` クエリだけで `/result` に来た場合、自動解析しない（手動ボタン「このURLを解析する」でのみ開始）
- 意図再生成中（`isIntentGenerating`）は全体ローディングへ戻さず、結果画面を維持
- 意図入力はロック（`isIntentLocked`）/ 再編集切替を持つ
  - 再編集ボタンは `guidanceUnlocked && isIntentLocked && !isIntentGenerating` で表示
- dev にあった「結果をダウンロード」ボタンは削除
- 履歴更新は `PATCH /api/history/:historyId` で部分更新
  - チェックリストトグルは即時UI更新し、デバウンスでPATCH
  - `historyId` 未確定時は pending に保持し、確定後にflush

履歴復元:
- `/analyze` からの遷移は常に `url` をクエリに含める（`historyId` は保存成功後に追記される）
- `historyId` 復元失敗時は `setResult(null)` の上で `url` 再解析導線へフォールバック
- `isHistoryResolving` が `true` の間は手動再解析CTAを表示しない（復元処理との競合防止）
- 復元時に `result.userIntent` を `intentInput`/store の `intent` に戻し、編集可能状態を再現

深掘りチャットのメッセージ管理:
- メッセージが20件を超えると、古いメッセージを `summaryOnly: true` で要約しトリミング
- 要約失敗時は全メッセージを保持（データ損失を防ぐ）
- チャット吹き出しは `user` と `assistant` で視覚スタイルを分離（`user`: blue系, `assistant`: slate系）

### 4.2 ページ理解モード (`src/components/SummaryViewer.tsx`)

Props:

| Prop | 型 | Default | 説明 |
|------|------|---------|------|
| `data` | `IntermediateRepresentation` | — | 中間表現 |
| `overview` | `Overview?` | `undefined` | 構造化ページ概要 |
| `showTitle` | `boolean?` | `true` | タイトル表示 |
| `hideDetails` | `boolean?` | `false` | `true` 時は中間表現の詳細を非表示にし overview ブロックのみ表示 |

表示ブロック（overview モード）:

| 表示名 | `OverviewBlockId` | ソース | 表示条件 |
|--------|-------------------|--------|----------|
| 30秒で把握 | `conclusion` | `overview.conclusion` / `data.summary` | 常時 |
| だれ向けの情報か | `targetAudience` | `overview.targetAudience` / `data.target` | 常時 |
| このページで実現できること | `achievableOutcomes` | intermediate から自動導出 | 常時（最大3件） |
| このページの最重要ポイント | `criticalFacts` | overview 優先 → intermediate から自動生成 | データがある場合のみ |
| 見落とすと困る注意点 | `cautions` | `overview.cautions` / `data.warnings` | 常時 |
| 問い合わせ情報 | `contactInfo` | `data.contact` / `data.procedure` | データがある場合のみ |
| 証跡URL | — | `evidenceByBlock` → fallback pool | 末尾に集約表示 |

補足仕様:
- 注意点ブロックには問い合わせ情報を混在させない（`hasContactKeyword` でフィルタ）
- 問い合わせ情報は電話/メール/窓口等を表形式で表示、重複排除済み
- `criticalFacts` は overview から優先取得し、欠損時は intermediate のキーポイント・手続き・期限等から自動生成
- `achievableOutcomes` は intermediate の対象・手続き・給付・連絡先の有無から自動導出（最大3件）

### 4.3 意図回答カード

表示スキーマ（`StructuredIntentAnswer`）:

| フィールド | 型 | 説明 | UIカラー |
|-----------|------|------|----------|
| `headline` | `string` | 回答要点 | — |
| `finalJudgment` | `IntentAnswerEntry` | 対象可能性の判断 | sky |
| `firstPriorityAction` | `IntentAnswerEntry` | 最優先の1手 | emerald |
| `failureRisks` | `IntentAnswerEntry[]` | 失敗リスク（最大2件） | amber |

JSONパース戦略:
（実装箇所: `src/lib/intent-answer-parser.ts`）
1. `JSON.parse` を試行
2. 失敗時は `extractJsonChunk` でコードフェンスを除去し、ネスト対応の括弧マッチングでJSON部分を抽出
3. 各フィールドは `normalizeIntentEntry` で正規化（`text` のみ使用、欠損時は所定のフォールバック文言）
4. `core` が存在しない場合はルートオブジェクトを `core` として扱う
5. `finalJudgment` のキーは `targetJudgment` / `targetAudienceDecision` もフォールバック候補

表示ルール:
- JSONパース成功時は構造化カード表示（色分け: 判断=sky、アクション=emerald、リスク=amber）
- 失敗時はテキスト行単位にフォールバック（改行区切りのリスト表示）
- 生成中文言:
  - `あなた向けの回答を作成しています。まもなくご確認いただけます。`

## 5. API設計 (`src/app/api/analyze/route.ts`)

### 5.1 default mode

- 入力: `url`, optional `userIntent`
- 処理（順次実行）:
  1. `buildPersonalizationInput(userIntent)` — パーソナライズ情報を構築（認証失敗時も非パーソナライズで継続）
  2. `fetchWithGoogleSearch(url)` — Google Search Grounding 取得
  3. `generateIntermediateRepresentation` — 中間表現生成
  4. `generateChecklist` — チェックリスト生成
  5. `generateSimpleSummary` — 平易化要約生成（パーソナライズ適用）
  6. `generateOverview` — 構造化ページ概要生成
  7. optional `generateIntentAnswer` — 意図回答生成（`userIntent` がある場合のみ）
- 出力: `AnalyzeResult`（`overview`, `intentAnswer`, `userIntent`, `guidanceUnlocked` を含む）
- `guidanceUnlocked` は default mode では `false` で初期化
- 備考: `buildPersonalizationInput` は deepDive/intent mode でも共用するヘルパー関数として抽出

### 5.2 `mode: deepDive` / `mode: intent` 比較

|  | deepDive | intent |
|--|---------|--------|
| **必須入力** | `summary`, `messages` | `userIntent`, `intermediate` |
| **任意入力** | `deepDiveSummary`, `summaryOnly` | `messages`, `deepDiveSummary`, `overviewTexts`, `checklistTexts` |
| **レスポンス型** | `DeepDiveResponse` | `IntentAnswerResponse` |
| **主要出力** | `answer?`, `summary?` | `intentAnswer?` |
| **パーソナライズ** | なし | `buildPersonalizationInput(userIntent)` |

仕様補足:
- deepDive: `summaryOnly=true` 時は要約更新専用で `answer` 空を許容。フロント側でメッセージ20件超過時に呼び出し
- intent: `overviewTexts` / `checklistTexts` は重複抑制文脈として使用

### 5.4 エラー方針

- modeごとに必須パラメータをバリデーション
- 失敗時は 400/500 を返す
- 認証情報が取れない場合でも非パーソナライズで継続

## 6. 型と状態管理

### 6.1 型 (`src/lib/types/intermediate.ts`)

追加型:

| 型名 | 主要フィールド | 用途 |
|------|--------------|------|
| `GroundingSupport` | `segment`, `groundingChunkIndices` | 本文とチャンクの紐付け |
| `Overview` | `conclusion`, `targetAudience`, `purpose`, `topics`, `cautions`, `criticalFacts?`, `evidenceByBlock?` | 構造化ページ概要 |
| `OverviewCriticalFact` | `item`, `value`, `reason` | 最重要ポイント行 |
| `OverviewBlockId` | union: `conclusion` \| `targetAudience` \| `achievableOutcomes` \| `criticalFacts` \| `cautions` \| `contactInfo` | 表示ブロック識別子 |
| `OverviewEvidenceByBlock` | `Partial<Record<OverviewBlockId, string[]>>` | ブロック別証跡URLマップ |
| `ChatMessage` | `role: 'user' \| 'assistant'`, `content` | 深掘りチャットメッセージ |
| `DeepDiveRequest` | `mode: 'deepDive'`, `summary`, `messages`, `deepDiveSummary?`, `summaryOnly?` | 深掘りリクエスト |
| `IntentAnswerRequest` | `mode: 'intent'`, `userIntent`, `intermediate`, `messages?`, `deepDiveSummary?`, `overviewTexts?`, `checklistTexts?` | 意図回答リクエスト |
| `DeepDiveResponse` | `status`, `answer?`, `summary?`, `error?` | 深掘りレスポンス |
| `IntentAnswerResponse` | `status`, `intentAnswer?`, `error?` | 意図回答レスポンス |

変更型:

| 型名 | 変更内容 |
|------|----------|
| `GroundingMetadata` | `groundingSupports?: GroundingSupport[]` を追加 |
| `AnalyzeResult` | `overview?: Overview`, `intentAnswer?: string`, `userIntent?: string`, `guidanceUnlocked?: boolean` を追加 |
| `AnalyzeRequest` | union 型に変更: `{ url, userIntent?, mode?: 'default' }` \| `DeepDiveRequest` \| `IntentAnswerRequest` |

### 6.2 Store (`src/stores/analyzeStore.ts`)

状態:

| 状態 | 型 | 初期値 | 区分 |
|------|----|--------|------|
| `url` | `string` | `''` | 既存 |
| `status` | `AnalyzeStatus` | `'idle'` | 既存 |
| `result` | `AnalyzeResult \| null` | `null` | 既存 |
| `error` | `string \| null` | `null` | 既存 |
| `lastHistoryId` | `string \| null` | `null` | 既存 |
| `activeAnalyzeRequestId` | `string \| null` | `null` | 追加 |
| `messages` | `ChatMessage[]` | `[]` | **追加** |
| `intent` | `string` | `''` | **追加** |
| `deepDiveSummary` | `string` | `''` | **追加** |

操作:

| 操作 | シグネチャ | 区分 | 備考 |
|------|-----------|------|------|
| `setMessages` | `(messages) => void` | 追加 | メッセージ一括設定 |
| `addMessage` | `(message) => void` | 追加 | メッセージ追加 |
| `setIntent` | `(intent) => void` | 追加 | 意図設定 |
| `setDeepDiveSummary` | `(summary) => void` | 追加 | 深掘り要約設定 |
| `resetDeepDiveState` | `() => void` | 追加 | `messages`, `intent`, `deepDiveSummary` を初期化 |
| `analyze` | `(url, userIntent?) => Promise<void>` | 変更 | `userIntent` を受け取り API に送信。成功後に深掘り状態を自動リセット |
| `setLastHistoryId` | `(historyId) => void` | 既存 | 履歴IDを後段保存完了時に設定 |

`analyze` の更新方針:
- `requestId`（`activeAnalyzeRequestId`）で非同期処理を相関管理
- `status='success'` を先に立てて結果遷移をブロックしない（履歴保存失敗でもUX継続）
- 履歴保存成功時のみ `lastHistoryId` を更新し、`/result` のURLに `historyId` を追記

## 7. プロンプト設計

### 7.1 `prompts/overview.txt`

- JSON固定出力
- `criticalFacts` は3〜5件、項目名は可変
- `contact` 情報は `criticalFacts` / `cautions` に混在させない
- `evidenceByBlock` は入力内URLのみ利用

### 7.2 `prompts/deep-dive.txt`

- 出力を `{ "answer": "...", "summary": "..." }` に固定
- `summaryOnly` 運用を許可

### 7.3 `prompts/intent-answer.txt`

- 出力を以下に固定:
  - `headline`
  - `core.finalJudgment.text`
  - `core.firstPriorityAction.text`
  - `core.failureRisks[].text`
- `existingGuides.overviewTexts` / `existingGuides.checklistTexts` との重複抑制を明示
- `evidenceUrls` は出力仕様に含めない

### 7.4 `prompts/intermediate.txt`

- `title` 指示を強化: 「だれ向け・何の内容かが一目で分かる短い表現。12〜20文字程度。やさしい日本語」
- ルール追加: 「元の長い題名をそのまま使わず、内容が伝わる短い言い換えにする」

### 7.5 `prompts/simple-summary.txt`

- 出力構成を全面刷新（旧: タイトル・ポイント・手続き・注意 → 新: テーマ・対象者・目的・主要トピック・注意事項）
- 見出しは `##` 固定、各セクションは箇条書き（`-`）のみ（見出し直下の平文禁止）
- セクション順序を厳守する指示を追加

## 8. 証跡URL設計

### 8.1 共通正規化（`normalizeEvidenceUrl`）

- `http/https` のみ採用
- hash除去
- 末尾スラッシュ正規化
- 表示名は grounding chunk の `title` 優先、欠損時は `hostname`（`www.` 除去）

### 8.2 URLプール構築（`SummaryViewer` 内）

- `source_url`, `groundingChunks[].web.uri`, `relatedLinks[].url`, `contact.website` から構築
- 各URLを正規化し `knownEvidenceUrls` Set に登録
- `evidenceTitleByUrl` Map でURL→表示名の対応を保持

### 8.3 ページ理解モードの証跡表示

- `overview.evidenceByBlock`（`OverviewBlockId` → URL配列）を最優先
- 欠損時は `fallbackEvidenceByBlock` としてURLプールからブロック単位で自動割当
- `getBlockEvidenceUrls(blockId)` でブロックごとに最大3件を取得
- `source_url` のみしかない場合は証跡表示を抑制（非source URLが0件なら空配列を返す）
- 各コンテンツブロック内には表示せず、ページ理解モード末尾の「証跡URL」セクションに集約

### 8.4 意図回答の証跡 (`result/page.tsx`)

- 意図回答カード内には証跡URLを表示しない
- 根拠情報は下部の `GoogleSearchAttribution` / `SourceReference` に集約

## 9. 履歴保存・復元

### 9.1 保存 (`src/app/api/history/route.ts`, `src/lib/history-api.ts`)

- 保存対象:
  - `checklist`
  - `generatedSummary`
  - `userIntent`
  - `intentAnswer`
  - `guidanceUnlocked`
  - `overview`
  - `intermediate`
- `resultId` と `historyId` を整合チェックして保存
- `createdAt` / `updatedAt` をサーバ時刻で設定

### 9.2 部分更新 (`src/app/api/history/[historyId]/route.ts`)

- `PATCH /api/history/:historyId` で以下を部分更新:
  - `checklist`
  - `userIntent`
  - `intentAnswer`
  - `guidanceUnlocked`
- `historyId` → `resultId` を解決して `conversation_results` を更新
- 認可・整合チェック:
  - `userId` 一致
  - `historyId` と `result.historyId` の整合
- `updatedAt` を更新

### 9.3 復元 (`src/app/api/history/[historyId]/route.ts`)

- `history` / `result` / `intermediate` を同時返却
- ユーザーIDと `historyId` の整合を検証
- `result.userIntent` / `result.intentAnswer` / `result.guidanceUnlocked` を復元

## 10. 受け入れチェック項目

1. `/result` でページ理解モードの主要ブロック（30秒で把握・だれ向け・実現できること・注意点）が表示される
2. `このページの最重要ポイント` と `問い合わせ情報` はデータがある場合のみ表示される
3. 証跡URLがページ理解モード末尾に集約表示され、source_url のみの場合は抑制される
4. 深掘り送信で `mode: deepDive` が呼ばれ、回答と要約が更新される
5. 深掘りメッセージ20件超過時に要約圧縮が動作する
6. 意図確定で `mode: intent` が呼ばれ、構造化回答カードが表示される
7. 意図回答のJSONパース失敗時にテキスト行フォールバックが表示される
8. 意図回答カード内に証跡URLが表示されない
9. 意図確定後にチェックリスト・漫画・Google検索引用・出典が表示される
10. `/result?url=...` のみアクセス時に自動解析せず、手動ボタンが表示される
11. 履歴復元失敗時に `url` があればフォールバックで手動再解析導線が維持される
12. `/analyze` → `/result` 遷移時に常に `url` がクエリに含まれる
13. 履歴から戻った際に `userIntent` が入力欄へ復元され、意図編集導線が表示される
14. チェックリストトグルは即時反映され、履歴更新はデバウンスPATCHで同期される
