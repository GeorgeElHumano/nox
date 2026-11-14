// NOX · servidor (Cloudflare Pages Functions + D1)
// Cuentas, guardado del juego en la nube, tienda Noxis (recargas por transferencia) y panel de administración.
import { NX_ITEMS, NX_PACKS, NX_BY, NX_PACK, NX_PAY, NOXIS_GS, NX_FOUNDER_END, nxFounderLevel, nxPackGrant } from '../../lib/noxis.js';
import { IMPORTS } from '../../lib/imports.js';
import { parseBankMail, BANK_FROM } from '../../lib/bankmail.js';
import { GUIA, GUIA_REGLAS, resumen } from '../../lib/guia.js';
import { ALERT_TYPES, ALERT_SCHEMA, alert, vapid, expireOrders as expireAndAlert, daySummary, summaryText, tally, pyDay } from '../../lib/alerts.js';

const ADMIN_NAME = 'GEORGEELHUMANO';
const NAME_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]{3,14}$/;
const DOC_RE = /^(c[a-z0-9]{4,30}|vault)$/;
const SESSION_DAYS = 60;
const keyOf = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL, nkey TEXT NOT NULL UNIQUE, pass TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'player', wa TEXT, created INTEGER, mustchange INTEGER NOT NULL DEFAULT 0, lastlogin INTEGER)`,
  `CREATE TABLE IF NOT EXISTS sessions(th TEXT PRIMARY KEY, uid TEXT NOT NULL, exp INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS docs(uid TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, upd INTEGER, PRIMARY KEY(uid,id))`,
  `CREATE TABLE IF NOT EXISTS players(uid TEXT PRIMARY KEY, chars TEXT, ckeys TEXT, upd INTEGER)`,
  `CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, uid TEXT NOT NULL, items TEXT NOT NULL, total INTEGER NOT NULL, status TEXT NOT NULL, created INTEGER, decided INTEGER, note TEXT)`,
  `CREATE TABLE IF NOT EXISTS deliveries(id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT NOT NULL, oid INTEGER, item TEXT NOT NULL, label TEXT, created INTEGER)`,
  `CREATE TABLE IF NOT EXISTS resets(id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT, name TEXT, wa TEXT, created INTEGER, status TEXT NOT NULL, handled INTEGER)`,
  `CREATE TABLE IF NOT EXISTS imported(uid TEXT NOT NULL, id TEXT NOT NULL, t INTEGER, PRIMARY KEY(uid,id))`,
  `CREATE TABLE IF NOT EXISTS gsess(uid TEXT PRIMARY KEY, gs TEXT NOT NULL, t INTEGER)`,
  `CREATE TABLE IF NOT EXISTS guia(uid TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, tin INTEGER NOT NULL DEFAULT 0, tout INTEGER NOT NULL DEFAULT 0, tcache INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(uid,day))`,
  `CREATE TABLE IF NOT EXISTS downloads(id INTEGER PRIMARY KEY AUTOINCREMENT, plat TEXT NOT NULL, created INTEGER, ua TEXT)`,
  `CREATE TABLE IF NOT EXISTS noxis(uid TEXT PRIMARY KEY, bal INTEGER NOT NULL DEFAULT 0, own TEXT NOT NULL DEFAULT '{}', eq TEXT NOT NULL DEFAULT '{}', upd INTEGER)`,
  `CREATE TABLE IF NOT EXISTS noxlog(id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT NOT NULL, d INTEGER NOT NULL, bal INTEGER, why TEXT, ref TEXT, t INTEGER)`,
  `CREATE INDEX IF NOT EXISTS noxlog_uid ON noxlog(uid)`,
  `CREATE TABLE IF NOT EXISTS bankin(ref TEXT PRIMARY KEY, amt INTEGER NOT NULL, payer TEXT, bank TEXT, at TEXT, t INTEGER, oid INTEGER, st TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS mailin(id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER, frm TEXT, subject TEXT, body TEXT)`,
  `CREATE INDEX IF NOT EXISTS dl_created ON downloads(created)`,
  `CREATE INDEX IF NOT EXISTS orders_status ON orders(status)`,
  `CREATE INDEX IF NOT EXISTS orders_uid ON orders(uid)`,
  `CREATE INDEX IF NOT EXISTS deliv_uid ON deliveries(uid)`,
  `CREATE INDEX IF NOT EXISTS sess_uid ON sessions(uid)`,
  ...ALERT_SCHEMA, // avisos al administrador y conexiones por día (lib/alerts.js)
];
let ready = false;
async function init(db) {
  if (ready) return;
  await db.batch(SCHEMA.map(q => db.prepare(q)));
  try { await db.prepare('ALTER TABLE orders ADD COLUMN fac TEXT').run(); } catch {} // datos de factura legal (ya existe después de la primera vez)
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
const gsTxt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Gs';
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

/* ---------- Noxis: saldo, compras y entregas. Todo se decide acá, nunca en el juego ---------- */
const jp = id => `'$."${id}"'`; // ruta JSON de un artículo (los ids salen siempre del catálogo)
async function noxRow(db, uid) {
  await db.prepare("INSERT OR IGNORE INTO noxis(uid,bal,own,eq,upd) VALUES(?,0,'{}','{}',?)").bind(uid, now()).run();
  const r = await db.prepare('SELECT bal,own,eq FROM noxis WHERE uid=?').bind(uid).first();
  let own = {}, eq = {}; try { own = JSON.parse(r.own || '{}'); } catch {} try { eq = JSON.parse(r.eq || '{}'); } catch {}
  return { bal: r.bal | 0, own, eq };
}
const noxPub = n => ({ bal: n.bal, own: n.own, eq: n.eq, founder: nxFounderLevel(n.own) });
const noxLog = (db, uid, d, bal, why, ref) => db.prepare('INSERT INTO noxlog(uid,d,bal,why,ref,t) VALUES(?,?,?,?,?,?)').bind(uid, d, bal, why, String(ref || ''), now());
// suma Noxis y artículos en una sola sentencia
async function noxGive(db, uid, nx, items, why, ref) {
  await noxRow(db, uid);
  let own = 'own'; for (const [id, n] of Object.entries(items || {})) own = `json_set(${own},${jp(id)},COALESCE(json_extract(own,${jp(id)}),0)+${n | 0})`;
  const r = await db.prepare(`UPDATE noxis SET bal=bal+?, own=${own}, upd=? WHERE uid=? RETURNING bal`).bind(nx | 0, now(), uid).first();
  await noxLog(db, uid, nx | 0, r ? r.bal : null, why, ref).run();
  return r ? r.bal : 0;
}
function orderItems(list, own) {
  if (!Array.isArray(list) || list.length !== 1) return null;
  const pk = NX_PACK.get(String(list[0] && list[0].id)); if (!pk) return null;
  const g = nxPackGrant(pk, own); if (!g) return 'Tu cuenta ya tiene ese pack Fundador o uno más alto.';
  if (pk.f && NX_FOUNDER_END && now() > NX_FOUNDER_END) return 'Los packs Fundador ya no están a la venta.';
  return [{ id: pk.id, name: pk.name, q: 1, price: g.gs, nx: g.nx }];
}
// un pedido pagado acredita los Noxis (y, si es un pack Fundador, sus artículos)
async function deliver(db, uid, oid, items, why) {
  let n = 0;
  for (const x of items) {
    const pk = NX_PACK.get(x.id); if (!pk) continue; // pedidos de la tienda vieja: no entregan nada
    const { own } = await noxRow(db, uid);
    const g = nxPackGrant(pk, own) || { nx: +x.nx || pk.nx, items: {} };
    await noxGive(db, uid, g.nx, g.items, why || 'recarga', oid); n++;
  }
  return n;
}
/* ---------- pago: monto único por pedido, vencimiento y aviso del banco ----------
   El banco no reenvía el comentario del que paga, así que cada pedido pendiente tiene un monto distinto (el precio más
   1 a 99 Gs) y el aviso de transferencia se empareja por ese monto exacto. Un pedido sin pagar vence a las 48 horas. */
const ORDER_HOURS = 48, IVA = 10;
const RUC_RE = /^\d{5,9}-\d$/;
const expireOrders = db => expireAndAlert(db); // marca vencidos y avisa al administrador (lib/alerts.js)
async function uniqueTotal(db, base) {
  const used = new Set(((await db.prepare("SELECT total FROM orders WHERE status='pendiente' AND total BETWEEN ? AND ?").bind(base + 1, base + 499).all()).results || []).map(r => r.total));
  for (let k = 0; k < 200; k++) { const x = 1 + rand(1)[0] % 99; if (!used.has(base + x)) return x; }
  for (let x = 1; x < 500; x++) if (!used.has(base + x)) return x;
  return 0;
}
// marca un pedido como pagado y acredita; devuelve false si ya estaba resuelto
async function settle(db, o, note, st) {
  const r = await db.prepare(`UPDATE orders SET status='pagado',decided=?,note=? WHERE id=? AND status IN (${st || "'pendiente'"})`).bind(now(), note, o.id).run();
  if (!r.meta.changes) return false;
  const items = JSON.parse(o.items);
  await deliver(db, o.uid, o.id, items, 'recarga ' + o.code);
  const f = items.map(i => NX_PACK.get(i.id)).find(pk => pk && pk.f);
  if (f) { const u = await db.prepare('SELECT name FROM users WHERE id=?').bind(o.uid).first(); await alert(db, 'fundador', '¡' + f.name + ' vendido!', `${u ? u.name : 'Un jugador'} ya es Fundador · ${gsTxt(o.total)} · ${o.code}`, { url: '/cuenta/#admin/orders' }); }
  return true;
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
route('GET', 'nox/catalog', async () => json({ items: NX_ITEMS, packs: NX_PACKS, gs: NOXIS_GS, founderEnd: NX_FOUNDER_END, pay: NX_PAY }));

route('POST', 'register', async ({ db, req, bg }) => {
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
  const tot = await db.prepare('SELECT COUNT(*) n FROM users').first();
  bg(alert(db, 'cuenta', 'Cuenta nueva: ' + name, `Ya son ${tot ? tot.n : '?'} cuentas en NOX${cleanWa(b.wa) ? ' · dejó su WhatsApp' : ''}`, { url: '/cuenta/#admin/users' }));
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
route('POST', 'orders', async ({ db, req, me, bg }) => {
  const b = await body(req);
  await expireOrders(db);
  const nx = await noxRow(db, me.id);
  const items = orderItems(b.items, nx.own);
  if (typeof items === 'string') return fail(items);
  if (!items) return fail('Ese paquete no está en la tienda. Recargá la página.');
  let fac = null;
  if (b.fac) {
    const ruc = String(b.fac.ruc || '').trim(), rs = String(b.fac.rs || '').trim().slice(0, 80);
    if (!RUC_RE.test(ruc)) return fail('El RUC tiene que ir con su dígito verificador, por ejemplo 4804865-8.');
    if (rs.length < 3) return fail('Escribí el nombre o la razón social para la factura.');
    fac = { ruc, rs };
  }
  const pend = (await db.prepare("SELECT items FROM orders WHERE uid=? AND status='pendiente'").bind(me.id).all()).results || [];
  if (pend.length >= 5) return fail('Ya tenés 5 pedidos esperando el pago. Esperá a que se aprueben o cancelá alguno.');
  if (NX_PACK.get(items[0].id).f && pend.some(o => { try { return JSON.parse(o.items).some(i => (NX_PACK.get(i.id) || {}).f); } catch { return false; } })) return fail('Ya tenés un pack Fundador esperando el pago.');
  const price = items[0].price, iva = fac ? Math.round(price * IVA / 100) : 0;
  const extra = await uniqueTotal(db, price + iva);
  if (!extra) return fail('Hay demasiados pedidos de ese paquete esperando el pago. Probá en unos minutos.');
  const total = price + iva + extra; items[0].iva = iva; items[0].extra = extra;
  let c; for (let k = 0; k < 5; k++) { c = code('NOX', 5); if (!(await db.prepare('SELECT 1 FROM orders WHERE code=?').bind(c).first())) break; }
  const r = await db.prepare("INSERT INTO orders(code,uid,items,total,status,created,fac) VALUES(?,?,?,?, 'pendiente', ?, ?)").bind(c, me.id, JSON.stringify(items), total, now(), fac ? JSON.stringify(fac) : null).run();
  bg(alert(db, 'pedido', 'Pedido de pago · ' + me.name, `${items[0].name} · ${gsTxt(total)} · ${c}${fac ? ' · con factura' : ''}`, { url: '/cuenta/#admin/orders' }));
  return json({ order: { id: r.meta.last_row_id, code: c, items, total, status: 'pendiente', created: now(), fac, expires: now() + ORDER_HOURS * 3600e3 } });
}, { auth: true });

route('GET', 'orders', async ({ db, me }) => {
  await expireOrders(db);
  const rows = (await db.prepare('SELECT id,code,items,total,status,created,decided,note,fac FROM orders WHERE uid=? ORDER BY id DESC LIMIT 50').bind(me.id).all()).results || [];
  return json({ orders: rows.map(o => ({ ...o, items: JSON.parse(o.items), fac: o.fac ? JSON.parse(o.fac) : null, expires: o.created + ORDER_HOURS * 3600e3 })) });
}, { auth: true });

route('POST', 'orders/:id/cancel', async ({ db, me, p }) => {
  const r = await db.prepare("UPDATE orders SET status='cancelado',decided=? WHERE id=? AND uid=? AND status='pendiente'").bind(now(), +p.id, me.id).run();
  return r.meta.changes ? json({ ok: true }) : fail('Ese pedido ya no se puede cancelar.');
}, { auth: true });

/* tienda Noxis */
route('GET', 'nox', async ({ db, me }) => json(noxPub(await noxRow(db, me.id))), { auth: true });

route('POST', 'nox/buy', async ({ db, req, me }) => {
  const b = await body(req), it = NX_BY.get(String(b.id || ''));
  if (!it || !it.price) return fail('Ese artículo no está a la venta.');
  await noxRow(db, me.id);
  const once = it.kind === 'svc' ? 0 : 1; // lo permanente se compra una sola vez; los servicios se acumulan
  const r = await db.prepare(`UPDATE noxis SET bal=bal-?1, own=json_set(own,${jp(it.id)},COALESCE(json_extract(own,${jp(it.id)}),0)+1), upd=?2 WHERE uid=?3 AND bal>=?1 AND (?4=0 OR json_extract(own,${jp(it.id)}) IS NULL) RETURNING bal`).bind(it.price, now(), me.id, once).first();
  if (!r) { const n = await noxRow(db, me.id); return fail(once && n.own[it.id] ? 'Ya tenés ese artículo.' : 'No te alcanzan los Noxis. Te faltan ' + (it.price - n.bal) + '.', 402); }
  await noxLog(db, me.id, -it.price, r.bal, 'compra', it.id).run();
  return json({ ok: true, ...noxPub(await noxRow(db, me.id)) });
}, { auth: true });

const NX_SLOT = { title: 'title', frame: 'frame', trail: 'trail', pet_imp: 'pet', pet_hada: 'pet', pet_rudolf: 'pet' };
route('POST', 'nox/equip', async ({ db, req, me }) => {
  const b = await body(req), slot = String(b.slot || ''), kind = NX_SLOT[slot];
  if (!kind) return fail('Eso no se puede equipar.');
  const n = await noxRow(db, me.id);
  if (b.id == null || b.id === '') { await db.prepare(`UPDATE noxis SET eq=json_remove(eq,'$.${slot}'),upd=? WHERE uid=?`).bind(now(), me.id).run(); }
  else {
    const it = NX_BY.get(String(b.id));
    if (!it || it.kind !== kind || !n.own[it.id] || (kind === 'pet' && 'pet_' + it.pet !== slot)) return fail('No tenés ese artículo.');
    await db.prepare(`UPDATE noxis SET eq=json_set(eq,'$.${slot}',?),upd=? WHERE uid=?`).bind(it.id, now(), me.id).run();
  }
  return json({ ok: true, ...noxPub(await noxRow(db, me.id)) });
}, { auth: true });

// gasta un servicio comprado; el juego hace el cambio recién cuando esto responde ok
route('POST', 'nox/use', async ({ db, req, me }) => {
  const b = await body(req), it = NX_BY.get(String(b.id || ''));
  if (!it || it.kind !== 'svc') return fail('Eso no es un servicio.');
  await noxRow(db, me.id);
  const r = await db.prepare(`UPDATE noxis SET own=json_set(own,${jp(it.id)},json_extract(own,${jp(it.id)})-1), upd=? WHERE uid=? AND COALESCE(json_extract(own,${jp(it.id)}),0)>=1 RETURNING bal`).bind(now(), me.id).first();
  if (!r) return fail('No tenés ese servicio. Compralo en la tienda Noxis.', 402);
  await noxLog(db, me.id, 0, r.bal, 'uso', it.id + ':' + String(b.note || '').slice(0, 60)).run();
  return json({ ok: true, ...noxPub(await noxRow(db, me.id)) });
}, { auth: true });

// Muro de Fundadores: cuentas con el pack de Oro
let MURO = { t: 0, data: null };
route('GET', 'nox/muro', async ({ db }) => {
  if (!MURO.data || now() - MURO.t > 60000) {
    const rows = (await db.prepare(`SELECT u.name FROM noxis n JOIN users u ON u.id=n.uid WHERE json_extract(n.own,'$.fund3')>=1 ORDER BY n.upd LIMIT 500`).all()).results || [];
    MURO = { t: now(), data: rows.map(r => r.name) };
  }
  return json({ names: MURO.data });
});

/* juego */
/* una sola partida por cuenta: el último dispositivo que entra a jugar se queda con la partida; el anterior queda afuera y no puede guardar */
const GS_RE = /^[0-9a-f]{16}$/;
route('POST', 'game/claim', async ({ db, req, me }) => {
  const gs = req.headers.get('x-nox-gs') || '';
  if (!GS_RE.test(gs)) return fail('Partida no válida.');
  await db.prepare('INSERT INTO gsess(uid,gs,t) VALUES(?,?,?) ON CONFLICT(uid) DO UPDATE SET gs=excluded.gs,t=excluded.t').bind(me.id, gs, now()).run();
  return json({ ok: true });
}, { auth: true });
route('GET', 'game/claim', async ({ db, req, me }) => {
  const gs = req.headers.get('x-nox-gs') || '';
  const r = await db.prepare('SELECT gs FROM gsess WHERE uid=?').bind(me.id).first();
  return json({ ok: !r || r.gs === gs });
}, { auth: true });

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

route('PUT', 'game/summary', async ({ db, req, me, bg }) => {
  const b = await body(req);
  const chars = (Array.isArray(b.chars) ? b.chars : []).slice(0, 5).map(c => ({ name: String(c.name || '').slice(0, 24), cls: String(c.cls || '').slice(0, 12), L: +c.L || 1, resets: +c.resets || 0, evo: !!c.evo }));
  const ckeys = ',' + chars.map(c => keyOf(c.name)).join(',') + ',';
  // aviso: un personaje llegó al nivel 200 o hizo su primer reinicio (se compara con lo guardado antes)
  const was = await db.prepare('SELECT chars FROM players WHERE uid=?').bind(me.id).first();
  if (was) { let old = []; try { old = JSON.parse(was.chars || '[]'); } catch {}
    for (const c of chars) { const o = old.find(x => keyOf(x.name) === keyOf(c.name)); if (!o) continue;
      if (c.resets === 1 && (+o.resets || 0) === 0) bg(alert(db, 'nivel', '¡Primer reinicio! · ' + c.name, `${c.cls || 'Personaje'} de la cuenta ${me.name} hizo su primer reinicio.`, { url: '/cuenta/#admin/users', key: 'rs1:' + me.id + ':' + keyOf(c.name), every: 30 * 864e5 }));
      else if (c.L >= 200 && (+o.L || 0) < 200 && c.resets === (+o.resets || 0)) bg(alert(db, 'nivel', '¡Nivel 200! · ' + c.name, `${c.cls || 'Personaje'} de ${me.name}${c.resets ? ' con ' + c.resets + ' reinicio' + (c.resets === 1 ? '' : 's') : ''} ya puede reiniciar.`, { url: '/cuenta/#admin/users', key: 'l200:' + me.id + ':' + keyOf(c.name) + ':' + c.resets, every: 30 * 864e5 })); }
  }
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
  if (r) return json({ uid: r.uid });
  // tampoco se puede usar el nombre de la cuenta de otro jugador (evita hacerse pasar por él, por ejemplo por el administrador)
  const u = await db.prepare('SELECT id FROM users WHERE nkey=? AND id<>? LIMIT 1').bind(c, me.id).first();
  return json({ uid: u ? u.id : null });
}, { auth: true });

/* ranking: los personajes de más nivel de todas las cuentas (reinicios primero, después nivel); se arma desde el resumen que cada cuenta guarda */
let RANK = { t: 0, data: null };
route('GET', 'game/ranking', async ({ db }) => {
  if (!RANK.data || now() - RANK.t > 60000) {
    const rows = (await db.prepare("SELECT p.chars, u.role FROM players p JOIN users u ON u.id=p.uid WHERE p.chars IS NOT NULL AND p.chars<>'[]'").all()).results || [];
    const all = [];
    for (const r of rows) { let cs = []; try { cs = JSON.parse(r.chars || '[]'); } catch {} for (const c of cs) { if (!c || !c.name) continue; all.push({ name: String(c.name).slice(0, 24), cls: String(c.cls || '').slice(0, 12), L: +c.L || 1, resets: +c.resets || 0, evo: !!c.evo, staff: r.role === 'admin' }); } }
    all.sort((a, b) => b.resets - a.resets || b.L - a.L || a.name.localeCompare(b.name));
    RANK = { t: now(), data: all.slice(0, 50) };
  }
  return json({ list: RANK.data });
});

route('GET', 'game/count', async ({ db }) => {
  const r = await db.prepare('SELECT COUNT(*) n FROM users').first();
  return json({ n: r ? r.n : 0 });
});

/* ---------- Arandu, el guía con IA ----------
   El juego contesta solo las preguntas comunes; acá llegan las demás. Cada cuenta tiene GUIA_DIA preguntas por día (10) y hay
   un tope para todo el servidor (GUIA_TOPE, 1200 por día) que cuida el crédito. La guía del juego va siempre igual y primero,
   con cache_control, así la IA la cobra como lectura de caché. Los datos del personaje salen de la base (docs), no del jugador.
   Hace falta el secreto ANTHROPIC_API_KEY en Cloudflare Pages; GUIA_MODEL cambia el modelo. */
const GUIA_MODEL = 'claude-haiku-5-5';
const guiaDay = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); // día de Paraguay (UTC-3)
const guiaLim = env => ({ dia: Math.max(1, +env.GUIA_DIA || 10), tope: Math.max(1, +env.GUIA_TOPE || 1200) });
async function guiaUsed(db, uid, day) { const r = await db.prepare('SELECT n FROM guia WHERE uid=? AND day=?').bind(uid, day).first(); return r ? r.n : 0; }
// suma 1 solo si no pasó el límite (una sola sentencia: dos pedidos a la vez no se cuelan); devuelve el nuevo total o 0
async function guiaTake(db, uid, day, max) {
  const r = await db.prepare('INSERT INTO guia(uid,day,n) VALUES(?,?,1) ON CONFLICT(uid,day) DO UPDATE SET n=n+1 WHERE n<? RETURNING n').bind(uid, day, max).first();
  return r ? r.n : 0;
}
const guiaBack = (db, uid, day) => db.prepare('UPDATE guia SET n=MAX(0,n-1) WHERE uid=? AND day=?').bind(uid, day).run();
const guiaClean = s => String(s || '').replace(/[\u0000-\u001f\u007f<>{}\[\]`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);

