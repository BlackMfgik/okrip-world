FROM node:24-bookworm-slim
WORKDIR /app
RUN npm install --global pnpm@11.19.0
# Спершу лише маніфести: поки залежності не змінились, шар встановлення береться з кешу.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/api/package.json ./apps/api/
# Кеш-маунт Railway (id формату s/<service-id>-<шлях>): сховище pnpm живе між збірками.
RUN --mount=type=cache,id=s/69ef2bcd-ff13-46bc-ac02-2044cf865d4d-/pnpm/store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @okrip/api... --store-dir /pnpm/store
COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api
RUN pnpm --filter @okrip/contracts build && pnpm --filter @okrip/api build
USER node
ENV NODE_ENV=production
EXPOSE 3001
CMD ["pnpm", "--filter", "@okrip/api", "start"]
