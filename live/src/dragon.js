// Dragón Dorado: jefe de mundo del evento "Apertura del Reino". Vive en el servidor (nadie puede hacer trampa con su vida):
// aparece fuera de las murallas de Asunción en los horarios del evento, su vida crece con cada jugador que le pega,
// tiene tres fases (100 %, 50 % y 20 %) y se va volando si no lo derrotan a tiempo.
// Los ataques se avisan con el mismo mensaje 'tele' de los otros jefes; el daño es un porcentaje de la vida del jugador
// (pc), así es peligroso para todos los niveles.
import { mobStats } from './sim.js';

export const DR = {
  type: 'dragondorado', nid: 900001, zone: 'asuncion', home: [8, 68], arena: 30, wall: 46,
  from: [2026, 12, 1], to: [2026, 12, 14], hours: [9, 13, 17, 21], tz: -3, // cuatro veces por día (mañana, siesta, tarde y noche), hora de Paraguay
  limit: 1800, warn: 300, share: 14, col: 0xff3a0a,
};
const R = (a, b) => a + Math.random() * (b - a), TAU = Math.PI * 2;
const angd = (a, b) => { const d = a - b; return Math.atan2(Math.sin(d), Math.cos(d)); };

// ventana del evento que toca ahora (desde el aviso previo hasta que vence el tiempo), o null
export function dragonWindow(now, cfg) {
  cfg = cfg || DR; const d0 = Date.UTC(cfg.from[0], cfg.from[1] - 1, cfg.from[2]), d1 = Date.UTC(cfg.to[0], cfg.to[1] - 1, cfg.to[2]);
  for (let d = d0; d <= d1; d += 864e5) for (const h of cfg.hours) { const start = d + (h - cfg.tz) * 36e5; if (now >= start - cfg.warn * 1000 && now < start + cfg.limit * 1000) return { start, end: start + cfg.limit * 1000 }; }
  return null;
}

export class Dragon {
  constructor(opts) {
    opts = opts || {}; this.n = DR.nid; this.x = DR.home[0]; this.z = DR.home[1]; this.ry = Math.PI; // mira hacia la puerta de la ciudad
    this.max = this.hp = mobStats(60, true) * 4; this.parts = new Map(); this.contrib = {}; this.names = {};
    this.t = 0; this.test = !!opts.test; this.limit = opts.limit || DR.limit; this.phase = 1; this.dead = false; this.deadT = 0; this.gone = false; this.fled = false;
    this.stun = 5.2; this.bcd = 7; this.atkCD = 0; this.rot = 0; this.dash = null; this.ln = 0; this.idle = 0; this.pend = []; this.out = [];
    this.tele('d_llega', { t: 'circle', r: 9 }, this.x, this.z, 1.9, 0, 0, { pc: .5 });
  }
  entry() { return [this.n, DR.type, Math.round(this.x * 10), Math.round(this.z * 10), Math.round(this.ry * 100), Math.max(0, Math.round(this.hp)), Math.round(this.max), (this.dead ? 1 : 0) | (this.phase >= 3 ? 32 : 0), this.ln % 100, 0]; }
  state() { return { t: 'wbs', e: this.gone ? null : this.entry(), ph: this.phase, left: Math.max(0, Math.round(this.limit - this.t)), np: this.parts.size, age: Math.round(this.t * 10) / 10 }; }
  emit(o) { this.out.push(o); }
  later(dt, fn) { this.pend.push({ at: this.t + dt, fn }); }
  tele(ab, f, x, z, dur, pc, delay, extra) { this.emit({ t: 'tele', n: this.n, ab, f, x: +x.toFixed(2), z: +z.toFixed(2), dur, m: 1, d: delay || 0, col: DR.col, pc, ...(extra || {}) }); }
  fwd(d, a) { a = a == null ? this.ry : a; return [this.x + Math.sin(a) * d, this.z + Math.cos(a) * d]; }
  okSpot(x, z) { return Math.hypot(x - DR.home[0], z - DR.home[1]) <= DR.arena + 4 && Math.hypot(x, z) >= DR.wall; }

  join(uid, L, name) {
    if (this.parts.has(uid) || this.parts.size >= 80) return;
    const share = mobStats(Math.max(20, Math.min(200, L | 0)), true) * DR.share; this.parts.set(uid, share); if (name) this.names[uid] = name;
    this.max += share; this.hp += share; // la vida ya quitada no se pierde: se suma la parte del que llega
  }
  hit(uid, d, L, name) {
    if (this.dead || this.gone) return;
    { const b = (this.rate ||= {}), r = b[uid] || (b[uid] = { n: 0, t: this.t }); if (this.t - r.t > 1) { r.t = this.t; r.n = 0; } if (++r.n > 14) return; } // como mucho 14 golpes por segundo por jugador
    this.join(uid, L, name);
    d = Math.max(0, Math.min(5e6, +d || 0)); this.hp -= d; this.contrib[uid] = (this.contrib[uid] || 0) + d; this.idle = 0;
    if (this.hp <= 0) this.kill();
  }
  top(n) { return Object.entries(this.contrib).sort((a, b) => b[1] - a[1]).slice(0, n || 10).map(([uid, d]) => ({ id: uid, n: this.names[uid] || '?', d: Math.round(d) })); }
  kill() {
    this.dead = true; this.hp = 0; this.deadT = 0; this.dash = null; this.pend = [];
    const c = {}; for (const k in this.contrib) c[k] = Math.round(this.contrib[k]);
    this.emit({ t: 'mk', n: this.n, c, x: +this.x.toFixed(1), z: +this.z.toFixed(1), wb: 1 });
    this.emit({ t: 'wbk', top: this.top(10), np: this.parts.size, secs: Math.round(this.t) });
  }

