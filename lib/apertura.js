// NOX · evento «Apertura del Reino» (1 al 14 de diciembre de 2026, hora de Paraguay). Lo usa solo el servidor (functions/api);
// el juego tiene su propia copia para dibujar el panel (APE en public/jugar/index.html): si se cambia algo acá, cambiarlo allá.
export const APE_T0 = Date.UTC(2026, 11, 1, 3);          // 1/12/2026 00:00 en Paraguay (UTC-3)
export const APE_DAYS = 14;
export const APE_T1 = APE_T0 + APE_DAYS * 864e5;         // fin del evento
export const APE_GRACE = APE_T0 + 31 * 864e5;            // hasta el 31/12 se pueden retirar premios pendientes (Noxis de nivel 50, metas, carrera)
export const APE_LVL = 50;                               // los Noxis del evento se acreditan cuando la cuenta tiene un personaje de este nivel (o con reinicio)
export const APE_LMAX = 200;                             // un reinicio vale 200 niveles en la carrera
export const APE_PION = 100, APE_KILLS = 100000;         // metas del reino
// regalo de cada día: gem = gemas al baúl ({tipo: cantidad}), nx = Noxis, own = artículos de la tienda (título, marco, estela)
export const APE_CAL = [
  { own: { t_pionero: 1 }, label: 'Título Pionero del Reino' },
  { gem: { tupa: 10 }, label: '10 Gemas de Tupã' },
  { nx: 100, label: '100 Noxis' },
  { gem: { jasy: 10 }, label: '10 Gemas de Jasy' },
  { own: { m_pionero: 1 }, label: 'Marco de aurora' },
  { gem: { yvy: 10 }, label: '10 Gemas de Yvy' },
  { nx: 500, label: '500 Noxis' },
  { gem: { kerana: 15 }, label: '15 Gemas de Kerana' },
  { nx: 150, label: '150 Noxis' },
  { gem: { tupa: 5, jasy: 5, yvy: 5, kerana: 5 }, label: '20 gemas surtidas' },
  { nx: 250, label: '250 Noxis' },
  { gem: { mainumby: 3 }, label: '3 Plumas de Mainumby' },
  { gem: { tupa: 7, jasy: 7, yvy: 7, kerana: 7 }, label: '28 gemas surtidas' },
  { own: { e_aurora: 1 }, label: 'Estela Aurora de la Apertura' },
];
export const APE_GEM = { tupa: 'Gema de Tupã', jasy: 'Gema de Jasy', yvy: 'Gema de Yvy', kerana: 'Gema de Kerana', mainumby: 'Pluma de Mainumby' };
// premios fuera del calendario
export const APE_GUARD = { own: { t_guardian: 1, m_guardian: 1 }, label: 'Título y marco Guardián de la Beta' };           // cuentas creadas antes del evento
export const APE_META1 = { own: { p_imp_aurora: 1, p_hada_aurora: 1, p_rudolf_aurora: 1 }, label: 'Aspecto Aurora para tus mascotas' }; // 100 pioneros
export const APE_META2 = { gem: { tupa: 8, jasy: 8, yvy: 8, kerana: 8, mainumby: 1 }, label: 'Cofre del Reino' };          // 100.000 criaturas
export const APE_TOP = { own: { t_primeros: 1, m_primeros: 1 }, nx: 2000, label: 'Título y marco Primeros del Reino y 2.000 Noxis' }; // 10 primeros de la carrera
export const apeDay = t => { const d = Math.floor((t - APE_T0) / 864e5) + 1; return d < 1 ? 0 : d > APE_DAYS ? APE_DAYS + 1 : d; };
