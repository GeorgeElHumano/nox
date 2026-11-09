# NOX · Mapa técnico

Cómo está armado el juego y la web, para no tener que volver a analizarlo. Se actualiza cada vez que cambia algo importante.

Última actualización: 9 de noviembre de 2026 (tarde).

## Repositorio y publicación

- Repo: `GeorgeElHumano/nox`. Rama de trabajo: `arte-cc0`.
- **No se publica nada sin el OK del dueño.** Publicar es hacer push a `main`: Cloudflare Pages (`wrangler.toml`, carpeta `public/`) despliega solo en 1 o 2 minutos.
- Se puede publicar **solo la web** sin tocar el juego:
  - Hacer un worktree de `origin/main`.
  - Traer `web/`, `scripts/web/`, `public/index.html` y `public/img/` desde `arte-cc0`, y nada de `public/jugar/`.
  - Hacer commit y push a `main`.
  - Después mergear `origin/main` en `arte-cc0`.
- Estado al 9/11/2026: **juego publicado** (parche 202611091336: vuelo, misiones y vegetación; antes 202611091317: avisos de admin, trajes completos y pies; antes 202611091228: nivel 200 y mapas Mbocaruzú y Salto Cristal; antes 202611091049: base sin equipo; antes 202611091008: capas del Mburuvicha, eventos, comercio y tiendas, pies al suelo; ver su sección). Antes, al 8/11: (parche 202611082009: HUD v2, arreglos del 8/11, venta múltiple, capas, empuñaduras, ranking y gestos; web con el capítulo Capturas). Antes, al 7/11: (main = `arte-cc0`, commit 30608ae, apps v1.0.7). Incluye Moñái dragón, escorpión nuevo, Mburuvicha por Energía, sonidos nuevos, portada azul, 3 mascotas, la optimización, arco y cascos corregidos, muerte en la arena e instalador de Windows.
- Apps (`.github/workflows/release.yml`): corre al cambiar `VERSION`, `desktop/**`, `android/**` o el workflow en `main`. Windows sale como `NOX-Windows.zip` y como `NOX-Instalador.exe` (Inno Setup 6, `desktop/nox.iss`: instala sin admin en `%LOCALAPPDATA%\Programs\NOX`, acceso directo en el escritorio y en Inicio, desinstalable desde Windows). El bot sube `public/version.json` a `main` al terminar: mergear `origin/main` antes del próximo push. La web apunta a `releases/latest/download/…`: no cambiar un enlace hasta que la versión ya tenga el archivo.
  - Publicar el juego: `git push origin arte-cc0:main` (Cloudflare tarda ~1 minuto). Verificar con `tools/livegame.js` (PC, iPhone 15, Pixel 7, Galaxy S9+, iPad Mini; modo sin cuenta, no toca el servidor) y `tools/presan.js` (las 10 zonas sin errores, en local).
  - En las pruebas automáticas elegir Caballero: Mburuvicha pide nivel 50 en la cuenta y Gladiador nivel 40.
- **Parches (desde el 7/11):** antes de publicar el juego correr `scripts/patch.sh "Título" "novedad 1" "novedad 2"…`. Pone la versión (AAAAMMDDHHMM, hora de Paraguay) en `NOX_BUILD` dentro de `public/jugar/index.html` y escribe `public/jugar/build.json` (`build`, `min`, `title`, `notes`). Por defecto `min = build`: el parche es obligatorio para jugar en línea (`OPCIONAL=1` deja el mínimo anterior y el aviso se puede cerrar).
  - El juego revisa `build.json` al abrir, cada 3 minutos y al volver a la pestaña (`updCheck`), y muestra `#patchBox` con las notas; "Actualizar ahora" guarda y recarga con `?v=build`. Obligatorio: corta el modo en vivo (`window.__UPDREQ`) y no se puede cerrar.
  - La API (`minBuild` en `functions/api/[[path]].js`) lee `build.json` con `env.ASSETS` y responde 426 en las rutas `game/*` (menos `game/count`) si el juego no manda `x-nox-build` o es más viejo. Las versiones de antes no mandan ese dato, así que también tienen que actualizar.
  - El servidor en vivo (`live/`, Worker `nox-live`) se despliega solo con cada push a `main` (Workers Builds de Cloudflare, se ve en las versiones del Worker). Pide versión: el juego manda `&b=NOX_BUILD` y si es menor que `min` de `build.json` (`minBuild`, caché de 60 s) cierra con 4426; el juego entonces corta el modo en vivo y llama a `updCheck`.
  - `build.json` va sin caché (`_headers`).
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
- Portada en celular vertical (lista de personajes): la cámara corre la imagen hacia arriba (`setViewOffset`, 30 % de la altura en `updCamera`) para que el personaje se vea arriba; abajo van logo de 290 px, frase de 15-18 px, cuenta y tarjetas. Sin la línea "Un MMORPG hecho en Paraguay", la descripción se oculta en pantallas de menos de 780 px y los créditos quedan en una línea que se abre al tocar. Medir con `tools/selmeasure.js` (WebKit, `ADMIN=1` simula los botones de administrador).
- Las dos usan el tema de la web: noche `#1a1d47`, oro `#e2a83f`/`#f6d892`, fuentes Cinzel, Cormorant Garamond y Alegreya Sans. El bloque CSS está antes del script de boot.

### Cámaras (7/11)

- `CAMM`: `'iso'` (la clásica, `CAM_YAW=PI/4` fijo), `'tercera'` (detrás del hombro derecho a `3.6*CAMZ`, FOV 62) y `'primera'` (desde los ojos, ver abajo). Se guarda en `localStorage noxCam`. `setCam(m)`, botón `#mbCam` (`camCycle`), tecla **B** y sección Cámara en la ficha del personaje (`camSet`).
- `CAM_YAW` ahora es variable: el joystick y el minimapa ya la usaban, así que el movimiento queda relativo a la cámara. `CAM_PITCH` se limita en `camTurn`.
- Arrastrar en la pantalla (o con el botón izquierdo del mouse) gira la cámara (`CDRAG`, ojo: `DRAG` y `LOOK` ya existen para el inventario y la luz); un toque corto sigue llamando a `tapAt` al soltar.
- `camera.far` = fin de la niebla de la zona + 6 m, y el cielo se achica para quedar adentro: con 3ra/1ra persona se ve hasta el horizonte y así no se dibuja lo que ya está tapado por la niebla. Aun así esas cámaras dibujan el doble que la clásica (Campos, celular: ~178 → ~355 llamadas).
- El área de la sombra la fija `updCamera` cada cuadro (40/30 m, ×0,65 en el celular).

