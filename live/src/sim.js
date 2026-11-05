// Simulación de monstruos en el servidor: cada mapa con jugadores tiene sus monstruos, que se mueven
// con el reloj del servidor, persiguen al jugador más cercano y avisan sus ataques especiales a todos.
import { MOBS, ZONES, BOSSK } from './data.js';

const R = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;
export const RAID_KEY = 'ev_raid#';
const RAID_LIST = ['slam', 'quake', 'charge', 'stampede', 'poison', 'sweep', 'quake', 'charge'];
const RAID_TIME = 360; // segundos antes de que Añaretã consuma la sala

export function mobStats(lvl, boss, golden) {
  let hp = 15 + lvl * 10 + lvl * lvl * .55;
  if (boss) hp *= 7; if (golden) hp *= 3;
  return Math.round(hp);
}
const reachOf = m => .55 * (MOBS[m.type] ? MOBS[m.type].sc : 1) * (m.golden ? 1.15 : m.elite ? 1.22 : 1) + .85;
function inLake(Z, x, z, pad) { return Z.lake && Math.hypot(x - Z.lake[0], z - Z.lake[1]) < Z.lake[2] + (pad || 2); }
function spotPoint(Z, sp) { for (let t = 0; t < 30; t++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * sp.r, x = sp.x + Math.cos(a) * r, z = sp.z + Math.sin(a) * r; if (!inLake(Z, x, z)) return [x, z]; } return [sp.x, sp.z]; }

export class Sim {
  constructor(key, opts) {
    this.key = key; this.raid = key.startsWith(RAID_KEY);
    this.base = this.raid ? 'ev_raid' : key; this.Z = ZONES[this.base] || { spots: [], lake: null, spawn: [0, 0] };
    this.mobs = []; this.nid = 0; this.keyT = 0; this.goldT = 240; this.t = 0; this.pend = []; this.out = [];
    this.opts = opts || {};
    if (this.raid) this.spawnRaid(); else this.spawnZone();
  }
  add(type, x, z, o) {
    o = o || {}; const def = MOBS[type]; if (!def) return null;
    const lvl = o.lvl || def.lvl, boss = o.boss != null ? o.boss : def.boss;
    const elite = !boss && !o.golden && !o.summon && !!o.spot && Math.random() < .05;
    let hp = mobStats(lvl, boss, o.golden); if (elite) hp = Math.round(hp * 3.2); if (o.hpMul) hp = Math.round(hp * o.hpMul);
    const m = { n: ++this.nid, type, x, z, ry: Math.random() * TAU, hp, max: hp, dead: false, deadT: 0, golden: !!o.golden, elite, summon: !!o.summon, spot: o.spot || null,
      hx: x, hz: z, cx: x, cz: z, aggro: o.aggro || 0, atkCD: R(0, 1), wx: x, wz: z, wanderT: R(0, 3), ret: false, contrib: {}, ln: 0, boss, lvl, lvlO: o.lvl || 0,
      speed: def.sp, ag: o.ag || def.ag, respawn: o.respawn || (boss ? 150 : o.golden ? 6 : 12), bcd: 3, rot: 0, stun: 0, dash: null, enraged: false, born: 0 };
    this.mobs.push(m); return m;
  }
  spawnZone() {
    for (const sp of this.Z.spots || []) for (let i = 0; i < sp.c; i++) { const q = spotPoint(this.Z, sp); this.add(sp.m, q[0], q[1], { spot: sp }); }
    if (this.Z.boss) this.add(this.Z.boss[0], this.Z.boss[1], this.Z.boss[2]);
  }
  spawnRaid() {
    const L = this.opts.lvl || 60, n = this.opts.size || 2;
    this.raidL = L; this.raidStart = 0;
    const b = this.add('anaretan', 0, -6, { lvl: L, boss: true, hpMul: 1.6 + n * 1.1, ag: 60, respawn: 1e9 });
    if (b) { b.raidBoss = true; b.speed = 4.2; }
  }
  entry(m) { return [m.n, m.type, Math.round(m.x * 10), Math.round(m.z * 10), Math.round(m.ry * 100), Math.max(0, Math.round(m.hp)), m.max, (m.dead ? 1 : 0) | (m.golden ? 2 : 0) | (m.elite ? 4 : 0) | (m.summon ? 16 : 0) | (m.enraged ? 32 : 0), m.ln % 100, m.lvlO || 0]; }
  roster() { return this.mobs.map(m => this.entry(m)); }
  later(dt, fn) { this.pend.push({ at: this.t + dt, fn }); }
  emit(o) { this.out.push(o); } // mensajes para todos los del mapa
  tele(m, ab, f, x, z, dur, mult, delay, extra) { this.emit({ t: 'tele', n: m.n, ab, f, x: +x.toFixed(2), z: +z.toFixed(2), dur, m: mult, d: delay || 0, col: (BOSSK[m.type] || {}).col || 0xff3a1a, ...(extra || {}) }); }

