// NOX · servidor en vivo (Cloudflare Worker + Durable Object con WebSockets)
// Un solo "mundo" reparte: posiciones de los jugadores de cada mapa, chat (general, mapa, grupo),
// grupos de hasta 5 y la señalización WebRTC del chat de voz del grupo.

import { Sim, RAID_KEY } from './sim.js';
import { ZONES } from './data.js';

const enc = new TextEncoder();
const hex = u => [...u].map(b => b.toString(16).padStart(2, '0')).join('');
async function sha256(s) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))); }
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const PARTY_MAX = 5;

let MIN = { v: '', t: 0 };
async function minBuild() {
  if (Date.now() - MIN.t < 60000) return MIN.v;
  try { const r = await fetch('https://noxparaguay.com/jugar/build.json', { cf: { cacheTtl: 30 } }); if (r.ok) { const j = await r.json(); MIN = { v: String(j.min || ''), t: Date.now() }; } } catch {}
  MIN.t = Date.now(); return MIN.v;
}

const GESTOS = ['saludo', 'baile', 'risa', 'llanto', 'burla', 'celebracion', 'descanso'];

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/live/ping') return new Response('ok');
    // quiénes están jugando ahora (para el ranking y la portada): solo nombres de personajes, sin datos de cuenta
    if (url.pathname === '/live/online') return env.WORLD.get(env.WORLD.idFromName('reino')).fetch(new Request(req.url));
    if (url.pathname !== '/live/ws') return new Response('No encontrado', { status: 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Se espera WebSocket', { status: 426 });
    // versión mínima: la de /jugar/build.json (la escribe scripts/patch.sh); un juego viejo recibe el código 4426 y muestra el aviso de actualización
    const min = await minBuild();
    if (min && !((url.searchParams.get('b') || '') >= min)) {
      const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
      server.accept(); server.close(4426, 'Hay una actualización de NOX');
      return new Response(null, { status: 101, webSocket: client });
    }
    const tok = url.searchParams.get('t') || '';
    if (!/^[0-9a-f]{64}$/.test(tok)) return new Response('Sin sesión', { status: 401 });
    const row = await env.DB.prepare('SELECT u.id,u.name,u.role,s.exp FROM sessions s JOIN users u ON u.id=s.uid WHERE s.th=?').bind(await sha256(tok)).first();
    if (!row || row.exp < Date.now()) return new Response('Sesión vencida', { status: 401 });
    const id = env.WORLD.idFromName('reino');
    const h = new Headers(req.headers);
    h.set('x-uid', row.id); h.set('x-acc', row.name); h.set('x-role', row.role);
    // una sola partida por cuenta: si este dispositivo ya no es el dueño de la partida, no entra (y no echa al que sí lo es)
    const gs = url.searchParams.get('g') || '';
    if (/^[0-9a-f]{16}$/.test(gs)) {
      let cur = null; try { cur = await env.DB.prepare('SELECT gs FROM gsess WHERE uid=?').bind(row.id).first(); } catch {}
      if (cur && cur.gs !== gs) { const pair = new WebSocketPair(); const [c, sv] = Object.values(pair); sv.accept(); sv.close(4000, 'Abriste el juego en otro lugar'); return new Response(null, { status: 101, webSocket: c }); }
    }
    return env.WORLD.get(id).fetch(new Request(req.url, { headers: h }));
  }
};

export class World {
  constructor(state, env) {
    this.state = state; this.env = env;
    // los grupos viven en los datos de cada conexión (pid, líder, voz): así sobreviven si el objeto se duerme
    this.invites = new Map();   // uid invitado -> {pid, from, t}
    this.sims = new Map(); this.loop = null;
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }

