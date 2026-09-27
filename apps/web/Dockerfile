FROM node:24-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@11.19.0
WORKDIR /app

FROM base AS build
# Спершу лише маніфести: поки залежності не змінились, шар встановлення береться з кешу.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/web/package.json ./apps/web/
# Кеш-маунти Railway мають id формату s/<service-id>-<шлях>; сховище pnpm живе між збірками.
RUN --mount=type=cache,id=s/a6b24472-1c96-4c08-af94-33074dc144cc-/pnpm/store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @okrip/web... --store-dir /pnpm/store
COPY packages/contracts ./packages/contracts
COPY apps/web ./apps/web
# .next/cache — інкрементальний кеш компілятора Next.js між збірками.
RUN --mount=type=cache,id=s/a6b24472-1c96-4c08-af94-33074dc144cc-/app/apps/web/.next/cache,target=/app/apps/web/.next/cache \
    pnpm --filter @okrip/contracts build && pnpm --filter @okrip/web build

# Фінальний образ: лише standalone-сервер без dev-залежностей і вихідного коду.
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
