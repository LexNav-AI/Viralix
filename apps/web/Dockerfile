# ---------------------------------------------------------------------------
# Stage 1: Build the Vite SPA
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json    ./apps/web/
COPY lib/types/package.json   ./lib/types/

# Install all dependencies (includes devDeps needed for build)
RUN pnpm install --frozen-lockfile

# Copy full source
COPY . .

# Accept build-time API base URL
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build the SPA
RUN pnpm --filter @viralix/web run build

# ---------------------------------------------------------------------------
# Stage 2: Serve via Nginx
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine

# Copy compiled SPA
COPY --from=builder /app/apps/web/dist /var/www/html

# Copy Nginx config (assumes repo root is build context)
COPY infrastructure/nginx/nginx.conf /etc/nginx/nginx.conf

# Expose HTTP only; HTTPS termination is handled by the load balancer
# or the nginx container itself when SSL certs are mounted.
EXPOSE 80

# Healthcheck so ECS/Docker knows when Nginx is ready
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://localhost/nginx-health || exit 1

CMD ["nginx", "-g", "daemon off;"]