- 1ra persona (7/11, noche; corregida el 8/11): sin mira; FOV gran angular (vertical que da ~120° horizontales, entre 62 y 80; `near` .18). El héroe se ve: `fpArms` achica el hueso `head` a .001 (cabeza, casco y pelo desaparecen) y suma un giro en el mundo a `upperarm`/`lowerarm` (`boneRotW`) para llevar los brazos al frente con vaivén al caminar; desde el 8/11 los brazos quedan en su pose también al atacar (`ak` empuja solo el brazo derecho), porque antes cruzaban la lente. Cámara en la posición real del hueso de la cabeza (`FPH`, x/z suavizado y máx. .45 m; alto entre +1,35 y +1,95), .3 m adelante (.42 al correr). El cuervo del Mburuvicha sigue más atrás y al costado en 1ra persona y se oculta a menos de 2,2 m de la cámara (`ravenTick`). Prueba en combate: `tools/fpcombat.js` (Mburuvicha con set, mobs encima). El cuerpo mira hacia la cámara (`fpFace`) y el ataque sin objetivo elige el enemigo más cerca del centro (`crossTarget`). Fotos: `tools/fpshot.js`.

### Mapa, carga y voz (7/11)

- Minimapa: otros jugadores en lila (`#b98cff`, los del grupo `#ecd6ff`). Tocar el minimapa abre `#bigMap` (`openBigMap`/`drawBigMap`, norte arriba, nombres de portales, PNJ y jugadores, se redibuja cada 150 ms; Esc o tocar afuera cierra).
- Pantalla de carga entre mapas: `travel` llama a `zloadShow(id)` (foto `assets/ui/zona_<id>.webp` de 1280x720, nombre, subtítulo y barra que sigue a `OAD.pend`) y la saca cuando no queda nada por bajar (mín. 1,2 s, máx. 12 s). Fotos con `tools/zoneshots.js` (`ZS=`).
- Chat de voz: `VOXA`. El micrófono pasa por un `GainNode` (`micV`, 0–5) a un `MediaStreamDestination` que es lo que se envía (`VOX.send`); las voces que llegan van por `createMediaStreamSource` → `inG` (`inV`, 0–5) → altavoz, con el `<audio>` en silencio. Sliders en el panel de grupo (`#voxMic`, `#voxIn`, `localStorage noxVoxMic/noxVoxIn`). `voxDuckTick` baja `AU.master` a 85 % en el chat de voz y a 55 % mientras alguien habla.
- Portada: el héroe nunca muestra el modelo viejo; queda oculto con `#heroLoad` ("Cargando tu personaje…") y reintenta la descarga cada 8 s (`rebuildHero` limpia `OAD.failed` en el menú).

### Ajustes, inventario y Asunción (7/11, noche)

- Ficha y ajustes separados: `renderChar` (personaje) y `renderCfg` (`#pCfg`: cuenta, gráficos, cámara, FPS, sonido), botón de engranaje `#mbCfg` (`openCfg`). El botón rápido de cámara `#mbCam` va a la izquierda del minimapa con la etiqueta `#camQ` (CLÁS/3RA/1RA).
- Inventario: `irPreview` usa `cc0Hero` (el mismo cuerpo del juego); si no bajó todavía espera con `cc0Want`. El de 0 A.D. solo si el CC0 está apagado.
- Asunción: `townR:38`. En `loadZone` la copia `Z` recibe un getter `safe` que es verdadero solo dentro de las murallas (radio 36), así que afuera hay combate, música de campo, mobs activos y AUTO. Spots en las afueras (aguara y taitetu, `ZONES.asuncion.spots`), más animales, cuervos, halcones y 2 guardias patrullando la puerta (`LIFE_POP.asuncion`). Aviso al cruzar la muralla (`P.inTown`). Ojo: `Object.assign` copia getters como valores; por eso el getter se define sobre `Z`.

- AUTO con menús abiertos: sigue peleando y `useSkill` deja usar técnicas aunque haya panel abierto (`paused`) si el AUTO está prendido.

### HUD v2 (7/11, noche; publicado el 8/11)

- Íconos de técnicas y ataques: `SKI` (paths de game-icons.net, CC BY 3.0: Lorc, Delapouite, Skoll) y `SKIC(id)` con degradé por elemento (`SKIG`, gradientes `skg_*` en un SVG oculto). Ataques `atk_<clase>`, pociones `pot_hp/pot_mp`. Créditos en `.credits`.
- `hudV2Init`: tarjeta de vida `#lifeCard` (reemplaza orbes y placa, que quedan ocultos), sol `#sunBtn` con contador `#sunN` y aviso la primera vez (`noxSunTip`), `#mmFoot` bajo el minimapa con el botón de cámara y el oro, AUTO junto a Atacar. Los botones sueltos de `.menu` quedan ocultos (siguen existiendo).
- Rueda del sol `#wheel` (`wheelToggle`, `WHEEL`): Personaje, Bolsa, Misiones, Grupo, Chat, Ajustes. Esc la abre si no hay nada abierto.
- Menús a media pantalla: CSS sobre `.panel:not(.top)` (mitad derecha; en vertical, abajo desde 42 %), `#partyBox`/`#chatBox` igual, `pItem` en la otra mitad. Pestañas comunes `#pTabs` (`tabsFor`, `PTABS`, `tabCycle`). `closeAll` y `anyPanel` incluyen `pCfg`, `pMap`, grupo, chat y rueda.
- Cámara con menú abierto: `hcTick`/`hcCamera` (`HC.on`, clase `body.half`): de frente al héroe, FOV 40, `setViewOffset` para centrarlo en la mitad libre (horizontal 25 %, vertical 22 %).
- Mapa: tocar el minimapa (o M, o View en el mando) abre `#pMap` (`openMap`, `renderMap`, `MAPV`): mapa de la zona (`drawBigMap(cv,x,sz)`) con pestañas Viajar / Spots de caza (botones `travel`/`warp` de siempre) y "Mapa del reino" (Paraguay de la web sin líneas, `PYO/PYR/PYP/PYL`). El minimapa usa la foto desde arriba `assets/ui/top_<zona>.webp` (640 px, 260 m de lado, cámara ortogonal; se rehacen con `tools/topzones.js`) en un lienzo de 520 (`minimapPhoto`; `drawMinimap` dibuja `mmBg` a 260).
- Mando táctil: aparece solo en el 36 % izquierdo y el 55 % de abajo.
- PC/Mac en 3ra y 1ra persona (`WASD()`): WASD camina, clic captura el mouse (pointer lock) y mira, clic izquierdo ataca, clic derecho = técnica 1, Q/E/R = técnicas 2-4, 1/2 pociones, Espacio AUTO, Tab siguiente enemigo, F hablar, Alt suelta el cursor. En la clásica, como antes (Q W E R, Espacio ataca). Barra de técnicas abajo al centro en PC con la tecla en cada botón (`kbLabels`).
- Mando (Gamepad API, `padTick`, `PAD`): stick izq camina (escribe en `joy`), stick der mira, RT ataca, X/Y/B/RB técnicas, LT fija y LB pasa de enemigo, cruceta ↑↓ pociones, ← voz, → AUTO, A habla/acepta, Menu rueda, View mapa, R3 cámara, L3 centra. En menús: stick/cruceta mueve el foco (`padMove`), A elige, B vuelve, LB/RB pestañas. `body.pad` esconde el joystick. Prueba: `tools/ctl.js` (mando simulado).
- Pruebas: `tools/hud2.js` (`MOB=1`, `W/H`, `CAM`, `OUT`), `tools/inv2.js` (invitación).

