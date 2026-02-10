# Web検索統合実装計画

## 概要

回答・チェックリスト・漫画生成において、意図に沿ったWeb検索を実施し、生成物に反映する。
検索結果は再利用可能にし、429エラー等での再生成時に再検索を避ける。

## 採用アーキテクチャ

**オプション2（意図ベース追加検索） + 検索結果キャッシュ（方式B: IntermediateRepresentation保存）**

### データフロー

```
初回解析（/api/analyze）
  ↓ fetchWithGoogleSearch(url) → baseSearchResult
  ↓ intermediate.metadata.groundingMetadata に保存

意図入力（/api/analyze mode: 'intent'）
  ↓ fetchWithGoogleSearch(url, userIntent) → intentSearchResult
  ↓ intermediate.metadata.intentSearchMetadata に保存
  ↓ intentSearchResult をプロンプトに含めて生成
  ↓ - generateIntentAnswer
  ↓ - generateChecklistWithState

チェックリスト再生成（/api/analyze mode: 'checklist'）
  ↓ body.intermediate.metadata.intentSearchMetadata を取得
  ↓ 再検索せず、保存済み検索結果を使用
  ↓ generateChecklistWithState

漫画生成（/api/manga）
  ↓ MangaRequest に intentSearchMetadata を含める
  ↓ Cloud Tasks Worker で検索結果を使用して漫画生成
```

## 実装タスク

### Task #1: 型定義の更新

**ファイル**: `src/lib/types/intermediate.ts`

```typescript
export interface Metadata {
  // ... 既存フィールド
  groundingMetadata?: GroundingMetadata; // 初回URL検索結果
  intentSearchMetadata?: GroundingMetadata; // 意図ベース検索結果（追加）
}
```

---

### Task #2: fetchWithGoogleSearch の拡張

**ファイル**: `src/lib/gemini.ts`

`fetchWithGoogleSearch` 関数に `userIntent` パラメータを追加：

```typescript
export async function fetchWithGoogleSearch(
  url: string,
  userIntent?: string // 追加
): Promise<GoogleSearchResult> {
  const basePrompt = `${GOOGLE_SEARCH_PROMPT}\n\n対象URL: ${url}`;

  const prompt = userIntent
    ? `${basePrompt}\n\nユーザーの意図: ${userIntent}\n\n上記の意図に特に関連する情報を重点的に調査してください。`
    : basePrompt;

  // ... 既存の実装
}
```

**変更点**:
- オプショナルパラメータ `userIntent?: string` を追加
- 意図がある場合はプロンプトに追記

---

### Task #3: 意図入力時に意図ベース検索を実行

**ファイル**: `src/app/api/analyze/route.ts`

`mode: 'intent'` 処理で検索を実行し、intermediate を更新：

```typescript
if (body.mode === 'intent') {
  // ... バリデーション

  // 意図ベース検索を実行
  const intentSearchResult = await fetchWithGoogleSearch(
    body.intermediate.metadata.source_url,
    body.userIntent
  );

  // intermediate を更新
  const updatedIntermediate = {
    ...body.intermediate,
    metadata: {
      ...body.intermediate.metadata,
      intentSearchMetadata: intentSearchResult.groundingMetadata,
    },
  };

  const personalizationInput = await buildPersonalizationInput(body.userIntent);

  const checklistPromise = generateChecklistWithState(
    updatedIntermediate,
    personalizationInput
  );

  const intentAnswer = await generateIntentAnswer(
    updatedIntermediate,
    body.userIntent,
    personalizationInput,
    { /* ... */ }
  );

  // ... レスポンス生成（updatedIntermediate を返す）
  return NextResponse.json({
    status: 'success',
    intentAnswer,
    checklist: checklistGeneration.checklist,
    checklistState: checklistGeneration.state,
    checklistError: checklistGeneration.error,
    intermediate: updatedIntermediate, // 更新されたintermediateを返す
  });
}
```