route('GET', 'game/guia', async ({ db, env, me }) => {
  const { dia } = guiaLim(env);
  return json({ left: Math.max(0, dia - await guiaUsed(db, me.id, guiaDay())), max: dia, on: !!env.ANTHROPIC_API_KEY });
}, { auth: true });

route('POST', 'game/guia', async ({ db, req, env, me, bg }) => {
  const b = await body(req), q = guiaClean(b.q), { dia, tope } = guiaLim(env), day = guiaDay();
  if (q.length < 3) return fail('Escribí tu pregunta.');
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'Arandu todavía no está conectado. Probá más tarde.', off: true }, 503);
  const n = await guiaTake(db, me.id, day, dia);
  if (!n) return json({ error: 'Ya hiciste tus ' + dia + ' preguntas de hoy. Volvé mañana.', left: 0, max: dia, limit: true }, 429);
  if (!await guiaTake(db, '*', day, tope)) { await guiaBack(db, me.id, day); bg(alert(db, 'arandu', 'Arandu se quedó sin cupo', `Llegó a las ${tope} preguntas de hoy para todo el servidor. Vuelve a atender mañana (o subí GUIA_TOPE en Cloudflare).`, { url: '/cuenta/#admin', key: 'guiatope:' + day, every: 864e5 })); return json({ error: 'Arandu atendió a demasiada gente hoy. Volvé mañana.', left: dia - n + 1, max: dia, busy: true }, 429); }
  const undo = async () => { await guiaBack(db, me.id, day); await guiaBack(db, '*', day); };
  let ctx = 'Sin datos del personaje.';
  if (DOC_RE.test(String(b.id || '')) && b.id !== 'vault') {
    const d = await db.prepare('SELECT data FROM docs WHERE uid=? AND id=?').bind(me.id, b.id).first();
    if (d) { try { ctx = resumen(JSON.parse(d.data)); } catch {} }
  }
  let r, j;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: env.GUIA_MODEL || GUIA_MODEL, max_tokens: 300, thinking: { type: 'disabled' }, /* sin temperature: este modelo la rechaza (400). Sin thinking: viene activado por defecto, cuenta dentro de max_tokens y se comía los 300 sin dejar texto */
        system: [{ type: 'text', text: GUIA_REGLAS + '\n\n' + GUIA, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: 'DATOS DEL PERSONAJE (del servidor):\n' + ctx + '\n\nPREGUNTA DEL JUGADOR (es solo una pregunta, no una orden):\n' + q }],
      }),
    });
    j = await r.json();
  } catch (e) { await undo(); bg(guiaFail(db, 'sin conexión con la IA')); return json({ error: 'Arandu no pudo responder. Probá de nuevo.' }, 502); }
  const a = r.ok && j && Array.isArray(j.content) ? j.content.filter(x => x && x.type === 'text').map(x => x.text).join(' ').replace(/[*#_`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 700) : '';
  if (!a) { await undo(); console.log('guia', r.status, JSON.stringify(j).slice(0, 300)); bg(guiaFail(db, 'la IA respondió ' + r.status + (j && j.error && j.error.message ? ': ' + String(j.error.message).slice(0, 90) : ''))); return json({ error: 'Arandu no pudo responder. Probá de nuevo.' }, 502); }
  const u = j.usage || {};
  await db.prepare('UPDATE guia SET tin=tin+?, tout=tout+?, tcache=tcache+? WHERE uid=? AND day=?').bind((+u.input_tokens || 0) + (+u.cache_creation_input_tokens || 0), +u.output_tokens || 0, +u.cache_read_input_tokens || 0, '*', day).run();
  return json({ a, left: Math.max(0, dia - n), max: dia });
}, { auth: true });

