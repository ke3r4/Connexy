FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/connectors/package*.json ./packages/connectors/
COPY packages/ai-engine/package*.json ./packages/ai-engine/
COPY packages/data/package*.json ./packages/data/

RUN npm ci --legacy-peer-deps

COPY . .

RUN npx vite build --config apps/web/vite.config.ts --outDir apps/web/dist

FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/ ./apps/
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/wrangler.jsonc ./wrangler.jsonc
COPY --from=builder /app/infra/ ./infra/
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/node_modules/ ./node_modules/

ENV ENVIRONMENT=production
EXPOSE 8787

CMD ["npx", "wrangler", "dev", "--port", "8787"]