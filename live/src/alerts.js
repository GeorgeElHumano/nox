// NOX · avisos al administrador (notificaciones push) y conexiones por día.
// Lo usan la API (functions/api) y el servidor en vivo (live/, con una copia: scripts/noxis-sync.sh).
// Web Push estándar (RFC 8030/8291/8292) hecho con WebCrypto, sin librerías: sirve para iPhone (app agregada al inicio,
// iOS 16.4 o más), Android y PC. Las claves VAPID se crean solas la primera vez y se guardan en la base (pushkv),
// así no hace falta cargar ningún secreto en Cloudflare.

export const ALERT_TYPES = [
  { id: 'pedido', g: 'Plata', name: 'Pedido de pago nuevo' },
  { id: 'auto', g: 'Plata', name: 'Pago acreditado solo por el banco' },
  { id: 'suelto', g: 'Plata', name: 'Transferencia sin pedido (asignar a mano)' },
  { id: 'vencido', g: 'Plata', name: 'Pedido vencido sin pagar' },
  { id: 'fundador', g: 'Plata', name: 'Compra de un pack Fundador' },
  { id: 'cuenta', g: 'Jugadores', name: 'Cuenta nueva creada' },
  { id: 'record', g: 'Jugadores', name: 'Récord de conectados al mismo tiempo' },
  { id: 'nivel', g: 'Jugadores', name: 'Nivel 200 o primer reinicio' },
  { id: 'resumen', g: 'Jugadores', name: 'Resumen del día (21:00)' },
  { id: 'arandu', g: 'Problemas', name: 'Arandu sin cupo o con fallas de la IA' },
  { id: 'servidor', g: 'Problemas', name: 'Servidor caído o con muchos errores' },
  { id: 'trade', g: 'Problemas', name: 'Intercambio grande de Noxis' },
];
const TYPE_IDS = new Set(ALERT_TYPES.map(x => x.id));
export const TRADE_ALERT_NX = 5000; // desde cuántos Noxis (50.000 Gs) un intercambio avisa

