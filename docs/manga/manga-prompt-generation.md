# 漫画生成プロンプトの仕組み

このドキュメントでは、KOMANAVIの漫画生成機能がどのようにプロンプトを構築し、Gemini APIに送信するかを説明します。

## 概要

漫画生成は以下の3つのステップで行われます：

```
1. パネル生成 (buildPanels)
   ↓
2. プロンプト構築 (buildMangaPrompt)
   ↓
3. Gemini API呼び出し (generateMangaImage)
```

## 1. パネル生成 (buildPanels)

### 入力
`MangaRequest` オブジェクト - 中間表現から抽出されたデータ

```typescript
{
  title: "児童手当の申請",
  summary: "0歳から中学卒業までの児童を養育している方に...",
  keyPoints: ["所得制限あり", "毎年6月に現況届が必要"],
  documentType: "benefit",
  benefits: { amount: "月額10,000円～15,000円" },
  target: { eligibility_summary: "0歳～中学卒業までの児童を養育する方" },
  procedure: { deadline: "出生日から15日以内" },
  warnings: ["15日を過ぎると受給開始が遅れます"],
  tips: ["里帰り出産の場合でも住民票のある自治体に申請してください"]
}
```

### 処理フロー

パネルは以下の優先順位で生成されます（**最小4コマ、最大8コマ**）：

#### 1️⃣ warnings（最優先、最大2件）
```typescript
if (request.warnings && request.warnings.length > 0) {
  panels.push({ text: "15日を過ぎると受給開始が遅れます" });
}
```

#### 2️⃣ documentType別の優先情報

**benefit（給付金）の場合：**
```
優先順位: 金額 → 対象者 → 期限
```
```typescript
panels.push({ text: "給付額: 月額10,000円～15,000円" });
panels.push({ text: "対象: 0歳～中学卒業までの児童を養育する方" });
panels.push({ text: "期限: 出生日から15日以内" });
```

**procedure（手続き）の場合：**
```
優先順位: 手順（最大2件） → 必要書類 → 期限
```
```typescript
panels.push({ text: "1. 申請書を記入する" });
panels.push({ text: "2. 窓口に提出する" });
panels.push({ text: "必要書類: マイナンバーカード、通帳、印鑑" });
panels.push({ text: "期限: 転入から14日以内" });
```

**その他の場合：**
```
優先順位: keyPoints（最大3件）
```

#### 3️⃣ 連絡先（最大1件、パネル数が7未満の場合）
```typescript
panels.push({ text: "問い合わせ: 子育て支援課 03-1234-5678" });
```

#### 4️⃣ tips（最大1件、パネル数が7未満の場合）
```typescript
panels.push({ text: "里帰り出産の場合でも住民票のある自治体に申請してください" });
```

#### 5️⃣ summaryで補填（パネル数が4未満の場合）
summaryを句点で分割してパネルを追加

#### 6️⃣ 汎用フォールバック（最終手段）
```typescript
const fallbacks = [
  "条件に当てはまるか確認しましょう。",
  "必要な手続きを整理しましょう。",
  "期限や必要書類をチェックしましょう。",
  "詳しくは問い合わせ窓口へ。"
];
```

### 出力例

```typescript
{
  title: "児童手当の申請",
  panels: [
    { id: "panel-1", text: "15日を過ぎると受給開始が遅れます" },
    { id: "panel-2", text: "給付額: 月額10,000円～15,000円" },
    { id: "panel-3", text: "対象: 0歳～中学卒業までの児童を養育する方" },
    { id: "panel-4", text: "期限: 出生日から15日以内" },
    { id: "panel-5", text: "問い合わせ: 子育て支援課 03-1234-5678" },
    { id: "panel-6", text: "里帰り出産の場合でも住民票のある自治体に申請してください" }
  ]
}
```

## 2. プロンプト構築 (buildMangaPrompt)

### プロンプトテンプレート

プロンプトは `/prompts/manga.txt` から読み込まれます：

```
あなたは行政情報を4コマ漫画として視覚化するエキスパートです。

以下の情報を基に、4コマ漫画を1枚の画像として生成してください。

# タイトル
{title}

# 要約
{summary}

# 4コマ構成
{panels}

# 補足情報（コンテキスト）
{context}

## 生成要件

- 日本語の吹き出しを使用
- 4コマが1枚の画像に収まるレイアウト
- 読みやすい配色とフォントサイズ
- 行政情報の説明として誠実で分かりやすい表現

## 注意事項

- 専門用語は避け、やさしい日本語で表現
- 重要な情報（金額、期限、注意事項）を見落とさない
- 4コマの流れが自然で理解しやすいストーリーになるように構成
```

### プレースホルダーの置換

`buildMangaPrompt` 関数は以下のプレースホルダーを実際の値に置換します：

#### {title}
```typescript
template.replace("{title}", request.title)
// 例: "児童手当の申請"
```

#### {summary}
```typescript
template.replace("{summary}", request.summary)
// 例: "0歳から中学卒業までの児童を養育している方に支給される手当です。"
```

#### {panels}
パネルを番号付きリストに変換：
```typescript
const panelTexts = panels
  .map((panel, index) => `(${index + 1}) ${panel.text}`)
  .join("\n");

// 結果:
// (1) 15日を過ぎると受給開始が遅れます
// (2) 給付額: 月額10,000円～15,000円
// (3) 対象: 0歳～中学卒業までの児童を養育する方
// (4) 期限: 出生日から15日以内
// (5) 問い合わせ: 子育て支援課 03-1234-5678
// (6) 里帰り出産の場合でも住民票のある自治体に申請してください
```

