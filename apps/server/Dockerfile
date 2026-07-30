# Stage 1: install dependencies
FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock bunfig.toml ./

# Copy all workspace package.json files so bun can resolve the monorepo
COPY apps/server/package.json ./apps/server/
# Create a minimal placeholder for native so bun workspace resolver doesn't fail
RUN mkdir -p ./apps/native && echo '{"name":"native","version":"1.0.0","private":true}' > ./apps/native/package.json
COPY packages/db/package.json ./packages/db/
COPY packages/db/prisma ./packages/db/prisma
COPY packages/db/prisma.config.ts ./packages/db/
COPY packages/env/package.json ./packages/env/
COPY packages/config/package.json ./packages/config/

RUN bun install --ignore-scripts
RUN cd packages/db && bunx prisma generate

# Stage 2: build
FROM oven/bun:1 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/env/node_modules ./packages/env/node_modules
COPY . .

RUN cd apps/server && bun run build

# Stage 3: production image
FROM oven/bun:1-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/packages/db/prisma.config.ts ./packages/db/
COPY --from=builder /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder /app/packages/env ./packages/env
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["sh", "-c", "cd packages/db && bunx prisma migrate deploy && cd /app/apps/server && bun run dist/index.mjs"]
