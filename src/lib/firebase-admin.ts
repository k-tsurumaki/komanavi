import {
  initializeApp,
  getApps,
  getApp,
  cert,
  applicationDefault,
  type App,
} from "firebase-admin/app";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App;

const initializeAdminApp = (): App => {
  if (getApps().length > 0) {
    return getApp();
  }

  // ローカル開発時はサービスアカウントキーを使用
  // Cloud Run ではデフォルト認証情報を使用
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    let serviceAccount: string | Record<string, unknown> = raw;

    try {
      if (raw.trim().startsWith("{")) {
        serviceAccount = JSON.parse(raw) as Record<string, unknown>;
      } else {
        const resolvedPath = resolve(raw);
        const fileContent = readFileSync(resolvedPath, "utf8");
        serviceAccount = JSON.parse(fileContent) as Record<string, unknown>;
      }
    } catch (error) {
      console.error("Failed to load service account credentials:", error);
      throw error;
    }

    return initializeApp({
      credential: cert(serviceAccount as Parameters<typeof cert>[0]),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
};

// 遅延初期化
const getAdminApp = (): App => {
  if (!app) {
    app = initializeAdminApp();
  }
  return app;
};

export const getAdminAuth = (): Auth => {
  return getAuth(getAdminApp());
};

export const getAdminFirestore = (): Firestore => {
  const databaseId = process.env.FIREBASE_DATABASE_ID;
  return databaseId ? getFirestore(getAdminApp(), databaseId) : getFirestore(getAdminApp());
};

// IDトークン検証
export const verifyIdToken = async (idToken: string) => {
  const auth = getAdminAuth();
  return auth.verifyIdToken(idToken);
};

// ユーザー取得
export const getUser = async (uid: string) => {
  const auth = getAdminAuth();
  return auth.getUser(uid);
};
