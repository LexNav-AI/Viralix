FROM node:22-alpine AS builder

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy workspace manifests first (layer-cache friendly)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json         ./apps/api/
COPY lib/db/package.json           ./lib/db/
COPY lib/types/package.json        ./lib/types/

# Install all dependencies (frozen for reproducibility)
RUN pnpm install --frozen-lockfile

# Copy full source
COPY . .

# Compile TypeScript → dist/
RUN pnpm --filter @viralix/api run build

# ---------------------------------------------------------------------------
# Runtime image — smaller footprint
# ---------------------------------------------------------------------------
FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json         ./apps/api/
COPY lib/db/package.json           ./lib/db/
COPY lib/types/package.json        ./lib/types/

# Production deps only
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/lib/db/dist   ./lib/db/dist
COPY --from=builder /app/lib/types/dist ./lib/types/dist

# Non-root user for security
RUN addgroup -S viralix && adduser -S viralix -G viralix
USER viralix

EXPOSE 8090

CMD ["node", "apps/api/dist/index.js"]
