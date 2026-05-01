# syntax=docker/dockerfile:1
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# Copy source first, then install (pnpm store cache makes this fast)
COPY . .

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

RUN pnpm --filter @lucky-slots/web build

FROM node:20-slim AS production
WORKDIR /app
COPY --from=base /app/apps/web/.output ./.output

ENV NODE_ENV=production
ENV PORT=3000
ENV NITRO_PORT=3000
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