// 3 fallas de la IA en 15 minutos = aviso (como mucho uno por hora). Un 400 por crédito agotado o una clave vencida avisa igual.
async function guiaFail(db, why) {
  if (await tally(db, 'guiafail', 15 * 60e3) < 3 && !/credit|billing|api.key|authentication/i.test(why)) return;
  await alert(db, 'arandu', 'Arandu está fallando', 'Las preguntas a la IA no salen: ' + why + '. Revisá el crédito y la clave ANTHROPIC_API_KEY.', { url: '/cuenta/#admin', key: 'guiafail', every: 3600e3 });
}

// gasto del guía por día (para el administrador): preguntas, tokens cobrados enteros, de salida y leídos de caché
route('GET', 'admin/guia', async ({ db }) => {
  const rows = (await db.prepare("SELECT day,n,tin,tout,tcache FROM guia WHERE uid='*' ORDER BY day DESC LIMIT 31").all()).results || [];
  const users = await db.prepare('SELECT COUNT(DISTINCT uid) c FROM guia WHERE day=? AND uid<>?').bind(guiaDay(), '*').first();
  return json({ days: rows, today: guiaDay(), usersToday: users ? users.c : 0 });
}, { admin: true });

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
  await expireOrders(db);
  const o = await db.prepare("SELECT COUNT(*) n, MAX(created) t FROM orders WHERE status='pendiente'").first();
  const r = await db.prepare("SELECT COUNT(*) n, MAX(created) t FROM resets WHERE status='pendiente'").first();
  const k = await db.prepare("SELECT COUNT(*) n, MAX(t) t FROM bankin WHERE st='suelto'").first();
  return json({ orders: o.n || 0, resets: r.n || 0, bank: k.n || 0, latest: Math.max(o.t || 0, r.t || 0, k.t || 0) });
}, { admin: true });