### Arreglos del 8/11 (publicados)

- Lagos (`Z.lake`, Campos, Ruinas y Monday): `H()` arma una cuenca propia (fondo `LAKE_Y+.1-3.4`) y funde la orilla en 14 m con piso mínimo `LAKE_Y+.28`; antes el terreno cortaba el disco de agua. Fotos del minimapa rehechas (`tools/topzones.js`, `ZS=campos,ruinas,monday`). Prueba: `tools/lake.js` (altura del terreno menos `LAKE_Y` alrededor del lago).
- Mapa (`#pMap`): filas de spots más grandes (`flex:none`, 48 px); el mapa del reino desliza (`.py` con `overflow:auto`, el SVG no se achica). Campos en `PYP` pasó a [-56.95,-25.42] para no tapar Asunción.
- Celular vertical: se quitó `.mm-wrap{order:-1}`; el minimapa queda en la esquina derecha con el sol a su izquierda, igual que acostado.
- Reloj del juego bajo el minimapa: `#mmClock` (☀/☾, `dnHour`), se actualiza en `hudV2Tick`.
- Misiones diarias: `#dayDot` (oculto) cuenta las cumplidas sin reclamar; suma al contador del sol (`#sunN`), al punto de la rueda y a la pestaña Misiones (`.tdot` en `tabsFor`).
- Menús a media pantalla: la cabecera `.card-h` con la X es `position:sticky` (el padding de arriba de la tarjeta pasó a la cabecera).
- Luz: `heroFill` (PointLight cálida, 7,5 m, sigue al héroe del lado de la cámara; .45 de día a 1,2 de noche) y `plazaL` (2 faroles en Asunción, 32 m, más fuertes de noche); la luz ambiente de Asunción sube hasta 45 % de noche (`hemiI` en `dnTick`). Las luces están siempre en escena con intensidad 0 cuando no se usan, para no recompilar shaders.
- Pantalla siempre encendida: `AWAKE` (`awakeOn/awakeOff`): Wake Lock API mientras `mode==='game'`, se pide de nuevo al volver a la pestaña y con cada toque; respaldo para iOS < 16.4: video mudo en bucle `assets/ui/despierto.mp4` (3 s, 64 px). Solo debe existir **un** `const AWAKE` (en el merge del 8/11 entró otro de la rama `arte-mitologia` y se quitó).
- Cursor de PC (9/11): guantelete de Tupã de 64 px, punta del dedo = clic (hotspot 9,9). Archivos `assets/ui/cur_tupa.png`, `cur_tupa@2x.png` y los dos `cur_tupa_click*` (cuadro 2). CSS `#noxCursor` antes de `</head>`: con `html.cur` aplica el cursor a todo menos input/textarea/select (`!important`, `-webkit-image-set` 1x/2x); con `html.cur.dn` usa el cuadro de click. JS justo antes de `pagehide`: pone `cur` solo si `(hover:hover) and (pointer:fine)` y `dn` en `pointerdown` de mouse hasta `pointerup/pointercancel/dragend/blur`. Táctil: sin cambios. Diseño en SVG (fuente fuera del repo): placas plateadas, oro, gema celeste, halo y arcos; cuadro 2 = guantelete a 90 % + destello en la gema + onda en la punta.
- Ítems en el piso (9/11): `dropAt` ya no dibuja la columna de luz (`beamGeo`, sin uso). Los ítems con rareza/calidad/gema/material raro llevan un resplandor desde el centro: dos `glowSprite` (halo `S` y núcleo `S*.4`, a y=.42) guardados en `g.userData.gl` y `d.gl`; `S` = 2.5 gema/opt, 2.8 exc, 3 épico, 3.3 antiguo, 3.6 único, 2.3 el resto. `updateDrops` los hace latir (escala y opacidad) y suelta 2 chispas cada ~0,75 s (no en gemas, que ya tienen las suyas). El aro del piso se mantiene. `__NOX.dropAt(x,z,o,quiet)` es un gancho de prueba para las fotos.
- Ganchos nuevos en `__NOX`: `H`, `LAKE_Y`, `enemies`, `AWAKE`, `openShop`, `newEquip`.

### Tienda, capas y empuñaduras (8/11, mediodía; publicado)

- Venta múltiple: en la pestaña Vender, `SHOP.sel` (Set de índices de `C.inv`) y `SHOP.cfm` (doble toque). Acciones `sellMode`, `sellPick` (`comun` = equipo normal sin +4, `todo`, `nada`), `sellCancel`, `sellMany`; avisa si hay objetos valiosos (`itemR!=='normal'` o `itemQ>=2`). Prueba: `tools/sellt.js`.
- Capa: solo el Mburuvicha (en `cc0Hero`, en el héroe de 0 A.D. y en el modelo viejo). `capeFit(r)` mide en la pose de reposo lo que hay en la espalda y cuelga la capa detrás (`c.lowBack` abre la parte de abajo). El carcaj de la arquera se arma después de la capa y va por encima.
- Peto: el caparazón del pecho incluye las clavículas (antes quedaba una franja sin cubrir entre peto y hombreras, se veía en el gladiador).
- Empuñaduras: `cc0Grip(body,side,k)` guarda el cierre en `body.userData.curl` y `cc0Recurl` lo vuelve a aplicar después de cada `skeleton.pose()` (en `cc0GripQ`, `cc0APose` y `cc0MakeBow`); antes el escudo abría la mano de la espada. `cc0Grip2` pone el arma en el promedio de las falanges cerradas (centro del puño). Pruebas: `tools/gripshot.js` (mano de cerca) y `tools/armshot.js` (cuerpo entero, 4 poses, todas las clases y sets).
- Recoger objetos: `tryPickup` revisa si hay lugar antes del sonido (antes sonaba en cada cuadro con la bolsa llena).

