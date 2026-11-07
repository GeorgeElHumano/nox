# NOX · Mapa técnico

Cómo está armado el juego y la web, para no tener que volver a analizarlo. Se actualiza cada vez que cambia algo importante.

Última actualización: 6 de noviembre de 2026.

## Repositorio y publicación

- Repo: `GeorgeElHumano/nox`. Rama de trabajo: `arte-cc0`.
- **No se publica nada sin el OK del dueño.** Publicar es hacer push a `main`: Cloudflare Pages (`wrangler.toml`, carpeta `public/`) despliega solo en 1 o 2 minutos.
- Se puede publicar **solo la web** sin tocar el juego:
  - Hacer un worktree de `origin/main`.
  - Traer `web/`, `scripts/web/`, `public/index.html` y `public/img/` desde `arte-cc0`, y nada de `public/jugar/`.
  - Hacer commit y push a `main`.
  - Después mergear `origin/main` en `arte-cc0`.
- Estado al 6/11/2026:
  - La web nueva está publicada.
  - El juego de `arte-cc0` (Moñái dragón, escorpión nuevo, Mburuvicha por Energía, sonidos nuevos, portada azul) **todavía no** está publicado.
- `functions/api/[[path]].js`: la API del servidor (cuentas, pedidos), con base D1 `nox-db`.
- `gamedata.json`: exportación de datos del juego que usa `gencatalog.py` para `lib/catalog.js` (tienda). No valida stats.

## Juego: `public/jugar/index.html`

Un solo archivo HTML de unos 880 KB con three.js r128, que se carga del CDN. Partes clave:

### Datos

- `CLASSES`: clases con stats base y stat principal.
  - Caballero: fue. Hechicero: ene. Arquera: agi. Gladiador: fue.
  - Mburuvicha: **ene** desde el 6/11/2026.
  - `reqOf` usa `main` para lo que piden los ítems.
- `STATFX`: qué hace cada stat en cada clase. Se muestra en la ficha del personaje (`renderChar`).
- `recalc()` (cerca de la línea 1450): fórmulas de vida, maná, daño y defensa por clase.
  - El cuervo del Mburuvicha está en `ravenTick`: daño `.55*(1+ene/260)`.
  - En el Caballero, la energía sube las técnicas: `useSkill` multiplica `mult` por `1+ene/500`.
- Mascotas: `PETS` (precio, sonido), `PETK`, `C.pets={imp,hada,rudolf}` (las tres a la vez, una casilla cada una en `#eqGrid`, `.pslot`). `petTick`/`petMove` dibujan una figura por mascota en `PETPOS`. Se venden en la tienda de Ña Eusebia (`shopStock('boticaria')`). Sonidos `pet_imp`, `pet_hada`, `pet_rudolf` (síntesis propia). Íconos en `assets/ui/pet_*.webp`. Partidas viejas: `C.pet` pasa a `C.pets` en `fixChar`.
- Muertes de criaturas en código: `deadScorp` (panza arriba), `deadLizard` (sobre la panza), serpientes con `e.deadK` dentro de `updSnake`; poses guardadas en `e.dk0` y repuestas en `respawnEnemy`. Luisón usa el ataque del aguará (`ATK_FROM`). Teju Guasu salta el inicio de su muerte (`deathFrom`). Fantasmas: altura máxima .18.
- Mascotas: Imp = `pet_bat` rojo con cuernos (`horns`), Rudolf = `c_a_stag` con pelaje (`fur`, UV de caja). Precios: Rudolf 800.000, Imp y Hada 1.500.000.
- `fixChar()`: migraciones de las partidas guardadas. Si `c.mbE` no existe, al Mburuvicha se le devuelven los puntos una sola vez y se avisa con un toast en `enterGame`.
- Mobs y mapas:
  - `MOBS`: definición de cada mob (`model:'quad'|'lizard'|'scorp'|'snake'|'biped'`).
  - `MYTH`: ficha y apariencia de los mitos (human / beast / snake / qm).
  - `ZONES`: zonas.
  - `OAD_BEAST` / `OAD_NPC`: modelos de 0 A.D.
