FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/tokens/package.json ./packages/tokens/
COPY packages/ui/package.json ./packages/ui/
COPY packages/api-client/package.json ./packages/api-client/
COPY apps/api/prisma ./apps/api/prisma/
ENV DATABASE_URL="mysql://placeholder:placeholder@localhost:3306/placeholder"
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages
COPY . .

# Same-origin API when SPA is served from this container (sportza.in → /api)
ARG VITE_API_URL=/api
ARG VITE_RAZORPAY_KEY_ID=
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_MAP_PROVIDER=mappls
ARG VITE_MAPPLS_API_KEY=
ARG VITE_GOOGLE_MAPS_API_KEY=
ARG VITE_AUTH0_DOMAIN=
ARG VITE_AUTH0_CLIENT_ID=
ARG VITE_AUTH0_AUDIENCE=

ENV VITE_API_URL=$VITE_API_URL \
    VITE_RAZORPAY_KEY_ID=$VITE_RAZORPAY_KEY_ID \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_MAP_PROVIDER=$VITE_MAP_PROVIDER \
    VITE_MAPPLS_API_KEY=$VITE_MAPPLS_API_KEY \
    VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY \
    VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN \
    VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID \
    VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE

RUN cd packages/tokens && npx tsup
RUN cd packages/ui && npx tsup || true
RUN cd packages/api-client && npx tsup || true
RUN cd apps/web && npx vite build

RUN cd apps/api && npx prisma generate
RUN cd apps/api && npx tsc || true

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/packages ./packages
COPY --from=build /app/tsconfig.base.json ./
# SPA assets — Express serves these for / (sportza.in)
COPY --from=build /app/apps/web/dist ./apps/api/public

WORKDIR /app/apps/api
ENV NODE_ENV=production
ENV PORT=5000
ENV WEB_DIST=/app/apps/api/public
EXPOSE 5000

CMD ["sh", "-c", "sed -i 's/\\r$//' scripts/railway-start.sh 2>/dev/null; sh scripts/railway-start.sh"]
