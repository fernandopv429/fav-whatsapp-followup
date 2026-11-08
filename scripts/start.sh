#!/bin/sh
set -e

echo "[start] aplicando migrations..."
npx prisma migrate deploy

echo "[start] subindo worker em background..."
node scripts/worker.mjs &

echo "[start] subindo servidor Next.js..."
exec npm run start