**変更点**:
1. `fetchWithGoogleSearch(url, userIntent)` を呼び出し
2. `intermediate.metadata.intentSearchMetadata` に保存
3. レスポンスに更新された `intermediate` を含める

**注意**: `IntentAnswerResponse` 型に `intermediate` フィールドを追加する必要がある

---

### Task #4: チェックリスト生成プロンプトに検索結果を組み込む

**ファイル**: `src/lib/gemini.ts`

検索結果をプロンプトに含めるヘルパー関数を作成：

```typescript
/**
 * 検索結果をプロンプトに追加するためのテキストを生成
 */
function buildSearchResultContext(intermediate: IntermediateRepresentation): string {
  const lines: string[] = [];

  // 意図ベース検索結果を優先
  const searchMetadata = intermediate.metadata.intentSearchMetadata
    || intermediate.metadata.groundingMetadata;

  if (!searchMetadata) {
    return '';
  }

  lines.push('\n## Web検索結果');

  if (searchMetadata.webSearchQueries?.length) {
    lines.push('\n### 検索クエリ:');
    searchMetadata.webSearchQueries.forEach(query => {
      lines.push(`- ${query}`);
    });
  }

  if (searchMetadata.groundingChunks?.length) {
    lines.push('\n### 参照元情報:');
    searchMetadata.groundingChunks.forEach((chunk, idx) => {
      if (chunk.web) {
        lines.push(`[${idx + 1}] ${chunk.web.title}`);
        lines.push(`    URL: ${chunk.web.uri}`);
      }
    });
  }

  lines.push('\n上記のWeb検索結果を参考に、最新かつ正確な情報を提供してください。');

  return lines.join('\n');
}
```

`generateChecklistWithState` を更新：

```typescript
export async function generateChecklistWithState(
  intermediate: IntermediateRepresentation,
  personalization?: PersonalizationInput
): Promise<{
  checklist: ChecklistItem[];
  state: Exclude<ChecklistGenerationState, 'not_requested'>;
  error?: string;
}> {
  const context = JSON.stringify(intermediate, null, 2);
  const personalizationContext = buildPersonalizationContext(personalization);
  const searchContext = buildSearchResultContext(intermediate); // 追加

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: getPrompt('checklist.txt') +
                    personalizationContext +
                    searchContext + // 追加
                    '\n\n---\n\n' +
                    context
            },
          ],
        },
      ],
    });
    // ... 既存の実装
  }
}
```

---

### Task #5: MangaRequest に検索結果情報を追加

**ファイル**: `src/lib/types/intermediate.ts`

```typescript
export interface MangaRequest {
  // ... 既存フィールド

  // 検索結果情報（追加）
  intentSearchMetadata?: GroundingMetadata;
}
```

**ファイル**: `src/app/api/manga/route.ts`

```typescript
export async function POST(request: NextRequest) {
  // ... 既存の処理

  // intermediate から intentSearchMetadata を取得
  const intentSearchMetadata = body.intermediate?.metadata?.intentSearchMetadata;

  const enrichedBody: MangaRequest = {
    ...body,
    userIntent: personalizationInput.userIntent,
    userProfile: personalizationInput.userProfile,
    intentSearchMetadata, // 追加
  };

  // ... 既存の処理
}
```

**注意**: `MangaRequest` に `intermediate` フィールドを追加するか、クライアント側で `intentSearchMetadata` を渡す必要がある

---

### Task #6: 意図回答生成プロンプトに検索結果を組み込む

**ファイル**: `src/lib/gemini.ts`

`generateIntentAnswer` を更新：

