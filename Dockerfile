# syntax=docker/dockerfile:1-labs

# ==============================================================================
# OmniServices Multi-Stage Dockerfile for Microservices
# Optimized for monorepo layer caching, dependency pruning & non-root runtime
# Usage: docker build --build-arg SERVICE_NAME=auth -t omni-auth:latest .
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Base Alpine with Node.js & pnpm
# ------------------------------------------------------------------------------
FROM node:24-alpine AS base

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

# ------------------------------------------------------------------------------
# Stage 2: Install workspace dependencies with maximum cache efficiency
# ------------------------------------------------------------------------------
FROM base AS deps

# Install build dependencies for native node-gyp compilation (e.g., nebula, argon2)
RUN apk add --no-cache python3 make g++

# Copy root workspace manifests & pnpm configuration
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig*.json nest-cli.json webpack.config.cjs ./

# Copy ONLY package manifests across apps & libs to prevent cache busting on code changes
COPY --parents apps/*/package.json libs/common/package.json libs/contracts/*/package.json ./

# Install full dependencies (cached unless manifests change)
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ------------------------------------------------------------------------------
# Stage 3: Build the target microservice
# ------------------------------------------------------------------------------
FROM deps AS builder

ARG SERVICE_NAME
ENV NODE_ENV=production

# Ensure SERVICE_NAME is provided
RUN if [ -z "$SERVICE_NAME" ]; then echo "ERROR: SERVICE_NAME build-arg is required!" && exit 1; fi

# Copy full repository source code
COPY . .

# Generate Prisma Client if target service uses Prisma
RUN if [ -f "apps/${SERVICE_NAME}/prisma/schema.prisma" ]; then \
      pnpm exec prisma generate --schema="apps/${SERVICE_NAME}/prisma/schema.prisma"; \
    fi

# Build NestJS microservice bundle with SWC & Webpack
RUN pnpm exec nest build ${SERVICE_NAME}

# Create fallback directories to prevent COPY failures in runner stage
RUN mkdir -p apps/${SERVICE_NAME}/prisma apps/${SERVICE_NAME}/src/generated

# ------------------------------------------------------------------------------
# Stage 4: Prune devDependencies for a lean production runtime
# ------------------------------------------------------------------------------
FROM deps AS prod-deps

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm prune --prod --no-optional

# ------------------------------------------------------------------------------
# Stage 5: Production Runner (Lean, Secure, Isolated Container)
# ------------------------------------------------------------------------------
FROM node:24-alpine AS runner

ARG SERVICE_NAME
ENV NODE_ENV=production
ENV SERVICE_NAME=${SERVICE_NAME}
ENV PORT=3000

WORKDIR /app

# Install runtime utilities: dumb-init for signals, openssl for Prisma engines, curl for health checks
RUN apk add --no-cache dumb-init openssl libc6-compat curl

# Switch to standard non-root user
USER node

# Copy pruned production node_modules
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules

# Copy compiled service artifacts
COPY --from=builder --chown=node:node /app/dist/apps/${SERVICE_NAME} ./dist/apps/${SERVICE_NAME}

# Copy Protobuf contract schemas (required for gRPC runtime resolution)
COPY --from=builder --chown=node:node /app/libs/contracts ./libs/contracts

# Copy Prisma schema and generated clients for migrations and engine binaries
COPY --from=builder --chown=node:node /app/apps/${SERVICE_NAME}/prisma ./apps/${SERVICE_NAME}/prisma
COPY --from=builder --chown=node:node /app/apps/${SERVICE_NAME}/src/generated ./apps/${SERVICE_NAME}/src/generated

# Copy metadata
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/apps/${SERVICE_NAME}/package.json ./apps/${SERVICE_NAME}/package.json

# Default exposed ports (HTTP & gRPC)
EXPOSE 3000 50051

# Forward signals directly to dumb-init for clean process shutdown
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Use exec to replace shell with node process for proper signal forwarding
CMD ["sh", "-c", "exec node dist/apps/${SERVICE_NAME}/main.js"]
