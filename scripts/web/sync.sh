#!/bin/bash
# Sincroniza la web con el juego que está en public/jugar/: datos + fotos + build.
# Solo se vuelve a sacar lo que pedís, y solo quedan en el repo las imágenes que cambiaron de verdad.
#
# Uso: scripts/web/sync.sh [grupo ...]        (desde la raíz del repo)
#   grupos: datos | alas | mobs | razas | sets | armas | iconos | og | todo (por defecto: todo)
#   filtros: mobs:teju,monai   sets:caballero,arquera   alas:hechicero   iconos:gladiador
#   ejemplos: scripts/web/sync.sh datos            → solo los textos y números (segundos)
#             scripts/web/sync.sh mobs:teju        → solo la foto del Teju Jagua y sus recortes
#             scripts/web/sync.sh alas sets        → alas y sets de todas las razas
#             FORCE=1 scripts/web/sync.sh todo     → vuelve a escribir todo aunque no haya cambiado
# Las fotos crudas quedan en $WORK (por defecto /tmp/nox-gal) para que las composiciones (portada, capítulos)
# puedan rearmarse con la última versión de cada pieza sin volver a renderizar las demás.
# Necesita: node + playwright con chromium (npm i playwright && npx playwright install chromium) y python3 con Pillow, numpy y scipy.
set -e
cd "$(dirname "$0")/../.."
WORK=${WORK:-/tmp/nox-gal}; PORT=${PORT:-8788}; export BASE="http://localhost:$PORT/jugar/" ALPHA=1
[ $# -eq 0 ] && set -- todo
node scripts/web/serve.mjs public $PORT > /tmp/nox-serve.log 2>&1 & SRV=$!
trap "kill $SRV 2>/dev/null" EXIT
sleep 2
mkdir -p "$WORK"
want(){ for g in "$@"; do for a in "${ARGS[@]}"; do [ "${a%%:*}" = "$g" ] && return 0; [ "$a" = "todo" ] && return 0; done; done; return 1; }
only(){ for a in "${ARGS[@]}"; do case "$a" in $1:*) echo "${a#*:}";; esac; done; }
ARGS=("$@")
want datos && node scripts/web/extract.js web/data.json
want alas   && node scripts/web/gallery.js "$WORK/alas"  wingsonly "$(only alas)"
want mobs   && ZOOM=.78 node scripts/web/gallery.js "$WORK/mobs" mobs "$(only mobs)"
want razas  && node scripts/web/gallery.js "$WORK/razas" razas "$(only razas)"
want sets   && node scripts/web/gallery.js "$WORK/sets"  sets  "$(only sets)"
want armas  && node scripts/web/gallery.js "$WORK/big"   bigicons
want iconos && node scripts/web/gallery.js "$WORK/icons" icons "$(only iconos)"
if want alas mobs razas sets armas iconos; then python3 scripts/web/cutouts.py "$WORK"; fi
if want og razas; then
  node scripts/web/og.js "http://localhost:$PORT/" /tmp/nox-og.jpg && python3 - <<'PY'
import os
from PIL import Image
import numpy as np
new=Image.open('/tmp/nox-og.jpg');dst='web/img/w/og-invita.jpg'
def same(a,b,tol=9.0,frac=.04):
    if a.size!=b.size:return False
    x=np.asarray(a.convert('RGB')).astype(np.int16);y=np.asarray(b.convert('RGB')).astype(np.int16);d=np.abs(x-y).max(2)
    return d.mean()<tol and (d>40).mean()<frac
if os.environ.get('FORCE')=='1' or not os.path.exists(dst) or not same(Image.open(dst),new):new.save(dst,'JPEG',quality=88);print('og-invita.jpg actualizada')
else:print('og-invita.jpg sin cambios')
PY
fi
bash scripts/web/build.sh
echo
echo "Cambios que quedaron para subir:"; git status --short web public | head -40
echo "(si no aparece nada, la web ya estaba igual al juego)"
