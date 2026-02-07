# ページ理解モード・深掘りチャット・意図入力 実装設計書

## 1. 目的
`feature/summary-deepdive-intent-ui` の実装内容を、現行コードと一致する形でレビュー可能に整理する。

- 差分基準: `dev..feature/summary-deepdive-intent-ui`
- 対象: 「1分でわかる！平易化されたWebページ」「深掘りチャット」「意図入力」
- 本書は直近の整理（`focus` 削除、`evidenceUrls` 契約削除、履歴復元フロー修正、未使用state削除）を反映済み

## 2. 今回の整理で反映した変更点

1. `focus` を実装から完全撤去
- 型: `DeepDiveRequest` / `IntentAnswerRequest` から削除
- Store: `focus` state / setter を削除
- API: `/api/analyze` deepDive/intent payload から削除
- LLM呼び出し: `generateDeepDiveResponse` / `generateIntentAnswer` から削除
- Prompt文言: deep-dive / intent-answer から関連文言を削除

2. 意図回答の `evidenceUrls` 契約を削除
- Promptの出力JSONをテキスト中心に単純化（`headline` + `core`）
- UIパーサーも `text` のみを正規化する構成へ統一

3. 履歴復元フローを修正
- `/analyze` → `/result` 遷移時に常に `url` クエリを付与（保存成功時は `historyId` も付与）
- `historyId` 復元失敗時は `setResult(null)` の上で `url` 再解析導線へフォールバック
- `historyId` 解決中は手動再解析CTAを非表示にし、復元処理との競合を防止

4. 未使用stateを削除
- `src/app/result/page.tsx` の `isNavigatingToAnalyzeRef` を削除
- 将来の誤解を生む write-only state を排除

## 3. 差分スコープ（dev基準）

- 変更ファイル: 15
- 代表ファイル:
  - `prompts/deep-dive.txt`
  - `prompts/intent-answer.txt`
  - `prompts/intermediate.txt`
  - `prompts/overview.txt`
  - `prompts/simple-summary.txt`
  - `src/app/analyze/page.tsx`
  - `src/app/api/analyze/route.ts`
  - `src/app/api/history/route.ts`
  - `src/app/result/page.tsx`
  - `src/components/SummaryViewer.tsx`
  - `src/lib/gemini.ts`
  - `src/lib/history-api.ts`
  - `src/lib/types/intermediate.ts`
  - `src/stores/analyzeStore.ts`

## 4. エンドツーエンドフロー

1. `/analyze` で URL を入力して解析を実行
2. `/api/analyze` default mode で以下を生成
- Google Search 取得結果
- 中間表現（intermediate）
- ページ理解用 `overview`
- チェックリスト
- 平易化要約
- （`userIntent` があれば）意図回答
3. `/result` でページ理解モードを表示
4. 同一画面で深掘りチャット
5. 意図入力を確定し、`mode: intent` で回答を再生成
6. 意図回答確定後にチェックリスト・漫画・Google検索引用・出典を表示

## 5. フロントエンド設計

### 5.1 Resultページ (`src/app/result/page.tsx`)

- 上段: `SummaryViewer`（ページ理解モード）
- 中段: 深掘り/意図入力の切替カード
- 下段: 意図回答カード（生成中インジケータ付き）
- 後段: チェックリスト、漫画、`GoogleSearchAttribution`、`SourceReference`

主な挙動:
- `url` クエリだけで `/result` に来た場合、自動解析しない
- 手動ボタン「このURLを解析する」でのみ解析開始
- 意図再生成中は全体ローディングへ戻さず、結果画面を維持
- 意図入力はロック/再編集切替を持つ
- `/analyze` からの遷移は常に `url` をクエリに含める（保存成功時は `historyId` も付与）
- `historyId` 復元に失敗しても `url` があれば `idle` にフォールバックし、手動再解析導線を維持する
- `historyId` がある間は復元確定まで手動再解析CTAを表示しない（復元処理との競合防止）

### 5.2 ページ理解モード (`src/components/SummaryViewer.tsx`)

表示ブロック:
- `30秒で把握`
- `だれ向けの情報か`
- `このページで実現できること`
- `このページの最重要ポイント`（表）
- `見落とすと困る注意点`
- `問い合わせ情報`（独立ブロック）

補足仕様:
- 注意点ブロックには問い合わせ情報を混在させない
- 問い合わせ情報は電話/メール/窓口等を表形式で表示

### 5.3 意図回答カード

表示スキーマ:
- `headline`
- `core.finalJudgment`
- `core.firstPriorityAction`
- `core.failureRisks`（1〜2件想定、最大2件表示）

表示ルール:
- JSONパース成功時は構造化カード表示
- 失敗時はテキスト行単位にフォールバック
- 生成中文言:
  - `あなた向けの回答を作成しています。まもなくご確認いただけます。`

