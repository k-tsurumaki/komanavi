# ページ理解モード・深掘りチャット・意図入力 実装設計書

## 1. この設計書の目的
この文書は、`feature/summary-deepdive-intent-ui` ブランチの実装内容を、レビューしやすい形で整理したものです。

- 差分基準: `dev..feature/summary-deepdive-intent-ui`
- 対象機能: 「1分でわかる！平易化されたWebページ」「深掘りチャット」「意図入力」
- 補足: ローカル未コミット変更（意図回答JSON化、根拠URL表示改善など）も現時点仕様として反映

## 2. 先に押さえる要点（TL;DR）

1. URL解析後の第一画面を「ページ理解モード」に再設計した。
2. 深掘りチャットと意図入力を同一カードで切替できるようにした。
3. `/api/analyze` を mode 分岐（default / deepDive / intent）に拡張した。
4. `overview` と `intentAnswer` を `AnalyzeResult` に統合した。
5. 根拠URLは `groundingSupports` 優先、なければ `groundingChunks` でフォールバックする方針にした。

## 3. レビューの進め方（推奨）

1. 画面仕様: `src/components/SummaryViewer.tsx` と `src/app/result/page.tsx`
2. API契約: `src/lib/types/intermediate.ts` と `src/app/api/analyze/route.ts`
3. 生成仕様: `src/lib/gemini.ts` と `prompts/*.txt`
4. 状態・保存: `src/stores/analyzeStore.ts` と `src/lib/history-api.ts` / `src/app/api/history/route.ts`

## 4. 差分概要（dev基準）

- 変更ファイル数: 15
- 追加/削除: +1911 / -258

主な対象ファイル:
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

## 5. プロダクト要件（実装上の到達点）

### 5.1 ゴール
- 長文で複雑な行政ページを、短時間で理解できること。
- 理解不足の論点をその場で深掘りし、疑問を解消できること。
- 最後に利用者の目的を確定し、個別化された回答へ接続できること。

### 5.2 非ゴール
- 画面内チャット履歴の永続化。
- 意図入力の候補サジェスト。
- 本文トークン単位のインライン引用UI。

## 6. 全体フロー

1. `/analyze` でURLを入力する。
2. `/api/analyze` default mode で中間表現・overview・checklistを生成する。
3. `/result` でページ理解モードを表示する。
4. 同一画面で深掘りチャットを行う。
5. 意図入力を確定し、`mode: intent` で回答を生成する。
6. 意図確定後にチェックリスト、漫画、検索引用、根拠情報を表示する。

## 7. フロントエンド設計

### 7.1 Resultページ（`src/app/result/page.tsx`）
- 上段: `SummaryViewer`（ページ理解モード）
- 中段: 深掘り/意図入力の切替カード
- 下段: 意図回答カード（生成中表示あり）
- 後段: チェックリスト、漫画、Google検索引用、根拠表示

主なUI状態:
- URLのみで `/result` 到達時は自動解析しない。手動ボタンで解析開始。
- 意図再生成中は全体ローディングへ戻さず、画面を維持する。
- 意図入力はロック制御し、編集ボタンで再入力可能にする。

### 7.2 ページ理解モード（`src/components/SummaryViewer.tsx`）
表示ブロック:
- `30秒で把握`
- `だれ向けの情報か`
- `このページで実現できること`
- `このページの最重要ポイント`（表形式）
- `見落とすと困る注意点`
- `問い合わせ情報`（注意点から分離）

### 7.3 意図回答表示
- JSON形式の回答をパースしてカード表示する。
- 構成: `headline` / `最終判断` / `最優先の1手` / `失敗リスク`
- パース失敗時はテキスト表示へフォールバックする。
- 生成中文言: `あなた向けの回答を作成しています。まもなくご確認いただけます。`

## 8. API設計（`/api/analyze`）

### 8.1 default mode
- 入力: `url`, optional `userIntent`
- 処理: `fetchWithGoogleSearch` -> `generateIntermediateRepresentation` -> `generateChecklist` -> `generateSimpleSummary` -> `generateOverview` -> optional `generateIntentAnswer`
- 出力: `AnalyzeResult`

