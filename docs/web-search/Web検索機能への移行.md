# Google Search グラウンディング機能への移行計画

## 概要

URL解析をHTMLスクレイピングからGoogle Search グラウンディングに完全移行する。
これにより、PDF等の様々な形式にも対応可能となる。

## 変更方針

- **完全移行**: スクレイピング（scraper.ts）を廃止し、Web検索のみ使用
- **引用表示**: 検索クエリと参照元URLをUIに表示（Google利用規約準拠）

---

## 実装ステップ

### Step 1: 型定義の拡張

**ファイル**: `src/lib/types/intermediate.ts`

追加する型:
```typescript
// Google Search Grounding関連の型
export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface GroundingMetadata {
  webSearchQueries?: string[];
  groundingChunks?: GroundingChunk[];
  searchEntryPoint?: {
    renderedContent: string;
  };
}
```

`Metadata`インターフェースに追加:
```typescript
groundingMetadata?: GroundingMetadata;
```

### Step 2: Gemini連携の修正

**ファイル**: `src/lib/gemini.ts`

1. **新関数追加**: `fetchWithGoogleSearch(url: string)`
   - Google Search グラウンディングを使用してURL情報を取得
   - `tools: [{ googleSearch: {} }]` を設定
   - `temperature: 1.0` を設定（Google推奨）

2. **既存関数修正**: `generateIntermediateRepresentation()`
   - 入力をScrapedContentからWeb検索結果に変更
   - groundingMetadataをレスポンスから抽出してmetadataに含める

3. **削除**: ScrapedContent関連のインポートと処理

### Step 3: APIエンドポイントの修正

**ファイル**: `src/app/api/analyze/route.ts`

変更内容:
```typescript
// Before: scrapeUrl() → generateIntermediateRepresentation()
// After:  fetchWithGoogleSearch() → generateIntermediateRepresentation()
```

- `scrapeUrl`のインポートを削除
- `fetchWithGoogleSearch`を使用して情報を取得
- エラーハンドリングを更新

### Step 4: UI - 引用表示コンポーネントの作成

**新規ファイル**: `src/components/GoogleSearchAttribution.tsx`

表示内容:
- 使用した検索クエリ（タグ形式）
- 参照した情報源（リンク付きリスト）
- Google Search Suggestionsウィジェット（renderedContent）

### Step 5: 結果ページの更新

**ファイル**: `src/app/result/page.tsx`

- `GoogleSearchAttribution`コンポーネントを組み込み
- `intermediate.metadata.groundingMetadata`が存在する場合に表示

### Step 6: 不要ファイルの削除

- `src/lib/scraper.ts` を削除（使用箇所がなくなった後）

---

## 修正対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/lib/types/intermediate.ts` | GroundingMetadata型追加 |
| `src/lib/gemini.ts` | fetchWithGoogleSearch追加、generateIntermediateRepresentation修正 |
| `src/app/api/analyze/route.ts` | スクレイピング→Web検索に変更 |
| `src/components/GoogleSearchAttribution.tsx` | 新規作成 |
| `src/app/result/page.tsx` | 引用表示コンポーネント組み込み |
| `src/lib/scraper.ts` | 削除 |

---

## 検証方法

1. **開発サーバーで動作確認**
   ```bash
   npm run dev
   ```
   - HTMLページURL（例: 横浜市の児童手当ページ）で解析実行
   - PDFページURLで解析実行（新たに対応）
   - 引用表示（検索クエリ、参照URL）が正しく表示されることを確認

2. **ビルド確認**
   ```bash
   npm run lint && npm run build
   ```

3. **UIテスト**
   - 検索クエリがタグとして表示される
   - 参照URLがクリック可能なリンクとして表示される
   - モバイル表示でも崩れない

---

## 注意事項

### コスト
- 月45,000クエリまで無料（2026年1月5日以降の料金体系）
- 超過分: $35/1,000クエリ
- キャッシュ（24時間TTL）により重複クエリを削減

### Google利用規約
- 検索クエリと参照元URLの表示が推奨
- `searchEntryPoint.renderedContent`のHTMLは改変禁止
