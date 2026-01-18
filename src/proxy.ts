import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Edge Runtime対応のミドルウェア
// Firebase Admin SDKを使わない軽量な設定を使用
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    // Auth.js のデフォルトマッチャー + カスタムルート
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