```typescript
export async function generateIntentAnswer(
  intermediate: IntermediateRepresentation,
  userIntent: string,
  personalization?: PersonalizationInput,
  context?: { /* ... */ }
): Promise<string> {
  const personalizationContext = buildPersonalizationContext(personalization);
  const searchContext = buildSearchResultContext(intermediate); // 追加

  const payload = JSON.stringify(
    {
      userIntent,
      intermediate,
      deepDiveContext: { /* ... */ },
      existingGuides: { /* ... */ },
    },
    null,
    2
  );

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: getPrompt('intent-answer.txt') +
                    personalizationContext +
                    searchContext + // 追加
                    '\n\n---\n\n' +
                    payload,
            },
          ],
        },
      ],
    });
    return extractText(result);
  } catch (error) {
    console.error('Intent answer generation error:', error);
    return '';
  }
}
```

**同様の更新を以下の関数にも適用**:
- `generateSimpleSummary`

---

## 追加検討事項

### 1. クライアント側の更新

**ファイル**: `src/stores/analyzeStore.ts`

- `IntentAnswerResponse` に `intermediate` を追加
- 意図入力後、更新された `intermediate` をストアに保存
- チェックリスト再生成・漫画生成時に最新の `intermediate` を使用

### 2. 型定義の追加

**ファイル**: `src/lib/types/intermediate.ts`

```typescript
export interface IntentAnswerResponse {
  status: 'success' | 'error';
  intentAnswer?: string;
  checklist?: ChecklistItem[];
  checklistState?: Exclude<ChecklistGenerationState, 'not_requested'>;
  checklistError?: string;
  error?: string;
  intermediate?: IntermediateRepresentation; // 追加：更新されたintermediate
}
```

### 3. 漫画生成ワーカーの更新

**ファイル**: `src/app/api/manga/worker/route.ts` (または該当ファイル)

- `MangaRequest.intentSearchMetadata` を取得
- 漫画生成プロンプトに検索結果を含める
- `buildSearchResultContext` を再利用

### 4. インメモリキャッシュ（オプション）

**ファイル**: `src/app/api/analyze/route.ts`

同一リクエスト内での重複検索を防ぐため、軽量なキャッシュを追加：

```typescript
// 検索結果キャッシュ
const searchCache = new Map<string, {
  searchResult: GoogleSearchResult;
  expiresAt: number;
}>();

function getSearchCacheKey(url: string, userIntent?: string): string {
  return hashUrl(url + (userIntent || ''));
}

async function fetchWithCache(url: string, userIntent?: string): Promise<GoogleSearchResult> {
  const key = getSearchCacheKey(url, userIntent);
  const cached = searchCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    console.log('[Cache HIT] Using cached search result');
    return cached.searchResult;
  }

  const result = await fetchWithGoogleSearch(url, userIntent);
  searchCache.set(key, {
    searchResult: result,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5分
  });

  return result;
}
```

---

## テスト計画

### 1. 基本フロー
- [ ] URL入力 → 初回検索実行
- [ ] 意図入力 → 意図ベース検索実行 → intermediate更新確認
- [ ] チェックリストに検索結果が反映されているか確認

### 2. 再生成フロー
- [ ] チェックリスト再生成（同じ意図） → 再検索なし
- [ ] 漫画生成 → 検索結果が使用されている
- [ ] 429エラー後の再試行 → 検索結果が保持されている

### 3. エッジケース
- [ ] 意図なしでの解析
- [ ] 検索結果が空の場合
- [ ] groundingMetadata が null の場合

---

## リリース手順

1. バックエンド実装（Task #1-6）
2. 型定義の更新を先にデプロイ（破壊的変更なし）
3. クライアント側の対応
4. 統合テスト
5. 段階的ロールアウト

---

## パフォーマンス考慮

- 意図入力時の検索追加により、レスポンス時間が増加（+1-3秒程度）
- ただし、チェックリスト/漫画再生成時は検索不要なため、トータルでは効率化
- Google Search Grounding のコスト増加を監視

---

## 将来的な拡張

- 検索結果の品質評価（relevance score）
- 検索クエリの最適化（LLMによる自動生成）
- 複数回の検索結果の統合・ランキング
