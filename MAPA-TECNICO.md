# NOX · Mapa técnico

Cómo está armado el juego y la web, para no tener que volver a analizarlo. Se actualiza cada vez que cambia algo importante.

Última actualización: 7 de noviembre de 2026.

## Repositorio y publicación

- Repo: `GeorgeElHumano/nox`. Rama de trabajo: `arte-cc0`.
- **No se publica nada sin el OK del dueño.** Publicar es hacer push a `main`: Cloudflare Pages (`wrangler.toml`, carpeta `public/`) despliega solo en 1 o 2 minutos.
- Se puede publicar **solo la web** sin tocar el juego:
  - Hacer un worktree de `origin/main`.
  - Traer `web/`, `scripts/web/`, `public/index.html` y `public/img/` desde `arte-cc0`, y nada de `public/jugar/`.
  - Hacer commit y push a `main`.
  - Después mergear `origin/main` en `arte-cc0`.
- Estado al 7/11/2026: **juego y web publicados** (main = `arte-cc0`, commit 30608ae, apps v1.0.7). Incluye Moñái dragón, escorpión nuevo, Mburuvicha por Energía, sonidos nuevos, portada azul, 3 mascotas, la optimización, arco y cascos corregidos, muerte en la arena e instalador de Windows.
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

- 1ra persona (7/11, noche): sin mira; FOV gran angular (vertical que da ~120° horizontales, entre 62 y 80; `near` .06). El héroe se ve: `fpArms` achica el hueso `head` a .001 (cabeza, casco y pelo desaparecen) y suma un giro en el mundo a `upperarm`/`lowerarm` (`boneRotW`) para llevar los brazos al frente con vaivén al caminar; al atacar baja a 30 % y manda la animación. Cámara en el hueso de la cabeza, más adelante y arriba al correr. El cuerpo mira hacia la cámara (`fpFace`) y el ataque sin objetivo elige el enemigo más cerca del centro (`crossTarget`). Fotos: `tools/fpshot.js`.

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
- Íconos (7/11, noche azul y sol dorado; fuente `/home/claude/opt/icon/icon.svg`, se renderiza con `tools/svgpng.js`): `img/nox-icon-192/256/512.png` (nombres nuevos para saltar la caché), `nox-icon-maskable-512.png` (sin esquinas, Android), `apple-touch-icon.png` (180, sin esquinas, también en la raíz), favicon SVG embebido en el juego, `jugar/manifest.webmanifest`, `android/.../mipmap-*/ic_launcher.png` y `desktop/icon.ico/png` (las apps hay que volver a armarlas con `scripts/app.sh`).
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
- `livegame.js` (juego publicado en 5 dispositivos), `presan.js` (revisión previa a publicar).
- `prof.js` (perfil de CPU por función), `tris.js` (triángulos, llamadas y quién proyecta sombra), `shshot2.js` (sombra con y sin `shadowProxy` en el mismo cuadro), `run.sh` (levanta el servidor local y corre). `boot.js` acepta `mobile:true` o `MOB=1`; `perf2.js` acepta `Q=medio`.
- `swarm.js` (Esteros en alto con 10 mobs encima: llamadas, mallas y lógica), `mobprobe.js` (mallas por tipo de mob), `snakeshot.js` (foto de serpientes), `helmprobe.js` (alturas de ojos y casco).
- `perf2.js` (rendimiento por zona), `who.js`/`casters.js`/`cast2.js` (qué dibuja y qué hace sombra), `texleak.js`, `vis.js`, `benchtest.js`.

## Pendientes conocidos

- Confirmar requisitos mínimos con los resultados de `?prueba=1` en teléfonos reales del dueño.
- Ítem "Coraza del Rey de las Serpientes": el texto dice "piel dorada" y el Moñái ahora es rojo. Falta que el dueño decida el texto nuevo.
- Nada de esto existe para el escorpión ni el Moñái en modelos 3D descargables gratis (poly.pizza da 403 desde el servidor). Por eso son procedurales.