- Sonido:
  - `snd(name)` carga `assets/s/NAME.mp3`.
  - `BSND`: voces de cada criatura.
  - `BEDZ`: ambientes por zona. `MUSZ`: música por zona (`assets/m`).
  - `stepSurface`: qué sonido de pasos va en cada suelo.
  - `sndCore`: lo que se precarga.

### Modelos

- Mobs procedurales:
  - `scorpModel` / `poseScorp`: escorpión, rehecho el 6/11.
  - `snakeModel` / `updSnake`: serpientes. Con `rear` el cuello va erguido en S y con `head:'dragon'` es el Moñái.
  - También `lizardModel`, `quadModel` y `bipedMob`.
- Mitos humanos: `mythHuman`. El extra de cada uno puede usar `A.top`, la altura de la coronilla.
  - Los sombreros van en `A.top-.115*U` a `-.125*U`, con z `+.03*U`.
  - `strawHat` hace el sombrero de paja y `hairStrandTex` el pelo.
- Héroes y equipo:
  - `cc0Human` / `forgeApply` / `cc0Armor`: cuerpos CC0 y armaduras.
  - `FORJA`: estilo de cada set por clase y nivel.
  - Alas: generaciones 1 a 3 (`WINGN3`). `makeAura`: auras.
- NPC: `npcLit` ilumina las caras debajo de los techos. `updNpcs` mueve sus efectos.

### Pantallas

- `#boot`: pantalla de carga. Un script inline mide los fetch de `assets/`.
- `#sel`: portada y selección de personaje.
- Las dos usan el tema de la web: noche `#1a1d47`, oro `#e2a83f`/`#f6d892`, fuentes Cinzel, Cormorant Garamond y Alegreya Sans. El bloque CSS está antes del script de boot.

### Ganchos de prueba

`window.__NOX` expone `STUDIO`, `MOBS`, `MYTH`, `GAMEDATA`, `HERO`, `DS`, `C`, `fixChar`, `recalc`, `renderChar`, `SND`, `setEq`, entre otros.

## Assets del juego

- `assets/*.json`: modelos.
  - `b_*`: bestias de 0 A.D.
  - `q_*`: monstruos de Quaternius (CC0).
  - `c_*`: CC0.
  - `p_*`: piezas.
  - `d_*`: decoración.
- `assets/s/*.mp3`: 160 efectos.
  - Se arman con `/home/claude/sndaudit/build.py`.
  - Todas las fuentes son gratuitas y con licencia. El volumen va parejo por categoría (`CAT`).
  - Los créditos están en `CREDITOS-SONIDO.md`.
  - Escudos: `CC0_SH` (un modelo por set) + `CC0_SHT` (tinte desde Tau) para que no se repitan.
  - `mu_gem` y `mu_rare` son síntesis propia: `sndaudit/synth.py`.
  - Ojo: si a `build.py` se le pasan argumentos, pisa `build.json`. Correrlo siempre sin argumentos.
- `assets/m/*.mp3`: música de 0 A.D. (CC BY-SA 3.0) normalizada a −18 LUFS, a 112k.

## Web: `web/` → `public/`

- Fuentes:
  - `web/shell_head.html`: CSS principal.
  - `web/shell_body.html` y `web/views.html` / `views.css` / `views.js`: las fichas.
  - `web/shell_js.js`: navegación.
  - `web/data.json`: datos sacados del juego.
  - `web/dl_block.js`: descargas.
- `scripts/web/build.sh` → `assemble.py` arma `public/index.html` y copia `web/img` → `public/img`.
  - Cada imagen lleva `?v=huella` (md5 de 8 caracteres) para que la caché nunca muestre fotos viejas.
  - En el JS, el mapa de huellas es `IMGV` y las direcciones se arman con `IMG(n)`.