  async fetch(req) {
    if (new URL(req.url).pathname === '/live/online') {
      const pl = this.all().filter(x => x.a.s);
      const names = [...new Set(pl.map(x => String(x.a.s.n || '').toLowerCase()).filter(Boolean))];
      return new Response(JSON.stringify({ n: pl.length, names }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.accept(server, req.headers.get('x-uid'), req.headers.get('x-acc'), req.headers.get('x-role'));
    return new Response(null, { status: 101, webSocket: client });
  }

  accept(server, uid, acc, role) {
    // un jugador, una conexión: la anterior se cierra
    let pid = null, pl = null;
    for (const ws of this.state.getWebSockets()) { const a = this.att(ws); if (a && a.uid === uid) { pid = a.pid || pid; pl = a.pl || pl; a.pid = null; this.save(ws, a); try { ws.close(4000, 'Abriste el juego en otro lugar'); } catch {} } }
    this.state.acceptWebSocket(server);
    // si se reconecta, conserva su grupo
    server.serializeAttachment({ uid, acc, role, sid: crypto.randomUUID().slice(0, 8), zone: null, s: null, p: null, pid, pl, vc: false });
  }

  att(ws) { try { return ws.deserializeAttachment(); } catch { return null; } }
  save(ws, a) { try { ws.serializeAttachment(a); } catch {} }
  send(ws, o) { try { ws.send(typeof o === 'string' ? o : JSON.stringify(o)); } catch {} }
  all() { return this.state.getWebSockets().filter(ws => ws.readyState === 1).map(ws => ({ ws, a: this.att(ws) })).filter(x => x.a); }
  byUid(uid) { return this.all().find(x => x.a.uid === uid); }
  byName(name) { const k = String(name).toLowerCase(); return this.all().find(x => (x.a.s && String(x.a.s.n).toLowerCase() === k) || String(x.a.acc).toLowerCase() === k); }
  inZone(zone, except) { return this.all().filter(x => x.a.zone && x.a.zone === zone && x.ws !== except); }
  pub(a) { return { id: a.uid, s: a.s, p: a.p, sh: a.shop ? { title: a.shop.title, n: a.shop.items.length } : null }; }
  simZone(zone) { if (!zone) return false; if (zone.startsWith(RAID_KEY)) return this.sims.has(zone); const z = ZONES[zone]; return !!z && !z.safe && !z.event; }
  ensureSim(zone) { if (!this.simZone(zone)) return null; let sim = this.sims.get(zone); if (!sim) { sim = new Sim(zone); this.sims.set(zone, sim); } this.startLoop(); return sim; }
  startLoop() { if (this.loop) return; this.lastStep = Date.now(); this.loop = setInterval(() => { try { this.stepAll(); } catch (e) {} }, 100); }
  stepAll() {
    const now = Date.now(), dt = Math.min(.3, (now - this.lastStep) / 1000); this.lastStep = now;
    for (const [key, sim] of this.sims) {
      const pl = this.inZone(key).filter(x => x.a.s);
      if (!pl.length) { sim.empty = (sim.empty || 0) + dt; if (sim.empty > (key.startsWith(RAID_KEY) ? 8 : 45)) this.sims.delete(key); continue; }
      sim.empty = 0;
      const players = pl.map(x => ({ uid: x.a.uid, p: x.a.p }));
      sim.step(dt, players, (uid, o) => { const x = pl.find(y => y.a.uid === uid); if (x) this.send(x.ws, o); });
      if (sim.out.length) { for (const o of sim.out) { const s = JSON.stringify(o); for (const x of pl) this.send(x.ws, s); if (o.t === 'mk' && o.raid) { const w = JSON.stringify({ t: 'raidwin' }); for (const x of pl) this.send(x.ws, w); } } sim.out = []; }
      sim.snapT = (sim.snapT || 0) - dt; sim.keyT = (sim.keyT || 0) - dt;
      if (sim.snapT <= 0) { sim.snapT = .15; const key3 = sim.keyT <= 0; if (key3) sim.keyT = 3; const l = [];
        for (const mo of sim.mobs) { const e = sim.entry(mo), k = e.join(','); if (key3 || k !== mo._ns) { mo._ns = k; l.push(e); } }
        if (l.length || key3) { const s = JSON.stringify({ t: 'ms', k: key3 ? 1 : 0, l, key }); for (const x of pl) this.send(x.ws, s); } }
    }
    if (!this.sims.size) { clearInterval(this.loop); this.loop = null; }
  }
  // ---- objetos en el piso compartidos por mapa: el que lo hizo caer tiene prioridad unos segundos ----
  zoneDrops(zone, make) {
    this.drops = this.drops || new Map(); let dz = this.drops.get(zone);
    if (dz) { const now = Date.now(), gone = []; for (const [id, d] of dz) if (now - d.ts > (d.life || 90000)) { dz.delete(id); gone.push(id); }
      if (gone.length) { const out = JSON.stringify({ t: 'dg', key: zone, ids: gone, by: null }); for (const x of this.inZone(zone)) this.send(x.ws, out); }
      if (!dz.size && !make) { this.drops.delete(zone); return null; } }
    if (!dz && make) { dz = new Map(); this.drops.set(zone, dz); }
    return dz;
  }
  dropMsg(ws, a, m) {
    if (!a.zone || !a.s) return;
    if (m.t === 'dr') {
      const l = Array.isArray(m.l) ? m.l.slice(0, 24) : []; if (!l.length) return;
      const now = Date.now(); a.drN = (now - (a.drT || 0) > 10000) ? 0 : (a.drN || 0); a.drT = now; if ((a.drN += l.length) > 120) return; // freno anti abuso
      const dz = this.zoneDrops(a.zone, true); if (dz.size > 400) return;
      const out = [];
      for (const d of l) { if (!d || typeof d !== 'object' || !d.o || JSON.stringify(d.o).length > 1500) continue;
        const o = d.o.gold != null ? { gold: Math.max(0, Math.min(5e8, Math.round(+d.o.gold || 0))) } : d.o.item && typeof d.o.item === 'object' ? { item: d.o.item } : null; if (!o) continue;
        const id = (++this.dropN || (this.dropN = 1)) + '' + Math.floor(Math.random() * 1e3);
        /* tirado a mano por un jugador (pd): queda 2 minutos en el piso; el primer minuto solo lo puede levantar quien lo tiró, después cualquiera */
        const e = d.pd ? { id, x: +d.x || 0, z: +d.z || 0, o, own: a.uid, ownN: a.s.n, pid: null, ts: now, solo: 1, ownMs: 60000, life: 120000 }
          : { id, x: +d.x || 0, z: +d.z || 0, o, own: d.free ? null : a.uid, ownN: a.s.n, pid: a.pid || null, ts: now };
        dz.set(id, e); out.push(e); }
      if (!out.length) return;
      const s = JSON.stringify({ t: 'dr', key: a.zone, l: out }); for (const x of this.inZone(a.zone)) this.send(x.ws, s);
      return;
    }
    const dz = this.zoneDrops(a.zone, false), d = dz && dz.get(String(m.id));
    if (!d) { this.send(ws, { t: 'dg', key: a.zone, ids: [String(m.id)], by: null, miss: 1 }); return; }
    if (d.own && d.own !== a.uid && !(!d.solo && d.pid && d.pid === a.pid) && Date.now() - d.ts < (d.ownMs || 20000)) { this.send(ws, { t: 'sys', m: d.solo ? d.ownN + ' tiró ese objeto: solo él lo puede levantar por ' + Math.ceil(((d.ownMs || 20000) - (Date.now() - d.ts)) / 1000) + ' s más.' : 'Ese objeto es de ' + d.ownN + ' por unos segundos más.' }); this.send(ws, { t: 'dg', key: a.zone, ids: [], by: null }); return; }
    dz.delete(d.id);
    const s = JSON.stringify({ t: 'dg', key: a.zone, ids: [d.id], by: a.uid }); for (const x of this.inZone(a.zone)) this.send(x.ws, s);
  }
  // ---- duelos 1 contra 1 con espectadores ----
  duelOf(uid) { if (!this.duels) return [null, null]; for (const [k, d] of this.duels) if (!d.end && (d.a === uid || d.b === uid)) return [k, d]; return [null, null]; }
  roomInfo(k, d) { return { key: k, a: d.a, b: d.b, na: d.na, nb: d.nb, la: d.la, lb: d.lb, ca: d.ca, cb: d.cb, hp: d.hp, state: d.end ? 'fin' : Date.now() < d.start ? 'cuenta' : 'pelea', start: d.start, left: d.end ? 0 : Math.max(0, Math.round((d.limit - Date.now()) / 1000)), winner: d.winner || null, spec: this.inZone(k).filter(x => x.a.uid !== d.a && x.a.uid !== d.b).length }; }
  roomSend(k, o) { const s = JSON.stringify(o); for (const x of this.inZone(k)) this.send(x.ws, s); }
  duelEnd(k, winner, why) {
    const d = this.duels && this.duels.get(k); if (!d || d.end) return; d.end = Date.now(); d.winner = winner; clearTimeout(d.timer);
    const wn = winner === d.a ? d.na : winner === d.b ? d.nb : null, ln = winner === d.a ? d.nb : d.na;
    const o = { t: 'duelend', key: k, winner, wn, ln, why, a: d.a, b: d.b, na: d.na, nb: d.nb };
    const sent = new Set(); for (const x of this.inZone(k)) { this.send(x.ws, o); sent.add(x.a.uid); }
    for (const uid of [d.a, d.b]) if (!sent.has(uid)) { const x = this.byUid(uid); if (x) this.send(x.ws, o); }
    const txt = wn ? wn + ' ganó el duelo contra ' + ln + (why === 'tiempo' ? ' por vida restante' : why === 'abandono' ? ' por abandono' : '') : 'El duelo entre ' + d.na + ' y ' + d.nb + ' terminó empatado';
    const msg = JSON.stringify({ t: 'c', ch: 'g', id: 'arena', n: 'Arena', adm: false, m: txt, ts: Date.now() }); for (const x of this.all()) this.send(x.ws, msg);
    setTimeout(() => { if (this.duels.get(k) === d) this.duels.delete(k); }, 30000);
  }
  duelMsg(ws, a, m) {
    this.duels = this.duels || new Map(); this.dinv = this.dinv || new Map();
    const t = m.t;
    if (t === 'rooms') { this.send(ws, { t: 'rooms', list: [...this.duels].filter(([, d]) => !d.end || Date.now() - d.end < 8000).map(([k, d]) => this.roomInfo(k, d)) }); return; }
    if (t === 'watch') { const d = this.duels.get(m.key); if (!d || d.end) { this.send(ws, { t: 'sys', m: 'Ese duelo ya terminó.' }); return; } if (d.a === a.uid || d.b === a.uid) return; this.send(ws, { t: 'duelgo', key: m.key, side: 'spec', room: this.roomInfo(m.key, d) }); return; }
    if (t === 'duel') {
      const x = m.id ? this.byUid(m.id) : this.byName(m.name || ''); if (!x || !x.a.s) { this.send(ws, { t: 'sys', m: 'Ese jugador no está conectado.' }); return; }
      if (x.a.uid === a.uid || !a.s) return;
      if (this.duelOf(a.uid)[1]) { this.send(ws, { t: 'sys', m: 'Ya estás en un duelo.' }); return; }
      if (this.duelOf(x.a.uid)[1]) { this.send(ws, { t: 'sys', m: x.a.s.n + ' ya está en un duelo.' }); return; }
      this.dinv.set(x.a.uid, { from: a.uid, t: Date.now() });
      this.send(x.ws, { t: 'duelinv', from: a.uid, n: a.s.n, L: a.s.L, c: a.s.c });
      this.send(ws, { t: 'sys', m: 'Desafiaste a ' + x.a.s.n + ' a un duelo. Esperando que acepte…' });
      return;
    }
    if (t === 'duelacc' || t === 'duelrej') {
      const iv = this.dinv.get(a.uid); this.dinv.delete(a.uid);
      const from = iv && this.byUid(iv.from);
      if (!iv || !from || !from.a.s || !a.s || Date.now() - iv.t > 60000) { this.send(ws, { t: 'sys', m: 'El desafío ya venció.' }); return; }
      if (t === 'duelrej') { this.send(from.ws, { t: 'sys', m: a.s.n + ' rechazó el duelo.' }); return; }
      if (this.duelOf(a.uid)[1] || this.duelOf(from.a.uid)[1]) { this.send(ws, { t: 'sys', m: 'Uno de los dos ya está en otro duelo.' }); return; }
      const k = 'duel#' + crypto.randomUUID().slice(0, 8), now = Date.now();
      const d = { a: from.a.uid, b: a.uid, na: from.a.s.n, nb: a.s.n, la: from.a.s.L, lb: a.s.L, ca: from.a.s.c, cb: a.s.c, hp: {}, start: now + 9000, limit: now + 9000 + 180000, end: null };
      this.duels.set(k, d);
      d.timer = setTimeout(() => { // a los 3 minutos gana el que tenga más vida
        const r = u => d.hp[u] ? d.hp[u][0] / d.hp[u][1] : 1, ha = r(d.a), hb = r(d.b);
        this.duelEnd(k, Math.abs(ha - hb) < .001 ? null : ha > hb ? d.a : d.b, 'tiempo');
      }, 9000 + 180000);
      for (const [x, side] of [[from, 'a'], [this.byUid(a.uid), 'b']]) if (x) this.send(x.ws, { t: 'duelgo', key: k, side, room: this.roomInfo(k, d) });
      return;
    }
    const [k, d] = this.duelOf(a.uid);
    if (!d || a.zone !== k) return;
    const other = d.a === a.uid ? d.b : d.a;
    if (t === 'ph') { if (Date.now() < d.start) return; const x = this.byUid(other); if (x && x.a.zone === k) this.send(x.ws, { t: 'ph', d: Math.max(0, Math.min(1e6, +m.d || 0)), k: String(m.k || '').slice(0, 2), from: a.uid }); return; }
    if (t === 'php') { d.hp[a.uid] = [Math.max(0, Math.round(+m.hp || 0)), Math.max(1, Math.round(+m.max || 1))]; this.roomSend(k, { t: 'php', key: k, id: a.uid, hp: d.hp[a.uid] }); return; }
    if (t === 'pd') { if (Date.now() >= d.start) this.duelEnd(k, other, 'ko'); return; }
  }
  startRaid(ws, a) {
    const [pid, p] = this.partyOf(a.uid);
    if (!p) { this.send(ws, { t: 'sys', m: 'Necesitás un grupo para desafiar a Añaretã.' }); return; }
    if (p.leader !== a.uid) { this.send(ws, { t: 'sys', m: 'Solo el líder del grupo puede iniciar el desafío.' }); return; }
    if (p.members.size < 2) { this.send(ws, { t: 'sys', m: 'El desafío es para grupos de 2 a 5 jugadores.' }); return; }
    const key = RAID_KEY + pid; if (this.sims.has(key)) { this.send(ws, { t: 'sys', m: 'Tu grupo ya está en la guarida.' }); return; }
    const ms = [...p.members].map(uid => this.byUid(uid)).filter(Boolean);
    const lvl = Math.max(...ms.map(x => (x.a.s && x.a.s.L) || 1));
    this.sims.set(key, new Sim(key, { lvl: Math.max(10, lvl + 2), size: ms.length })); this.startLoop();
    for (const x of ms) this.send(x.ws, { t: 'raid', key, lvl: Math.max(10, lvl + 2), n: ms.length });
  }

  partyOf(uid) {
    const x = this.byUid(uid); if (!x || !x.a.pid) return [null, null];
    const ms = this.all().filter(y => y.a.pid === x.a.pid);
    return [x.a.pid, { leader: x.a.pl, members: new Set(ms.map(y => y.a.uid)), voice: new Set(ms.filter(y => y.a.vc).map(y => y.a.uid)) }];
  }
  setParty(uid, pid, leader, vc) { const x = this.byUid(uid); if (!x) return; x.a.pid = pid; x.a.pl = leader; x.a.vc = !!vc; this.save(x.ws, x.a); }
  setLeader(pid, leader) { for (const y of this.all()) if (y.a.pid === pid) { y.a.pl = leader; this.save(y.ws, y.a); } }
  partySend(p, o, exceptUid) { const msg = JSON.stringify(o); for (const uid of p.members) { if (uid === exceptUid) continue; const x = this.byUid(uid); if (x) this.send(x.ws, msg); } }
  partyInfo(pid, p) {
    const members = [...p.members].map(uid => { const x = this.byUid(uid); return { id: uid, n: x && x.a.s ? x.a.s.n : '…', c: x && x.a.s ? x.a.s.c : '', L: x && x.a.s ? x.a.s.L : 0, zone: x ? x.a.zone : null, voice: p.voice.has(uid) }; });
    return { t: 'party', pid, leader: p.leader, members };
  }
  partyBroadcast(pid, p) { this.partySend(p, this.partyInfo(pid, p)); }
  leaveParty(uid, quiet, gone) {
    const [pid, p] = this.partyOf(uid); if (!p) return;
    if (!gone) this.setParty(uid, null, null, false);
    p.members.delete(uid); p.voice.delete(uid);
    this.partySend(p, { t: 'vl', id: uid });
    const me = this.byUid(uid); if (me && !quiet) this.send(me.ws, { t: 'party', pid: null, members: [] });
    if (p.members.size <= 1) { for (const m of p.members) { this.setParty(m, null, null, false); const x = this.byUid(m); if (x) this.send(x.ws, { t: 'party', pid: null, members: [] }); } return; }
    if (p.leader === uid) { p.leader = [...p.members][0]; this.setLeader(pid, p.leader); }
    this.partyBroadcast(pid, p);
  }

  // ---- intercambio entre jugadores y tiendas personales (como en MU) ----
  // El juego de cada jugador guarda su personaje; el servidor hace de escribano: en el intercambio cada uno
  // primero entrega lo suyo (lo saca de su bolsa y guarda) y recién cuando los dos entregaron, el servidor reparte
  // por la tabla de entregas (deliveries), que el juego retira una sola vez. Si alguien se cae a mitad, a quien
  // ya entregó se le devuelve lo suyo por el mismo camino. Así nadie pierde ni duplica.
  async deliver(uid, items, gold, label) {
    const st = [], now = Date.now();
    for (const it of items || []) st.push(this.env.DB.prepare('INSERT INTO deliveries(uid,oid,item,label,created) VALUES(?,?,?,?,?)').bind(uid, null, JSON.stringify({ raw: it }), label, now));
    if (gold > 0) st.push(this.env.DB.prepare('INSERT INTO deliveries(uid,oid,item,label,created) VALUES(?,?,?,?,?)').bind(uid, null, JSON.stringify({ k: 'gold', n: Math.round(gold), inv: 1 }), label, now));
    if (st.length) await this.env.DB.batch(st);
  }
  cleanItems(l, max) { const out = []; for (const it of (Array.isArray(l) ? l : []).slice(0, max)) { if (!it || typeof it !== 'object' || it.k === 'gold' || it.raw) continue; const s = JSON.stringify(it); if (s.length > 1500) continue; out.push(JSON.parse(s)); } return out; }
  tradeOf(uid) { if (!this.trades) return [null, null]; for (const [k, tr] of this.trades) if (tr.a === uid || tr.b === uid) return [k, tr]; return [null, null]; }
  tradeState(tr) { return { t: 'tst', off: { [tr.a]: tr.off[tr.a], [tr.b]: tr.off[tr.b] }, rdy: tr.rdy, cnf: tr.cnf, stage: tr.stage }; }
  tradeSend(tr, o) { for (const u of [tr.a, tr.b]) { const x = this.byUid(u); if (x) this.send(x.ws, o); } }
  async tradeEnd(k, tr, why) {
    if (!this.trades || !this.trades.has(k)) return; this.trades.delete(k); if (tr.timer) clearTimeout(tr.timer);
    if (tr.stage === 'commit') { // alguien no llegó a entregar: se devuelve lo entregado
      for (const u of [tr.a, tr.b]) { const g = tr.got[u]; if (g) await this.deliver(u, g.items, g.gold, 'Intercambio devuelto'); }
      this.tradeSend(tr, { t: 'tend', ok: false, refund: 1, m: why || 'El intercambio no se completó: lo que entregaste vuelve a tu bolsa.' });
    } else this.tradeSend(tr, { t: 'tend', ok: false, m: why || 'Se canceló el intercambio.' });
  }
  async tradeMsg(ws, a, m) {
    const t = m.t; this.trades = this.trades || new Map(); this.tinv = this.tinv || new Map();
    if (t === 'treq') {
      const x = this.byUid(String(m.id || '')); if (!x || !x.a.s || !a.s || x.a.uid === a.uid) return;
      if (x.a.zone !== a.zone) { this.send(ws, { t: 'sys', m: 'Tienen que estar en el mismo mapa para comerciar.' }); return; }
      if (a.p && x.a.p && Math.hypot(a.p.x - x.a.p.x, a.p.z - x.a.p.z) > 8) { this.send(ws, { t: 'sys', m: 'Acercate más a ' + x.a.s.n + ' para comerciar.' }); return; }
      if (this.tradeOf(a.uid)[1] || this.tradeOf(x.a.uid)[1]) { this.send(ws, { t: 'sys', m: x.a.s.n + ' ya está comerciando.' }); return; }
      this.tinv.set(x.a.uid, { from: a.uid, t: Date.now() }); this.send(x.ws, { t: 'treq', from: a.uid, n: a.s.n }); this.send(ws, { t: 'sys', m: 'Le pediste comerciar a ' + x.a.s.n + '.' }); return;
    }
    if (t === 'tacc' || t === 'trej') {
      const iv = this.tinv.get(a.uid); this.tinv.delete(a.uid); if (!iv || Date.now() - iv.t > 60000) return; const x = this.byUid(iv.from); if (!x || !x.a.s) return;
      if (t === 'trej') { this.send(x.ws, { t: 'sys', m: (a.s ? a.s.n : 'El jugador') + ' no quiso comerciar.' }); return; }
      if (this.tradeOf(a.uid)[1] || this.tradeOf(x.a.uid)[1]) return;
      const k = 'tr' + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
      const tr = { a: x.a.uid, b: a.uid, na: x.a.s.n, nb: a.s.n, off: { [x.a.uid]: { items: [], gold: 0 }, [a.uid]: { items: [], gold: 0 } }, rdy: {}, cnf: {}, got: {}, stage: 'open' };
      this.trades.set(k, tr);
      this.send(x.ws, { t: 'topen', with: a.uid, n: a.s.n }); this.send(ws, { t: 'topen', with: x.a.uid, n: x.a.s.n }); return;
    }
    const [k, tr] = this.tradeOf(a.uid); if (!tr) return;
    if (t === 'tx') { await this.tradeEnd(k, tr, (a.s ? a.s.n : 'El otro jugador') + ' canceló el intercambio.'); return; }
    if (tr.stage === 'open') {
      if (t === 'toff') { tr.off[a.uid] = { items: this.cleanItems(m.items, 8), gold: Math.max(0, Math.min(2e9, Math.round(+m.gold || 0))) }; tr.rdy = {}; tr.cnf = {}; this.tradeSend(tr, this.tradeState(tr)); return; }
      if (t === 'trdy') { tr.rdy[a.uid] = !!m.on; if (!m.on) tr.cnf = {}; this.tradeSend(tr, this.tradeState(tr)); return; }
      if (t === 'tcnf') { if (!tr.rdy[tr.a] || !tr.rdy[tr.b]) return; tr.cnf[a.uid] = true; this.tradeSend(tr, this.tradeState(tr));
        if (tr.cnf[tr.a] && tr.cnf[tr.b]) { tr.stage = 'commit'; tr.nonce = Math.random().toString(36).slice(2, 10);
          this.tradeSend(tr, { t: 'tcommit', nonce: tr.nonce, off: { [tr.a]: tr.off[tr.a], [tr.b]: tr.off[tr.b] } });
          tr.timer = setTimeout(() => { this.tradeEnd(k, tr, 'El otro jugador no respondió: se canceló el intercambio.').catch(() => {}); }, 15000); }
        return; }
      return;
    }
    if (tr.stage === 'commit' && t === 'tok' && m.nonce === tr.nonce && !tr.got[a.uid]) {
      tr.got[a.uid] = { items: this.cleanItems(m.items, 8), gold: Math.max(0, Math.min(2e9, Math.round(+m.gold || 0))) };
      if (tr.got[tr.a] && tr.got[tr.b]) { this.trades.delete(k); if (tr.timer) clearTimeout(tr.timer);
        await this.deliver(tr.a, tr.got[tr.b].items, tr.got[tr.b].gold, 'Intercambio con ' + tr.nb);
        await this.deliver(tr.b, tr.got[tr.a].items, tr.got[tr.a].gold, 'Intercambio con ' + tr.na);
        this.tradeSend(tr, { t: 'tend', ok: true }); }
      return;
    }
    if (tr.stage === 'commit' && t === 'tno') { await this.tradeEnd(k, tr, 'Un ítem ya no estaba en la bolsa: se canceló el intercambio.'); }
  }
  // tienda personal: el vendedor publica la lista (con precios); el comprador paga primero, el vendedor entrega y cobra
  shopPub(a) { return a.shop ? { title: a.shop.title, n: a.shop.items.length } : null; }
  async shopMsg(ws, a, m) {
    const t = m.t; this.sbuys = this.sbuys || new Map();
    if (t === 'shop') {
      if (m.open && a.zone !== 'asuncion') { this.send(ws, { t: 'sys', m: 'Las tiendas solo se abren en Asunción.' }); return; }
      a.shop = m.open ? { title: clip(m.title, 28) || 'Tienda', items: (Array.isArray(m.items) ? m.items : []).slice(0, 12).map(x => ({ item: this.cleanItems([x && x.item], 1)[0], price: Math.max(1, Math.min(2e9, Math.round(+(x && x.price) || 0))) })).filter(x => x.item && x.item.u != null) } : null;
      this.save(ws, a); const o = { t: 'shop', id: a.uid, sh: this.shopPub(a) }; if (a.zone) for (const x of this.inZone(a.zone)) this.send(x.ws, o); return;
    }
    if (t === 'shopv') { const x = this.byUid(String(m.id || '')); if (!x || !x.a.shop || x.a.zone !== a.zone) { this.send(ws, { t: 'shopv', id: m.id, closed: 1 }); return; } this.send(ws, { t: 'shopv', id: x.a.uid, n: x.a.s && x.a.s.n, title: x.a.shop.title, items: x.a.shop.items }); return; }
    if (t === 'sbuy') { // el comprador ya descontó el oro de su bolsa y guardó
      const price = Math.max(0, Math.round(+m.price || 0)), nonce = clip(m.nonce, 16), x = this.byUid(String(m.id || ''));
      const it = x && x.a.shop && x.a.shop.items.find(y => y.item.u === m.u && y.price === price);
      if (!x || !it || x.a.zone !== a.zone) { await this.deliver(a.uid, [], price, 'Compra devuelta'); this.send(ws, { t: 'sres', ok: false, refund: 1, m: 'Ese ítem ya no está a la venta: tu plata vuelve a tu bolsa.' }); return; }
      const sb = { buyer: a.uid, seller: x.a.uid, price, u: m.u, bn: a.s ? a.s.n : '' }; this.sbuys.set(nonce, sb);
      sb.timer = setTimeout(async () => { if (!this.sbuys.has(nonce)) return; this.sbuys.delete(nonce); await this.deliver(a.uid, [], price, 'Compra devuelta'); const b = this.byUid(a.uid); if (b) this.send(b.ws, { t: 'sres', ok: false, refund: 1, m: 'El vendedor no respondió: tu plata vuelve a tu bolsa.' }); }, 12000);
      this.send(x.ws, { t: 'ssell', nonce, u: m.u, price, bn: sb.bn }); return;
    }
    if (t === 'sok' || t === 'sno') { // el vendedor ya sacó el ítem y cobró (sok) o no lo tiene (sno)
      const sb = this.sbuys.get(clip(m.nonce, 16)); if (!sb || sb.seller !== a.uid) return; this.sbuys.delete(clip(m.nonce, 16)); clearTimeout(sb.timer);
      const b = this.byUid(sb.buyer);
      if (t === 'sok') { const it = this.cleanItems([m.item], 1); await this.deliver(sb.buyer, it, 0, 'Compra a ' + (a.s ? a.s.n : 'un jugador')); if (b) this.send(b.ws, { t: 'sres', ok: true });
        if (a.shop) { a.shop.items = a.shop.items.filter(y => y.item.u !== sb.u); if (!a.shop.items.length) a.shop = null; this.save(ws, a); const o = { t: 'shop', id: a.uid, sh: this.shopPub(a) }; if (a.zone) for (const x of this.inZone(a.zone)) this.send(x.ws, o); } }
      else { await this.deliver(sb.buyer, [], sb.price, 'Compra devuelta'); if (b) this.send(b.ws, { t: 'sres', ok: false, refund: 1, m: 'Ese ítem ya no estaba: tu plata vuelve a tu bolsa.' }); }
    }
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 60000) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    const a = this.att(ws); if (!a) return;
    const t = m.t;
    if (raw.length > 4000 && t !== 'ms' && t !== 'mr' && !(raw.length < 26000 && (t === 'toff' || t === 'tok' || t === 'shop' || t === 'sok'))) return;
    if (t === 'treq' || t === 'tacc' || t === 'trej' || t === 'tx' || t === 'toff' || t === 'trdy' || t === 'tcnf' || t === 'tok' || t === 'tno') { await this.tradeMsg(ws, a, m); return; }
    if (t === 'shop' || t === 'shopv' || t === 'sbuy' || t === 'sok' || t === 'sno') { await this.shopMsg(ws, a, m); return; }
    // vida y maná para la tarjeta de los compañeros de grupo (en porcentaje; máx. 2 por segundo)
    if (t === 'ps') { const now = Date.now(); if (now - (a.psT || 0) < 450) return; a.psT = now; const [, p] = this.partyOf(a.uid); if (!p) return;
      const pc = v => Math.max(0, Math.min(100, Math.round(+v || 0)));
      this.partySend(p, { t: 'ps', id: a.uid, h: pc(m.h), m: pc(m.m), d: m.d ? 1 : 0, L: (a.s && a.s.L) | 0 }, a.uid); return; }

    // monstruos: los mueve el servidor; los jugadores mandan sus golpes y piden la lista completa
    if (t === 'mh') { const sim = a.zone && this.sims.get(a.zone); if (sim) sim.hit(a.uid, m.n | 0, m.d); return; }
    if (t === 'mreq') { const sim = a.zone && this.sims.get(a.zone); if (sim) this.send(ws, { t: 'mr', l: sim.roster(), key: a.zone }); return; }
    if (t === 'raid') { this.startRaid(ws, a); return; }
    if (t === 'sk') { // poder usado: los demás del mapa lo ven
      if (!a.zone || !a.s) return; const now = Date.now(); if (now - (a.skT || 0) < 120) return; a.skT = now;
      const o = { t: 'sk', id: a.uid, k: clip(m.k, 14), x: +m.x || 0, z: +m.z || 0, ry: +m.ry || 0, tx: m.tx == null ? null : +m.tx || 0, tz: m.tz == null ? null : +m.tz || 0, tn: m.tn | 0, st: m.st ? 1 : 0 };
      const out = JSON.stringify(o); for (const x of this.inZone(a.zone, ws)) this.send(x.ws, out); return;
    }
    if (t === 'dr' || t === 'dp') { this.dropMsg(ws, a, m); return; }
    if (t === 'duel' || t === 'duelacc' || t === 'duelrej' || t === 'ph' || t === 'php' || t === 'pd' || t === 'rooms' || t === 'watch') { this.duelMsg(ws, a, m); return; }


    if (t === 'p') { // posición: x,z,ry,mv,ac (contador de ataques),d (muerto),f (vuela)
      a.p = { x: +m.x || 0, z: +m.z || 0, ry: +m.ry || 0, mv: +m.mv || 0, ac: m.ac | 0, d: m.d ? 1 : 0 };
      if (GESTOS.includes(m.g)) a.p.g = m.g; // gesto en curso (saludo, baile…), para que lo vean los demás
      this.save(ws, a);
      if (!a.zone) return;
      const out = JSON.stringify({ t: 'p', id: a.uid, ...a.p });
      for (const x of this.inZone(a.zone, ws)) this.send(x.ws, out);
      return;
    }
    if (t === 'hi' || t === 'z' || t === 'eq') { // presentarse, cambiar de mapa o de equipo
      const s = m.s || {};
      a.s = { n: clip(s.n, 24), c: clip(s.c, 12), L: s.L | 0, evo: !!s.evo, eq: s.eq && typeof s.eq === 'object' ? s.eq : {}, pet: clip(s.pet, 10) || null, face: s.face | 0 };
      if (JSON.stringify(a.s).length > 2500) a.s.eq = {};
      const old = a.zone, zone = m.zone ? clip(m.zone, 24) : a.zone;
      if (m.p) a.p = { x: +m.p.x || 0, z: +m.p.z || 0, ry: +m.p.ry || 0, mv: 0, ac: 0, d: 0 };
      if (old !== zone) { a.jt = Date.now(); a.shop = null; const [tk, tr] = this.tradeOf(a.uid); if (tr) this.tradeEnd(tk, tr, 'Se canceló el intercambio: ' + (a.s ? a.s.n : 'el otro jugador') + ' se fue del mapa.').catch(() => {}); }
      a.zone = zone; this.save(ws, a);
      if (old && old !== zone) for (const x of this.inZone(old, ws)) this.send(x.ws, { t: 'l', id: a.uid });
      if (old && old.startsWith('duel#') && old !== zone) { const [k, d] = this.duelOf(a.uid); if (d && k === old) this.duelEnd(k, d.a === a.uid ? d.b : d.a, 'abandono'); }
      if (zone && zone.startsWith('duel#') && this.duels && this.duels.get(zone)) { const d = this.duels.get(zone); this.send(ws, { t: 'room', room: this.roomInfo(zone, d) }); }
      if (old !== zone || t === 'hi') {
        { const dz = this.zoneDrops(zone, false); if (dz && dz.size) this.send(ws, { t: 'dr', key: zone, init: 1, l: [...dz.values()] }); }
        this.send(ws, { t: 'w', you: a.uid, list: this.inZone(zone, ws).filter(x => x.a.s).map(x => this.pub(x.a)) });
        for (const x of this.inZone(zone, ws)) this.send(x.ws, { t: 'j', ...this.pub(a) });
        const sim = this.ensureSim(zone); if (sim) this.send(ws, { t: 'mr', l: sim.roster(), key: zone });
      } else for (const x of this.inZone(zone, ws)) this.send(x.ws, { t: 'eq', id: a.uid, s: a.s });
      const [pid, p] = this.partyOf(a.uid); if (p) this.partyBroadcast(pid, p);
      if (t === 'hi') this.send(ws, { t: 'online', n: this.all().filter(x => x.a.s).length, ts: Date.now() });
      // bienvenida de un administrador a todo el servidor (como en MU); como mucho una vez cada 10 minutos por cuenta
      if (t === 'hi' && a.role === 'admin' && a.s && a.s.n) { this.admWel = this.admWel || new Map(); const last = this.admWel.get(a.uid) || 0; if (Date.now() - last > 600000) { this.admWel.set(a.uid, Date.now()); for (const x of this.all()) this.send(x.ws, { t: 'ann', k: 'adm', n: a.s.n }); } }
      return;
    }
    if (t === 'sv') { // aviso global de un administrador ("/sv mensaje" en el chat): sale en grande en la pantalla de todos los conectados
      if (a.role !== 'admin' || !a.s) { this.send(ws, { t: 'sys', m: 'Solo los administradores pueden enviar avisos globales.' }); return; }
      const text = clip(m.m, 200).replace(/[\u0000-\u001f]/g, ' ').trim(); if (!text) return;
      const now = Date.now(); if (now - (a.svT || 0) < 3000) return; a.svT = now; this.save(ws, a);
      const s = JSON.stringify({ t: 'ann', k: 'sv', n: a.s.n, m: text, ts: now }); for (const x of this.all()) this.send(x.ws, s);
      return;
    }
    if (t === 'c') { // chat
      const text = clip(m.m, 200).replace(/[\u0000-\u001f]/g, ' ').trim(); if (!text || !a.s) return;
      const now = Date.now(); a.cq = (a.cq || []).filter(x => now - x < 10000); if (a.cq.length >= 6) { this.send(ws, { t: 'sys', m: 'Esperá un momento antes de escribir de nuevo.' }); return; }
      a.cq.push(now); this.save(ws, a);
      const ch = m.ch === 'm' || m.ch === 'p' ? m.ch : 'g';
      const msg = { t: 'c', ch, id: a.uid, n: a.s.n, adm: a.role === 'admin', m: text, ts: now };
      if (ch === 'g') { const s = JSON.stringify(msg); for (const x of this.all()) this.send(x.ws, s); }
      else if (ch === 'm') { const s = JSON.stringify(msg); for (const x of this.all()) if (x.a.zone === a.zone) this.send(x.ws, s); }
      else { const [, p] = this.partyOf(a.uid); if (!p) { this.send(ws, { t: 'sys', m: 'No estás en un grupo.' }); return; } this.partySend(p, msg); }
      return;
    }
    if (t === 'inv') { // invitar al grupo por nombre de personaje o cuenta
      const x = m.id ? this.byUid(m.id) : this.byName(m.name || '');
      if (!x || !x.a.s) { this.send(ws, { t: 'sys', m: 'Ese jugador no está conectado.' }); return; }
      if (x.a.uid === a.uid) return;
      if (this.partyOf(x.a.uid)[1]) { this.send(ws, { t: 'sys', m: x.a.s.n + ' ya está en un grupo.' }); return; }
      let [pid, p] = this.partyOf(a.uid);
      if (!p) { pid = crypto.randomUUID().slice(0, 8); this.setParty(a.uid, pid, a.uid, false); [pid, p] = this.partyOf(a.uid); }
      if (p.members.size >= PARTY_MAX) { this.send(ws, { t: 'sys', m: 'El grupo ya tiene 5 integrantes.' }); return; }
      this.invites.set(x.a.uid, { pid, from: a.uid, t: Date.now() });
      this.send(x.ws, { t: 'inv', from: a.uid, n: a.s.n });
      this.send(ws, { t: 'sys', m: 'Invitaste a ' + x.a.s.n + ' a tu grupo.' });
      this.partyBroadcast(pid, p);
      return;
    }
    if (t === 'acc' || t === 'rej') {
      const iv = this.invites.get(a.uid); this.invites.delete(a.uid);
      if (!iv || Date.now() - iv.t > 120000) { this.send(ws, { t: 'sys', m: 'La invitación ya venció.' }); return; }
      const from = this.byUid(iv.from); const [fpid, p] = from ? this.partyOf(iv.from) : [null, null];
      if (t === 'rej') { if (from) this.send(from.ws, { t: 'sys', m: (a.s ? a.s.n : 'El jugador') + ' rechazó la invitación.' }); return; }
      if (!p || fpid !== iv.pid || p.members.size >= PARTY_MAX) { this.send(ws, { t: 'sys', m: 'Ese grupo ya no está disponible.' }); return; }
      this.leaveParty(a.uid, true);
      this.setParty(a.uid, iv.pid, p.leader, false); p.members.add(a.uid); this.partyBroadcast(iv.pid, p);
      this.partySend(p, { t: 'sys', m: (a.s ? a.s.n : 'Alguien') + ' se unió al grupo.' });
      return;
    }
    if (t === 'leave') { this.leaveParty(a.uid); return; }
    if (t === 'kick') { const [pid, p] = this.partyOf(a.uid); if (p && p.leader === a.uid && m.id !== a.uid && p.members.has(m.id)) { this.leaveParty(m.id); } return; }

    // chat de voz del grupo: avisos de entrada/salida y señal WebRTC entre integrantes
    if (t === 'vj' || t === 'vl') {
      const [pid, p] = this.partyOf(a.uid); if (!p) return;
      a.vc = t === 'vj'; this.save(ws, a);
      if (t === 'vj') p.voice.add(a.uid); else p.voice.delete(a.uid);
      this.partySend(p, { t, id: a.uid }, a.uid); this.partyBroadcast(pid, p);
      return;
    }
    if (t === 'v') {
      const [, p] = this.partyOf(a.uid); if (!p || !p.members.has(m.to)) return;
      const x = this.byUid(m.to); if (x) this.send(x.ws, { t: 'v', from: a.uid, sig: m.sig });
      return;
    }
  }

  async webSocketClose(ws) { this.gone(ws); }
  async webSocketError(ws) { this.gone(ws); }
  gone(ws) {
    const a = this.att(ws); if (!a) return;
    { const [tk, tr] = this.tradeOf(a.uid); if (tr) this.tradeEnd(tk, tr, 'Se canceló el intercambio: el otro jugador se desconectó.').catch(() => {}); }
    { const [k, d] = this.duelOf(a.uid); if (d) this.duelEnd(k, d.a === a.uid ? d.b : d.a, 'abandono'); }
    if (a.zone) { for (const x of this.inZone(a.zone, ws)) this.send(x.ws, { t: 'l', id: a.uid }); }
    if (a.pid) {
      // el que se fue ya no figura entre las conexiones: avisar al resto del grupo
      const ms = this.all().filter(y => y.ws !== ws && y.a.pid === a.pid);
      for (const y of ms) this.send(y.ws, { t: 'vl', id: a.uid });
      if (ms.length <= 1) { for (const y of ms) { y.a.pid = null; y.a.pl = null; y.a.vc = false; this.save(y.ws, y.a); this.send(y.ws, { t: 'party', pid: null, members: [] }); } }
      else { if (a.pl === a.uid) this.setLeader(a.pid, ms[0].a.uid); const [pid, p] = this.partyOf(ms[0].a.uid); if (p) this.partyBroadcast(pid, p); }
    }
  }
}
