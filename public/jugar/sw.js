/* NOX · guardado en el dispositivo.
   Guarda en el celular o la PC los archivos del juego (modelos, sonidos, texturas, three.js) para que
   la próxima vez abra sin volver a bajarlos, y para poder abrir sin conexión.
   - cache.json (lo arma scripts/swfiles.py en cada parche) trae la huella de cada archivo. Cada archivo se
     guarda como "ruta?h=huella": si la huella cambia, se baja solo ese archivo y el viejo se borra.
   - La página del juego (index.html) siempre se pide primero a la red; la copia guardada es solo para
     cuando no hay conexión. build.json, patches.json, /api y /live no pasan por acá.
   - La música y los videos se piden por partes (Range): se baja el archivo entero una vez y se sirve el pedazo. */
const SCOPE = new URL('./', self.location).pathname;
const C_FILES = 'nox-files-1', C_SHELL = 'nox-shell-1', C_FONTS = 'nox-fonts-1';
const KEEP = [C_FILES, C_SHELL, C_FONTS];
let MAN = null, manP = null;
const pulling = new Map();

const wait = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('lento')), ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });
const okMan = j => !!(j && j.f && typeof j.f === 'object');

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil((async () => {
    try { const r = await fetch(SCOPE, { credentials: 'same-origin' }); if (r.ok && r.status === 200 && r.type === 'basic') await (await caches.open(C_SHELL)).put(SCOPE, r); } catch (_) {}
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('nox-') && !KEEP.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

/* lista de archivos: de la red al abrir el juego; si no hay red, la guardada */
async function manStored() { try { const r = await (await caches.open(C_SHELL)).match(SCOPE + 'cache.json'); if (r) { const j = await r.json(); if (okMan(j)) return j; } } catch (_) {} return null; }
async function manFresh() {
  try {
    const r = await wait(fetch(SCOPE + 'cache.json', { cache: 'no-store', credentials: 'same-origin' }), 5000);
    if (r.ok) { const c = r.clone(), j = await r.json(); if (okMan(j)) { const old = MAN || await manStored(); MAN = j; await (await caches.open(C_SHELL)).put(SCOPE + 'cache.json', c); if (!old || JSON.stringify(old.f) !== JSON.stringify(j.f)) purge(j); return j; } }
  } catch (_) {}
  if (!MAN) MAN = await manStored();
  return MAN;
}
function manReady(fresh) {
  if (fresh || !manP) manP = (fresh ? manFresh() : (async () => MAN || (MAN = await manStored()) || manFresh())()).catch(() => MAN);
  const mine = manP; mine.then(v => { if (!v && manP === mine) manP = null; });
  return manP;
}
const keyOf = (p, m) => SCOPE + p + '?h=' + m.f[p][0];
/* borra lo guardado que ya no corresponde a la lista (archivo cambiado o quitado) */
async function purge(m) {
  try {
    const c = await caches.open(C_FILES);
    for (const q of await c.keys()) { const u = new URL(q.url), p = u.pathname.slice(SCOPE.length), e = m.f[p]; if (!e || u.search !== '?h=' + e[0]) await c.delete(q); }
  } catch (_) {}
}

/* baja un archivo y lo guarda. r = la respuesta (sin esperar a que termine de guardarse), saved = promesa de si quedó guardado */
function pull(key, c) {
  let done;
  const saved = new Promise(r => { done = r; });
  pulling.set(key, saved);
  const fin = v => { if (pulling.get(key) === saved) pulling.delete(key); done(v); };
  const r = fetch(key, { credentials: 'same-origin' }).then(r => {
    if (r.ok && r.status === 200 && r.type === 'basic') c.put(key, r.clone()).then(() => fin(true), () => fin(false)); else fin(false);
    return r;
  }, e => { fin(false); throw e; });
  return { r, saved };
}
/* el archivo entero desde lo guardado (bajándolo antes si hace falta) */
async function fileFull(key, c) {
  let r = await c.match(key);
  if (r) return r;
  if (pulling.has(key)) { await pulling.get(key); r = await c.match(key); if (r) return r; }
  const q = pull(key, c), net = await q.r;
  if (!net.ok) return net;
  if (await q.saved) { r = await c.match(key); if (r) return r; }
  return fetch(key, { credentials: 'same-origin' });
}
async function ranged(r, range) {
  const b = await r.blob(), n = b.size, m = /bytes=(\d*)-(\d*)/.exec(range || '');
  if (!m || (m[1] === '' && m[2] === '')) return new Response(b, { status: 200, headers: r.headers });
  let a = m[1] === '' ? Math.max(0, n - (+m[2])) : +m[1], z = m[1] === '' || m[2] === '' ? n - 1 : Math.min(+m[2], n - 1);
  if (a >= n || a > z) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + n } });
  const h = new Headers(); h.set('Content-Type', r.headers.get('Content-Type') || 'application/octet-stream');
  h.set('Content-Range', 'bytes ' + a + '-' + z + '/' + n); h.set('Content-Length', String(z - a + 1)); h.set('Accept-Ranges', 'bytes');
  return new Response(b.slice(a, z + 1, h.get('Content-Type')), { status: 206, headers: h });
}
async function file(e, p) {
  const req = e.request, m = await manReady();
  if (!m || !m.f[p]) return fetch(req);
  const key = keyOf(p, m), range = req.headers.get('range');
  let c;
  try { c = await caches.open(C_FILES); } catch (_) { return fetch(req); }
  if (range) { const r = await fileFull(key, c); return r.ok && r.status === 200 ? ranged(r, range) : r; }
  const hit = await c.match(key);
  if (hit) return hit;
  if (pulling.has(key)) { await pulling.get(key); const h2 = await c.match(key); if (h2) return h2; }
  const q = pull(key, c);
  e.waitUntil(q.saved);
  return q.r;
}

