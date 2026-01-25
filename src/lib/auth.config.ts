import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge Runtime対応の設定（ミドルウェア用）
// Firebase Admin SDKはNode.js専用のため、ここでは使用しない
export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      profile: (profile) => ({
        id: profile.sub ?? profile.id ?? "",
        name: profile.name,
        email: profile.email,
        image: profile.picture,
      }),
    }),
  ],
  callbacks: {
    jwt: async ({ token, user, account }) => {
      if (account?.providerAccountId) {
        token.id = account.providerAccountId;
      } else if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
    authorized: ({ auth, request: { nextUrl } }) => {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // 保護されたルート（認証必須）
      const protectedRoutes = ["/analyze", "/history", "/result"];

      // 認証ページ
      const authRoutes = ["/login"];

      // 保護されたルートへのアクセス
      const isProtected = protectedRoutes.some((route) =>
        pathname.startsWith(route)
      );
      if (isProtected) {
        return isLoggedIn;
      }

      // ログイン済みユーザーが認証ページにアクセス
      if (authRoutes.includes(pathname) && isLoggedIn) {
        return Response.redirect(new URL("/analyze", nextUrl));
      }

      return true;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};
