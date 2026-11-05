// NOX · servidor (Cloudflare Pages Functions + D1)
// Cuentas, guardado del juego en la nube, tienda por transferencia y panel de administración.
import { CATALOG } from '../../lib/catalog.js';
import { IMPORTS } from '../../lib/imports.js';

const ADMIN_NAME = 'GEORGEELHUMANO';
const NAME_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]{3,14}$/;
const DOC_RE = /^(c[a-z0-9]{4,30}|vault)$/;
const SESSION_DAYS = 60;
const keyOf = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const CAT = new Map(CATALOG.map(i => [i.id, i]));

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL, nkey TEXT NOT NULL UNIQUE, pass TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'player', wa TEXT, created INTEGER, mustchange INTEGER NOT NULL DEFAULT 0, lastlogin INTEGER)`,
  `CREATE TABLE IF NOT EXISTS sessions(th TEXT PRIMARY KEY, uid TEXT NOT NULL, exp INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS docs(uid TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, upd INTEGER, PRIMARY KEY(uid,id))`,
  `CREATE TABLE IF NOT EXISTS players(uid TEXT PRIMARY KEY, chars TEXT, ckeys TEXT, upd INTEGER)`,
  `CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, uid TEXT NOT NULL, items TEXT NOT NULL, total INTEGER NOT NULL, status TEXT NOT NULL, created INTEGER, decided INTEGER, note TEXT)`,
  `CREATE TABLE IF NOT EXISTS deliveries(id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT NOT NULL, oid INTEGER, item TEXT NOT NULL, label TEXT, created INTEGER)`,
  `CREATE TABLE IF NOT EXISTS resets(id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT, name TEXT, wa TEXT, created INTEGER, status TEXT NOT NULL, handled INTEGER)`,
  `CREATE TABLE IF NOT EXISTS imported(uid TEXT NOT NULL, id TEXT NOT NULL, t INTEGER, PRIMARY KEY(uid,id))`,
  `CREATE TABLE IF NOT EXISTS downloads(id INTEGER PRIMARY KEY AUTOINCREMENT, plat TEXT NOT NULL, created INTEGER, ua TEXT)`,
  `CREATE INDEX IF NOT EXISTS dl_created ON downloads(created)`,
  `CREATE INDEX IF NOT EXISTS orders_status ON orders(status)`,
  `CREATE INDEX IF NOT EXISTS orders_uid ON orders(uid)`,
  `CREATE INDEX IF NOT EXISTS deliv_uid ON deliveries(uid)`,
  `CREATE INDEX IF NOT EXISTS sess_uid ON sessions(uid)`,
];
let ready = false;
async function init(db) {
  if (ready) return;
  await db.batch(SCHEMA.map(q => db.prepare(q)));
  ready = true;
}

/* ---------- utilidades ---------- */
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const fail = (msg, status = 400) => json({ error: msg }, status);
const now = () => Date.now();
const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const rand = n => crypto.getRandomValues(new Uint8Array(n));
const hex = u => [...u].map(b => b.toString(16).padStart(2, '0')).join('');
async function sha256(s) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))); }
async function hashPass(pw, saltB64) {
  const salt = saltB64 ? unb64(saltB64) : rand(16);
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return 'pbkdf2$' + b64(salt) + '$' + b64(bits);
}
async function checkPass(pw, stored) {
  const [, salt] = String(stored).split('$');
  if (!salt) return false;
  const h = await hashPass(pw, salt);
  if (h.length !== stored.length) return false;
  let d = 0; for (let i = 0; i < h.length; i++) d |= h.charCodeAt(i) ^ stored.charCodeAt(i);
  return d === 0;
}
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = (pre, n) => pre + '-' + [...rand(n)].map(b => CODE_ABC[b % CODE_ABC.length]).join('');
function tempPassword() { return [...rand(8)].map(b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join(''); }
const cleanWa = s => String(s || '').replace(/[^\d+]/g, '').slice(0, 20);
async function body(req) { try { return await req.json(); } catch { return {}; } }

async function newSession(db, uid) {
  const tok = hex(rand(32));
  await db.prepare('INSERT INTO sessions(th,uid,exp) VALUES(?,?,?)').bind(await sha256(tok), uid, now() + SESSION_DAYS * 864e5).run();
  return tok;
}
async function auth(req, db) {
  const h = req.headers.get('authorization') || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!/^[0-9a-f]{64}$/.test(tok)) return null;
  const row = await db.prepare('SELECT u.id,u.name,u.role,u.wa,u.mustchange,s.exp FROM sessions s JOIN users u ON u.id=s.uid WHERE s.th=?').bind(await sha256(tok)).first();
  if (!row || row.exp < now()) return null;
  return row;
}
const pub = u => ({ id: u.id, name: u.name, role: u.role, wa: u.wa || '', mustchange: !!u.mustchange });

function orderItems(list) {
  if (!Array.isArray(list) || !list.length || list.length > 60) return null;
  const out = [];
  for (const x of list) {
    const it = CAT.get(String(x && x.id));
    const q = Math.floor(+(x && x.q) || 1);
    if (!it || q < 1 || q > 20) return null;
    out.push({ id: it.id, name: it.name, q, price: it.price });
  }
  return out;
}
async function deliver(db, uid, oid, items) {
  const st = [];
  for (const x of items) {
    const it = CAT.get(x.id); if (!it) continue;
    for (let k = 0; k < x.q; k++) for (const g of it.give) st.push(db.prepare('INSERT INTO deliveries(uid,oid,item,label,created) VALUES(?,?,?,?,?)').bind(uid, oid, JSON.stringify(g), it.name, now()));
  }
  if (st.length) await db.batch(st);
  return st.length;
}
async function pendingDeliveries(db, uid) {
  const v = await db.prepare("SELECT data FROM docs WHERE uid=? AND id='vault'").bind(uid).first();
  let upto = 0;
  try { upto = +(JSON.parse(v ? v.data : '{}').gotUpTo) || 0; } catch {}
  const rows = (await db.prepare('SELECT id,item,label FROM deliveries WHERE uid=? AND id>? ORDER BY id LIMIT 200').bind(uid, upto).all()).results || [];
  return rows.map(r => ({ id: r.id, item: JSON.parse(r.item), label: r.label }));
}

/* ---------- rutas ---------- */
const routes = [];
const route = (m, p, f, opt = {}) => routes.push({ m, re: new RegExp('^' + p.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), f, opt });

route('GET', 'ping', async () => json({ ok: true, t: now() }));
route('GET', 'catalog', async () => json({ items: CATALOG }));

route('POST', 'register', async ({ db, req }) => {
  const b = await body(req);
  const name = String(b.name || '').trim(), pw = String(b.password || '');
  if (!NAME_RE.test(name)) return fail('El usuario tiene que tener de 3 a 14 letras o números, sin espacios.');
  if (pw.length < 6 || pw.length > 72) return fail('La contraseña tiene que tener al menos 6 caracteres.');
  const nkey = keyOf(name);
  if (await db.prepare('SELECT 1 FROM users WHERE nkey=?').bind(nkey).first()) return fail('Ese usuario ya existe. Probá con otro.', 409);
  let role = 'player';
  if (nkey === keyOf(ADMIN_NAME)) {
    const adm = await db.prepare("SELECT 1 FROM users WHERE role='admin'").first();
    if (adm) return fail('Ese usuario está reservado.', 409);
    role = 'admin';
  }
  const id = 'u' + hex(rand(8));
  await db.prepare('INSERT INTO users(id,name,nkey,pass,role,wa,created,lastlogin) VALUES(?,?,?,?,?,?,?,?)').bind(id, name, nkey, await hashPass(pw), role, cleanWa(b.wa), now(), now()).run();
  const token = await newSession(db, id);
  return json({ token, user: { id, name, role, wa: cleanWa(b.wa), mustchange: false } });
});

route('POST', 'login', async ({ db, req }) => {
  const b = await body(req);
  const u = await db.prepare('SELECT * FROM users WHERE nkey=?').bind(keyOf(String(b.name || '').trim())).first();
  if (!u || !(await checkPass(String(b.password || ''), u.pass))) return fail('Usuario o contraseña incorrectos.', 401);
  await db.prepare('UPDATE users SET lastlogin=? WHERE id=?').bind(now(), u.id).run();
  await db.prepare('DELETE FROM sessions WHERE exp<?').bind(now()).run();
  return json({ token: await newSession(db, u.id), user: pub(u) });
});

route('POST', 'logout', async ({ db, req }) => {
  const h = (req.headers.get('authorization') || '').slice(7).trim();
  if (h) await db.prepare('DELETE FROM sessions WHERE th=?').bind(await sha256(h)).run();
  return json({ ok: true });
}, { auth: true });

route('GET', 'me', async ({ db, me }) => {
  const p = await db.prepare('SELECT chars FROM players WHERE uid=?').bind(me.id).first();
  const pend = (await pendingDeliveries(db, me.id)).length;
  return json({ user: pub(me), chars: p ? JSON.parse(p.chars || '[]') : [], pendingItems: pend });
}, { auth: true });

route('POST', 'me', async ({ db, req, me }) => {
  const b = await body(req);
  if (b.wa !== undefined) await db.prepare('UPDATE users SET wa=? WHERE id=?').bind(cleanWa(b.wa), me.id).run();
  return json({ ok: true });
}, { auth: true });

route('POST', 'password', async ({ db, req, me }) => {
  const b = await body(req);
  const u = await db.prepare('SELECT pass FROM users WHERE id=?').bind(me.id).first();
  if (!me.mustchange && !(await checkPass(String(b.old || ''), u.pass))) return fail('La contraseña actual no es correcta.', 401);
  const pw = String(b.password || '');
  if (pw.length < 6 || pw.length > 72) return fail('La contraseña nueva tiene que tener al menos 6 caracteres.');
  await db.prepare('UPDATE users SET pass=?,mustchange=0 WHERE id=?').bind(await hashPass(pw), me.id).run();
  return json({ ok: true });
}, { auth: true });

route('POST', 'reset-request', async ({ db, req }) => {
  const b = await body(req);
  const name = String(b.name || '').trim(), wa = cleanWa(b.wa);
  if (!NAME_RE.test(name)) return fail('Escribí tu usuario de NOX.');
  if (wa.replace(/\D/g, '').length < 8) return fail('Escribí un número de WhatsApp para que te contactemos.');
  const u = await db.prepare('SELECT id,name FROM users WHERE nkey=?').bind(keyOf(name)).first();
  const open = await db.prepare("SELECT COUNT(*) n FROM resets WHERE name=? AND status='pendiente'").bind(keyOf(name)).first();
  if ((open && open.n) >= 2) return json({ ok: true });
  await db.prepare("INSERT INTO resets(uid,name,wa,created,status) VALUES(?,?,?,?, 'pendiente')").bind(u ? u.id : null, keyOf(name), wa, now()).run();
  return json({ ok: true });
});

/* tienda */
route('POST', 'orders', async ({ db, req, me }) => {
  const b = await body(req);
  const items = orderItems(b.items);
  if (!items) return fail('El carrito tiene algo que no está en la tienda. Recargá la página.');
  const total = items.reduce((s, x) => s + x.price * x.q, 0);
  const open = await db.prepare("SELECT COUNT(*) n FROM orders WHERE uid=? AND status='pendiente'").bind(me.id).first();
  if (open && open.n >= 5) return fail('Ya tenés 5 pedidos esperando el pago. Esperá a que se aprueben o cancelá alguno.');
  let c; for (let k = 0; k < 5; k++) { c = code('NOX', 5); if (!(await db.prepare('SELECT 1 FROM orders WHERE code=?').bind(c).first())) break; }
  const r = await db.prepare("INSERT INTO orders(code,uid,items,total,status,created) VALUES(?,?,?,?, 'pendiente', ?)").bind(c, me.id, JSON.stringify(items), total, now()).run();
  return json({ order: { id: r.meta.last_row_id, code: c, items, total, status: 'pendiente', created: now() } });
}, { auth: true });

route('GET', 'orders', async ({ db, me }) => {
  const rows = (await db.prepare('SELECT id,code,items,total,status,created,decided,note FROM orders WHERE uid=? ORDER BY id DESC LIMIT 50').bind(me.id).all()).results || [];
  return json({ orders: rows.map(o => ({ ...o, items: JSON.parse(o.items) })) });
}, { auth: true });

route('POST', 'orders/:id/cancel', async ({ db, me, p }) => {
  const r = await db.prepare("UPDATE orders SET status='cancelado',decided=? WHERE id=? AND uid=? AND status='pendiente'").bind(now(), +p.id, me.id).run();
  return r.meta.changes ? json({ ok: true }) : fail('Ese pedido ya no se puede cancelar.');
}, { auth: true });

/* juego */
route('GET', 'game/docs', async ({ db, me }) => {
  // personajes traídos de la versión anterior: se agregan una sola vez
  for (const im of IMPORTS) {
    if (im.account !== keyOf(me.name)) continue;
    const r = await db.prepare('INSERT OR IGNORE INTO imported(uid,id,t) VALUES(?,?,?)').bind(me.id, im.id, now()).run();
    if (r.meta.changes) await db.prepare('INSERT OR IGNORE INTO docs(uid,id,data,upd) VALUES(?,?,?,?)').bind(me.id, im.id, JSON.stringify(im.data), now()).run();
  }
  const rows = (await db.prepare('SELECT id,data FROM docs WHERE uid=?').bind(me.id).all()).results || [];
  return json({ docs: rows.map(r => ({ id: r.id, data: JSON.parse(r.data) })) });
}, { auth: true });

route('PUT', 'game/docs/:id', async ({ db, req, me, p }) => {
  if (!DOC_RE.test(p.id)) return fail('Documento no válido.');
  const txt = await req.text();
  if (txt.length > 400000) return fail('Demasiado grande.', 413);
  let data; try { data = JSON.parse(txt); } catch { return fail('Datos no válidos.'); }
  let out = txt;
  if (p.id === 'vault') {
    // nunca retroceder el contador de entregas: evita recibir dos veces una compra
    const old = await db.prepare("SELECT data FROM docs WHERE uid=? AND id='vault'").bind(me.id).first();
    let prev = 0; try { prev = +(JSON.parse(old ? old.data : '{}').gotUpTo) || 0; } catch {}
    if ((+data.gotUpTo || 0) < prev) { data.gotUpTo = prev; out = JSON.stringify(data); }
  }
  if (p.id !== 'vault') {
    const n = await db.prepare("SELECT COUNT(*) n FROM docs WHERE uid=? AND id<>'vault' AND id<>?").bind(me.id, p.id).first();
    if (n && n.n >= 5) return fail('La cuenta ya tiene 5 personajes.');
  }
  await db.prepare('INSERT INTO docs(uid,id,data,upd) VALUES(?,?,?,?) ON CONFLICT(uid,id) DO UPDATE SET data=excluded.data,upd=excluded.upd').bind(me.id, p.id, out, now()).run();
  return json({ ok: true });
}, { auth: true });

route('DELETE', 'game/docs/:id', async ({ db, me, p }) => {
  if (!DOC_RE.test(p.id) || p.id === 'vault') return fail('Documento no válido.');
  await db.prepare('DELETE FROM docs WHERE uid=? AND id=?').bind(me.id, p.id).run();
  return json({ ok: true });
}, { auth: true });

route('PUT', 'game/summary', async ({ db, req, me }) => {
  const b = await body(req);
  const chars = (Array.isArray(b.chars) ? b.chars : []).slice(0, 5).map(c => ({ name: String(c.name || '').slice(0, 24), cls: String(c.cls || '').slice(0, 12), L: +c.L || 1, resets: +c.resets || 0, evo: !!c.evo }));
  const ckeys = ',' + chars.map(c => keyOf(c.name)).join(',') + ',';
  await db.prepare('INSERT INTO players(uid,chars,ckeys,upd) VALUES(?,?,?,?) ON CONFLICT(uid) DO UPDATE SET chars=excluded.chars,ckeys=excluded.ckeys,upd=excluded.upd').bind(me.id, JSON.stringify(chars), ckeys, now()).run();
  return json({ ok: true });
}, { auth: true });

route('GET', 'game/summary', async ({ db, me }) => {
  const p = await db.prepare('SELECT chars FROM players WHERE uid=?').bind(me.id).first();
  const chars = p ? JSON.parse(p.chars || '[]') : [];
  return json({ data: { account: me.name, accountKey: keyOf(me.name), chars, charKeys: chars.map(c => keyOf(c.name)) } });
}, { auth: true });

route('GET', 'game/taken', async ({ db, url, me }) => {
  const c = keyOf(url.searchParams.get('c') || '');
  if (!c) return json({ uid: null });
  const r = await db.prepare('SELECT uid FROM players WHERE ckeys LIKE ? AND uid<>? LIMIT 1').bind('%,' + c.replace(/[%_,]/g, '') + ',%', me.id).first();
  return json({ uid: r ? r.uid : null });
}, { auth: true });

route('GET', 'game/count', async ({ db }) => {
  const r = await db.prepare('SELECT COUNT(*) n FROM users').first();
  return json({ n: r ? r.n : 0 });
});

route('GET', 'game/deliveries', async ({ db, me }) => json({ items: await pendingDeliveries(db, me.id) }), { auth: true });

/* descargas: cada clic en un botón de descarga o de jugar se anota acá */
const PLATS = new Set(['android', 'windows', 'mac', 'macIntel', 'ios', 'web']);
route('POST', 'dl/:plat', async ({ db, req, p }) => {
  if (!PLATS.has(p.plat)) return fail('Plataforma desconocida.');
  const ua = (req.headers.get('user-agent') || '').slice(0, 160);
  await db.prepare('INSERT INTO downloads(plat,created,ua) VALUES(?,?,?)').bind(p.plat, now(), ua).run();
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
});

/* administración */
let GH = { t: 0, data: null };
async function githubCounts() {
  if (GH.data && now() - GH.t < 10 * 60 * 1000) return GH.data;
  try {
    const r = await fetch('https://api.github.com/repos/GeorgeElHumano/nox/releases?per_page=30', { headers: { 'user-agent': 'noxparaguay-admin', accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error('github ' + r.status);
    const rel = await r.json(); const by = {}; let total = 0;
    for (const x of rel) for (const a of (x.assets || [])) { by[a.name] = (by[a.name] || 0) + (a.download_count || 0); total += a.download_count || 0; }
    GH = { t: now(), data: { total, by, releases: rel.length, latest: rel[0] ? rel[0].tag_name : null } };
  } catch (e) { GH = { t: now(), data: { total: 0, by: {}, releases: 0, latest: null, error: String(e && e.message || e) } }; }
  return GH.data;
}
route('GET', 'admin/stats', async ({ db }) => {
  const d7 = now() - 7 * 864e5, d30 = now() - 30 * 864e5;
  const u = await db.prepare('SELECT COUNT(*) total, SUM(lastlogin>=?) a7, SUM(lastlogin>=?) a30, SUM(created>=?) n7, SUM(created>=?) n30 FROM users').bind(d7, d30, d7, d30).first();
  const pl = await db.prepare("SELECT COUNT(*) n FROM players WHERE chars IS NOT NULL AND chars<>'' AND chars<>'[]'").first();
  const dl = await db.prepare('SELECT COUNT(*) total, SUM(created>=?) d7, SUM(created>=?) d30 FROM downloads').bind(d7, d30).first();
  const byp = (await db.prepare('SELECT plat, COUNT(*) n FROM downloads GROUP BY plat').all()).results || [];
  const days = (await db.prepare('SELECT (created/86400000) d, COUNT(*) n FROM downloads WHERE created>=? GROUP BY d ORDER BY d').bind(d30).all()).results || [];
  const udays = (await db.prepare('SELECT (created/86400000) d, COUNT(*) n FROM users WHERE created>=? GROUP BY d ORDER BY d').bind(d30).all()).results || [];
  const byPlat = {}; for (const r of byp) byPlat[r.plat] = r.n;
  return json({ users: { total: u.total || 0, active7: u.a7 || 0, active30: u.a30 || 0, new7: u.n7 || 0, new30: u.n30 || 0, withChars: pl.n || 0 },
    downloads: { total: dl.total || 0, d7: dl.d7 || 0, d30: dl.d30 || 0, byPlat, days, udays }, github: await githubCounts(), t: now() });
}, { admin: true });
route('GET', 'admin/pending', async ({ db }) => {
  const o = await db.prepare("SELECT COUNT(*) n, MAX(created) t FROM orders WHERE status='pendiente'").first();
  const r = await db.prepare("SELECT COUNT(*) n, MAX(created) t FROM resets WHERE status='pendiente'").first();
  return json({ orders: o.n || 0, resets: r.n || 0, latest: Math.max(o.t || 0, r.t || 0) });
}, { admin: true });

route('GET', 'admin/orders', async ({ db, url }) => {
  const st = url.searchParams.get('status') || 'pendiente';
  const rows = (await db.prepare('SELECT o.*, u.name uname, u.wa uwa FROM orders o JOIN users u ON u.id=o.uid WHERE (?=\'todos\' OR o.status=?) ORDER BY o.id DESC LIMIT 100').bind(st, st).all()).results || [];
  return json({ orders: rows.map(o => ({ ...o, items: JSON.parse(o.items) })) });
}, { admin: true });

route('POST', 'admin/orders/:id', async ({ db, req, p }) => {
  const b = await body(req);
  const o = await db.prepare('SELECT * FROM orders WHERE id=?').bind(+p.id).first();
  if (!o) return fail('No existe ese pedido.', 404);
  if (o.status !== 'pendiente') return fail('Ese pedido ya fue resuelto: ' + o.status + '.');
  const note = String(b.note || '').slice(0, 300);
  if (b.action === 'pagado') {
    const r = await db.prepare("UPDATE orders SET status='pagado',decided=?,note=? WHERE id=? AND status='pendiente'").bind(now(), note, o.id).run();
    if (!r.meta.changes) return fail('Ese pedido ya fue resuelto.');
    const n = await deliver(db, o.uid, o.id, JSON.parse(o.items));
    return json({ ok: true, delivered: n });
  }
  if (b.action === 'rechazado') {
    await db.prepare("UPDATE orders SET status='rechazado',decided=?,note=? WHERE id=? AND status='pendiente'").bind(now(), note, o.id).run();
    return json({ ok: true });
  }
  return fail('Acción no válida.');
}, { admin: true });

route('GET', 'admin/resets', async ({ db }) => {
  const rows = (await db.prepare("SELECT r.*, u.name uname FROM resets r LEFT JOIN users u ON u.id=r.uid WHERE r.status='pendiente' ORDER BY r.id DESC LIMIT 100").all()).results || [];
  return json({ resets: rows });
}, { admin: true });

route('POST', 'admin/resets/:id', async ({ db, req, p }) => {
  const b = await body(req);
  const r = await db.prepare('SELECT * FROM resets WHERE id=?').bind(+p.id).first();
  if (!r || r.status !== 'pendiente') return fail('Esa solicitud ya fue atendida.');
  if (b.action === 'descartar') {
    await db.prepare("UPDATE resets SET status='descartado',handled=? WHERE id=?").bind(now(), r.id).run();
    return json({ ok: true });
  }
  if (!r.uid) return fail('Ese usuario no existe. Descartá la solicitud.');
  const pw = tempPassword();
  await db.batch([
    db.prepare('UPDATE users SET pass=?,mustchange=1 WHERE id=?').bind(await hashPass(pw), r.uid),
    db.prepare('DELETE FROM sessions WHERE uid=?').bind(r.uid),
    db.prepare("UPDATE resets SET status='hecho',handled=? WHERE id=?").bind(now(), r.id),
  ]);
  const u = await db.prepare('SELECT name FROM users WHERE id=?').bind(r.uid).first();
  return json({ ok: true, name: u.name, temp: pw, wa: r.wa });
}, { admin: true });

route('GET', 'admin/users', async ({ db, url }) => {
  const q = keyOf(url.searchParams.get('q') || '').replace(/[%_]/g, '');
  const rows = (await db.prepare("SELECT u.id,u.name,u.role,u.wa,u.created,u.lastlogin,p.chars FROM users u LEFT JOIN players p ON p.uid=u.id WHERE u.nkey LIKE ? ORDER BY u.lastlogin DESC LIMIT 40").bind('%' + q + '%').all()).results || [];
  return json({ users: rows.map(u => ({ ...u, chars: JSON.parse(u.chars || '[]') })) });
}, { admin: true });

route('POST', 'admin/users/:id/password', async ({ db, p }) => {
  const u = await db.prepare('SELECT id,name,wa FROM users WHERE id=?').bind(p.id).first();
  if (!u) return fail('No existe ese usuario.', 404);
  const pw = tempPassword();
  await db.batch([
    db.prepare('UPDATE users SET pass=?,mustchange=1 WHERE id=?').bind(await hashPass(pw), u.id),
    db.prepare('DELETE FROM sessions WHERE uid=?').bind(u.id),
  ]);
  return json({ ok: true, name: u.name, temp: pw, wa: u.wa });
}, { admin: true });

route('POST', 'admin/give', async ({ db, req }) => {
  const b = await body(req);
  const u = await db.prepare('SELECT id,name FROM users WHERE id=?').bind(String(b.uid || '')).first();
  if (!u) return fail('No existe ese usuario.', 404);
  const items = orderItems(b.items);
  if (!items) return fail('Elegí al menos un ítem de la tienda.');
  const c = code('REG', 5);
  const r = await db.prepare("INSERT INTO orders(code,uid,items,total,status,created,decided,note) VALUES(?,?,?,0,'pagado',?,?,?)").bind(c, u.id, JSON.stringify(items.map(x => ({ ...x, price: 0 }))), now(), now(), String(b.note || 'Regalo del administrador').slice(0, 300)).run();
  const n = await deliver(db, u.id, r.meta.last_row_id, items);
  return json({ ok: true, delivered: n, code: c });
}, { admin: true });

export async function onRequest(ctx) {
  const { request: req, env, params } = ctx;
  const db = env.DB;
  if (!db) return fail('Falta conectar la base de datos (binding DB).', 500);
  await init(db);
  const url = new URL(req.url);
  const path = (Array.isArray(params.path) ? params.path.join('/') : String(params.path || '')).replace(/\/+$/, '');
  for (const r of routes) {
    if (r.m !== req.method) continue;
    const m = path.match(r.re); if (!m) continue;
    let me = null;
    if (r.opt.auth || r.opt.admin) {
      me = await auth(req, db);
      if (!me) return fail('Tenés que iniciar sesión.', 401);
      if (r.opt.admin && me.role !== 'admin') return fail('Solo el administrador puede hacer esto.', 403);
    }
    try { return await r.f({ db, req, env, url, me, p: m.groups || {} }); }
    catch (e) { return fail('Error del servidor: ' + (e && e.message || e), 500); }
  }
  return fail('No encontrado.', 404);
}
