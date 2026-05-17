FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy workspace manifests first (layer-cache friendly)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json  ./apps/api/
COPY lib/db/package.json    ./lib/db/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# 1. Compile lib/db → lib/db/dist  (apps/api depends on @viralix/db)
RUN pnpm --filter @viralix/db run build

# 2. Compile apps/api → apps/api/dist
RUN pnpm --filter @viralix/api run build

# ---------------------------------------------------------------------------
# Runtime image
# ---------------------------------------------------------------------------
FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json  ./apps/api/
COPY lib/db/package.json    ./lib/db/

# Production deps only
RUN pnpm install --frozen-lockfile --prod

# Compiled output
COPY --from=builder /app/apps/api/dist  ./apps/api/dist
COPY --from=builder /app/lib/db/dist    ./lib/db/dist

RUN addgroup -S viralix && adduser -S viralix -G viralix
USER viralix

EXPOSE 8090

CMD ["node", "apps/api/dist/index.js"]
