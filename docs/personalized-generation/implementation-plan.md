# パーソナライズ生成機能 実装計画

## 概要

生成品質とUXの向上、信頼性の確保、パーソナライズによる理解・行動の支援を目的とした機能拡張。

**ブランチ**: `feature/personalized-generation`

---

## 入力と出力

### 入力（3つ）

| 入力 | 説明 | 実装状況 |
|------|------|---------|
| ユーザの意図 | 「児童手当について知りたい」などの文字列 | **モックで実装**（他の人が後で実装） |
| ユーザ情報 | Firebase から取得するプロフィール | 既存（ProfileForm） |
| URL解析結果 | 中間表現（IntermediateRepresentation） | 既存 |

### ユーザ情報（Firebase から取得可能）

```typescript
interface UserProfile {
  displayName?: string;    // 名前
  birthDate?: string;      // 生年月日 → 年齢計算可能
  gender?: string;         // 性別（男性/女性/その他/無回答）
  occupation?: string;     // 職業
  nationality?: string;    // 国籍（日本/外国）
  location?: string;       // 居住地
  visualTraits?: string;   // 外見の特徴（漫画用）
  personality?: string;    // 性格・口調（漫画用）
}
```

### 出力（パーソナライズ適用）

| 出力 | 説明 |
|------|------|
| 要約（generatedSummary） | ユーザ属性・状況に合わせた表現 |
| チェックリスト（checklist） | 個別条件に応じた項目の出し分け |

---

## 受入条件

- [ ] スキーマ準拠の生成物であること
- [ ] 根拠リンクが表示されること
- [ ] 免責と更新日時が表示されること
- [ ] UX観点（視認性・導線・理解しやすさ）が担保されること
- [ ] パーソナライズ要素が反映されていること（対象条件の出し分け）

---

## アーキテクチャ

### データフロー

```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  ユーザの意図   │   │   ユーザ情報    │   │  URL解析結果    │
│  (モック)       │   │  (Firebase)     │   │ (中間表現)      │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
                               ▼
                 ┌─────────────────────────┐
                 │   パーソナライズ生成    │
                 │   (Gemini API)          │
                 └─────────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
    ┌─────────────────┐               ┌─────────────────┐
    │  要約           │               │  チェックリスト │
    │ (Markdown)      │               │  (JSON)         │
    └─────────────────┘               └─────────────────┘
```

### API設計

#### POST /api/analyze（既存APIを拡張）

既存のAPIエンドポイントを拡張。パーソナライズ生成を行う。

**リクエスト**:
```typescript
interface AnalyzeRequest {
  url: string;
  userIntent?: string;  // ユーザの意図（省略時はモックで "この制度について知りたい"）
}
```

**処理フロー（route.ts内）**:
1. リクエストから `url` と `userIntent` を取得
2. 認証セッションからユーザIDを取得（未ログインでもOK）
3. ログイン時はFirestoreからユーザプロフィールを取得
4. `generateChecklist(intermediate, personalizationInput)` 呼び出し
5. `generateSimpleSummary(intermediate, personalizationInput)` 呼び出し

**レスポンス**:
```typescript
interface AnalyzeResult {
  id: string;
  intermediate: IntermediateRepresentation;
  generatedSummary: string;           // パーソナライズ適用済み
  checklist: ChecklistItem[];         // パーソナライズ適用済み
  personalization?: {                 // 新規追加
    appliedProfile: Partial<UserProfile>;
    appliedIntent: string;
  };
  status: 'success' | 'error';
  error?: string;
}
```

---

## 実装フェーズ

### Phase 1: 基盤整備

#### 1.1 型定義の拡張
**ファイル**: `src/lib/types/intermediate.ts`

```typescript
// パーソナライズ入力の型（新規追加）
export interface PersonalizationInput {
  userIntent: string;
  userProfile?: {
    age?: number;           // birthDate から計算
    gender?: string;
    occupation?: string;
    isJapaneseNational?: boolean;  // nationality から判定
    location?: string;
  };
}

// AnalyzeRequest に userIntent を追加
export interface AnalyzeRequest {
  url: string;
  userIntent?: string;  // 追加
  personalization?: PersonalizationAnswer[];
}

// AnalyzeResult に personalization を追加
export interface AnalyzeResult {
  // 既存フィールド...
  personalization?: {
    appliedProfile?: PersonalizationInput['userProfile'];
    appliedIntent: string;
  };
}
```

#### 1.2 プロンプト更新
**ファイル**: `prompts/simple-summary.txt`
- パーソナライズ情報を受け取るようプロンプト拡張

**ファイル**: `prompts/checklist.txt`
- パーソナライズ情報を受け取るようプロンプト拡張

---

### Phase 2: バックエンド実装

#### 2.1 ユーザ情報取得ユーティリティ
**新規ファイル**: `src/lib/user-profile.ts`

```typescript
// Firebase からユーザプロフィールを取得（サーバー側）
export async function getUserProfileFromFirestore(
  userId: string
): Promise<UserProfile | null>

// プロフィールからパーソナライズ入力を生成
export function toPersonalizationInput(
  profile: UserProfile | null,
  userIntent: string
): PersonalizationInput
```

#### 2.2 gemini.ts の関数シグネチャ変更
**ファイル**: `src/lib/gemini.ts`

