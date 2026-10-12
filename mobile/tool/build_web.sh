#!/usr/bin/env bash
# Mobil uygulamanın web önizlemesini derler ve frontend/public/mobil altına koyar.
# Böylece docker compose / Railway'deki site /mobil/ adresinde aynı API ile mobil demoyu da sunar.
set -euo pipefail
cd "$(dirname "$0")/.."
flutter build web --release --base-href /mobil/ --pwa-strategy=none --dart-define=API_URL=/api
rm -rf ../frontend/public/mobil
cp -R build/web ../frontend/public/mobil
rm -f ../frontend/public/mobil/.last_build_id
# Yalnızca Chrome/Safari'nin kullandığı CanvasKit dosyaları kalsın (repo boyutu)
rm -f ../frontend/public/mobil/canvaskit/skwasm* ../frontend/public/mobil/canvaskit/*.symbols ../frontend/public/mobil/canvaskit/chromium/*.symbols
du -sh ../frontend/public/mobil
