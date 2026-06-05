# Install dependencies in an isolated stage to leverage layer caching
FROM node:22.14.0-alpine AS backend-deps

RUN corepack enable && corepack prepare pnpm@10.33.3 --activate
WORKDIR /app/back

COPY back/package.json ./
COPY back/prisma ./prisma
COPY back/prisma.config.ts ./
RUN pnpm install --no-frozen-lockfile --ignore-scripts


# Runtime stage: copy source and generate Prisma client
FROM backend-deps AS backend

WORKDIR /app/back
COPY back ./
RUN pnpm exec prisma generate

EXPOSE 3000
# Run migrations then start in dev mode
CMD ["sh", "-c", "pnpm exec prisma generate && pnpm exec prisma migrate deploy && pnpm run start:dev"]


# Install frontend dependencies separately
FROM node:22.14.0-alpine AS frontend-deps

WORKDIR /app/front
COPY front/package.json front/package-lock.json ./
RUN npm ci


# Frontend runtime stage
FROM frontend-deps AS frontend

WORKDIR /app/front
COPY front ./

EXPOSE 5173
# Bind to 0.0.0.0 so Vite is reachable from outside the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]