```typescript
// 既存関数を拡張（第2引数追加）
export async function generateChecklist(
  intermediate: IntermediateRepresentation,
  personalization?: PersonalizationInput  // 追加
): Promise<ChecklistItem[]>

export async function generateSimpleSummary(
  intermediate: IntermediateRepresentation,
  personalization?: PersonalizationInput  // 追加
): Promise<string>
```

#### 2.3 API route.ts の修正
**ファイル**: `src/app/api/analyze/route.ts`

```typescript
// 処理フロー
1. リクエストから url, userIntent を取得
2. auth() でセッション取得
3. セッションがあれば getUserProfileFromFirestore() でプロフィール取得
4. toPersonalizationInput() でパーソナライズ入力生成
5. generateChecklist(intermediate, personalizationInput)
6. generateSimpleSummary(intermediate, personalizationInput)
7. レスポンスに personalization フィールド追加
```

---

### Phase 3: フロントエンド実装（後回し可）

#### 3.1 状態管理の拡張
**ファイル**: `src/stores/analyzeStore.ts`

```typescript
// userIntent を analyze() に渡せるよう拡張
analyze: async (url: string, userIntent?: string) => Promise<void>;
```

#### 3.2 UI改善: 根拠・免責・更新日時
**ファイル**: `src/components/DisclaimerBanner.tsx`

```typescript
interface DisclaimerBannerProps {
  sourceUrl: string;
  fetchedAt: string;
  lastModified?: string;  // 追加: 元ページの最終更新日
}
```

---

## 変更ファイル一覧

| ファイル | 変更種別 | 内容 |
|---------|---------|------|
| `src/lib/types/intermediate.ts` | 拡張 | PersonalizationInput型、AnalyzeRequest/Result拡張 |
| `src/lib/user-profile.ts` | 新規 | ユーザ情報取得ユーティリティ |
| `src/lib/gemini.ts` | 拡張 | generateChecklist, generateSimpleSummary の引数追加 |
| `src/app/api/analyze/route.ts` | 拡張 | パーソナライズ処理追加 |
| `prompts/simple-summary.txt` | 拡張 | パーソナライズ情報対応 |
| `prompts/checklist.txt` | 拡張 | パーソナライズ情報対応 |
| `src/stores/analyzeStore.ts` | 拡張 | userIntent対応（後回し可） |
| `src/components/DisclaimerBanner.tsx` | 拡張 | lastModified追加（後回し可） |

---

## パーソナライズロジック

### ユーザ属性に基づく出し分け

| 属性 | 出し分け例 |
|------|-----------|
| 年齢（birthDate） | 高齢者向け説明、子育て世代向け説明 |
| 性別（gender） | 出産・育児関連の説明分岐 |
| 職業（occupation） | 会社員/自営業/学生で手続きが異なる場合 |
| 国籍（nationality） | 外国人向けの追加説明、やさしい日本語の強化 |
| 居住地（location） | 自治体固有の情報がある場合 |

### ユーザの意図に基づく出し分け

| 意図 | 出力の調整 |
|------|-----------|
| "概要を知りたい" | 簡潔な要約、詳細は折りたたみ |
| "対象か確認したい" | 対象条件を強調、該当/非該当を明示 |
| "手続きを進めたい" | チェックリストを詳細化、期限を強調 |
| "必要書類を確認したい" | 書類一覧をリスト化、入手方法を明記 |

---

## 検証方法

### 1. 単体テスト
```bash
npm run lint
npm run build
```

### 2. 手動テスト

**テストシナリオ1: 児童手当（子育て世代）**
- URL: 児童手当のページ
- ユーザ情報: birthDate=1990年（30代）、occupation=会社員
- 期待: 子育て世代向けの説明、会社員向けの申請方法

**テストシナリオ2: 介護保険（高齢者）**
- URL: 介護保険のページ
- ユーザ情報: birthDate=1950年（70代）
- 期待: 高齢者向けのやさしい表現、本人申請の手順

**テストシナリオ3: 転入届（外国人）**
- URL: 転入届のページ
- ユーザ情報: nationality=外国
- 期待: 在留カード関連の説明追加、やさしい日本語

### 3. 受入条件チェックリスト
- [ ] 生成物がスキーマに準拠している（JSON パース可能）
- [ ] 根拠リンクが SourceReference に表示される
- [ ] DisclaimerBanner に取得日時が表示される
- [ ] 要約がユーザ属性に応じて変化する
- [ ] チェックリストがユーザ属性に応じてフィルタリングされる

---

## 注意事項

### 後方互換性
- 既存の `/api/analyze` は変更せず、新規 `/api/analyze/personalized` を追加
- 未ログインユーザーでも基本機能は動作（パーソナライズなし）

### LLM出力の不安定性
- JSON パースに失敗した場合は非パーソナライズ版にフォールバック
- プロンプトで出力形式を厳密に指定

### パフォーマンス
- 中間表現はキャッシュ活用（既存）
- パーソナライズ生成は毎回実行（ユーザ固有のため）

---

## 今後の拡張（スコープ外）

- ユーザの意図の自然言語入力対応（現在はモック）
- Agentic検索による追加情報取得
- パーソナライズ履歴の保存と学習
