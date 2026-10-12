#!/usr/bin/env bash
# Entegrasyon testi sırasında bırakılan *.req işaretlerini görüp simülatörden ekran görüntüsü alır.
# Kullanım: tool/shots.sh <simülatör-id> <klasör>   (arka planda çalıştırın, işi bitince kapatın)
sim="$1"; dir="$2"; mkdir -p "$dir"
while true; do
  for r in "$dir"/*.req; do
    [ -e "$r" ] || continue
    n="$(basename "$r" .req)"; rm -f "$r"
    xcrun simctl io "$sim" screenshot "$dir/$n.png" >/dev/null 2>&1
  done
  sleep 0.15
done