#### {context}
補足情報を構築：
```typescript
const context: string[] = [];

if (request.documentType) {
  const typeLabels = {
    benefit: "給付・支援制度",
    procedure: "手続き案内",
    information: "一般情報",
    faq: "よくある質問",
    guide: "利用ガイド",
    other: "行政情報"
  };
  context.push(`種類: ${typeLabels[request.documentType]}`);
}

if (request.benefits?.amount) {
  context.push(`給付額: ${request.benefits.amount}`);
}

if (request.procedure?.deadline) {
  context.push(`期限: ${request.procedure.deadline}`);
}

if (request.target?.eligibility_summary) {
  context.push(`対象: ${request.target.eligibility_summary}`);
}

const contextText = context.length > 0 ? context.join("\n") : "なし";

// 結果:
// 種類: 給付・支援制度
// 給付額: 月額10,000円～15,000円
// 期限: 出生日から15日以内
// 対象: 0歳～中学卒業までの児童を養育する方
```

### 最終的なプロンプト例

```
あなたは行政情報を4コマ漫画として視覚化するエキスパートです。

以下の情報を基に、4コマ漫画を1枚の画像として生成してください。

# タイトル
児童手当の申請

# 要約
0歳から中学卒業までの児童を養育している方に支給される手当です。

# 4コマ構成
(1) 15日を過ぎると受給開始が遅れます
(2) 給付額: 月額10,000円～15,000円
(3) 対象: 0歳～中学卒業までの児童を養育する方
(4) 期限: 出生日から15日以内
(5) 問い合わせ: 子育て支援課 03-1234-5678
(6) 里帰り出産の場合でも住民票のある自治体に申請してください

# 補足情報（コンテキスト）
種類: 給付・支援制度
給付額: 月額10,000円～15,000円
期限: 出生日から15日以内
対象: 0歳～中学卒業までの児童を養育する方

## 生成要件

- 日本語の吹き出しを使用
- 4コマが1枚の画像に収まるレイアウト
- 読みやすい配色とフォントサイズ
- 行政情報の説明として誠実で分かりやすい表現

## 注意事項

- 専門用語は避け、やさしい日本語で表現
- 重要な情報（金額、期限、注意事項）を見落とさない
- 4コマの流れが自然で理解しやすいストーリーになるように構成
```

## 3. Gemini API呼び出し

生成されたプロンプトは `generateMangaImage` 関数で Gemini API に送信されます：

```typescript
await ai.models.generateContent({
  model: "gemini-3-pro-image-preview",
  contents: [
    {
      role: "user",
      parts: [{ text: prompt }]  // 上記で生成されたプロンプト
    }
  ],
  generationConfig: {
    responseModalities: ["TEXT", "IMAGE"],
    imageConfig: {
      aspectRatio: "16:9"
    }
  }
});
```

Gemini API は受け取ったプロンプトを解釈し、4コマ漫画の画像を生成します。

## documentType別の挙動まとめ

| documentType | 優先表示される情報 | 例 |
|--------------|------------------|-----|
| `benefit` | 金額 → 対象者 → 期限 | 児童手当、介護保険給付 |
| `procedure` | 手順 → 必要書類 → 期限 | 転入届、パスポート申請 |
| `information`<br>`faq`<br>`guide`<br>`other` | keyPoints（最大3件） | お知らせ、制度説明 |

## エラー時のフォールバック

画像生成に失敗した場合、`buildFallback` 関数が以下の優先順位でテキストパネルを生成します：

1. warnings（最優先）
2. 重要情報（給付額、期限、対象者）
3. keyPoints
4. summary

これにより、画像生成が失敗してもユーザーに最低限の情報を提供できます。

## プロンプトのカスタマイズ方法

プロンプトテンプレートは `/prompts/manga.txt` で管理されています。このファイルを編集することで、以下をカスタマイズできます：

- 生成要件（レイアウト、配色、表現方法）
- 注意事項（専門用語の扱い、強調すべき情報）
- トーン＆マナー（誠実、親しみやすい、など）

変更後は Worker を再デプロイすることで反映されます。

## トークン削減の工夫

プロンプトが長すぎると Gemini API のトークン制限に引っかかる可能性があるため、以下の工夫をしています：

1. **procedure.steps から details と note を除外**
   ```typescript
   steps: intermediate.procedure.steps.map((step) => ({
     order: step.order,
     action: step.action  // detailsとnoteは含めない
   }))
   ```

2. **最大パネル数を8コマに制限**
   ```typescript
   const finalPanels = panels.slice(0, 8);
   ```

3. **必要書類は最大3件まで**
   ```typescript
   text: `必要書類: ${request.procedure.required_documents.slice(0, 3).join("、")}`
   ```

4. **補足情報は4行程度に抑える**
   - documentType、給付額、期限、対象者のみ

## まとめ

KOMANAVIの漫画生成は以下の特徴を持ちます：

✅ **情報の優先度付け** - documentTypeに応じて重要な情報を優先的に表示
✅ **柔軟なフォールバック** - 情報が不足していても適切にパネルを補填
✅ **プロンプト管理の一元化** - `/prompts/manga.txt` で管理、変更が容易
✅ **トークン削減** - 必要最小限の情報のみを送信
✅ **エラー時の代替表示** - 画像生成失敗時もテキストで情報を提供
