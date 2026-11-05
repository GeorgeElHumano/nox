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

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/live/ping') return new Response('ok');
    if (url.pathname !== '/live/ws') return new Response('No encontrado', { status: 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Se espera WebSocket', { status: 426 });
    const tok = url.searchParams.get('t') || '';
    if (!/^[0-9a-f]{64}$/.test(tok)) return new Response('Sin sesión', { status: 401 });
    const row = await env.DB.prepare('SELECT u.id,u.name,u.role,s.exp FROM sessions s JOIN users u ON u.id=s.uid WHERE s.th=?').bind(await sha256(tok)).first();
    if (!row || row.exp < Date.now()) return new Response('Sesión vencida', { status: 401 });
    const id = env.WORLD.idFromName('reino');
    const h = new Headers(req.headers);
    h.set('x-uid', row.id); h.set('x-acc', row.name); h.set('x-role', row.role);
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
  pub(a) { return { id: a.uid, s: a.s, p: a.p }; }
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
  // anfitrión del mapa: el que entró primero (y sigue ahí)
  hostOf(zone) { let best = null; for (const x of this.inZone(zone)) { if (!x.a.s) continue; if (!best || (x.a.jt || 0) < (best.a.jt || 0)) best = x; } return best ? best.a.uid : null; }
  announceHost(zone) {
    if (!zone) return; this.hosts = this.hosts || {};
    const h = this.hostOf(zone); if (this.hosts[zone] === h) return; this.hosts[zone] = h;
    const out = JSON.stringify({ t: 'host', zone, id: h }); for (const x of this.inZone(zone)) this.send(x.ws, out);
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

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 60000) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    const a = this.att(ws); if (!a) return;
    const t = m.t;
    if (raw.length > 4000 && t !== 'ms' && t !== 'mr') return;

    // monstruos: los mueve el servidor; los jugadores mandan sus golpes y piden la lista completa
    if (t === 'mh') { const sim = a.zone && this.sims.get(a.zone); if (sim) sim.hit(a.uid, m.n | 0, m.d); return; }
    if (t === 'mreq') { const sim = a.zone && this.sims.get(a.zone); if (sim) this.send(ws, { t: 'mr', l: sim.roster(), key: a.zone }); return; }
    if (t === 'raid') { this.startRaid(ws, a); return; }

    if (t === 'p') { // posición: x,z,ry,mv,ac (contador de ataques),d (muerto),f (vuela)
      a.p = { x: +m.x || 0, z: +m.z || 0, ry: +m.ry || 0, mv: +m.mv || 0, ac: m.ac | 0, d: m.d ? 1 : 0 };
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
      if (old !== zone) a.jt = Date.now();
      a.zone = zone; this.save(ws, a);
      if (old && old !== zone) for (const x of this.inZone(old, ws)) this.send(x.ws, { t: 'l', id: a.uid });
      if (old !== zone || t === 'hi') {
        this.send(ws, { t: 'w', you: a.uid, list: this.inZone(zone, ws).filter(x => x.a.s).map(x => this.pub(x.a)) });
        for (const x of this.inZone(zone, ws)) this.send(x.ws, { t: 'j', ...this.pub(a) });
        const sim = this.ensureSim(zone); if (sim) this.send(ws, { t: 'mr', l: sim.roster(), key: zone });
      } else for (const x of this.inZone(zone, ws)) this.send(x.ws, { t: 'eq', id: a.uid, s: a.s });
      const [pid, p] = this.partyOf(a.uid); if (p) this.partyBroadcast(pid, p);
      if (t === 'hi') this.send(ws, { t: 'online', n: this.all().filter(x => x.a.s).length, ts: Date.now() });
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
