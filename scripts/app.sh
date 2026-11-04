#!/bin/bash
# Arma la carpeta "app" de Electron: arranque, configuración y una copia del juego para jugar sin internet.
# Uso: scripts/app.sh DESTINO   (se corre desde la raíz del repositorio)
set -e
D="$1"; V=$(cat VERSION)
mkdir -p "$D/game"
cp desktop/main.js desktop/config.json desktop/icon.png "$D/"
sed "s/\"version\":\"[0-9.]*\"/\"version\":\"$V\"/" desktop/package.json > "$D/package.json"
cp -r desktop/vendor "$D/game/vendor"
cp -r public/jugar/assets "$D/game/assets"
python3 - "$D" <<'PY'
import sys
d=sys.argv[1]
s=open('public/jugar/index.html',encoding='utf-8').read()
s=s.replace('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js','vendor/three.min.js')
s=s.replace('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/','vendor/examples/')
open(d+'/game/index.html','w',encoding='utf-8').write(s)
PY
