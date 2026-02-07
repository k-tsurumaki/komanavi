# ページ理解モード・深掘りチャット・意図入力 実装設計書

## 1. 文書の目的
- `feature/summary-deepdive-intent-ui` ブランチで実装した「1分でわかる！平易化されたWebページ」「深掘りチャット」「意図入力」機能を、実装準拠で整理する。
- 基準差分は `dev..feature/summary-deepdive-intent-ui` とする。
- 併せて、ローカル未コミット変更（回答根拠ロジック・意図回答JSON化など）も反映した現時点仕様を記載する。

## 2. 差分サマリ（dev基準）

### 2.1 対象ファイル
- `docs/summary-deepdive-intent-ui/desigin.md`
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

### 2.2 差分規模
- 15 files changed
- 1911 insertions / 258 deletions

## 3. 実装ゴールと非ゴール

### 3.1 ゴール
- 長文で難解な行政ページを、短時間で「理解→確認→次行動」に接続する。
- URL投入後の第一画面を、判断に必要な情報へ圧縮した「ページ理解モード」に再設計する。
- 理解不足が残る論点は「深掘りチャット」で解消する。
- 利用者の目的は「意図入力」で確定し、個別回答へ接続する。

### 3.2 非ゴール
- 画面内のチャット履歴を永続化すること（履歴保存対象は解析結果中心）。
- 意図入力時の候補提案やサジェスト補完。
- すべての生成結果に対する厳密な引用スパンUI（本文トークン単位のインライン引用）。

## 4. 全体アーキテクチャ

### 4.1 処理フロー
1. `/analyze` でURLを入力し、`/api/analyze` default mode を実行。
2. Google Search Groundingで取得した情報を中間表現化し、`overview` と `checklist` を生成。
3. `/result` で `SummaryViewer` を中心としたページ理解UIを表示。
4. ユーザーは同一画面の「深掘り / 意図入力」タブで対話を進める。
5. 意図確定後に `mode: intent` を呼び、意図回答を表示。
6. 意図確定後のみチェックリスト・漫画・検索引用・根拠を追加表示。

### 4.2 システム責務
- `src/app/result/page.tsx`: 画面状態遷移、深掘り送信、意図確定、回答表示制御。
- `src/components/SummaryViewer.tsx`: ページ理解モードの可視化（主要ブロックと証跡表示）。
- `src/app/api/analyze/route.ts`: mode分岐とオーケストレーション。
- `src/lib/gemini.ts`: 各生成処理（intermediate / overview / deepDive / intent）と正規化。
- `src/stores/analyzeStore.ts`: 解析・チャット・意図のクライアント状態管理。

## 5. データモデル設計

### 5.1 `Overview` の導入
- `src/lib/types/intermediate.ts` に以下を追加:
- `OverviewCriticalFact { item, value, reason }`
- `OverviewBlockId`
- `OverviewEvidenceByBlock`
- `Overview`

### 5.2 `AnalyzeResult` の拡張
- `intentAnswer?: string`
- `overview?: Overview`

### 5.3 API mode別型の追加
- `DeepDiveRequest` / `DeepDiveResponse`
- `IntentAnswerRequest` / `IntentAnswerResponse`
- `AnalyzeRequest` を union type 化（default/deepDive/intent）

### 5.4 Groundingメタデータ拡張
- `GroundingSupport` を追加。
- `GroundingMetadata.groundingSupports?: GroundingSupport[]` を保持。
- `groundingSupports` を使って回答根拠URLを本文利用分へ寄せる設計に対応。

### 5.5 意図回答重複抑制の入力
- `IntentAnswerRequest` に `overviewTexts?: string[]` / `checklistTexts?: string[]` を追加。
- 既存ガイド文との重複を避けるため、LLM入力へ渡す。

## 6. API設計（`/api/analyze`）

### 6.1 default mode
- 入力: `url`, optional `userIntent`
- 実行順:
- `fetchWithGoogleSearch`
- `generateIntermediateRepresentation`
- `generateChecklist`
- `generateSimpleSummary`
- `generateOverview`
- optional `generateIntentAnswer`
- 出力: `AnalyzeResult`

### 6.2 `mode: deepDive`
- 入力: `summary`, `messages`, `focus`, `deepDiveSummary`, `summaryOnly`
- 実装: `generateDeepDiveResponse`
- 出力: `{ status, answer, summary }`

### 6.3 `mode: intent`
- 入力: `userIntent`, `intermediate`, `messages`, `focus`, `deepDiveSummary`, `overviewTexts`, `checklistTexts`
- 実装: `generateIntentAnswer`
- 出力: `{ status, intentAnswer }`

### 6.4 エラー処理
- modeごとに入力バリデーションを実施し、400/500を返却。
- 認証情報が取得できない場合でも、パーソナライズなしで継続可能。

## 7. LLMプロンプト設計

### 7.1 `prompts/overview.txt`
- 目的: 1分理解向けの構造化概要生成。
- 出力はJSON固定。
- `criticalFacts` は柔軟な項目名で3〜5件。
- `evidenceByBlock` は入力内URLのみ、0〜3件/ブロック。
- 問い合わせ情報は `criticalFacts` / `cautions` から除外。

### 7.2 `prompts/deep-dive.txt`
- 入力文脈: summary + deepDiveSummary + focus + messages。
- 出力: `{ answer, summary }` のJSON固定。
- `summaryOnly=true` 時は `answer` を空にできる設計。