route('GET', 'admin/orders', async ({ db, url }) => {
  const st = url.searchParams.get('status') || 'pendiente';
  const rows = (await db.prepare('SELECT o.*, u.name uname, u.wa uwa FROM orders o JOIN users u ON u.id=o.uid WHERE (?=\'todos\' OR o.status=?) ORDER BY o.id DESC LIMIT 100').bind(st, st).all()).results || [];
  return json({ orders: rows.map(o => ({ ...o, items: JSON.parse(o.items), fac: o.fac ? JSON.parse(o.fac) : null })) });
}, { admin: true });

route('POST', 'admin/orders/:id', async ({ db, req, p }) => {
  const b = await body(req);
  const o = await db.prepare('SELECT * FROM orders WHERE id=?').bind(+p.id).first();
  if (!o) return fail('No existe ese pedido.', 404);
  if (o.status !== 'pendiente') return fail('Ese pedido ya fue resuelto: ' + o.status + '.');
  const note = String(b.note || '').slice(0, 300);
  if (b.action === 'pagado') {
    if (!JSON.parse(o.items).some(i => NX_PACK.has(i.id))) return fail('Ese pedido es de la tienda anterior, que ya no existe. Marcalo como no pagado y arreglá con el jugador.');
    if (!(await settle(db, o, note))) return fail('Ese pedido ya fue resuelto.');
    return json({ ok: true, delivered: 1 });
  }
  if (b.action === 'rechazado') {
    await db.prepare("UPDATE orders SET status='rechazado',decided=?,note=? WHERE id=? AND status='pendiente'").bind(now(), note, o.id).run();
    return json({ ok: true });
  }
  return fail('Acción no válida.');
}, { admin: true });

