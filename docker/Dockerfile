# syntax=docker/dockerfile:1

# ---- Build stage: install everything, generate Prisma client, build apps ----
FROM node:26-alpine AS build
WORKDIR /app

# Toolchain for native deps (argon2) and Prisma engines.
RUN apk add --no-cache python3 make g++ openssl

# Install with full workspace context so npm resolves the workspaces. The
# Prisma schema + config are copied before `npm ci` because the postinstall
# hook runs `prisma generate` (Prisma 7 emits the client to a source path).
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma prisma/
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
RUN npm ci

# Bring in the rest of the sources and build.
COPY . .
RUN npm run build --workspace @tabletop/client
RUN npm run build --workspace @tabletop/server

# ---- Prod deps stage: production-only node_modules (no dev tooling shipped) ----
FROM node:26-alpine AS proddeps
WORKDIR /app
RUN apk add --no-cache python3 make g++ openssl
# Prisma schema + config are needed by the postinstall `prisma generate`.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma prisma/
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
# Production dependencies only (server runtime + prisma CLI + dotenv for the
# boot-time `migrate deploy`); keeps dev tooling and its CVEs out of the image.
RUN npm ci --omit=dev

# ---- Runtime stage: minimal image that serves API + client ----
FROM node:26-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl curl
ENV NODE_ENV=production
ENV CLIENT_DIST=/app/client

# Production-only node_modules (dev tooling excluded). The generated Prisma
# client is bundled into the server dist by esbuild, so it need not be copied.
# Root node_modules holds the hoisted deps; the server workspace keeps its own
# node_modules for deps that can't hoist (e.g. multer, whose readable-stream@3
# subtree conflicts with the root's readable-stream@4). esbuild leaves all npm
# deps external, so both trees must ship or Node can't resolve them at runtime.
COPY --from=proddeps /app/node_modules ./node_modules
COPY --from=proddeps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/client/dist ./client

# Volumes for uploaded images and logs, owned by the non-root runtime user.
# Only these dirs need write access — chown just them (a recursive `chown /app`
# rewrites every node_modules file's metadata, duplicating ~360MB into a new
# layer). The rest is world-readable and read-only at runtime.
RUN mkdir -p /app/images /app/logs && chown node:node /app/images /app/logs

# Drop privileges: run as the built-in non-root `node` user.
USER node

EXPOSE 5470
CMD ["node", "apps/server/dist/server.js"]
