# Cloud Storage 漫画永続化機能 設計書

## 概要

漫画生成機能で生成した画像を Cloud Storage に保存し、署名付きURLでユーザーに配信する。
ユーザーごとに画像を分離して履歴として保持する。

## アーキテクチャ

### システム構成図

```
                          フロントエンド
┌─────────────────────────────────────────────────────────────────┐
│              MangaViewer.tsx                                     │
│  - 漫画生成リクエスト（認証済みユーザー）                         │
│  - ポーリング（2秒間隔）                                          │
│  - 署名付きURLで画像表示                                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Authorization: Bearer {idToken}
                           ▼
                        API Routes
┌─────────────────────┐    ┌────────────────────────────────┐
│ POST /api/manga     │    │ GET /api/manga/[jobId]         │
│ - 認証検証          │    │ - ステータス確認               │
│ - ジョブ作成        │    │ - 署名付きURL返却              │
└─────────────────────┘    └────────────────────────────────┘
                           │
                           ▼
                     バックエンド処理
┌────────────────────────────────────────────────────────────┐
│  scheduleJob() - setTimeout ベース                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Gemini Pro   │→ │ Base64→PNG   │→ │ Cloud Storage    │  │
│  │ Image API    │  │ 変換         │  │ アップロード      │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
                     Cloud Storage
┌─────────────────────────────────────────────────────────────────┐
│  gs://komanavi-manga-images/                                     │
│  └── users/                                                      │
│      └── {userId}/                  ← ユーザーIDで分離           │
│          └── manga/                                              │
│              └── {timestamp}-{uuid}.png                          │
│                  [メタデータ: source-url, title, generated-at]   │
└─────────────────────────────────────────────────────────────────┘
```

### データフロー（シーケンス図）

```
ユーザー    MangaViewer    POST /api/manga    Auth     GCS Client    Cloud Storage    Gemini
   │            │               │              │           │              │             │
   │──ボタン──→│               │              │           │              │             │
   │            │──POST + Token→│              │           │              │             │
   │            │               │──ID検証─────→│           │              │             │
   │            │               │←─userId──────│           │              │             │
   │            │               │              │           │              │             │
   │            │←─{jobId}──────│              │           │              │             │
   │            │               │              │           │              │             │
   │            │               │──────────────┼───────────┼──────────────┼──画像生成─→│
   │            │               │              │           │              │←─Base64────│
   │            │               │              │           │              │             │
   │            │               │──アップロード─┼──────────→│              │             │
   │            │               │              │           │──保存───────→│             │
   │            │               │              │           │  users/{uid}/manga/...     │
   │            │               │←─storageUrl──┼───────────│              │             │
   │            │               │              │           │              │             │
   │            │──GET status──→│              │           │              │             │
   │            │               │──署名付きURL生成──────────→│              │             │
   │            │←─{done,       │              │           │              │             │
   │            │   imageUrl}───│              │           │              │             │
   │            │               │              │           │              │             │
   │←──表示─────│               │              │           │              │             │
```

## ストレージ設計

### バケット構成

| 項目 | 値 |
|------|-----|
| バケット名 | `komanavi-manga-images` |
| リージョン | `asia-northeast1`（東京） |
| ストレージクラス | Standard |
| 公開設定 | 非公開（署名付きURLでアクセス） |
| ライフサイクル | 90日後自動削除 |

### オブジェクトパス（ユーザー分離）

```
gs://komanavi-manga-images/
└── users/
    └── {userId}/                    ← Firebase Auth UID
        └── manga/
            └── {timestamp}-{uuid}.png
```

**例:**
```
gs://komanavi-manga-images/users/abc123xyz/manga/1706140800000-550e8400.png
```

### メタデータ

```json
{
  "source-url": "https://example.gov/procedure",
  "title": "児童手当の申請について",
  "generated-at": "2025-01-25T10:00:00Z",
  "user-id": "abc123xyz"
}
```

## 署名付きURL設計

| 項目 | 値 | 理由 |
|------|-----|------|
| 有効期限 | 60分 | 生成〜表示〜ダウンロードに十分 |
| HTTPメソッド | GET のみ | 読み取り専用 |

## 認証フロー

漫画生成には認証はオプショナル:

- **認証済み**: IDトークンをヘッダーに付与 → Cloud Storage に保存 → 署名付きURLで返却
- **未認証**: トークンなし → Base64 Data URL で返却（従来動作）

認証フロー:
1. フロントエンドから Firebase ID トークンをヘッダーに付与
2. API で `verifyIdToken()` を呼び出してユーザーID取得
3. ユーザーIDをパスに使用して画像を保存

