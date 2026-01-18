# KOMANAVI 認証機能設計書

## 技術選定

| 項目 | 選定技術 | 理由 |
|------|----------|------|
| 認証基盤 | GCP Identity Platform | GCPエコシステムとの統合 |
| 認証ライブラリ | Auth.js (NextAuth.js v5) | Next.js App Router対応 |
| データベース | Cloud Firestore | GCP統合、柔軟なスキーマ |
| ログイン方法 | Google OAuth + メール/パスワード | - |

## アーキテクチャ

```
クライアント → Next.js (Cloud Run) → Identity Platform
                    ↓
              Cloud Firestore ← Vertex AI (Gemini)
```

## Cloud Run での認証フロー

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ブラウザ（クライアント）                           │
│  1. Firebase SDK でログイン（メール/パスワード or Google）            │
│  2. IDトークンを取得                                                 │
│  3. APIリクエスト時にAuthorizationヘッダーにトークン付与              │
└────────────────────────────┬────────────────────────────────────────┘
                             │ Authorization: Bearer {IDトークン}
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Cloud Run（サーバー）                             │
│  4. Firebase Admin SDK でIDトークンを検証（API Key不要）             │
│     → サービスアカウント認証を使用                                   │
│  5. トークンからユーザーID（uid）を取得                              │
│  6. Firestoreでユーザーデータにアクセス                              │
└─────────────────────────────────────────────────────────────────────┘
```

### API Key の扱い

| 場所 | API Key | 理由 |
|------|---------|------|
| クライアント（ブラウザ） | **必要** | Firebase SDKの初期化に必須 |
| サーバー（Cloud Run） | **不要** | サービスアカウント認証を使用 |

クライアント側のAPI Keyは公開情報として設計されている：
- ドメイン制限（リファラー制限）で保護
- 認証自体の安全性はパスワードやOAuthに依存
- API Keyだけでは不正アクセス不可

### サーバーサイドでのトークン検証

```typescript
// Firebase Admin SDK（API Key不要）
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Cloud Runでは自動的にサービスアカウント認証
initializeApp({
  credential: applicationDefault(),
  projectId: 'your-project-id',
});

// IDトークン検証
async function verifyToken(idToken: string) {
  const decodedToken = await getAuth().verifyIdToken(idToken);
  return decodedToken.uid; // ユーザーID
}
```

## Firestore データモデル

```
users/{userId}
├── email, displayName, provider
├── createdAt, updatedAt
└── profile/attributes
    └── ageGroup, familyType, residenceStatus, interests[]

conversations/{conversationId}
├── userId, url, title, createdAt
└── messages/{messageId}
    └── role, content, createdAt

analyzeResults/{resultId}
├── userId, url, urlHash
├── intermediate, checklist, generatedSummary
└── createdAt, expiresAt

mangaResults/{mangaId}
├── userId, conversationId, resultId
├── status, panels[], personalized
└── createdAt, completedAt
```

## 必要なパッケージ

```bash
npm install next-auth@beta firebase@11 firebase-admin@13
```

## 環境変数

```env
# Auth.js
AUTH_SECRET=
AUTH_URL=http://localhost:3000

# Google OAuth
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# Firebase
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
```

## 実装ステップ

### Phase 1: 基盤セットアップ
1. GCP Identity Platform の有効化
2. Firebase プロジェクト設定
3. Google OAuth クライアント作成
4. 環境変数設定

### Phase 2: 認証機能実装
5. Auth.js 設定 (`src/lib/auth.ts`)
6. Firebase SDK 初期化
7. ログイン/登録ページ作成
8. 認証API実装

### Phase 3: データ永続化
9. Firestore ヘルパー関数
10. ユーザープロファイル CRUD
11. 会話履歴の永続化

### Phase 4: パーソナライズ
12. ユーザー属性入力フォーム
13. パーソナライズ漫画生成フロー

## 参考リンク

- [GCP Identity Platform パターン集](https://zenn.dev/google_cloud_jp/articles/idp-patterns)
- [Next.js + Auth.js で Identity Platform 実装](https://tagbangers.co.jp/en/blog/posts/2025/02/gcip-with-nextjs-authjs)
- [Auth.js v5 ドキュメント](https://authjs.dev/)