### Ranking y jugadores en línea (8/11, tarde; publicado)

- API `GET /api/game/ranking` (sin sesión, sin pedir versión): lee `players.chars` de todas las cuentas, ordena por `resets` y después `L`, devuelve los 50 primeros (`name, cls, L, resets, evo, staff`), en caché 60 s en el Worker de Pages (`RANK`). Se alimenta de `game/summary`, que el juego manda en cada guardado (`syncSummary`).
- Servidor en vivo `GET /live/online` (Worker `nox-live`, objeto `World`): `{n, names}` con los personajes conectados que ya mandaron su estado (`a.s`), nombres en minúscula.
- Juego: `RANK` (`list`, `on`, `n`), `onlineFetch`, `rankLoad`, `renderRank`; panel `#pRank` (en `anyPanel`, `closeAll`, `padRoot`), opción "Ranking" con ícono `crown` en `WHEEL`, `ACT.openRank`. En la portada `acctBar` agrega `.onl` ("N jugando ahora", luz verde) y el botón Ranking cuando hay servidor. Se refresca cada 30 s (portada y panel abierto). Prueba: `tools/rankt.js` (en el juego) y `tools/rankp.js` (portada), con `__NOX.rankTest(lista, nombres, n)`.

### Gestos, botones junto a la vida y FPS (8/11, noche; publicado)

- Rueda de gestos: `GESTW` (7: saludo, baile, risa, llanto, burla, celebracion, descanso), `ACT.gestWheel` (botón `#mbGest` en `#mmFoot`, tecla G). `wheelToggle(force,list)` sirve para la rueda del sol y la de gestos (`WCUR`).
- `P.gest={k,t,up,pend,done}`: `gestStart`/`gestEnd`. Moverse, atacar o una técnica lo cortan; en descanso primero se levanta (`up`, guarda la orden en `pend` y la devuelve al terminar). Solo con el cuerpo CC0 (`r.cc0`).
- Animación: en `oadHeroAnim` la rama `gestAnim` pone la animación base (`GDEF[k].base`: `Idle_Loop`/`Yes` de c_anim1/2 en `r.gclips`, `Dance_Loop`/`LayToIdle` de `assets/c_gest.json`, cargado al primer uso con `gestLoad`; armado con `tools/clipjson.js` desde Quaternius UAL1/UAL2, CC0). Después de `mixer.update` corre `gestPose`: poses propias (saludo, risa, llanto, burla) con `gAim` (apunta un hueso a su hijo en una dirección del mundo) y `gRot`, en el marco del personaje (x izquierda, y arriba, z adelante). Ojo: el hueso de la cabeza se llama `Head`.
- Mientras dura se esconden los hijos no-hueso de los huesos (armas, escudo, carcaj) en `r.gHid`; `gestOff` los devuelve. Globito `.gbub` con el ícono sobre la cabeza, textos `.gfl` que suben, lágrimas y papelitos con `parts`.
- En línea: `livePos` manda `g` y el Worker la deja pasar solo si está en `GESTOS`; los demás la reciben en `o.P.gest` y la animan con el mismo código.
- `#lcRow` = `#lifeCard` + `#lcSide` (Personaje y Bolsa, con punto rojo si hay puntos libres). En vertical de hasta 440 px la tarjeta mide 38vw (border-box), el nivel se muestra sin la clase y el sol baja a 54 px, para no encimarse (medido con `tools/hudq.js` en iPhone SE, 15 y Pro Max).
- FPS: `fpsMeter` escribe `#mmFps` ("60 FPS") dentro de `#mmClock`; el recuadro con datos técnicos (`#fpsBox`) queda solo para `?prueba=1` y la medición.
- Mapa en vertical: `.mp-b` desliza entero (mapa arriba y la lista completa abajo); antes `.mp-r` crecía y se cortaba sin scroll en iPhone.
- Pruebas: `tools/gtest.js` (rueda y los 7 gestos), `tools/gest4.js`/`onegif3.js` (GIF de muestra).

### Joyas, pilas, avisos, parches y caldero (8/11, noche; publicado)
- Destellos de luz (`flashLight`) usan un grupo fijo de 2 `PointLight` (`FLASHL`) que siempre están en escena. Agregar o quitar luces en three r128 cambia `numPointLights` y recompila todos los materiales (el cuelgue al poner joyas).
- `STACKMAX=999` para pociones y joyas; `addItem` llena pilas y después casilleros nuevos. Tienda con compra ×100.
- Pluma de evolución: 2 % por mob y 50 % por jefe, hasta tener 5.
- Gestos: solo se esconden objetos con `userData.piece==='weapon'` o `userData.gHide` (escudo, carcaj); alas y cascos quedan.
- Avisos en pantalla: `notice(html,cls)` (`#notices`, máx. 5, `big` para Admin, `cd` para los últimos 10 segundos). `evCountTick` (cada 250 ms) avisa al cruzar `EVMARK_OPEN` (5,4,3,2,1 min, 30 s, 10…1) y `EVMARK_CLOSE` (desde 2 min).
- Bienvenida Admin: el Worker, al recibir `hi` de una cuenta `role==='admin'`, manda `{t:'ann',k:'adm',n}` a todos (una vez cada 10 min por cuenta).
- Parches: `scripts/patch.sh` exige al menos una novedad y agrega la entrada a `public/jugar/patches.json` (el más nuevo primero, hasta 80). Botón «Historial de parches» en `acctBar` → panel `#pPatch` (`patchLoad`). `updShow` busca las notas en `build.json` si el aviso llega sin ellas (caso 426 de la API).
- Claves de shader: `crackGlow` y `ghostify` arman `customProgramCacheKey` con la clave anterior del material (+ color en el fantasma). Antes, materiales con grietas compartían programa con otros y la cabeza del Mbói Tata salía transparente.
- Anillo del set (`HERO.aura`): plano 14×14 en XZ; `auraFit` gira los vértices y les pone la altura del terreno (`H`) cada cuadro.
- Caldero (`renderCaldero`): resultado y el ítem elegido arriba (`.cald-sel`), después solo el equipo de la bolsa y al final las invitaciones compactas (fichas). Al elegir, el panel sube.
- Mburuvicha: 2ª y 3ª generación se llaman «Capa de Guyra Hũ Guasu» y «Capa de Ñanderuvusu».  La capa ya está hecha (ver el parche del 9/11).
- Pruebas: `tools/ntct.js` (avisos), `tools/caldt.js` (caldero), `tools/tatashot.js` (Mbói Tata), `tools/aurat.js`. Ganchos nuevos en `__NOX`: `notice`, `caldT`, `auraT`, `gemApply`, `addItemT`, `gestGo`.

