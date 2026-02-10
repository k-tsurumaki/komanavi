FROM node:20-slim AS builder

WORKDIR /app

# 依存関係ファイルをコピー
COPY worker/package*.json ./

# 全依存関係インストール（devDependencies 含む、ビルドに必要）
RUN npm ci

# ソースコードをコピー
COPY worker/tsconfig.json ./
COPY worker/src/ ./src/
COPY prompts/ ./prompts/

# TypeScript ビルド
RUN npm run build

# ============================================
# 本番イメージ
# ============================================
FROM node:20-slim

WORKDIR /app

# 依存関係ファイルをコピー
COPY worker/package*.json ./

# 本番用依存関係のみインストール
RUN npm ci --omit=dev

# ビルド済みファイルをコピー
COPY --from=builder /app/dist ./dist/
COPY --from=builder /app/prompts/ ./prompts/

# 環境変数設定
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/index.js"]
