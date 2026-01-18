/**
 * Identity Platform 認証テストスクリプト
 * 実行: npx tsx scripts/test-auth.ts
 *
 * 必要な環境変数:
 *   FIREBASE_API_KEY - Firebase設定のapiKey
 *   FIREBASE_AUTH_DOMAIN - Firebase設定のauthDomain
 *   FIREBASE_PROJECT_ID - プロジェクトID
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

// 環境変数から設定を読み込み
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID || 'zenn-ai-agent-hackathon-vol4',
};

// テスト用のメールアドレスとパスワード
const TEST_EMAIL = 'komanai@example.com';
const TEST_PASSWORD = 'password';

async function testAuth() {
  console.log('Identity Platform 認証テスト開始...');
  console.log(`Project: ${firebaseConfig.projectId}`);
  console.log(`Auth Domain: ${firebaseConfig.authDomain}`);
  console.log('---');

  // 環境変数チェック
  if (!firebaseConfig.apiKey) {
    console.error('❌ FIREBASE_API_KEY が設定されていません');
    process.exit(1);
  }
  if (!firebaseConfig.authDomain) {
    console.error('❌ FIREBASE_AUTH_DOMAIN が設定されていません');
    process.exit(1);
  }

  try {
    // Firebase初期化
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    console.log('✅ Firebase初期化成功');

    // ユーザー作成を試みる（既に存在する場合はログインに進む）
    console.log(`\nテストユーザー作成を試行: ${TEST_EMAIL}`);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        TEST_EMAIL,
        TEST_PASSWORD
      );
      console.log('✅ ユーザー作成成功');
      console.log(`  UID: ${userCredential.user.uid}`);
      console.log(`  Email: ${userCredential.user.email}`);
    } catch (error: unknown) {
      const firebaseError = error as { code?: string };
      if (firebaseError.code === 'auth/email-already-in-use') {
        console.log('ℹ️  ユーザーは既に存在します。ログインを試行します。');
      } else {
        throw error;
      }
    }

    // ログインテスト
    console.log(`\nログインテスト: ${TEST_EMAIL}`);
    const loginCredential = await signInWithEmailAndPassword(
      auth,
      TEST_EMAIL,
      TEST_PASSWORD
    );
    console.log('✅ ログイン成功');
    console.log(`  UID: ${loginCredential.user.uid}`);
    console.log(`  Email: ${loginCredential.user.email}`);

    // IDトークン取得
    const idToken = await loginCredential.user.getIdToken();
    console.log(`  IDトークン (先頭50文字): ${idToken.substring(0, 50)}...`);

    // ログアウト
    await signOut(auth);
    console.log('✅ ログアウト成功');

    console.log('\n---');
    console.log('✅ 認証テスト完了!');
  } catch (error) {
    console.error('❌ 認証テスト失敗');
    console.error(error);
    process.exit(1);
  }
}

testAuth();