### Ganchos de prueba

`window.__NOX` expone `STUDIO`, `MOBS`, `MYTH`, `GAMEDATA`, `HERO`, `DS`, `C`, `fixChar`, `recalc`, `renderChar`, `SND`, `setEq`, entre otros.

## Rendimiento (optimización del 7/11)

- Dónde se va el tiempo: casi todo son **llamadas de dibujo**, sobre todo en la pasada de sombra (se actualiza cada 2 cuadros a 60 y cada cuadro con tope 30). Medir con `tools/perf2.js` (vista + sombra por zona, espera a que termine de cargar).
- `charBake(r)`: se llama al terminar cada personaje (héroe en `rebuildHero`, otros jugadores en `liveModel`, PNJ al final de `npcLit`, mobs en `makeEnemy` y `oadUpgradeMobs`).
  - `bakeRig`: une las mallas rígidas colgadas del mismo hueso con material equivalente (`bakeSig`) y las mallas con piel que comparten esqueleto, postura de enlace y material.
  - No toca lo que el objeto `r` referencia (`bakeKeep`: alas, capa, armas en la mano, efectos de set...). Un hueso referenciado sí deja unir lo que cuelga de él. `forge`, `glowMats`, `eq`, `spec` se ignoran (solo se usan al armar).
  - Nunca une una malla que tenga hijos ni materiales que mueven vértices en espacio local (`bakeVS`: viento, alas, boca, pelaje; o `userData.vsLocal`).
  - Alas: `bakeLocal` une el armazón (huesos, nudos, anillos) en el espacio del ala. Efecto visible: las articulaciones ahora siguen la ola del ala en vez de quedar sueltas.
  - `shadowTrim`: las piezas de menos de 30 cm no proyectan sombra.
- `mergeStatic(zoneG,dyn,moved)`: dentro de `freezeStatic`, une el decorado quieto por material y por cuadrante de 24 m. `moved` sale de simular `AMB` y comparar matrices; no corre en zonas de evento. Se apaga con `window.__NOBAKE=1` (para comparar).
- `disposeTree` ahora suelta las texturas de los materiales que suelta (las `keep()` quedan) y la textura de huesos de cada esqueleto. Antes cada viaje sumaba ~100 texturas en la placa (prueba: `tools/texleak.js`).
- Cuadros por segundo: `FCAP.fps` (30 en celular, 60 en PC; `localStorage tsm-fps`). `dynRes` usa umbrales según el tope. Ajustes → "Cuadros por segundo" y "Ver FPS" (`FPSM`, también con `?fps=1`).
- Prueba en teléfonos reales: `jugar/?prueba=1` muestra "Medir rendimiento"; recorre Asunción, Campos, Chaco, Esteros y Cerro Corá (8 s cada una), da FPS, bajones y dibujos, y se copia o comparte el resultado. `BENCH.on` hace al jugador invulnerable mientras mide.
- Descargas: los modelos se bajan por zona a pedido (`oadNeed`). `oadFetch` reintenta 2 veces antes de dar un modelo por perdido (antes un corte de señal dejaba todo en modelos simples). La gente y animales del ambiente se piden después de lo principal (`oadLater`). Animaciones aligeradas sin cambios (`gt/resample.mjs`, tolerancia 1e-5).
- Mobs lejanos: `e.g.visible=!!(dl<D||boss)` con D = 62 (alto), 54 (medio), 40 (bajo). Antes daba `undefined` para los que no son jefes y three.js los dibujaba igual (solo oculta con `false`): ojo con cualquier `visible=` que no sea booleano. `mobShadow`: en medio y bajo solo hacen sombra los mobs a menos de 24 m.
- Mobs hechos con piezas (serpientes, cuadrúpedos, alacranes): `mobBake(m)` en `makeEnemy`, después de `charBake`. Une las piezas quietas de cada grupo (cabeza, mandíbula, patas, pájaros) por material en el espacio del grupo; deja aparte lo referenciado directo por `m`, `userData.solo/wing/flame/gem/piece/nobake`, sprites y mobs con `mixer` (GLB). La cresta de las serpientes es un `InstancedMesh` (`ridgeI`; `ridge` quedan como Object3D sin escena que el animador mueve y se copian a la instancia). Mboitui 42→18 mallas, Moñái 92→33; Esteros con 10 mobs encima: 413/1221 → 252/472 llamadas (`tools/swarm.js`).
- Celular (`pointer:coarse`) en alto: resolución máx. 1,5 (medio 1,3), MSAA 2 (medio 0) y mapa de sombras 1024. `dynRes` revisa cada 1,5 s y baja 0,25 si va por debajo de 18 FPS. En alto los mobs hacen sombra hasta 36 m.
- Optimización para celulares (7/11, tarde). Medido con `MOB=1 Q=medio W=926 H=428 node perf2.js` (Chromium con `isMobile`, `pointer:coarse`); llamadas promedio por cuadro: Asunción 672→~300, Esteros 239→132, Cerro Corá 153→102; triángulos de Chaco 487k→283k. Lógica de Esteros con 10 mobs: 6,5→2,4 ms (`tools/prof.js zona 0 N`, perfil de CPU por función).
  - `updSnake`: normales exactas de la elipse (antes `computeVertexNormals` por serpiente y cuadro).
  - `animEnemy`: no anima mobs ocultos (`e.g.visible` false); los GLB recuperan el tiempo perdido al volver (máx. 1 s).
  - `shadowProxy` (en `freezeStatic`): todo el decorado quieto que proyecta sombra se junta en una malla de solo posiciones por celda de 32 m y lado; las piezas originales dejan de proyectar. Las mallas fantasma están ocultas y `shadowProxyHook` las muestra solo durante la pasada de sombra (envuelve `renderer.shadowMap.render`; three.js arma la lista de la escena antes). No sirve ponerlas en otra capa: la sombra de r128 prueba la capa contra la cámara del juego. Se excluye lo transparente, con `alphaTest`, con viento (`bakeVS`) o que se mueve. Comparar: `__NOX.shpSet(false/true)`; apagar con `window.__NOSHP=1`.
  - `chunkInstances` (en `freezeStatic`): parte cada InstancedMesh de 16+ instancias en celdas de 40 m con su esfera real (geometría nueva que comparte los atributos), para que la cámara y la sombra descarten lo que no ven.
  - `charShadow(o,g,d)`: PNJ y vecinos proyectan sombra solo a menos de 16 m en el celular (24/36 en PC) y esconden ojos y cejas a más de 12 m. Ojos y cejas nunca proyectan sombra (`shadowTrim`).
  - `IS_MOB`: en el celular la sombra cubre un 65 % del área (en `updCamera`), en medio se actualiza cada 2 cuadros (`SHMOD`), el brillo (bloom) solo va en alto y a media resolución, y los mobs proyectan sombra hasta 20 m.
  - Calidad automática: si `dynRes` baja la calidad la guarda en `tsm-calidad-auto` y sigue en automático (antes quedaba fija para siempre).
