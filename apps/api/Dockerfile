FROM node:24-bookworm-slim
WORKDIR /app
RUN npm install --global pnpm@11.19.0
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile --filter @okrip/api... && pnpm --filter @okrip/contracts build && pnpm --filter @okrip/api build
USER node
ENV NODE_ENV=production
EXPOSE 3001
CMD ["pnpm", "--filter", "@okrip/api", "start"]