export const ALERT_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS pushsub(ep TEXT PRIMARY KEY, uid TEXT NOT NULL, p256 TEXT NOT NULL, auth TEXT NOT NULL, prefs TEXT NOT NULL DEFAULT '{}', ua TEXT, t INTEGER, last INTEGER, fails INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS pushkv(k TEXT PRIMARY KEY, v TEXT, t INTEGER)`,
  `CREATE TABLE IF NOT EXISTS alertlog(id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, title TEXT, body TEXT, url TEXT, t INTEGER, sent INTEGER)`,
  `CREATE TABLE IF NOT EXISTS logins(day TEXT NOT NULL, uid TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 1, t INTEGER, PRIMARY KEY(day,uid))`,
  `CREATE TABLE IF NOT EXISTS onlinepk(day TEXT PRIMARY KEY, n INTEGER NOT NULL, t INTEGER)`,
];
let schemaOk = false;
export async function alertSchema(db) { if (schemaOk) return; await db.batch(ALERT_SCHEMA.map(q => db.prepare(q))); schemaOk = true; }

/* ---------- utilidades ---------- */
const enc = new TextEncoder();
export const pyDay = (t = Date.now()) => new Date(t - 3 * 3600e3).toISOString().slice(0, 10); // día de Paraguay (UTC-3)
export const pyDayStart = day => Date.parse(day + 'T00:00:00-03:00');
export const gsTxt = n => String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Gs';
export const nTxt = n => String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const b64u = u8 => { let s = ''; const a = new Uint8Array(u8); for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode.apply(null, a.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = s => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const cat = (...l) => { const out = new Uint8Array(l.reduce((n, x) => n + x.length, 0)); let o = 0; for (const x of l) { out.set(x, o); o += x.length; } return out; };
const hkdf = async (salt, ikm, info, bytes) => new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), bytes * 8));

/* ---------- claves VAPID (se crean una vez y quedan en la base) ---------- */
let VAPID = null;
export async function vapid(db) {
  if (VAPID) return VAPID;
  let r = await db.prepare("SELECT v FROM pushkv WHERE k='vapid'").first();
  if (!r) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey)), jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
    await db.prepare("INSERT OR IGNORE INTO pushkv(k,v,t) VALUES('vapid',?,?)").bind(JSON.stringify({ pub, jwk }), Date.now()).run();
    r = await db.prepare("SELECT v FROM pushkv WHERE k='vapid'").first(); // si otro pedido la creó al mismo tiempo, vale la suya
  }
  const v = JSON.parse(r.v);
  VAPID = { pub: v.pub, key: await crypto.subtle.importKey('jwk', v.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']), jwts: new Map() };
  return VAPID;
}
async function vapidAuth(db, endpoint) {
  const V = await vapid(db), aud = new URL(endpoint).origin, now = Math.floor(Date.now() / 1000);
  const c = V.jwts.get(aud); if (c && c.exp - now > 3600) return 'vapid t=' + c.jwt + ', k=' + V.pub;
  const exp = now + 12 * 3600;
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))), body = b64u(enc.encode(JSON.stringify({ aud, exp, sub: 'mailto:admin@noxparaguay.com' })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, V.key, enc.encode(head + '.' + body)); // WebCrypto ya da r||s (el formato de JWS)
  const jwt = head + '.' + body + '.' + b64u(sig); V.jwts.set(aud, { jwt, exp });
  return 'vapid t=' + jwt + ', k=' + V.pub;
}

/* ---------- cifrado del mensaje (RFC 8291, aes128gcm, un solo registro) ---------- */
export async function encryptPush(p256dh, authSecret, plain, _test) {
  const uaPub = unb64u(p256dh), auth = unb64u(authSecret);
  const eph = _test ? _test.eph : await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(auth, ecdh, cat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = _test ? _test.salt : crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(typeof plain === 'string' ? enc.encode(plain) : plain, new Uint8Array([2]))));
  const head = new Uint8Array(21); head.set(salt, 0); new DataView(head.buffer).setUint32(16, 4096); head[20] = asPub.length;
  return cat(head, asPub, ct);
}

async function pushOne(db, s, payload) {
  const body = await encryptPush(s.p256, s.auth, payload);
  const r = await fetch(s.ep, { method: 'POST', headers: { TTL: '86400', Urgency: 'high', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Authorization: await vapidAuth(db, s.ep) }, body });
  return r.status;
}

/* ---------- mandar un aviso ----------
   type: uno de ALERT_TYPES. opt.url: a dónde lleva al tocarlo. opt.key + opt.every (ms): no repetir el mismo aviso antes de ese tiempo.
   Nunca tira error: un aviso que falla no puede romper un pago ni el servidor. */
export async function alert(db, type, title, body, opt = {}) {
  try {
    if (!TYPE_IDS.has(type)) return 0;
    await alertSchema(db);
    if (opt.key && !(await once(db, 'a:' + opt.key, opt.every || 3600e3))) return 0;
    title = String(title || '').slice(0, 80); body = String(body || '').slice(0, 300);
    const url = String(opt.url || '/cuenta/#admin');
    const subs = ((await db.prepare('SELECT * FROM pushsub').all()).results || []).filter(s => { try { return JSON.parse(s.prefs || '{}')[type] !== false; } catch { return true; } });
    const payload = JSON.stringify({ title, body, url, tag: opt.tag || type + ':' + Date.now().toString(36), type });
    let sent = 0;
    await Promise.all(subs.map(async s => {
      let st = 0; try { st = await pushOne(db, s, payload); } catch { st = 0; }
      if (st >= 200 && st < 300) { sent++; await db.prepare('UPDATE pushsub SET last=?, fails=0 WHERE ep=?').bind(Date.now(), s.ep).run(); }
      else if (st === 404 || st === 410) await db.prepare('DELETE FROM pushsub WHERE ep=?').bind(s.ep).run(); // el dispositivo ya no la quiere
      else await db.prepare('UPDATE pushsub SET fails=fails+1 WHERE ep=?').bind(s.ep).run();
    }));
    await db.prepare('DELETE FROM pushsub WHERE fails>30').run();
    const ins = await db.prepare('INSERT INTO alertlog(type,title,body,url,t,sent) VALUES(?,?,?,?,?,?)').bind(type, title, body, url, Date.now(), sent).run();
    if (ins.meta && ins.meta.last_row_id % 50 === 0) await db.prepare('DELETE FROM alertlog WHERE id<?').bind(ins.meta.last_row_id - 300).run();
    return sent;
  } catch (e) { try { console.log('alert', type, e && e.message); } catch {} return 0; }
}
// true solo la primera vez dentro de `every` ms (una sola sentencia: dos pedidos a la vez no avisan dos veces)
export async function once(db, k, every) {
  const now = Date.now();
  const r = await db.prepare('INSERT INTO pushkv(k,v,t) VALUES(?,\'\',?) ON CONFLICT(k) DO UPDATE SET t=excluded.t WHERE pushkv.t<? RETURNING k').bind(k, now, now - every).first();
  return !!r;
}
// cuenta un hecho (p. ej. una falla) y devuelve cuántos van dentro de la ventana
export async function tally(db, k, windowMs) {
  const now = Date.now();
  const r = await db.prepare("INSERT INTO pushkv(k,v,t) VALUES(?,'1',?) ON CONFLICT(k) DO UPDATE SET v=CASE WHEN pushkv.t<? THEN '1' ELSE CAST(CAST(pushkv.v AS INTEGER)+1 AS TEXT) END, t=CASE WHEN pushkv.t<? THEN excluded.t ELSE pushkv.t END RETURNING v").bind(k, now, now - windowMs, now - windowMs).first();
  return r ? +r.v : 1;
}

/* ---------- conexiones: quién entró cada día y el máximo al mismo tiempo ---------- */
export async function loginMark(db, uid) {
  await alertSchema(db);
  await db.prepare('INSERT INTO logins(day,uid,n,t) VALUES(?,?,1,?) ON CONFLICT(day,uid) DO UPDATE SET n=n+1, t=excluded.t').bind(pyDay(), uid, Date.now()).run();
}
// guarda el pico del día; si además pasa el récord de siempre, devuelve el récord anterior
export async function peakMark(db, n) {
  await alertSchema(db); const now = Date.now();
  await db.prepare('INSERT INTO onlinepk(day,n,t) VALUES(?,?,?) ON CONFLICT(day) DO UPDATE SET n=excluded.n, t=excluded.t WHERE excluded.n>onlinepk.n').bind(pyDay(), n, now).run();
  await db.prepare("INSERT OR IGNORE INTO pushkv(k,v,t) VALUES('peak','0',0)").run();
  const prev = await db.prepare("SELECT v FROM pushkv WHERE k='peak'").first();
  const r = await db.prepare("UPDATE pushkv SET v=?, t=? WHERE k='peak' AND CAST(v AS INTEGER)<? RETURNING v").bind(String(n), now, n).first();
  return r ? +(prev ? prev.v : 0) : null;
}

/* ---------- pedidos vencidos (48 h sin pagar): los marca y avisa cada uno una sola vez ---------- */
export const ORDER_HOURS = 48;
export async function expireOrders(db) {
  const r = await db.prepare("UPDATE orders SET status='vencido',decided=? WHERE status='pendiente' AND created<? AND code LIKE 'NOX-%' RETURNING id,code,uid,total,items").bind(Date.now(), Date.now() - ORDER_HOURS * 3600e3).all();
  const rows = r.results || [];
  for (const o of rows) {
    const u = await db.prepare('SELECT name FROM users WHERE id=?').bind(o.uid).first();
    let it = ''; try { it = JSON.parse(o.items).map(i => i.name).join(', '); } catch {}
    await alert(db, 'vencido', 'Pedido vencido', `${u ? u.name : 'Un jugador'} no pagó ${o.code}${it ? ' (' + it + ')' : ''} · ${gsTxt(o.total)}`, { url: '/cuenta/#admin/orders' });
  }
  return rows.length;
}

/* ---------- resumen del día (lo manda el servidor en vivo a las 21:00 de Paraguay) ---------- */
export async function daySummary(db, day = pyDay()) {
  await alertSchema(db);
  const t0 = pyDayStart(day), t1 = t0 + 864e5, w0 = t1 - 7 * 864e5;
  const one = async (q, ...b) => (await db.prepare(q).bind(...b).first()) || {};
  const lg = await one('SELECT COUNT(*) n FROM logins WHERE day=?', day);
  const wk = await one('SELECT COUNT(DISTINCT uid) n FROM logins WHERE day>?', pyDay(w0));
  const nu = await one('SELECT COUNT(*) n FROM users WHERE created>=? AND created<?', t0, t1);
  const sold = await one("SELECT COUNT(*) n, SUM(total) s FROM orders WHERE status='pagado' AND code LIKE 'NOX-%' AND decided>=? AND decided<?", t0, t1);
  const pk = await one('SELECT n FROM onlinepk WHERE day=?', day);
  let ar = {}; try { ar = await one("SELECT n FROM guia WHERE uid='*' AND day=?", day); } catch {}
  return { day, logins: lg.n || 0, week: wk.n || 0, newUsers: nu.n || 0, sales: sold.n || 0, salesGs: sold.s || 0, peak: pk.n || 0, arandu: ar.n || 0 };
}
export const summaryText = s => `${nTxt(s.logins)} jugador${s.logins === 1 ? '' : 'es'} entraron · ${nTxt(s.newUsers)} cuenta${s.newUsers === 1 ? '' : 's'} nueva${s.newUsers === 1 ? '' : 's'} · ${nTxt(s.sales)} venta${s.sales === 1 ? '' : 's'}${s.sales ? ' por ' + gsTxt(s.salesGs) : ''} · pico de ${nTxt(s.peak)} conectado${s.peak === 1 ? '' : 's'}${s.arandu ? ' · ' + nTxt(s.arandu) + ' preguntas a Arandu' : ''} · ${nTxt(s.week)} en la semana`;
