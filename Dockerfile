# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
# Installs all deps (dev + prod) so native modules (argon2, better-sqlite3)
# are compiled for Linux, then builds frontend + backend.
FROM node:22-alpine AS builder

# Build tools required by argon2 and better-sqlite3 native addons
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Registry configuration must land before any install. It goes to the user
# config because npm ignores a project-level .npmrc in global mode; pnpm reads
# the same file. corepack honours neither, so pnpm is installed with npm.
# The default is the feed proxy (networks here block registry.npmjs.org); CI
# builds override it with --build-arg NPM_REGISTRY=https://registry.npmjs.org/.
ARG NPM_REGISTRY=https://packagefeedproxy.microsoft.io/npm/
COPY .npmrc /root/.npmrc
RUN npm config set registry "$NPM_REGISTRY" && npm install -g pnpm@11.1.3

# ── Install dependencies ──────────────────────────────────────────────────────
# Copy manifests first to leverage Docker layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY backend/package.json  ./backend/
COPY frontend/package.json ./frontend/

RUN pnpm install --frozen-lockfile

# ── Copy source & build ───────────────────────────────────────────────────────
COPY CHANGELOG.md ./
COPY backend/  ./backend/
COPY frontend/ ./frontend/

# Build frontend (Vite → frontend/dist/)
RUN pnpm -C frontend build

# Build backend (tsup → backend/dist/server.js, CJS)
RUN pnpm -C backend build

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM node:22-alpine AS production

# argon2 links against libstdc++ at runtime on Alpine.
# openssh-client provides the `ssh` binary used to reach ssh:// Docker
# endpoints via `docker system dial-stdio` (043 / FR-035). Without it those
# endpoints fail with a distinct "SSH client not available in this image"
# configuration error rather than a connectivity one.
RUN apk add --no-cache libstdc++ openssh-client

WORKDIR /app

# ── Frontend static assets ────────────────────────────────────────────────────
# server.ts resolves: path.resolve(__dirname, '../../frontend/dist')
# __dirname = /app/backend/dist  →  ../../frontend/dist = /app/frontend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist

# ── Backend compiled bundle ───────────────────────────────────────────────────
COPY --from=builder /app/backend/dist ./backend/dist

# ── Drizzle migration files ───────────────────────────────────────────────────
# migrate.ts resolves: path.resolve(__dirname, '../../drizzle')
# __dirname = /app/backend/dist  →  ../../drizzle = /app/drizzle
COPY --from=builder /app/backend/drizzle ./drizzle

# ── Production node_modules ───────────────────────────────────────────────────
# Docker COPY follows pnpm symlinks, producing real files — no pnpm store needed.
# Root node_modules holds the pnpm virtual store (.pnpm/) that backend resolves from.
COPY --from=builder /app/node_modules         ./node_modules
COPY --from=builder /app/backend/node_modules ./backend/node_modules

# ── Runtime configuration ─────────────────────────────────────────────────────
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    HOMEDASH_DATA_DIR=/data

# Data directory is bind-mounted at runtime (db, uploads, icon-cache)
VOLUME ["/data"]

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "backend/dist/server.js"]
