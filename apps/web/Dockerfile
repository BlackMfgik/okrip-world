FROM node:24-bookworm-slim
WORKDIR /app
RUN npm install --global pnpm@11.19.0
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile --filter @okrip/web... && pnpm --filter @okrip/contracts build && pnpm --filter @okrip/web build
RUN chown -R node:node /app/apps/web/.next
USER node
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "--filter", "@okrip/web", "start"]
