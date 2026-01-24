import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { verifyIdToken } from "./firebase-admin";

// 完全な設定（APIルート用 - Node.js Runtime）
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    // Firebase IDトークン検証（メール/パスワード用）
    Credentials({
      id: "firebase",
      name: "Firebase",
      credentials: {
        idToken: { label: "ID Token", type: "text" },
      },
      authorize: async (credentials) => {
        if (!credentials?.idToken) {
          return null;
        }

        try {
          const decodedToken = await verifyIdToken(credentials.idToken as string);
          return {
            id: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name || decodedToken.email?.split("@")[0],
            image: decodedToken.picture,
          };
        } catch (error) {
          console.error("Firebase token verification failed:", error);
          return null;
        }
      },
    }),
  ],
});