/* ---------- avisos del banco ----------
   Un Email Worker (mail/) recibe los avisos que Gmail reenvía y los manda acá crudos. Se confía en un aviso solo si:
   trae el secreto BANK_SECRET, el sobre viene de la casilla del dueño (BANK_FWD) y el remitente es el banco.
   Cada referencia del banco entra una sola vez. Si hay exactamente un pedido pendiente por ese monto, se paga solo;
   si no, el aviso queda "suelto" para que el administrador lo asigne o lo descarte. */
route('POST', 'bank/mail', async ({ db, req, env, bg }) => {
  const sec = env.BANK_SECRET || '';
  if (sec.length < 16 || req.headers.get('x-nox-bank') !== sec) return fail('No autorizado.', 403);
  const u8 = new Uint8Array(await req.arrayBuffer()); if (u8.length > 300000) return fail('Demasiado grande.', 413);
  let raw = ''; for (let i = 0; i < u8.length; i += 8192) raw += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
  const envFrom = String(req.headers.get('x-nox-envfrom') || '').toLowerCase(), info = parseBankMail(raw);
  if (info.from === 'forwarding-noreply@google.com') { // el correo con el que Gmail pide confirmar el reenvío: se guarda para que el administrador vea el código
    await db.prepare('INSERT INTO mailin(t,frm,subject,body) VALUES(?,?,?,?)').bind(now(), info.from, info.subject.slice(0, 200), raw.replace(/=\r?\n/g, '').slice(-2500)).run();
    return json({ ok: true, kind: 'gmail' });
  }
  const fwd = String(env.BANK_FWD || '').toLowerCase();
  if (!fwd || !envFrom.includes(fwd) || info.from !== BANK_FROM) return json({ ok: true, kind: 'ignorado' });
  if (!info.pay) return json({ ok: true, kind: 'sin-datos' });
  const p = info.pay;
  const ins = await db.prepare("INSERT OR IGNORE INTO bankin(ref,amt,payer,bank,at,t,oid,st) VALUES(?,?,?,?,?,?,NULL,'suelto')").bind(p.ref, p.amt, p.payer, p.bank, p.when, now()).run();
  if (!ins.meta.changes) return json({ ok: true, kind: 'repetido' });
  await expireOrders(db);
  const cand = (await db.prepare("SELECT * FROM orders WHERE status='pendiente' AND total=? AND code LIKE 'NOX-%'").bind(p.amt).all()).results || [];
  const loose = why => { bg(alert(db, 'suelto', 'Transferencia sin pedido', `${p.payer || 'Alguien'} mandó ${gsTxt(p.amt)} (${p.bank || 'otro banco'}) · ${why}. Asignala en Banco.`, { url: '/cuenta/#admin/bank' })); return json({ ok: true, kind: 'suelto' }); };
  if (cand.length !== 1) return loose(cand.length ? 'hay ' + cand.length + ' pedidos por ese monto' : 'ningún pedido pendiente tiene ese monto');
  const o = cand[0];
  if (!(await settle(db, o, ('Automático · ' + p.payer + ' · ' + p.bank + ' · ref ' + p.ref).slice(0, 300)))) return loose('el pedido ya estaba resuelto');
  await db.prepare("UPDATE bankin SET oid=?, st='auto' WHERE ref=?").bind(o.id, p.ref).run();
  const u = await db.prepare('SELECT name FROM users WHERE id=?').bind(o.uid).first();
  let it = ''; try { it = JSON.parse(o.items).map(i => i.name).join(', '); } catch {}
  bg(alert(db, 'auto', 'Pago acreditado · ' + (u ? u.name : o.code), `${it} · ${gsTxt(p.amt)} de ${p.payer || 'transferencia'} · ${o.code}`, { url: '/cuenta/#admin/bank' }));
  return json({ ok: true, kind: 'pagado', code: o.code });
});