  hit(uid, n, d) { // golpe de un jugador
    const m = this.mobs.find(x => x.n === n); if (!m || m.dead) return null;
    d = Math.max(0, Math.min(5e6, +d || 0)); m.hp -= d; m.contrib[uid] = (m.contrib[uid] || 0) + d; m.aggro = 10; m.ret = false;
    if (m.raidBoss && !this.raidStart) this.raidStart = this.t;
    if (m.hp <= 0) return this.kill(m);
    return null;
  }
  kill(m) {
    m.dead = true; m.deadT = 0; m.hp = 0;
    const c = {}; for (const k in m.contrib) c[k] = Math.round(m.contrib[k]);
    this.emit({ t: 'mk', n: m.n, c, x: +m.x.toFixed(1), z: +m.z.toFixed(1), raid: m.raidBoss ? 1 : 0 });
    return m;
  }

  step(dt, players, sendTo) {
    this.t += dt;
    for (let i = this.pend.length - 1; i >= 0; i--) if (this.pend[i].at <= this.t) { const p = this.pend.splice(i, 1)[0]; try { p.fn(); } catch (e) {} }
    const alive = players.filter(p => p.p && !p.p.d);
    // invasión dorada cada 4 minutos cerca de alguien
    if (!this.raid && alive.length) { this.goldT -= dt; if (this.goldT <= 0) { this.goldT = 240; const sp = (this.Z.spots || [])[0]; if (sp) { const p = alive[Math.floor(Math.random() * alive.length)].p; const a = Math.random() * TAU, r = R(18, 35); let x = Math.max(-108, Math.min(108, p.x + Math.cos(a) * r)), z = Math.max(-108, Math.min(108, p.z + Math.sin(a) * r)); if (inLake(this.Z, x, z, 3)) { x = this.Z.spawn[0] + 20; z = this.Z.spawn[1] + 20; } this.add(sp.m, x, z, { golden: true }); this.emit({ t: 'sys', m: '¡Invasión dorada! Apareció un ' + MOBS[sp.m].n + ' Dorado cerca' }); } } }
    // la sala de Añaretã se consume si tardan demasiado
    if (this.raid && this.raidStart && this.t - this.raidStart > RAID_TIME) { this.doomT = (this.doomT || 0) - dt; if (this.doomT <= 0) { this.doomT = 3; const b = this.mobs.find(m => m.raidBoss && !m.dead); if (b) this.tele(b, 'doom', { t: 'circle', r: 60 }, b.x, b.z, 2, 8); } }

    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      if (m.dead) {
        m.deadT += dt;
        if (m.deadT > m.respawn) {
          if (m.golden || m.summon || m.raidBoss) { this.mobs.splice(i, 1); continue; }
          const q = m.boss ? [this.Z.boss ? this.Z.boss[1] : m.cx, this.Z.boss ? this.Z.boss[2] : m.cz] : m.spot ? spotPoint(this.Z, m.spot) : [m.cx, m.cz];
          Object.assign(m, { x: q[0], z: q[1], hx: q[0], hz: q[1], hp: m.max, dead: false, deadT: 0, aggro: 0, ret: false, contrib: {}, add1: 0, add2: 0, enraged: false, speed: MOBS[m.type].sp, born: this.t, stun: 0, dash: null });
          if (m.boss) this.emit({ t: 'sys', m: MOBS[m.type].n + ' volvió a aparecer' });
        }
        continue;
      }
      // objetivo: el jugador vivo más cercano
      let tg = null, d = 1e9; for (const p of alive) { const dd = Math.hypot(p.p.x - m.x, p.p.z - m.z); if (dd < d) { d = dd; tg = p; } }
      if (d > 75 && !m.ret && m.aggro <= 0 && !m.boss) { m.atkCD -= dt; continue; }
      m.atkCD -= dt; m.aggro = Math.max(0, m.aggro - dt); if (m.stun > 0) m.stun -= dt;
      if (m.dash) { const D = m.dash; D.t += dt; const k = Math.min(1, D.t / D.dur); m.x = D.x0 + (D.x1 - D.x0) * k; m.z = D.z0 + (D.z1 - D.z0) * k; if (k >= 1) m.dash = null; continue; }
      const homeD = Math.hypot(m.x - m.hx, m.z - m.hz), leash = m.raidBoss ? 1e9 : m.boss ? 22 : 30, reach = reachOf(m);
      let mx = 0, mz = 0, sp = 0;
      if (m.stun > 0) {}
      else if (m.ret) { const hx = m.hx - m.x, hz = m.hz - m.z, hd = Math.hypot(hx, hz); if (hd < 1) m.ret = false; else { mx = hx / hd; mz = hz / hd; sp = m.speed * 1.3; } m.hp = Math.min(m.max, m.hp + m.max * dt * .3); if (!m.ret) m.contrib = {}; }
      else if (tg && (m.aggro > 0 || d < m.ag)) {
        if (homeD > leash) { m.ret = true; m.aggro = 0; }
        else if (d > reach) { mx = (tg.p.x - m.x) / d; mz = (tg.p.z - m.z) / d; sp = m.speed; }
        else { m.ry = Math.atan2(tg.p.x - m.x, tg.p.z - m.z); if (m.atkCD <= 0) { m.atkCD = m.boss ? 1.4 : 1.7; m.ln++; const uid = tg.uid, rr = reach; this.later(.18, () => { const p = players.find(q => q.uid === uid); if (!m.dead && p && p.p && !p.p.d && Math.hypot(p.p.x - m.x, p.p.z - m.z) < rr + 1.4) sendTo(uid, { t: 'pa', n: m.n, m: m.raidBoss ? 1.6 : 1 }); }); } }
        if (m.boss && !m.ret && tg) this.bossAI(m, dt, d, tg, alive);
      } else {
        m.wanderT -= dt;
        if (m.wanderT <= 0) { m.wanderT = 3 + Math.random() * 4; const q = m.spot ? spotPoint(this.Z, m.spot) : [m.hx + (Math.random() - .5) * 16, m.hz + (Math.random() - .5) * 16]; m.wx = q[0]; m.wz = q[1]; }
        const wx = m.wx - m.x, wz = m.wz - m.z, wd = Math.hypot(wx, wz); if (wd > .6) { mx = wx / wd; mz = wz / wd; sp = m.speed * .3; }
      }
      if (sp > 0) { m.x += mx * sp * dt; m.z += mz * sp * dt; m.ry = Math.atan2(mx, mz); }
      for (const o of this.mobs) { if (o === m || o.dead) continue; const ox = m.x - o.x, oz = m.z - o.z, od = Math.hypot(ox, oz), mn = .9; if (od < mn && od > 1e-3) { m.x += ox / od * (mn - od) * .5; m.z += oz / od * (mn - od) * .5; } }
      if (inLake(this.Z, m.x, m.z, 0)) { const L = this.Z.lake, lx = m.x - L[0], lz = m.z - L[1], ld = Math.hypot(lx, lz) || 1; m.x = L[0] + lx / ld * L[2]; m.z = L[1] + lz / ld * L[2]; }
      m.x = Math.max(-110, Math.min(110, m.x)); m.z = Math.max(-110, Math.min(110, m.z));
    }
  }

  bossAI(m, dt, d, tg, alive) {
    const K = m.raidBoss ? { list: RAID_LIST, adds: 'siervo', enrage: true } : BOSSK[m.type];
    const f = m.hp / m.max;
    if (!K) { m.bcd -= dt; if (m.bcd <= 0 && d < 9) { m.bcd = R(6, 8); this.ab(m, 'slam', tg, alive); } return; }
    if (K.adds && !m.add1 && f < (m.raidBoss ? .7 : .65)) { m.add1 = 1; this.adds(m, K.adds, m.raidBoss ? 2 + alive.length : 3); }
    if (!m.add2 && f < (m.raidBoss ? .4 : .3)) { m.add2 = 1; if (K.adds) this.adds(m, K.adds, m.raidBoss ? 3 + alive.length : 4);
      if (K.enrage) { m.enraged = true; m.speed = MOBS[m.type].sp * 1.45; this.emit({ t: 'sys', m: MOBS[m.type].n + ' entra en furia' }); } }
    if (m.raidBoss && !m.rain && f < .4) { m.rain = 1; } // desde el 40 %: lluvia sobre todos
    m.bcd -= dt; if (m.bcd > 0 || m.stun > 0 || d > (m.raidBoss ? 40 : 15)) return;
    const ab = K.list[(m.rot = (m.rot || 0) + 1) % K.list.length];
    m.bcd = m.raidBoss ? (m.enraged ? R(2.2, 2.8) : R(3, 3.8)) : (m.enraged ? R(3.2, 4.2) : R(4.5, 6));
    this.ab(m, ab, tg, alive);
    if (m.raidBoss && m.rain) for (const p of alive) this.ab(m, 'stampede', p, alive, true);
  }
  adds(m, type, n) {
    this.emit({ t: 'sys', m: MOBS[m.type].n + ' llama a sus criaturas' });
    for (let i = 0; i < n; i++) { const a = i / n * TAU + Math.random(), x = m.x + Math.sin(a) * 4, z = m.z + Math.cos(a) * 4; const s = this.add(type, x, z, { summon: true, aggro: 12, respawn: 9999, lvl: m.raidBoss ? Math.max(1, this.raidL - 4) : 0 }); if (s) { s.hx = m.hx; s.hz = m.hz; } }
  }
  ab(m, ab, tg, alive, quiet) {
    const x = m.x, z = m.z, px = tg.p.x, pz = tg.p.z, a = Math.atan2(px - x, pz - z), rb = m.raidBoss ? 1.6 : 1;
    if (ab === 'slam') { m.stun = 1.1; this.tele(m, ab, { t: 'circle', r: m.raidBoss ? 6.5 : 4.8 }, x, z, 1, 2.2 * rb); }
    else if (ab === 'quake') { m.stun = 1.5; this.tele(m, ab, { t: 'ring', r0: 2.6, r1: m.raidBoss ? 12 : 8.5 }, x, z, 1.4, 2 * rb); }
    else if (ab === 'lash') { m.stun = 1.2; m.ry = a; this.tele(m, ab, { t: 'line', w: 2.4, len: 13, a }, x, z, 1, 1.6 * rb); }
    else if (ab === 'charge') { const len = Math.min(16, Math.hypot(px - x, pz - z) + 5); m.stun = .95 + len / 22; m.ry = a; this.tele(m, ab, { t: 'line', w: 2.8, len, a }, x, z, .9, 2 * rb);
      this.later(.9, () => { if (!m.dead) m.dash = { x0: x, z0: z, x1: x + Math.sin(a) * len, z1: z + Math.cos(a) * len, t: 0, dur: len / 22 }; }); }
    else if (ab === 'stampede') { if (!quiet) m.stun = 1.2; for (let i = 0; i < (quiet ? 3 : 5); i++) { const aa = Math.random() * TAU, r = i ? R(1.5, 5) : 0; this.tele(m, ab, { t: 'circle', r: 1.9 }, px + Math.sin(aa) * r, pz + Math.cos(aa) * r, 1.1, 1.1 * rb, i * .18); } }
    else if (ab === 'poison') { m.stun = 1; for (let i = 0; i < 3; i++) { const aa = Math.random() * TAU, r = i ? R(2, 4.5) : 0; this.tele(m, ab, { t: 'circle', r: 2.4 }, px + Math.sin(aa) * r, pz + Math.cos(aa) * r, 1.2, .35 * rb); } }
    else if (ab === 'sweep') { m.stun = 1.3; m.ry = a; this.tele(m, ab, { t: 'cone', r: m.raidBoss ? 10 : 8, a, half: 1.05 }, x, z, 1.1, 1.8 * rb); }
    else if (ab === 'dive') { m.stun = 2.6; this.later(.6, () => { if (m.dead) return; m.x = px; m.z = pz; this.tele(m, ab, { t: 'circle', r: 3.3 }, px, pz, 1.3, 2.2 * rb); }); }
  }
}