## 修正対象ファイル

| ファイル | 変更内容 |
|----------|----------|
| `src/lib/firebase-admin.ts` | `getAdminStorage()` 関数追加 |
| `src/lib/cloud-storage.ts` | 新規作成：アップロード・署名付きURL生成 |
| `src/app/api/manga/route.ts` | 認証検証追加、GCSアップロード処理追加 |
| `src/app/api/manga/state.ts` | `MangaJob` に `storageUrl`, `userId` 追加 |
| `src/lib/types/intermediate.ts` | `MangaResult` に `storageUrl` 追加 |
| `src/components/MangaViewer.tsx` | 認証トークン付与、ログイン案内メッセージ |
| `.env.example` | 環境変数追加 |

## 環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|--------------|
| `GCS_MANGA_BUCKET` | 漫画画像バケット名 | `komanavi-manga-images` |
| `GCS_SIGNED_URL_TTL_MINUTES` | 署名付きURL有効期限（分） | `60` |

## エラーハンドリング

### Cloud Storage アップロード失敗時

アップロードに失敗した場合は、従来通り Base64 Data URL を返却する（フォールバック）。
ユーザー体験は損なわれず、画像は正常に表示される。

```typescript
try {
  const uploadResult = await uploadMangaImageAndGetUrl(userId, imageUrls[0], metadata);
  finalImageUrls = [uploadResult.signedUrl];
} catch (uploadError) {
  // アップロード失敗時は Base64 Data URL をそのまま返す
  console.error('Cloud Storage upload failed, using fallback:', uploadError);
}
```

## 非同期処理の移行（実装済み）

### 概要

`setTimeout` ベースの非同期処理から、Cloud Tasks + 専用 Worker サービスベースの処理に移行済み。
詳細なセットアップ手順は [cloud-tasks-setup.md](./cloud-tasks-setup.md) を参照。

### Cloud Tasks + Cloud Run/Cloud Run Jobs の比較

#### Cloud Run（サービス）

**メリット:**
- HTTPエンドポイントとして常に利用可能
- Cloud Tasksから直接HTTPリクエストで呼び出せる（シンプル）
- タイムアウト最大60分（通常は十分）
- リクエストごとの課金で、処理がない時は0にスケール
- 設定がシンプルで理解しやすい

**デメリット:**
- 最大実行時間60分（ただしAI API呼び出しなら十分）
- 並列処理の明示的な制御がやや難しい

**適しているケース:**
- AI APIへの単純なリクエスト送信（数秒〜数分）
- Cloud Tasksからの呼び出しがメイン
- 処理時間が60分以内

#### Cloud Run Jobs

**メリット:**
- 最大実行時間24時間/タスク（1ジョブ全体は168時間＝7日間まで可能）
- 並列処理の明示的な制御が可能（タスク数と並列数を指定）
- バッチ処理向けの設計
- 複数タスクの実行状況を一元管理

**デメリット:**
- HTTPエンドポイントを持たない（Cloud Tasksから直接呼べない）
- Cloud Scheduler、Workflows、または手動実行が必要
- 構成がやや複雑
- Cloud Tasksとの連携に一手間必要

**適しているケース:**
- 長時間処理（60分以上）
- 大量データの並列バッチ処理
- 定期的なスケジュール実行

### 本プロジェクトでの推奨：Cloud Run（サービス）

AI API（Gemini Pro Image）への非同期リクエスト送信という用途であれば、**Cloud Run（サービス）** を推奨。

**推奨理由:**

1. **処理時間**: AI APIへのリクエストは通常数秒〜数分で完了するため、60分制限で十分
2. **シンプルさ**: Cloud Tasks → Cloud Runのフローが直接的でシンプル
3. **コスト効率**: リクエストベース課金で、処理がない時は0円
4. **実装の容易さ**: HTTPエンドポイントとして実装するだけ

**主な利点:**
- リクエストの失敗時の自動リトライ機能
- レート制限による外部API保護
- Next.jsのAPIレスポンスを高速化できる
- スケジュール実行も可能

### 実装例の構成

```
Next.js API (Cloud Run)
  ↓ タスクをキューに追加
Cloud Tasks
  ↓ HTTPリクエスト
Worker Cloud Run
  ↓ AI APIリクエスト
Gemini Pro Image API
  ↓ 画像保存
Cloud Storage
```

**インターフェース（API）は変更なしで、内部実装のみ差し替え可能な設計。**
