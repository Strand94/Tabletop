# syntax=docker/dockerfile:1

# ---- Build stage: install everything, generate Prisma client, build apps ----
FROM node:20-alpine AS build
WORKDIR /app

# Toolchain for native deps (argon2) and Prisma engines.
RUN apk add --no-cache python3 make g++ openssl

# Install with full workspace context so npm resolves the workspaces.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
RUN npm ci

# Bring in the rest of the sources and build.
COPY . .
RUN npx prisma generate
RUN npm run build --workspace @tabletop/client
RUN npm run build --workspace @tabletop/server

# ---- Deps stage: production-only node_modules (no dev tooling in the image) ----
FROM node:20-alpine AS proddeps
WORKDIR /app
RUN apk add --no-cache python3 make g++ openssl
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
# Only production dependencies (server runtime + prisma CLI for migrate deploy).
RUN npm ci --omit=dev
# Generate the Prisma client against the production install.
COPY prisma ./prisma
RUN npx prisma generate

# ---- Runtime stage: minimal image that serves API + client ----
FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl curl
ENV NODE_ENV=production
ENV CLIENT_DIST=/app/client

# Production-only node_modules + generated Prisma client (keeps dev tooling and
# its vulnerabilities out of the shipped image), plus the built app and schema.
COPY --from=proddeps /app/node_modules ./node_modules
COPY --from=proddeps /app/package.json ./package.json
COPY --from=proddeps /app/prisma ./prisma
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/client/dist ./client

# Volumes for uploaded images and logs, owned by the non-root runtime user.
RUN mkdir -p /app/images /app/logs && chown -R node:node /app

# Drop privileges: run as the built-in non-root `node` user.
USER node

EXPOSE 5444
CMD ["node", "apps/server/dist/server.js"]
