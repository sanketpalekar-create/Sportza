# Cursor Cloud Agent base image for Sportza monorepo.
# Do not COPY the project — Cursor checks out the repo into the workspace.
FROM node:20-bookworm

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

RUN apt-get update \
  && apt-get install -y --no-install-recommends git openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
