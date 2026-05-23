FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages/tokens/package.json ./packages/tokens/
COPY packages/ui/package.json ./packages/ui/
COPY packages/api-client/package.json ./packages/api-client/
COPY apps/api/prisma ./apps/api/prisma/
ENV DATABASE_URL="mysql://placeholder:placeholder@localhost:3306/placeholder"
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN cd apps/api && npx prisma generate
RUN cd apps/api && npx tsc || true

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/packages ./packages
COPY --from=build /app/tsconfig.base.json ./

WORKDIR /app/apps/api
EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/index.ts"]
