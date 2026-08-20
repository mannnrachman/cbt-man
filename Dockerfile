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

CMD ["sh", "-c", "npx prisma migrate deploy && npm run preview -- --host 0.0.0.0 --port 8080"]
