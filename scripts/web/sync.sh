#!/bin/bash
# Sincroniza la web con el juego: saca los datos y todas las fotos del juego que está en public/jugar/ y arma public/.
# Uso: scripts/web/sync.sh [solo-datos|solo-fotos]   (desde la raíz del repo; tarda 30-40 minutos con todas las fotos)
# Necesita: node + playwright con chromium (npm i playwright && npx playwright install chromium) y python3 con Pillow, numpy y scipy.
set -e
cd "$(dirname "$0")/../.."
WORK=${WORK:-/tmp/nox-gal}; PORT=8788; export BASE="http://localhost:$PORT/jugar/" ALPHA=1
node scripts/web/serve.mjs public $PORT > /tmp/nox-serve.log 2>&1 & SRV=$!
trap "kill $SRV 2>/dev/null" EXIT
sleep 2
if [ "$1" != "solo-fotos" ]; then
  node scripts/web/extract.js web/data.json
fi
if [ "$1" != "solo-datos" ]; then
  rm -rf "$WORK"; mkdir -p "$WORK"
  node scripts/web/gallery.js "$WORK/alas" wingsonly
  ZOOM=.78 node scripts/web/gallery.js "$WORK/mobs" mobs
  node scripts/web/gallery.js "$WORK/razas" razas
  node scripts/web/gallery.js "$WORK/sets" sets
  node scripts/web/gallery.js "$WORK/big" bigicons
  node scripts/web/gallery.js "$WORK/icons" icons
  python3 scripts/web/cutouts.py "$WORK"
fi
node scripts/web/og.js "http://localhost:$PORT/" web/img/w/og.jpg || true
bash scripts/web/build.sh
echo "listo: revisá public/ y subí los cambios"
