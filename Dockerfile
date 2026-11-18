# Stage 1: Build client bundle (dist-client) and TypeScript server (dist-server)
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.server.json vite.config.ts ./
COPY shared ./shared
COPY server ./server
COPY client ./client

RUN npm run build

# Stage 2: Slim production runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000 \
    LOCAL_STORAGE_ROOT=/app/.local-b2-storage

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist-client ./dist-client
COPY --from=builder /app/dist-server ./dist-server

RUN mkdir -p /app/.local-b2-storage \
    && chown -R node:node /app/.local-b2-storage

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist-server/server/index.js"]