### 7.3 `prompts/intent-answer.txt`（現時点仕様）
- 出力はJSON固定。
- `headline` + `core.finalJudgment` + `core.firstPriorityAction` + `core.failureRisks`。
- `text` は20〜70文字の短文。
- 証跡URLは `groundingSupports` 優先、なければ `groundingChunks`。
- `existingGuides`（overview/checklist）との重複は原則回避。

### 7.4 `prompts/intermediate.txt` / `prompts/simple-summary.txt`
- intermediate の title を「短く意味が通る表現」に強化。
- simple-summary は見出し順序・箇条書き固定の出力制約を追加。

## 8. フロントエンドUI設計

## 8.1 結果ページ全体（`src/app/result/page.tsx`）
- 上部: ページ見出し + `SummaryViewer`。
- 中段: 深掘り/意図入力を切替可能な統合カード。
- 下段: 意図確定後に回答カードを表示。
- さらに下段: チェックリスト、漫画、Google検索引用、根拠を表示。

## 8.2 ローディングと遷移
- URLのみで `/result` に来た場合は自動解析しない。
- 「このURLを解析する」ボタンで明示実行。
- 意図再生成中は画面を維持し、全体ローディング画面へ戻さない。

## 8.3 深掘りチャットUI
- メッセージ列を `messages` で保持。
- 送信時は optimistic に user message を追加。
- 失敗時はエラーバナーを表示。
- 20件超過時は overflow分を `summaryOnly` で要約して圧縮。

## 8.4 意図入力UI
- `isIntentLocked` により再送防止。
- 編集ボタンでロック解除可能。
- 入力確定後に `isGenerating=true` へ遷移。

## 8.5 意図回答UI（現時点）
- LLMのJSON回答を `parseStructuredIntentAnswer` でパース。
- 表示ブロック:
- headline
- 「あなたは対象になりそうですか？」
- 「最優先の1手」
- 「見落とすと申請で困るポイント」
- ローディング文言:
- `あなた向けの回答を作成しています。まもなくご確認いただけます。`
- JSONパース失敗時はプレーンテキスト表示へフォールバック。

## 8.6 ページ理解モード（`SummaryViewer`）
- 表示ブロック:
- `30秒で把握`
- `だれ向けの情報か`
- `このページで実現できること`
- `このページの最重要ポイント`（3列テーブル）
- `見落とすと困る注意点`
- `問い合わせ情報`（別ブロック）
- 旧詳細UIは `hideDetails` で非表示化可能。

## 9. 証跡URL設計

### 9.1 共通正規化
- HTTP/HTTPSのみ許可。
- hash除去。
- 末尾スラッシュ正規化。
- タイトル未取得時は hostname を表示名に利用。

### 9.2 SummaryViewerの証跡
- `overview.evidenceByBlock` を優先。
- 不足時は許可URLプールからブロック別フォールバックを構築。
- `source_url` のみになるケースを避け、可能なら周辺URLを優先。

### 9.3 意図回答の証跡（現時点）
- まず `groundingSupports -> groundingChunkIndices -> groundingChunks` を採用。
- supportsが取れない場合のみ `groundingChunks` 全体へフォールバック。
- ラベルは `この回答の根拠`。
- フォールバック時は「本文との直接ひも付けなし」の注記を表示。
- LLMが返した `evidenceUrls` はUI直接表示の主ソースにせず、grounding由来を優先。

## 10. 状態管理設計（`analyzeStore`）
- 追加状態:
- `messages`
- `intent`
- `focus`
- `deepDiveSummary`
- `lastHistoryId`
- 追加アクション:
- `setMessages`
- `addMessage`
- `setIntent`
- `setFocus`
- `setDeepDiveSummary`
- `resetDeepDiveState`
- `analyze(url, userIntent?)` に拡張。

## 11. 履歴連携設計
- `overview` を履歴保存対象に追加。
- `fetchHistoryDetail` で `overview` を復元。
- `/analyze` 成功遷移は `historyId` 優先 (`/result?historyId=...`)。
- `historyId` がない場合は `/result` へ遷移し、状態ストアから描画。

## 12. 失敗時フォールバック設計
- `generateOverview` は厳格正規化 + fallback overview 生成を持つ。
- `generateIntentAnswer` の失敗はUIで `intentError` を表示し、直前回答があれば維持。
- `groundingMetadata` 不在時は根拠ブロックを非表示（またはフォールバック注記付き）。

## 13. 実装上の重要な判断
- 根拠URLは「検索で拾った全URL」ではなく「回答に使った根拠URL（supports）」に寄せる。
- 問い合わせ情報は注意点から分離し、連絡導線を明示。
- 意図回答は「網羅」ではなく「本当に重要な差分」に限定する。
- 画面の第一目的を「短時間理解」に固定し、冗長なテキストを削減。

## 14. 既知の課題・今後改善候補
- `extractText` が `parts[0].text` のみ取得のため、複数part返却時に欠落余地がある。
- 画面内のエビデンス表示とGoogle検索引用表示に役割重複があるため、将来的に統合設計が必要。
- `useEffect` の依存警告（`src/app/result/page.tsx`）は既知の改善ポイント。

## 15. 受け入れ確認チェックリスト
- `dev` 比で対象15ファイルに差分が存在すること。
- `/result` で「ページ理解モード」ブロックが表示されること。
- 深掘り送信で `mode: deepDive` が呼ばれ、回答が追記されること。
- 意図確定で `mode: intent` が呼ばれ、回答カードが表示されること。
- 意図回答の根拠が supports優先・chunksフォールバックで表示されること。
- 意図確定後にチェックリスト/漫画/引用ブロックが表示されること。
