FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/web/package.json ./apps/web/
COPY packages/tokens/package.json ./packages/tokens/
COPY packages/ui/package.json ./packages/ui/
COPY packages/api-client/package.json ./packages/api-client/
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_API_URL=http://localhost:5000/api
ARG VITE_AUTH0_DOMAIN=
ARG VITE_AUTH0_CLIENT_ID=
ARG VITE_AUTH0_AUDIENCE=
ARG VITE_RAZORPAY_KEY_ID=
RUN cd packages/tokens && npx tsup
RUN cd packages/ui && npx tsup || true
RUN cd packages/api-client && npx tsup || true
RUN cd apps/web && npx vite build

FROM nginx:alpine AS runner
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]
