#!/bin/sh
set -e
echo "▶ Veritabanı migration'ları uygulanıyor…"
npx prisma migrate deploy
echo "▶ Yönetici hesabı hazırlanıyor…"
if [ "$SEED_DEMO" = "true" ]; then
  node dist/prisma/seed.js --demo
else
  node dist/prisma/seed.js
fi
echo "▶ API başlatılıyor"
exec node dist/src/server.js