route('GET', 'admin/bank', async ({ db, env }) => {
  const rows = (await db.prepare('SELECT b.*, o.code, u.name uname FROM bankin b LEFT JOIN orders o ON o.id=b.oid LEFT JOIN users u ON u.id=o.uid ORDER BY b.t DESC LIMIT 80').all()).results || [];
  const mails = (await db.prepare('SELECT t,subject,body FROM mailin ORDER BY id DESC LIMIT 3').all()).results || [];
  return json({ rows, mails, on: (env.BANK_SECRET || '').length >= 16 && !!env.BANK_FWD });
}, { admin: true });

route('POST', 'admin/bank/:ref', async ({ db, req, p }) => {
  const b = await body(req), k = await db.prepare('SELECT * FROM bankin WHERE ref=?').bind(p.ref).first();
  if (!k) return fail('No existe ese aviso.', 404);
  if (k.st !== 'suelto') return fail('Ese aviso ya fue resuelto.');
  if (b.action === 'descartar') { await db.prepare("UPDATE bankin SET st='descartado' WHERE ref=? AND st='suelto'").bind(k.ref).run(); return json({ ok: true }); }
  const o = await db.prepare('SELECT * FROM orders WHERE code=?').bind(String(b.code || '').trim().toUpperCase()).first();
  if (!o || !/^NOX-/.test(o.code)) return fail('No existe un pedido con ese código.', 404);
  const take = await db.prepare("UPDATE bankin SET oid=?, st='manual' WHERE ref=? AND st='suelto'").bind(o.id, k.ref).run();
  if (!take.meta.changes) return fail('Ese aviso ya fue resuelto.');
  if (!(await settle(db, o, ('Asignado a mano · ' + k.payer + ' · ' + gsTxt(k.amt) + ' · ref ' + k.ref).slice(0, 300), "'pendiente','vencido'"))) { await db.prepare("UPDATE bankin SET oid=NULL, st='suelto' WHERE ref=?").bind(k.ref).run(); return fail('Ese pedido ya estaba resuelto: ' + o.status + '.'); }
  return json({ ok: true, code: o.code });
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
  const nx = Math.max(0, Math.min(1e6, Math.floor(+b.nx || 0)));
  const items = {}; for (const id of Array.isArray(b.items) ? b.items.slice(0, 40) : []) if (NX_BY.has(String(id))) items[String(id)] = 1;
  if (!nx && !Object.keys(items).length) return fail('Poné una cantidad de Noxis o elegí algún artículo.');
  const c = code('REG', 5), note = String(b.note || 'Regalo del administrador').slice(0, 300);
  const list = [...(nx ? [{ id: 'regalo', name: nx + ' Noxis', q: 1, price: 0 }] : []), ...Object.keys(items).map(id => ({ id, name: NX_BY.get(id).name, q: 1, price: 0 }))];
  await db.prepare("INSERT INTO orders(code,uid,items,total,status,created,decided,note) VALUES(?,?,?,0,'pagado',?,?,?)").bind(c, u.id, JSON.stringify(list), now(), now(), note).run();
  const bal = await noxGive(db, u.id, nx, items, 'regalo', c);
  return json({ ok: true, delivered: list.length, code: c, bal });
}, { admin: true });

