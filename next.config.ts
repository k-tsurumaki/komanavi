import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },
  serverExternalPackages: [
    "@google-cloud/tasks",
    "@google-cloud/storage",
    "firebase-admin",
  ],
};

export default nextConfig;
