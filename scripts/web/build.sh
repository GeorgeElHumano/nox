#!/bin/bash
# Arma la parte web de public/ (portada, cuenta e imágenes). El juego (public/jugar/) se arma aparte.
# Uso: scripts/web/build.sh   (desde la raíz del repo)
set -e
cd "$(dirname "$0")/../.."
python3 scripts/web/assemble.py
rm -rf public/img public/cuenta
cp -r web/img public/img
cp -r web/cuenta public/cuenta
cp web/_headers public/_headers
echo "web lista: $(find public/img -type f | wc -l) imágenes"