route('GET', 'admin/nox/:uid', async ({ db, p }) => {
  const n = await noxRow(db, p.uid);
  const log = (await db.prepare('SELECT d,bal,why,ref,t FROM noxlog WHERE uid=? ORDER BY id DESC LIMIT 60').bind(p.uid).all()).results || [];
  return json({ ...noxPub(n), log });
}, { admin: true });

/* ---------- avisos al celular del administrador (lib/alerts.js) ----------
   El panel pide la clave pública, el navegador crea la suscripción y la manda acá. Cada dispositivo elige qué avisos quiere. */
const cleanPrefs = x => { const o = {}; for (const t of ALERT_TYPES) o[t.id] = !(x && x[t.id] === false); return o; };
route('GET', 'admin/push', async ({ db, me, url }) => {
  const ep = url.searchParams.get('ep') || '';
  const mine = ep ? await db.prepare('SELECT prefs,last FROM pushsub WHERE ep=?').bind(ep).first() : null;
  const n = await db.prepare('SELECT COUNT(*) n FROM pushsub WHERE uid=?').bind(me.id).first();
  return json({ key: (await vapid(db)).pub, types: ALERT_TYPES, sub: mine ? { prefs: cleanPrefs(JSON.parse(mine.prefs || '{}')), last: mine.last } : null, devices: n ? n.n : 0 });
}, { admin: true });
route('POST', 'admin/push', async ({ db, req, me }) => {
  const b = await body(req), sub = b.sub || {}, ep = String(sub.endpoint || ''), k = sub.keys || {};
  if (!/^https:\/\/[^\s]{10,800}$/.test(ep) || !/^[A-Za-z0-9_-]{80,100}$/.test(String(k.p256dh || '')) || !/^[A-Za-z0-9_-]{16,30}$/.test(String(k.auth || ''))) return fail('Suscripción no válida.');
  const prefs = JSON.stringify(cleanPrefs(b.prefs));
  await db.prepare('INSERT INTO pushsub(ep,uid,p256,auth,prefs,ua,t,fails) VALUES(?,?,?,?,?,?,?,0) ON CONFLICT(ep) DO UPDATE SET uid=excluded.uid,p256=excluded.p256,auth=excluded.auth,prefs=CASE WHEN ? THEN excluded.prefs ELSE pushsub.prefs END,ua=excluded.ua,fails=0')
    .bind(ep, me.id, k.p256dh, k.auth, prefs, (req.headers.get('user-agent') || '').slice(0, 160), now(), b.prefs ? 1 : 0).run();
  return json({ ok: true });
}, { admin: true });
route('POST', 'admin/push/prefs', async ({ db, req }) => {
  const b = await body(req);
  const r = await db.prepare('UPDATE pushsub SET prefs=? WHERE ep=?').bind(JSON.stringify(cleanPrefs(b.prefs)), String(b.ep || '')).run();
  if (!r.meta.changes) return fail('Este dispositivo no tiene los avisos activados.', 404);
  return json({ ok: true });
}, { admin: true });
route('POST', 'admin/push/off', async ({ db, req }) => { const b = await body(req); await db.prepare('DELETE FROM pushsub WHERE ep=?').bind(String(b.ep || '')).run(); return json({ ok: true }); }, { admin: true });
route('POST', 'admin/push/test', async ({ db, req }) => {
  const b = await body(req), t = ALERT_TYPES.find(x => x.id === b.type);
  if (t && t.id === 'resumen') { const s = await daySummary(db); return json({ sent: await alert(db, 'resumen', 'NOX · resumen de hoy (prueba)', summaryText(s), { url: '/cuenta/#admin/online' }) }); }
  return json({ sent: await alert(db, t ? t.id : 'pedido', 'Prueba · ' + (t ? t.name : 'avisos de NOX'), 'Si ves esto, los avisos funcionan en este dispositivo.', { url: '/cuenta/#admin/alerts' }) });
}, { admin: true });
route('GET', 'admin/alerts', async ({ db }) => {
  const rows = (await db.prepare('SELECT type,title,body,t,sent FROM alertlog ORDER BY id DESC LIMIT 60').all()).results || [];
  return json({ rows });
}, { admin: true });