### 8.2 `mode: deepDive`
- 入力: `summary`, `messages`, `focus`, `deepDiveSummary`, `summaryOnly`
- 出力: `{ status, answer, summary }`
- 備考: メッセージ圧縮時に `summaryOnly=true` を利用する。

### 8.3 `mode: intent`
- 入力: `userIntent`, `intermediate`, `messages`, `focus`, `deepDiveSummary`, `overviewTexts`, `checklistTexts`
- 出力: `{ status, intentAnswer }`
- 備考: `overviewTexts/checklistTexts` は重複抑制用の文脈としてLLMへ渡す。

### 8.4 エラー方針
- modeごとに必須入力をバリデーションする。
- 400/500を明示的に返却する。
- 認証情報が取れない場合でも、パーソナライズなしで処理継続する。

## 9. データモデル変更

`src/lib/types/intermediate.ts` の主な追加:
- `Overview`, `OverviewCriticalFact`, `OverviewEvidenceByBlock`
- `DeepDiveRequest/Response`
- `IntentAnswerRequest/Response`
- `GroundingSupport`

主な拡張:
- `AnalyzeResult.intentAnswer?: string`
- `AnalyzeResult.overview?: Overview`
- `GroundingMetadata.groundingSupports?: GroundingSupport[]`
- `IntentAnswerRequest.overviewTexts?: string[]`
- `IntentAnswerRequest.checklistTexts?: string[]`

## 10. プロンプト設計

### 10.1 `prompts/overview.txt`
- 構造化JSON固定で出力する。
- `criticalFacts` は3〜5件、項目名は柔軟に生成する。
- `evidenceByBlock` は入力内URLのみを許可する。

### 10.2 `prompts/deep-dive.txt`
- 出力を `{ answer, summary }` のJSONに固定する。
- `summaryOnly` の場合は `answer` を空にできる。

### 10.3 `prompts/intent-answer.txt`（現時点）
- JSON固定出力（`headline` と `core`）。
- 短文化・重複抑制・根拠URL方針を明示する。
- `groundingSupports` 優先、なければ `groundingChunks` を証跡候補にする。

### 10.4 `prompts/intermediate.txt` / `prompts/simple-summary.txt`
- タイトルの短文化・可読性向上ルールを追加する。
- 見出し順序と箇条書き形式を固定する。

## 11. 証跡URL設計

### 11.1 共通ルール
- `http/https` のみ許可
- hash除去
- 末尾スラッシュ正規化
- タイトル欠損時は hostname を表示名に利用

### 11.2 SummaryViewer
- `overview.evidenceByBlock` を優先する。
- 欠損時は許可URLプールからフォールバックを構築する。

### 11.3 意図回答（現時点）
- `groundingSupports` から利用chunkを抽出して表示する。
- supportsがない場合のみ `groundingChunks` 全体へフォールバックする。
- 表示ラベルは `この回答の根拠` とする。
- フォールバック時は「本文との直接ひも付けなし」の注記を表示する。

## 12. 状態管理・履歴連携

### 12.1 `src/stores/analyzeStore.ts`
追加状態:
- `messages`
- `intent`
- `focus`
- `deepDiveSummary`

追加操作:
- `setMessages`
- `addMessage`
- `setIntent`
- `setFocus`
- `setDeepDiveSummary`
- `resetDeepDiveState`
- `analyze(url, userIntent?)`

### 12.2 履歴
- `overview` を保存・復元対象に追加した。
- `/analyze` 成功時は `historyId` 優先で `result` へ遷移する。

## 13. 既知課題

- `extractText` が `parts[0].text` のみを読むため、複数part返却時に欠落余地がある。
- 画面内の根拠表示と `GoogleSearchAttribution` の役割が一部重複している。
- `src/app/result/page.tsx` の `useEffect` 依存 warning が残っている。

## 14. 受け入れチェック

1. `/result` でページ理解モードの6ブロックが表示される。
2. 深掘り送信で `mode: deepDive` が呼ばれ、回答と要約が更新される。
3. 意図確定で `mode: intent` が呼ばれ、回答カードが表示される。
4. 回答根拠は supports優先、chunksフォールバックで表示される。
5. 意図確定後にチェックリスト、漫画、引用ブロックが表示される。
