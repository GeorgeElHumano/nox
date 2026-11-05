# Web de NOX (noxparaguay.com)

La portada vive en `web/` y se arma en `public/` con `scripts/web/build.sh`.
Las imágenes y los datos de la web salen **del juego**: `scripts/web/sync.sh` abre `public/jugar/` en un navegador sin ventana, extrae los datos (`web/data.json`) y saca todas las fotos con fondo transparente (`web/img/w/`).

- `scripts/web/build.sh` — arma `public/index.html`, `public/cuenta` y `public/img` (rápido).
- `scripts/web/sync.sh` — después de parchear el juego: datos + fotos + build (30–40 min). `sync.sh solo-datos` tarda segundos.
- `scripts/web/assemble.py` — pega las piezas de `web/` (cabecera, capítulos, fichas, datos, descargas).
- `scripts/web/gallery.js` — fotos desde el juego (modos: wingsonly, mobs, razas, sets, bigicons, icons2).
- `scripts/web/cutouts.py` — recorta, compone (portada, capítulos) y guarda WebP.
- `scripts/web/extract.js` — lee `window.__NOX.GAMEDATA` y escribe `web/data.json`.

Requisitos: `node` con `playwright` (`npm i playwright && npx playwright install chromium`) y `python3` con `Pillow numpy scipy`.