  step(dt, players) {
    this.t += dt;
    for (let i = this.pend.length - 1; i >= 0; i--) if (this.pend[i].at <= this.t) { const p = this.pend.splice(i, 1)[0]; try { p.fn(); } catch (e) {} }
    if (this.dead) { this.deadT += dt; if (this.deadT > 25) this.gone = true; return; }
    if (this.t > this.limit) { this.gone = this.fled = true; this.emit({ t: 'wbf' }); return; }
    // jugadores en pelea: vivos, fuera de las murallas y cerca del campo
    const near = players.filter(p => p.p && !p.p.d && Math.hypot(p.p.x, p.p.z) > 38 && Math.hypot(p.p.x - DR.home[0], p.p.z - DR.home[1]) < 70);
    const f = this.hp / this.max;
    if (this.phase === 1 && f < .5) { this.phase = 2; this.stun = Math.max(this.stun, 2.8); this.bcd = 3; this.tele('d_rugido', { t: 'circle', r: 1 }, this.x, this.z, .1, 0); this.emit({ t: 'wbp', ph: 2 }); }
    else if (this.phase === 2 && f < .2) { this.phase = 3; this.stun = Math.max(this.stun, 2.8); this.bcd = 3; this.tele('d_rugido', { t: 'circle', r: 1 }, this.x, this.z, .1, 0); this.emit({ t: 'wbp', ph: 3 }); }
    if (this.dash) { const D = this.dash; D.t += dt; const k = Math.min(1, D.t / D.dur), s = k * k * (3 - 2 * k); this.x = D.x0 + (D.x1 - D.x0) * s; this.z = D.z0 + (D.z1 - D.z0) * s; if (k >= 1) this.dash = null; }
    if (this.stun > 0) { this.stun -= dt; return; }
    if (!near.length) { // nadie pelea: vuelve a su lugar y, pasado un rato, se cura
      this.idle += dt; if (this.idle > 15) this.hp = Math.min(this.max, this.hp + this.max * .02 * dt);
      const hx = DR.home[0] - this.x, hz = DR.home[1] - this.z, hd = Math.hypot(hx, hz); if (hd > 1) { this.turn(Math.atan2(hx, hz), dt); this.x += hx / hd * 3 * dt; this.z += hz / hd * 3 * dt; }
      return;
    }
    this.idle = 0;
    let tg = null, d = 1e9; for (const p of near) { const dd = Math.hypot(p.p.x - this.x, p.p.z - this.z); if (dd < d) { d = dd; tg = p; } }
    const want = Math.atan2(tg.p.x - this.x, tg.p.z - this.z), off = Math.abs(angd(want, this.ry));
    this.turn(want, dt);
    const sp = this.phase >= 3 ? 4.2 : this.phase === 2 ? 3.6 : 3.1;
    if (d > 13 && off < 1) { const nx = this.x + Math.sin(this.ry) * sp * dt, nz = this.z + Math.cos(this.ry) * sp * dt; if (this.okSpot(nx, nz)) { this.x = nx; this.z = nz; } }
    this.bcd -= dt; this.atkCD -= dt;
    if (this.bcd <= 0) { this.bcd = this.phase >= 3 ? R(2.2, 3) : this.phase === 2 ? R(3.2, 4.2) : R(4.5, 6); this.pick(near, tg, d, off); }
    else if (this.atkCD <= 0 && this.under(near)) { this.atkCD = 4.5; this.ab(this.ln++ % 3 === 2 ? 'brasa' : 'pisa', tg, near); } // nadie está a salvo debajo del cuerpo
    else if (this.atkCD <= 0 && d > 11 && d < 25 && off < .45) { this.atkCD = 3.2; this.ab('mord', tg, near); }
  }
  // jugadores pegados al cuerpo (debajo o entre las patas)
  under(near) { let n = 0; const c = this.fwd(1); for (const p of near) if (Math.hypot(p.p.x - c[0], p.p.z - c[1]) < 11) n++; return n; }
  turn(want, dt) { const da = angd(want, this.ry), mx = (this.phase >= 3 ? 2.2 : 1.6) * dt; this.ry += Math.max(-mx, Math.min(mx, da)); }
  pick(near, tg, d, off) {
    const behind = near.filter(p => Math.hypot(p.p.x - this.x, p.p.z - this.z) < 24 && Math.abs(angd(Math.atan2(p.p.x - this.x, p.p.z - this.z), this.ry)) > 1.9).length;
    const L = this.phase === 1 ? ['zarpa', 'fuego', 'cola', 'carga'] : this.phase === 2 ? ['fuego', 'zarpa', 'lluvia', 'cola', 'carga', 'fuego', 'lluvia'] : ['fuego', 'lluvia', 'carga', 'cola', 'zarpa', 'lluvia'];
    let ab = L[this.rot++ % L.length];
    if (this.under(near) && Math.random() < .35) return this.ab(Math.random() < .5 ? 'brasa' : 'pisa', tg, near);
    if (behind && ab !== 'lluvia' && Math.random() < .65) ab = 'cola';
    else if (ab === 'cola' && !behind) ab = d < 15 ? 'zarpa' : 'fuego';
    if (ab === 'zarpa' && d > 17) ab = 'fuego';
    if (ab === 'fuego' && d > 34) ab = 'carga';
    // con varios jugadores no siempre apunta al más cercano
    if ((ab === 'fuego' || ab === 'carga') && near.length > 1 && Math.random() < .5) tg = near[Math.floor(Math.random() * near.length)];
    this.ab(ab, tg, near);
    if (this.phase >= 3 && ab !== 'lluvia') this.rain(near, Math.min(4, near.length), .6);
  }
  ab(ab, tg, near) {
    const a = Math.atan2(tg.p.x - this.x, tg.p.z - this.z), big = this.phase >= 3 ? 1.15 : 1;
    if (ab === 'fuego') { this.ry = a; this.stun = 3.6; const q = this.fwd(11); this.tele('d_fuego', { t: 'cone', r: 23, a, half: .62 }, q[0], q[1], 1.15, .26 * big, 0, { tk: 4, ti: .45 }); }
    else if (ab === 'zarpa') { this.ry = a; this.stun = 1.7; const q = this.fwd(8); this.tele('d_zarpa', { t: 'cone', r: 12, a: a - .3, half: .9 }, q[0], q[1], .88, .55 * big); }
    else if (ab === 'pisa') { this.stun = 2; const q = this.fwd(1); this.tele('d_pisa', { t: 'circle', r: 10.5 }, q[0], q[1], 1, .6 * big); }
    else if (ab === 'brasa') { this.stun = 3.4; const q = this.fwd(-1); this.tele('d_brasa', { t: 'circle', r: 14 }, q[0], q[1], 1.56, .4 * big, 0, { bz: 6, bpc: .1 }); }
    else if (ab === 'mord') { this.stun = 1.3; this.ln++; const q = this.fwd(20.5); this.tele('d_mord', { t: 'circle', r: 4.6 }, q[0], q[1], .65, .4 * big); }
    else if (ab === 'cola') { this.stun = 2.3; const q = this.fwd(-5); this.tele('d_cola', { t: 'cone', r: 25, a: this.ry + Math.PI, half: 1.95 }, q[0], q[1], 1.15, .7 * big); }
    else if (ab === 'carga') {
      let len = 26; const e = this.fwd(len, a); if (!this.okSpot(e[0], e[1])) { // no se sale del campo ni entra a la ciudad: si no hay lugar, escupe fuego
        const h = Math.atan2(DR.home[0] - this.x, DR.home[1] - this.z), e2 = this.fwd(len, h); if (Math.abs(angd(h, a)) < .9 && this.okSpot(e2[0], e2[1])) return this.charge(h, len, big); return this.ab('fuego', tg, near); }
      this.charge(a, len, big);
    }
    else if (ab === 'lluvia') { this.stun = 4; this.tele('d_lluvia', { t: 'circle', r: 1 }, this.x, this.z, .1, 0); this.rain(near, 10, .08); }
  }
  charge(a, len, big) {
    this.ry = a; this.stun = 2.5; const q = this.fwd(9), x0 = this.x, z0 = this.z;
    this.tele('d_carga', { t: 'line', w: 10, len: len + 8, a }, q[0], q[1], .9, .8 * big);
    this.later(.9, () => { if (!this.dead) this.dash = { x0, z0, x1: x0 + Math.sin(a) * len, z1: z0 + Math.cos(a) * len, t: 0, dur: 1.35 }; });
  }
  // meteoros de oro: caen sobre los jugadores (y alrededor) y dejan el suelo en llamas
  rain(near, n, t0) {
    const big = this.phase >= 3 ? 1.15 : 1;
    for (let j = 0; j < n; j++) { const p = near[j % near.length].p, own = j < near.length, aa = Math.random() * TAU, r = own ? R(0, 1.5) : R(4, 11);
      this.tele('d_meteoro', { t: 'circle', r: 3.4 }, p.x + Math.sin(aa) * r, p.z + Math.cos(aa) * r, 1.6, .45 * big, t0 + j * .14, { bz: 7, bpc: .09 }); }
  }
}