- En producción Cloudflare sirve los `.json` con brotli: entrar a Asunción baja ~6 MB.
- `__NOX.bakeNow()` une todo a mano (con `__NOBAKE` puesto al cargar) y `tools/vis.js` saca fotos antes/después del mismo instante.

## Detalles de personajes (7/11)

- Arquera: el arco va en `hand_l` con `dir=[0,1,.05]`, `side=[1,0,0]` (el lomo hacia el blanco). Prueba: `tools/bowshot.js`.
- Cascos: `forgeApply` mide la línea de las cejas (mallas `Eyes`/`Eyebrows` del cuerpo CC0) y se la pasa a `forgeHelm(S,U,top,cls,brow)`. Los cascos cerrados (`cap/round/crest/full/horn/wing`) y la corona con gorro se ajustan de la coronilla a las cejas (domo cortado en el ecuador) y la cara queda a la vista. Prueba: `tools/helmshot.js` (`CLS=`, `OUT=`; todas las clases y sets 0-6, de frente y tres cuartos).
- Portada: el héroe va a `SELY=.09` (el empedrado está a .03); `updLife` esconde a los vecinos entre la cámara y el héroe en el menú. Prueba: `tools/selhero.js`.
- Arena: al perder, `duelend` deja al jugador muerto (animación de muerte) hasta volver a Asunción a los 9 s. Prueba: `tools/dueltest.js` con `__NOX.duelTest`.

- Arena (tablero): `duelTick` arma el tablero una vez por duelo (`hud._key`) y después solo cambia anchos y números, para que la barra clara de daño (`i.tr`, con retraso) se anime; `low` titila bajo 25 % y `hit` sacude al recibir. `body.induel` oculta la misión y el reloj. Compacto, arriba al centro entre la placa del jugador y el minimapa (celular acostado: `calc(100vw - 590px)`, entre 300 y 370 px).
- Grupo: `#liveInv`/`#duelInv` van al centro (24vh), grandes y con brillo; la invitación a grupo suena. `bigNote(html,bad)` muestra avisos grandes arriba al centro (entra al grupo, se une, sale, se disuelve) comparando la lista de miembros en el mensaje `party`. Prueba: `tools/duelhud.js` (usa `__NOX.duelSet` y `__NOX.liveTest`).

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
- Capítulo **IX Capturas** (8/11; Descargas pasó a X): 17 capturas del juego real de la charla Trailer (sin videos), en `web/img/w/cap/<id>.webp` (1600 px) y `<id>_t.webp` (640 px). El capítulo muestra un mosaico de 3; la ficha `data-view="capturas"` tiene la grilla `#capgrid` y el visor `#caplb` (flechas, teclado, deslizar; se mueve a `body` al cargar porque `#deep` lo encerraba). Lista `CAPS` al final de `shell_js.js`. Prueba: `tools/webcap.js`.
- Íconos (7/11, noche azul y sol dorado; fuente `/home/claude/opt/icon/icon.svg`, se renderiza con `tools/svgpng.js`): `img/nox-icon-192/256/512.png` (nombres nuevos para saltar la caché), `nox-icon-maskable-512.png` (sin esquinas, Android), `apple-touch-icon.png` (180, sin esquinas, también en la raíz), favicon SVG embebido en el juego, `jugar/manifest.webmanifest`, `android/.../mipmap-*/ic_launcher.png` y `desktop/icon.ico/png` (las apps hay que volver a armarlas con `scripts/app.sh`).
- `_headers`: `/img/*` se guarda 1 día en caché, por eso existe la huella en la dirección.

## Parche 202611091008: capas, eventos, comercio y tiendas (9/11)

- **Capa del Mburuvicha** (casillero `wings`, sin capa base): `mbCapeStyle`, `capeTex2` (ñandutí, borde trenzado, cuentas, borde dentado en 3ª gen.), `bannerTex`, `capeMesh2`, `mbCapeOn`, `capeSparkTick`; `animCape(c,t,mv,lean,fly)` mueve `subs` y `tips`. Colores por nivel: azul, rojo, negro; dorado (`0xe8b44a`) desde +9. Para pintar en canvas usar `mixHex` (lerp sRGB): `lerpHex` pasa por THREE.Color y oscurece.
- **Eventos**: `EVSCHED`, `runeRingTex`, `evAir` (brasas y humo), `bannerEvTex`. Arena de Añá: `E.total=100`, máx. 30 vivos, el piso cae a las 25/50/75 muertes, 420 s. Tuguy: altar `Z.evAltar`, muro de cierre en z=-43.6. Mobs de evento `C.L+10`.
- **Alas**: `restPose(body)` (`skeleton.pose()` + `cc0Recurl`) antes de cada `wingSocket`: el anclaje se mide en la pose base.
- **Sombreadores**: `crackGlow` y `ghostify` arman `customProgramCacheKey` desde la clave previa (antes chocaban y la cabeza del Mbói Tata salía transparente).
- **Set**: `setInfoHTML`/`setInfoToggle`, `ACT.setInfo`. **Mapa del reino**: `MAPV.pop` con tarjeta `.pyPop`, escucha en `svg.pym`. **PC**: `TIP` + `#itemTip` (`itemCard(it,ctx,true)`), `heroDropZone` para soltar y equipar.
- **Comercio y tiendas**: cliente `TR`, `MYSHOP`, `SHOPV`, `plMenu` (tocar a otro jugador en `tapAt`), paneles `#pTrade`, `#pMyShop`, `#pShopV`. Worker (`live/src/index.js`): `tradeOf/tradeState/tradeSend/tradeEnd/tradeMsg`, `shopPub/shopMsg`; mensajes treq/tacc/trej/toff/trdy/tcnf/tcommit/tok/tno/tx/tend y shop/shopv/sbuy/ssell/sok/sno/sres; límite 26000 para toff/tok/shop/sok. Se reparte por la tabla D1 `deliveries` (ítems `{raw:item}`, oro `{k:'gold',n,inv:1}`), que el cliente recoge con `srvDeliveries`. Se cancela al cambiar de zona o desconectarse.
- **Pies al suelo**: `footIK(r,dt)` al final de `oadHeroAnim` (héroe, PNJ y jugadores). IK de dos huesos (muslo, pantorrilla, pie; nombres CC0 `thigh_l/calf_l/foot_l` u OAD `thigh_L/leg_L/foot_L`), la cadera baja con `r.model.position.y += r.ikDrop`, el pie se inclina con la normal del terreno. Peso 1 quieto y en gestos, 0,5 caminando, 0 en vuelo, muerte y fuera de `mode==='game'`. `window.__NOIK=1` lo apaga para comparar. Prueba: `tools/feet.js` y `tools/feetwalk.js`.
- **Parches**: `scripts/patch.sh` escribe también `public/jugar/patches.json` (botón "Historial de parches") y exige al menos una nota.