/* la página del juego: red primero; lo guardado solo sin conexión o con la red colgada */
async function shell(e) {
  const req = e.request;
  manReady(true);
  const c = await caches.open(C_SHELL), had = await c.match(SCOPE);
  try {
    const r = await (had ? wait(fetch(req), 7000) : fetch(req));
    if (r.ok && r.status === 200 && r.type === 'basic') e.waitUntil(c.put(SCOPE, r.clone()).catch(() => {}));
    if (r.status >= 500 && had) return had;
    return r;
  } catch (err) { if (had) return had; throw err; }
}

/* fuentes de Google: guardadas, para que la portada se vea igual sin conexión */
async function font(e, u) {
  const c = await caches.open(C_FONTS), hit = await c.match(u.href);
  const net = fetch(u.href, { mode: 'cors', credentials: 'omit' }).then(r => { if (r.ok) c.put(u.href, r.clone()).catch(() => {}); return r; });
  if (hit) { if (u.hostname === 'fonts.googleapis.com') e.waitUntil(net.catch(() => {})); else net.catch(() => {}); return hit; }
  return net;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) {
    if (!u.pathname.startsWith(SCOPE)) return;
    const p = u.pathname.slice(SCOPE.length);
    if (req.mode === 'navigate') { if (p === '' || p === 'index.html') e.respondWith(shell(e)); return; }
    if (p.startsWith('assets/') || p.startsWith('vendor/')) e.respondWith(file(e, p));
    return;
  }
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') e.respondWith(font(e, u));
});

/* pedidos del juego: qué falta guardar, guardar un archivo, borrar todo */
self.addEventListener('message', e => {
  const d = e.data || {}, port = e.ports && e.ports[0];
  const out = v => { try { port && port.postMessage(v); } catch (_) {} };
  e.waitUntil((async () => {
    try {
      if (d.t === 'stat') {
        const m = await manReady();
        if (!m) return out({ ok: false });
        const c = await caches.open(C_FILES), have = new Set((await c.keys()).map(q => { const u = new URL(q.url); return u.pathname + u.search; }));
        const miss = []; let hb = 0;
        for (const p in m.f) { if (have.has(keyOf(p, m))) hb += m.f[p][1]; else miss.push([p, m.f[p][1]]); }
        return out({ ok: true, miss, have: hb, total: m.bytes, n: m.n });
      }
      if (d.t === 'put') {   /* guarda una tanda de archivos; contesta cuántos bytes quedaron guardados */
        const m = await manReady(), ps = Array.isArray(d.ps) ? d.ps : [];
        if (!m) return out({ ok: false });
        const c = await caches.open(C_FILES); let bytes = 0, bad = 0;
        for (const p of ps) {
          if (!m.f[p]) continue;
          const key = keyOf(p, m); let ok = !!(await c.match(key));
          if (!ok) { try { if (pulling.has(key)) ok = await pulling.get(key); else { const q = pull(key, c), r = await q.r; ok = r.ok && await q.saved; } } catch (_) { ok = false; } }
          if (ok) bytes += m.f[p][1]; else if (++bad >= 2) break;
        }
        return out({ ok: bad < 2, bytes });
      }
      if (d.t === 'clear') { await caches.delete(C_FILES); return out({ ok: true }); }
      out({ ok: false });
    } catch (_) { out({ ok: false }); }
  })());
});
