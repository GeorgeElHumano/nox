#!/bin/bash
# El catálogo de la tienda Noxis vive en lib/noxis.js. El servidor en vivo (live/) se despliega aparte y no puede
# importar de fuera de su carpeta, así que usa una copia. Correr esto después de tocar lib/noxis.js.
set -e
cd "$(dirname "$0")/.."
cp lib/noxis.js live/src/noxis.js
echo "live/src/noxis.js al día"
