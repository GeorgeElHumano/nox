# NOX: reglas para trabajar en este repo

- Leer `MAPA-TECNICO.md` antes de tocar el juego o la web, y actualizarlo con cada cambio.
- No se publica nada sin el OK del dueño. Publicar = push a `main`.
- **Juego y web van siempre juntos.** Cada vez que se publique un parche del juego, en el mismo push se actualiza la web (`noxparaguay.com`):
  1. `NODE_PATH=/opt/npm-tools/node_modules bash scripts/web/sync.sh datos` (textos, nombres, colores, PNJ, mobs, misiones).
  2. Fotos solo de lo que cambió en ese parche: `razas`, `sets[:clase]`, `alas[:clase]`, `iconos[:clase]`, `armas`, `mobs:id1,id2`, `og`. Después revisar `git status web/img` y volver atrás (`git checkout`) las imágenes de cosas que no se tocaron (el render cambia unos píxeles y las marca como cambiadas) y `cut_app.webp`.
  3. Si el parche agrega zonas, PNJ, mobs o eventos, sumarlos a los textos de la web (`web/shell_body.html`, `web/views.html`, mapa `PINS`/`LBLPOS` en `web/views.js` y `PINS`/`LP` en `web/shell_js.js`).
  4. `bash scripts/web/build.sh`, mirar las fotos nuevas (que no aparezca el héroe ni avisos) y mostrar el antes/después al dueño con el resto del parche.
- `scripts/patch.sh` recuerda este paso al terminar.
