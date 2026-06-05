#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Migrations done. Running seed..."
npx prisma db seed

echo "Seed done. Starting app..."
exec "$@"
