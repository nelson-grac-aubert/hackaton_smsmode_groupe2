# Dockerfile Stage DEV
FROM node:22.14.0-alpine

RUN corepack enable && corepack prepare pnpm@10.33.3 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY . .

CMD ["pnpm", "run", "start:dev"]