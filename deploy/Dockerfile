# HomeDash — multi-stage Docker build for Synology NAS (x86_64)
# Produces a single container serving both API + frontend static files.
# Build: docker build --platform linux/amd64 -f deploy/Dockerfile -t homedash:latest .

# ─── Stage 1: Prepare dependency builds ──────────────────────────────────────
FROM node:24.18.0-slim AS dependency-base

WORKDIR /app

# Node 24 does not have prebuilt better-sqlite3 binaries for every target
# architecture, so dependency stages must be able to compile native modules.
RUN apt-get update \
  && apt-get install -y --no-install-recommends g++ make python3 \
  && rm -rf /var/lib/apt/lists/*

# Registry configuration must land before any install. It goes to the user
# config because npm ignores a project-level .npmrc in global mode; pnpm reads
# the same file. corepack honours neither, so pnpm is installed with npm.
# The default is the feed proxy (networks here block registry.npmjs.org); CI
# builds override it with --build-arg NPM_REGISTRY=https://registry.npmjs.org/.
ARG NPM_REGISTRY=https://packagefeedproxy.microsoft.io/npm/
COPY .npmrc /root/.npmrc
RUN npm config set registry "$NPM_REGISTRY" && npm install -g pnpm@11.1.3

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY patches/ patches/

# ─── Stage 2: Install build dependencies ─────────────────────────────────────
FROM dependency-base AS deps

RUN pnpm install --frozen-lockfile

# ─── Stage 3: Install production dependencies ────────────────────────────────
FROM dependency-base AS prod-deps

RUN pnpm install --frozen-lockfile --prod

# ─── Stage 4: Build frontend ─────────────────────────────────────────────────
FROM deps AS build-frontend

ARG GIT_COMMIT=unknown
ENV VITE_GIT_COMMIT=$GIT_COMMIT

COPY CHANGELOG.md ./
COPY frontend/ frontend/
COPY backend/src/types/ backend/src/types/
RUN pnpm --filter frontend exec vite build

# ─── Stage 5: Build backend ──────────────────────────────────────────────────
FROM deps AS build-backend

COPY backend/ backend/
RUN pnpm --filter backend run build

# ─── Stage 6: Production image ───────────────────────────────────────────────
FROM node:24.18.0-slim AS production

# openssh-client provides the `ssh` binary used to reach ssh:// Docker
# endpoints via `docker system dial-stdio` (043 / FR-035).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssh-client \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the already-built production dependency tree without carrying compiler
# tooling or package-manager configuration into the runtime image.
COPY --from=prod-deps /app/node_modules/ node_modules/
COPY --from=prod-deps /app/backend/node_modules/ backend/node_modules/

# Copy built artifacts
COPY --from=build-backend /app/backend/dist/ backend/dist/
COPY --from=build-backend /app/backend/drizzle/ backend/drizzle/
COPY --from=build-frontend /app/frontend/dist/ frontend/dist/

# tsup bundles migrate.ts into dist/server.js where __dirname = backend/dist/
# The migration path resolves: backend/dist/../../drizzle → drizzle/
# So also symlink at /app/drizzle → /app/backend/drizzle
RUN ln -s /app/backend/drizzle /app/drizzle

# Data directory (mapped as a volume for persistence)
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV HOMEDASH_DATA_DIR=/app/data

EXPOSE 3000

CMD ["node", "backend/dist/server.js"]