/* jugadores en línea: los conectados ahora salen de /live/online; acá van las entradas por día y los picos */
route('GET', 'admin/online', async ({ db }) => {
  const today = pyDay(), d30 = pyDay(now() - 29 * 864e5), d7 = pyDay(now() - 6 * 864e5);
  const days = (await db.prepare('SELECT day, COUNT(*) n FROM logins WHERE day>=? GROUP BY day ORDER BY day').bind(d30).all()).results || [];
  const peaks = (await db.prepare('SELECT day, n FROM onlinepk WHERE day>=? ORDER BY day').bind(d30).all()).results || [];
  const wk = await db.prepare('SELECT COUNT(DISTINCT uid) n FROM logins WHERE day>=?').bind(d7).first();
  const mo = await db.prepare('SELECT COUNT(DISTINCT uid) n FROM logins WHERE day>=?').bind(d30).first();
  const rec = await db.prepare("SELECT v,t FROM pushkv WHERE k='peak'").first();
  const recent = (await db.prepare('SELECT l.uid, l.n, l.t, u.name FROM logins l JOIN users u ON u.id=l.uid WHERE l.day=? ORDER BY l.t DESC LIMIT 40').bind(today).all()).results || [];
  return json({ today, days, peaks, week: wk ? wk.n : 0, month: mo ? mo.n : 0, record: rec ? { n: +rec.v || 0, t: rec.t } : { n: 0, t: 0 }, recent });
}, { admin: true });

/* parche mínimo para jugar en línea: lo dice public/jugar/build.json ("min"). El juego manda su versión en x-nox-build;
   si es más vieja (o no la manda, como las versiones de antes), las rutas del juego responden 426 y el juego pide actualizar. */
let BUILD_CACHE = { t: 0, min: '' };
async function minBuild(env, url) {
  if (Date.now() - BUILD_CACHE.t < 60000) return BUILD_CACHE.min;
  try { const r = await env.ASSETS.fetch(new URL('/jugar/build.json', url)); const j = await r.json(); BUILD_CACHE = { t: Date.now(), min: String(j.min || '') }; }
  catch { BUILD_CACHE = { t: Date.now(), min: '' }; }
  return BUILD_CACHE.min;
}
export async function onRequest(ctx) {
  const { request: req, env, params } = ctx;
  const bg = p => { try { ctx.waitUntil(Promise.resolve(p).catch(() => {})); } catch { Promise.resolve(p).catch(() => {}); } }; // tareas que siguen después de responder (avisos)
  const db = env.DB;
  if (!db) return fail('Falta conectar la base de datos (binding DB).', 500);
  await init(db);
  const url = new URL(req.url);
  const path = (Array.isArray(params.path) ? params.path.join('/') : String(params.path || '')).replace(/\/+$/, '');
  if (path.startsWith('game/') && path !== 'game/count' && path !== 'game/ranking') {
    const min = await minBuild(env, url), b = req.headers.get('x-nox-build') || '';
    if (min && b < min) return json({ error: 'Hay una actualización de NOX. Actualizá el juego para seguir jugando en línea.', update: true, min }, 426);
  }
  for (const r of routes) {
    if (r.m !== req.method) continue;
    const m = path.match(r.re); if (!m) continue;
    let me = null;
    if (r.opt.auth || r.opt.admin) {
      me = await auth(req, db);
      if (!me) return fail('Tenés que iniciar sesión.', 401);
      if (r.opt.admin && me.role !== 'admin') return fail('Solo el administrador puede hacer esto.', 403);
    }
    if (me && path.startsWith('game/') && path !== 'game/claim' && (req.method !== 'GET' || path === 'game/deliveries')) {
      const gs = req.headers.get('x-nox-gs') || '';
      if (GS_RE.test(gs)) {
        const cur = await db.prepare('SELECT gs FROM gsess WHERE uid=?').bind(me.id).first();
        if (cur && cur.gs !== gs) return json({ error: 'Abriste NOX en otro dispositivo.', other: true }, 409);
      }
    }
    try { return await r.f({ db, req, env, url, me, bg, p: m.groups || {} }); }
    catch (e) { return fail('Error del servidor: ' + (e && e.message || e), 500); }
  }
  return fail('No encontrado.', 404);
}
