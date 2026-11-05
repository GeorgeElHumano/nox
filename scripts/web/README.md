# Web de NOX (noxparaguay.com)

La portada vive en `web/` y se arma en `public/` con `scripts/web/build.sh`.
Las imágenes y los datos de la web salen **del juego**: `scripts/web/sync.sh` abre `public/jugar/` en un navegador sin ventana, extrae los datos (`web/data.json`) y saca todas las fotos con fondo transparente (`web/img/w/`).

- `scripts/web/build.sh` — arma `public/index.html`, `public/cuenta` y `public/img` (rápido).
- `scripts/web/sync.sh [grupo ...]` — después de parchear el juego. Solo vuelve a sacar lo que pedís y **solo deja en el repo las imágenes que cambiaron de verdad** (las fotos salen con pose fija y se comparan con las anteriores; el ruido de render no cuenta).
  - `sync.sh datos` → textos y números del juego (segundos).
  - `sync.sh mobs:teju,monai` · `sync.sh alas:hechicero` · `sync.sh sets:caballero` · `sync.sh razas` · `sync.sh armas` · `sync.sh iconos`.
  - `sync.sh todo` → todo (30–40 min). `FORCE=1` reescribe aunque no haya cambios.
  - Al final imprime `git status` de `web/` y `public/`: eso es lo único que hay que subir.
- `scripts/web/assemble.py` — pega las piezas de `web/` (cabecera, capítulos, fichas, datos, descargas).
- `scripts/web/gallery.js` — fotos desde el juego (modos: wingsonly, mobs, razas, sets, bigicons, icons2).
- `scripts/web/cutouts.py` — recorta, compone (portada, capítulos) y guarda WebP.
- `scripts/web/extract.js` — lee `window.__NOX.GAMEDATA` y escribe `web/data.json`.

Requisitos: `node` con `playwright` (`npm i playwright && npx playwright install chromium`) y `python3` con `Pillow numpy scipy`.