## Parche 202611091049: base sin equipo (9/11)

- `cc0Human` (solo héroes; PNJ y mitos, `cls` que empieza con `__`, siguen vestidos como antes con `HB=false`): cada malla del atuendo de la clase (`S.outfit`, `S.legs`) se agrega solo si su casillero (`slot(n)`: Hood→helm, Pauldron/Body→armor, Legs/Belt→pants, Feet/Boots→boots, Bracer/Arms→gloves) está equipado.
- Base: pantalón de aldeano cortado al 60 % de su alto (`CC0_SHORT`, `cc0Shorts`, en caché por geometría) y, en la arquera, el `Body` de aldeana como top. `cc0Files` siempre pide `c_o_male_peasant` / `c_o_female_peasant`.
- Piel (`cc0Keep`): a `S.keep` se suman los huesos de lo que falta equipar (torso y hombros sin armadura —la arquera sin `spine`—, brazos sin guantes o armadura, muslos/pantorrillas sin pantalón, pantorrillas y pies sin botas). La clave de caché de `cc0Keep` usa la lista completa (`kp.join`), no su largo.
- Descalzo: `r.footY` (6,2 cm hombre, 4,8 cm mujer) se suma en `r.model.position.set(…)` de `oadHeroAnim`; las botas tienen suela y sin ellas los pies (con dedos, son del cuerpo CC0) quedaban bajo el piso. Compatible con `footIK` (mide contra la posición del grupo).
- Mburuvicha: sin el penacho `jeg` de base (bloque desactivado con `false&&`).
- Muestras y pruebas: `tools/gal2.js` modo `sets2` (`TSET=-1,0,6`, `VIEWS=1` agrega espalda, lado y torso).
- Pendiente aprobado en muestra pero sin publicar: correas del jubón bajo el peto, hombrera de tela con hombreras del set, ribete de la capucha (Ñandutí), pelo bajo cascos cerrados, peto hasta la cadera y faldón/pantalón con el material del set desde el set 2.

## Parche 202611091228: nivel 200, Mbocaruzú y Salto Cristal (9/11)

- `MAXL=200` (el reinicio usa `MAXL`, así que pasó a 200). `xpNeed` multiplica por .9 desde el 100: con los mobs nuevos, del 100 al 200 se tarda ~3 veces lo de 1 a 100 (cuenta: kills por nivel = `xpNeed/mobStats.xp`).
- Zonas `mbocaruzu` (lvl 100, portal desde `bahianegra` en [-40,70]) y `saltocristal` (lvl 150, portal desde `mbocaruzu`). Están en `ZORDER`, `ZTEX`, `LIFE_POP`, `MUSZ` (monday/mbaracayu), `BEDZ` (amb_waterfall), `ZLOAD_IMG`, `PYP/PYL`, `DMAP/DECZ` (plantas de modelo) y en `live/src/data.js` (MOBS, ZONES, BOSSK, a mano con el mismo formato).
- Relieve: `Z.tiers={cx,side,curve,rock,steps:[[z,alto,ancho,chorros]],jets,chan}`. `tierUp` (en `H`) sube cada escalón detrás de su borde, curvado en herradura (`tierZ`: z + curve·dx²). `addCascade` arma paredes de arenisca en capas (`strataTex`, bloques `dodeR` con `userData.rockM` de color liso), chorros con `fallTex` (paso `'c'` = usa `T.jets` en todas las capas), bruma y el cauce quieto (`tierWet`, también en minimapa y `decPoint`). `Z.lakeCol` cambia el color del pozo (`waterMat('lake_'+id)`).
- Mobs: Mbocaruzú `ypora` 104, `jaguahu` 116, `mboihovy` 128, `tejuhu` 140, jefe `yaguaretaba` 150 (yaguareté grande con jeguaka, collar y pintura de chamán; adds `jaguahu`). Salto Cristal `ypovera` 156, `yaguaruvera` 166, `mboiitavera` 178, `itajara` 190, jefe `yjara` 200 (adds `ypovera`). Todos con `MYTH`, `LOOTDEF` y misiones del Capitán. Las serpientes `head:'dragon'` aceptan `headTex` y `mouth`.
- Fotos: `assets/ui/zona_<id>.webp` y `top_<id>.webp` con `tools/zt.js` (`VIEWS='[[x,alto,z,lx,ly,lz],…]' TOP=1 node zt.js SALIDA zona ID`). Web: `ZK`, `PINS`, `LP/LBLPOS` en `web/shell_js.js` y `web/views.js`, `web/img/w/z_<id>.webp`, `scripts/web/sync.sh datos mobs:…`.
- Vegetación (arreglado en el parche siguiente): las zonas sin `DECZ` quedaban sin plantas porque `DREC.on` era true con `oadHave([])`; ahora `DREC.on=!!DECZ[id]&&…` y monday, mbaracayu, cerrocora, bahianegra e ybytyruzu tienen `DMAP/DECZ`.

## Parche de vuelo, misiones y vegetación (9/11, tarde)