- Las fotos se sincronizan con el juego con `scripts/web/sync.sh [datos|alas|mobs|razas|sets|armas|iconos|og][:filtro]`.
  - Las fotos crudas quedan en `/tmp/nox-gal`.
  - `gallery.js` saca las fotos con Playwright.
  - `cutouts.py` arma recortes y composiciones: `lineup` (fila en V con paso fijo) y `soft()`, que deja bordes suaves y saca la neblina.
  - Con `FORCE=1` reescribe todo, incluso los sets. Usarlo con cuidado: las fotos crudas de sets pueden estar viejas.
- Fotos de mobs (`gallery.js` modo mobs):
  - Encuadre por la caja real del modelo, en tres cuartos.
  - Se esconde al héroe.
  - Las serpientes erguidas van con la cámara baja.
- Capítulos:
  - `#stage` hace scroll con snap.
  - Cada `#ch-X` tiene su propio fondo `var(--c-X)`, porque en iPhone el fondo de `html` no se repinta.
  - El bloque de color `.ola` está desactivado.
  - Las fotos van **sin** `filter: drop-shadow`, porque Safari dibuja un rectángulo. En su lugar hay una sombra de piso con `.fig::after`.
- Portada en celular (≤860px): las tarjetas de mitología y descargas forman juntas una sola pantalla (50svh cada una, con aire para el encabezado y la barra de abajo). Los puntos de snap en celular son `.pan.main` y `.pan.myth` (no `#ch-inicio`). Clave: `#ch-inicio` usa `overflow:clip`, porque con `overflow:hidden` el capítulo pasa a ser contenedor de scroll y Safari ignora los snaps de adentro (saltaba directo a Mitología). Probar siempre con WebKit: `tools/wk.js` y `wk3.js` (Playwright webkit, iPhone 15).
- Cada capítulo debe entrar entero en la pantalla (si es más alto, el snap deja paradas a medias): reglas por alto de pantalla al final de `shell_head.html` (laptops bajas, celulares ≤760 y ≤620 de alto, pantallas 2K/4K). Solo Descargas puede ser más alto (lista larga, es el último).
- Revisión en dispositivos: `tools/devs.js URL` (iPhone SE/15/15 Pro Max, iPad Mini vertical y horizontal, iPad Pro, Pixel 7, Galaxy S9+, Galaxy Tab, laptops 1366 y 1568, PC 1920 y 2560, Firefox, Safari Mac; `ONLY="iPhone SE,PC 2560"` para filtrar) y `tools/chh.js URL` (qué capítulos son más altos que la pantalla).
- `_headers`: `/img/*` se guarda 1 día en caché, por eso existe la huella en la dirección.

## Herramientas de prueba (`/home/claude/tools`)

- `up.sh`: levanta el servidor local en `:8788` con `public/`.
- `boot.js`: entra al juego.
- `mobs.js` y `head.js`: fotos de mobs, con primer plano por yaw, distancia y altura.
- `sanity.js`: zonas y errores.
- `sndgame.js`: prueba los sonidos dentro del juego.
- `stattest.js`: prueba la devolución de puntos y las fórmulas del Mburuvicha.
- `screens.js` y `bootshot.js`: portada y pantalla de carga.
- `trans.js`: transiciones de la web.
- `live.js` y `live2.js`: revisan noxparaguay.com en vivo.
- `gdrive.py`: lista y baja carpetas de Google Drive (packs de Quaternius).
- `oga.sh`: busca en OpenGameArt.

## Pendientes conocidos

- Cuando se publique el juego con las 3 mascotas: en `web/views.js` (pestaña Mascotas) volver a poner el texto "Podés llevar las tres a la vez… Ña Eusebia las vende" y activar los precios (`W.petsShop`). Hoy la web publicada no lo dice porque el juego publicado todavía lleva una sola.

- Publicar el juego de `arte-cc0` cuando el dueño lo apruebe.
- Ítem "Coraza del Rey de las Serpientes": el texto dice "piel dorada" y el Moñái ahora es rojo. Falta que el dueño decida el texto nuevo.
- Nada de esto existe para el escorpión ni el Moñái en modelos 3D descargables gratis (poly.pizza da 403 desde el servidor). Por eso son procedurales.
