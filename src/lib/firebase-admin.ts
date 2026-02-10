import {
  initializeApp,
  getApps,
  getApp,
  cert,
  applicationDefault,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

let app: App;

const initializeAdminApp = (): App => {
  if (getApps().length > 0) {
    return getApp();
  }

  // ローカル開発時はサービスアカウントキーを使用
  // Cloud Run ではデフォルト認証情報を使用
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({
      credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
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
  const app = getAdminApp();
  const databaseId = process.env.FIREBASE_DATABASE_ID;

  // If FIREBASE_DATABASE_ID is specified, use that database
  // Otherwise, use the default database
  return databaseId ? getFirestore(app, databaseId) : getFirestore(app);
};

export const getAdminStorage = (): Storage => {
  return getStorage(getAdminApp());
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