- Vuelo: en `oadHeroAnim`, `fly` = tiene `r.wings` (alas o capa del Mburuvicha) y `mode` es game o select, sin pelear, morir ni gesto; ya no depende de moverse ni de `Z.safe`. Los PNJ (`r.npcP`) y los otros jugadores usan la misma función; en los PNJ la altura (`lift`) va ×0,3 y en los personajes ×0,4 (60 % más bajo, parche 202611091339).
- Mbói Tata: la cabeza usaba `mat()` (caché compartida) y cada serpiente le volvía a aplicar `crackGlow`; con varias, el sombreador duplicaba declaraciones y la cabeza no se dibujaba. Ahora `mat(...).clone()` y `crackGlow` se aplica una sola vez por material (`CG_ON`, WeakSet). Lo mismo para el arma de fuego de un mito (`tm2`). Prueba: `FOCUS=mboijagua node tools/zt.js SALIDA zona ybytyruzu`.
- Misiones: `questWarp(q)` arma el botón de viaje (acción `warp`, spot del mob o `i=-1` para el jefe, mismo costo que el viaje a un spot) en el panel del Capitán y en `NPCV==='quests'` mientras la misión no está cumplida.
- `tools/zt.js`: `HEROW=clase` (héroe nivel 200 con set 4 y alas), `QSHOT=1` (panel de Misiones), `FOCUS=mob`.

## Parches 202611091317 y 202611091350 (9/11, tarde)

- **Trajes completos**: en `cc0Armor`, el pantalón suma una cáscara (`cc0Shell`) en muslos y pelvis (`minW:.28`, para tomar también la rodilla) con el material del peto del set (`scale`/`ornate`/`metal`, o cuero). El pantalón inicial (t0 de cuero) no la lleva.
- **Pies**: `ikSoleOf(r)` mide en la pose de enlace (`bindMatrix` y `boneInverses`) la distancia del hueso del pie a la suela; `footIK` nunca deja la suela bajo `H()+.025` y puede subir la cadera (`ikDrop` hasta +.25). Prueba: `tools/feetclose.js` (`FULL=1` con set, `BASE=` para comparar con otra versión).
- **Aviso global**: chat `/sv texto` → `{t:'sv'}`; el Worker solo lo acepta si `a.role==='admin'` (1 cada 3 s) y manda `{t:'ann',k:'sv',n,m}` a todos; el juego lo muestra con `notice(...,'big sv')` (9 s) y lo deja en el chat.
- **Descripción al pasar el mouse en cualquier menú**: `cellHTML` agrega una marca oculta `.tk` (`tipK(it)`, registro `TIPREG`); el manejador de `TIP` busca la marca dentro de `.cell/.slot/.row/.ms-row`. Las filas de compra de la tienda también la llevan.
- **Bolsa al día**: `invSyncTick` (dentro de `hudV2Tick`, cada 200 ms) compara la firma de bolsa, equipo, oro y mascotas (`invSig`) y redibuja `#pInv`/`#pVault` si cambió; `afterGear` también llama a `renderInv`.
- **Ítems tirados**: el juego manda `dr` con `pd:1`; el Worker los guarda con `own`, `solo:1`, `ownMs:60000`, `life:120000` (los demás drops siguen con 20 s de prioridad y 90 s de vida). `dp` respeta `ownMs` y, si es `solo`, no deja levantarlo al grupo. En el juego, `dropOwnLbl` muestra "Tuyo/De X · m:ss" o "Libre" bajo la etiqueta y `updateDrops` lo saca al pasar `life`.
- Ganchos nuevos en `__NOX`: `npcT(id)` (abre un PNJ, por ejemplo `baul`), `invSyncT`. `tools/boot.js` acepta `BASE=`, `CH=` (canal del navegador) y usa `--disable-dev-shm-usage`. Con la bolsa abierta, el Chromium sin GPU dibuja muy lento: en las pruebas avanzar con `__NOX.step` en vez de esperar.

## Parche 202611091515: pies firmes quieto y en gestos (9/11)
- `footIK` ahora también corre en los gestos (antes `!(P.gest&&r.gOn)` lo apagaba y los pies se hundían: risa −3,4 cm, saludo −1,4; baile flotaba +5,5).
- `still` = quieto o en gesto. Cada pie con la suela a menos de 4 cm del suelo queda **clavado** (`B.pl` 1→0 entre 4 y 9 cm): se lleva a `H()+so+IK_SOLE` en las dos direcciones, y su giro se fija en el espacio de `r.g` (`B.lq`, se captura al apoyar y se suelta con `pl<.2`). Así el idle (que mecía talón y punta ±1 cm) ya no hace "bailar" el pie. Pie levantado de verdad (patada, salto) queda libre.
- Quieto, `ikDrop` y `B.o` siguen rápido (`dt*30`/`dt*40`; caminando siguen `dt*10`/`dt*12`). Constante `IK_SOLE=.025`.
- Medido: suela quieta y en todos los gestos ±2 mm (descalzo y con botas). Sonda: `zt.js` con `FEETPROBE=1 HEROEQ=clase:set GEST=risa,baile SUM=1`.

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
- `livegame.js` (juego publicado en 5 dispositivos), `presan.js` (revisión previa a publicar).
- `prof.js` (perfil de CPU por función), `tris.js` (triángulos, llamadas y quién proyecta sombra), `shshot2.js` (sombra con y sin `shadowProxy` en el mismo cuadro), `run.sh` (levanta el servidor local y corre). `boot.js` acepta `mobile:true` o `MOB=1`; `perf2.js` acepta `Q=medio`.
- `swarm.js` (Esteros en alto con 10 mobs encima: llamadas, mallas y lógica), `mobprobe.js` (mallas por tipo de mob), `snakeshot.js` (foto de serpientes), `helmprobe.js` (alturas de ojos y casco).
- `perf2.js` (rendimiento por zona), `who.js`/`casters.js`/`cast2.js` (qué dibuja y qué hace sombra), `texleak.js`, `vis.js`, `benchtest.js`.

## Pendientes conocidos

- Confirmar requisitos mínimos con los resultados de `?prueba=1` en teléfonos reales del dueño.
- Ítem "Coraza del Rey de las Serpientes": el texto dice "piel dorada" y el Moñái ahora es rojo. Falta que el dueño decida el texto nuevo.
- Nada de esto existe para el escorpión ni el Moñái en modelos 3D descargables gratis (poly.pizza da 403 desde el servidor). Por eso son procedurales.