## 6. API設計 (`src/app/api/analyze/route.ts`)

### 6.1 default mode

- 入力: `url`, optional `userIntent`
- 処理:
  - `fetchWithGoogleSearch`
  - `generateIntermediateRepresentation`
  - `generateChecklist`
  - `generateSimpleSummary`
  - `generateOverview`
  - optional `generateIntentAnswer`
- 出力: `AnalyzeResult`

### 6.2 `mode: deepDive`

- 入力: `summary`, `messages`, optional `deepDiveSummary`, optional `summaryOnly`
- 出力: `{ status, answer, summary }`
- 仕様:
  - `summaryOnly=true` 時は要約更新専用で `answer` 空を許容
  - `focus` は使用しない

### 6.3 `mode: intent`

- 入力:
  - `userIntent`
  - `intermediate`
  - optional `messages`
  - optional `deepDiveSummary`
  - optional `overviewTexts`
  - optional `checklistTexts`
- 出力: `{ status, intentAnswer }`
- 仕様:
  - `overviewTexts/checklistTexts` は重複抑制文脈として使用
  - `focus` は使用しない

### 6.4 エラー方針

- modeごとに必須パラメータをバリデーション
- 失敗時は 400/500 を返す
- 認証情報が取れない場合でも非パーソナライズで継続

## 7. 型と状態管理

### 7.1 型 (`src/lib/types/intermediate.ts`)

主要型:
- `AnalyzeResult` に `overview?: Overview`, `intentAnswer?: string`
- `GroundingMetadata` に `groundingSupports?: GroundingSupport[]`
- `DeepDiveRequest` / `IntentAnswerRequest` は `focus` なし

### 7.2 Store (`src/stores/analyzeStore.ts`)

保持状態:
- `messages`
- `intent`
- `deepDiveSummary`
- `checkedItems`
- `lastHistoryId`

提供操作:
- `setMessages`
- `addMessage`
- `setIntent`
- `setDeepDiveSummary`
- `resetDeepDiveState`
- `analyze(url, userIntent?)`

## 8. プロンプト設計

### 8.1 `prompts/overview.txt`

- JSON固定出力
- `criticalFacts` は3〜5件、項目名は可変
- `contact` 情報は `criticalFacts` / `cautions` に混在させない
- `evidenceByBlock` は入力内URLのみ利用

### 8.2 `prompts/deep-dive.txt`

- 出力を `{ "answer": "...", "summary": "..." }` に固定
- `summaryOnly` 運用を許可

### 8.3 `prompts/intent-answer.txt`

- 出力を以下に固定:
  - `headline`
  - `core.finalJudgment.text`
  - `core.firstPriorityAction.text`
  - `core.failureRisks[].text`
- `existingGuides.overviewTexts` / `existingGuides.checklistTexts` との重複抑制を明示
- `evidenceUrls` は出力仕様に含めない

### 8.4 `prompts/intermediate.txt` / `prompts/simple-summary.txt`

- タイトル短文化、平易表現、構成順序を強化

## 9. 証跡URL設計

### 9.1 共通正規化

- `http/https` のみ採用
- hash除去
- 末尾スラッシュ正規化
- 表示名は `title` 優先、欠損時は hostname

### 9.2 ページ理解モードの証跡 (`SummaryViewer`)

- `overview.evidenceByBlock` を最優先
- 欠損時は既知URLプールからブロック単位でフォールバック
- 入力元URL（`source_url`）だけしかない場合は証跡表示を抑制

### 9.3 意図回答の証跡 (`result/page.tsx`)

- 意図回答カード内には証跡URLを表示しない
- 根拠情報は下部の `GoogleSearchAttribution` / `SourceReference` に集約

## 10. 履歴保存・復元

### 10.1 保存 (`src/app/api/history/route.ts`, `src/lib/history-api.ts`)

- 保存対象:
  - `checklist`
  - `generatedSummary`
  - `overview`
  - `intermediate`
- `resultId` と `historyId` を整合チェックして保存

### 10.2 復元 (`src/app/api/history/[historyId]/route.ts`)

- `history` / `result` / `intermediate` を同時返却
- ユーザーIDと `historyId` の整合を検証

## 11. 既知課題

1. `src/lib/gemini.ts` の `extractText` が `parts[0].text` 固定
- 複数part返却時にテキスト欠落の余地あり

2. Debugログの残存
- `src/lib/gemini.ts`, `src/app/api/analyze/route.ts` にデバッグログが残る

## 12. 受け入れチェック項目

1. `/result` でページ理解モード6ブロックが表示される
2. 深掘り送信で `mode: deepDive` が呼ばれ、回答と要約が更新される
3. 意図確定で `mode: intent` が呼ばれ、構造化回答カードが表示される
4. 意図回答カード内に証跡URLが表示されない
5. 意図確定後にチェックリスト・漫画・Google検索引用・出典が表示される
