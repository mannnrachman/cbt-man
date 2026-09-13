FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production \
    DATABASE_URL=file:/app/data/cbt.db

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:8080/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"

CMD ["sh", "-c", "npx prisma migrate deploy && if [ \"${SEED_DEMO:-false}\" = true ] && [ ! -f /app/data/.demo-seeded ]; then npm run prisma:seed && touch /app/data/.demo-seeded; fi && npm run preview -- --host 0.0.0.0 --port 8080"]
