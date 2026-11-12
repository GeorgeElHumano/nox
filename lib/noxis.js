// NOX · tienda Noxis: la única fuente de precios y artículos. La usan la API, el servidor en vivo, el juego y la web.
// Noxis = moneda de pago (1 Noxis = 10 Gs). Solo compra cosméticos y servicios: nada de acá da poder.
// kind: gest (gesto o baile), title (título sobre el nombre), frame (marco del nombre), trail (estela),
//       pet (aspecto de mascota; `pet` dice cuál), svc (servicio: se gasta al usarlo).
// `price` en Noxis. Sin `price` = no se vende: solo llega con un pack Fundador (`f` = nivel mínimo 1 bronce, 2 plata, 3 oro).

export const NOXIS_GS = 10;

export const NX_ITEMS = [
  // gestos y bailes
  { id: 'carcajada', kind: 'gest', name: 'Carcajada señalando', desc: 'Se ríe echándose atrás y señala al rival.', price: 500 },
  { id: 'aplauso', kind: 'gest', name: 'Aplauso sarcástico', desc: 'Palmas lentas con la cabeza ladeada.', price: 400 },
  { id: 'violin', kind: 'gest', name: 'Violín chiquito', desc: 'Toca un violín diminuto.', price: 500 },
  { id: 'llora', kind: 'gest', name: 'Llorá', desc: 'Se refriega los ojos con los puños.', price: 500 },
  { id: 'hombro', kind: 'gest', name: 'Limpiarse el hombro', desc: 'Se sacude el hombro y levanta el mentón.', price: 400 },
  { id: 'bostezo', kind: 'gest', name: 'Bostezo y siesta parado', desc: 'Bosteza, se duerme y se despierta de golpe.', price: 400 },
  { id: 'robot', kind: 'gest', name: 'Baile del robot', desc: 'Brazos en ángulo recto, a golpes.', price: 700 },
  { id: 'moonwalk', kind: 'gest', name: 'Moonwalk', desc: 'Desliza los pies con la mano en el sombrero.', price: 800 },
  { id: 'dab', kind: 'gest', name: 'Dab', desc: 'El clásico.', price: 500 },
  { id: 'victoria', kind: 'gest', name: 'Victoria con giro', desc: 'Salta dando una vuelta y cae con los puños arriba.', price: 700 },
  { id: 'militar', kind: 'gest', name: 'Saludo militar burlón', desc: 'Se cuadra exagerado y menea la cabeza.', price: 400 },
  { id: 'besos', kind: 'gest', name: 'Tirar besos', desc: 'Besos a una mano y a la otra.', price: 500 },
  { id: 'fumar', kind: 'gest', name: 'Fumar', desc: 'Pitada larga y humo hacia arriba.', price: 600 },
  { id: 'polca', kind: 'gest', name: 'Polca del Fundador', desc: 'Zapateo con las manos en la cintura.', f: 1 },
  { id: 'reverencia', kind: 'gest', name: 'Reverencia del Fundador', desc: 'Reverencia larga con el brazo extendido.', f: 3 },
  // títulos
  { id: 't_cazador', kind: 'title', name: 'Cazador de Mitos', desc: 'Oro con brillo y flechas cruzadas.', price: 1000 },
  { id: 't_pombero', kind: 'title', name: 'Terror del Pombero', desc: 'Placa negra, borde violeta y ojos verdes.', price: 1000 },
  { id: 't_inmortal', kind: 'title', name: 'El Inmortal', desc: 'Letras de fuego.', price: 1500 },
  { id: 't_farmeador', kind: 'title', name: 'Farmeador Serial', desc: 'Placa esmeralda con monedas.', price: 1000 },
  { id: 't_afk', kind: 'title', name: 'AFK Profesional', desc: 'Placa de hielo con zetas.', price: 500 },
  { id: 't_terere', kind: 'title', name: 'Rey del Tereré', desc: 'Verde yerba y oro, corona y guampa.', price: 1000 },
  { id: 't_leyenda', kind: 'title', name: 'Leyenda de Asunción', desc: 'Estandarte rojo con franja tricolor.', price: 1500 },
  { id: 't_fund1', kind: 'title', name: 'Fundador', desc: 'Placa de bronce.', f: 1, only: 1 },
  { id: 't_fund2', kind: 'title', name: 'Fundador de Plata', desc: 'Placa de plata con chispas.', f: 2, only: 2 },
  { id: 't_fund3', kind: 'title', name: 'Fundador de Oro', desc: 'Placa de oro con corona.', f: 3, only: 3 },
  // marcos del nombre
  { id: 'm_filete', kind: 'frame', name: 'Filete dorado', desc: 'Dos filetes de oro.', price: 1000 },
  { id: 'm_luna', kind: 'frame', name: 'Cápsula lunar', desc: 'Cápsula azul que brilla.', price: 1500 },
  { id: 'm_brasa', kind: 'frame', name: 'Doble brasa', desc: 'Doble borde encendido.', price: 2000 },
  { id: 'm_estrellas', kind: 'frame', name: 'Estrellas', desc: 'Estrellas violetas a los lados.', price: 3000 },
  { id: 'm_fund1', kind: 'frame', name: 'Marco de bronce', desc: 'Marco Fundador.', f: 1, only: 1 },
  { id: 'm_fund2', kind: 'frame', name: 'Marco de plata', desc: 'Marco Fundador de Plata.', f: 2, only: 2 },
  { id: 'm_fund3', kind: 'frame', name: 'Marco de oro', desc: 'Marco Fundador de Oro.', f: 3, only: 3 },
  // estelas
  { id: 'e_oro', kind: 'trail', name: 'Polvo dorado', desc: 'Rastro de polvo de oro al caminar y volar.', price: 1500 },
  { id: 'e_luna', kind: 'trail', name: 'Rastro lunar', desc: 'Rastro azul de luna.', price: 2000 },
  { id: 'e_brasas', kind: 'trail', name: 'Brasas', desc: 'Brasas que quedan en el aire.', price: 3000 },
  { id: 'e_fund', kind: 'trail', name: 'Estela del Fundador', desc: 'Oro con destellos blancos.', f: 3 },
  // aspectos de mascota
  { id: 'p_imp_azul', kind: 'pet', pet: 'imp', name: 'Imp azul', desc: 'Tu Imp, en azul.', price: 1000 },
  { id: 'p_hada_oro', kind: 'pet', pet: 'hada', name: 'Hada dorada', desc: 'Tu Hada, en dorado.', price: 1500 },
  { id: 'p_rudolf_nav', kind: 'pet', pet: 'rudolf', name: 'Rudolf navideño', desc: 'Nariz roja y luces en la cornamenta.', price: 1500 },
  { id: 'p_imp_fund', kind: 'pet', pet: 'imp', name: 'Imp del Fundador', desc: 'Imp negro y oro.', f: 2 },
  // servicios (se gastan al usarlos)
  { id: 's_nombre', kind: 'svc', name: 'Cambio de nombre', desc: 'Cambiá el nombre de un personaje.', price: 1000 },
  { id: 's_apariencia', kind: 'svc', name: 'Cambio de apariencia', desc: 'Elegí de nuevo la cara de un personaje.', price: 1000 },
  { id: 's_puntos', kind: 'svc', name: 'Reorganizar puntos', desc: 'Te devuelve todos los puntos de un personaje para repartirlos de nuevo.', price: 1000 },
];

// Recargas (precio en guaraníes) y packs Fundador. `f` = nivel de Fundador que da.
export const NX_PACKS = [
  { id: 'nx500', name: '500 Noxis', gs: 5000, nx: 500 },
  { id: 'nx1050', name: '1.050 Noxis', gs: 10000, nx: 1050, bonus: 5 },
  { id: 'nx2750', name: '2.750 Noxis', gs: 25000, nx: 2750, bonus: 10 },
  { id: 'nx5750', name: '5.750 Noxis', gs: 50000, nx: 5750, bonus: 15 },
  { id: 'nx12000', name: '12.000 Noxis', gs: 100000, nx: 12000, bonus: 20 },
  { id: 'nx25000', name: '25.000 Noxis', gs: 200000, nx: 25000, bonus: 25 },
  { id: 'fund1', name: 'Pack Fundador Bronce', gs: 30000, nx: 3000, f: 1 },
  { id: 'fund2', name: 'Pack Fundador Plata', gs: 75000, nx: 8500, f: 2, extra: { s_nombre: 1 } },
  { id: 'fund3', name: 'Pack Fundador Oro', gs: 150000, nx: 18000, f: 3, extra: { s_nombre: 1, s_puntos: 1 } },
];

// Fecha en que dejan de venderse los packs Fundador (ms desde 1970). 0 = sin fecha todavía.
export const NX_FOUNDER_END = 0;

// Datos para pagar por transferencia (antes estaban en la página de la cuenta).
export const NX_PAY = { whatsapp: '595981187259', bank: 'Banco Itaú Paraguay\nCuenta N.º 212128\nTitular: Jorge Duarte\nCI 4804865 · RUC 4804865-8 (alias)' };

export const NX_BY = new Map(NX_ITEMS.map(i => [i.id, i]));
export const NX_PACK = new Map(NX_PACKS.map(p => [p.id, p]));
export const nxFounderLevel = own => { let f = 0; for (const p of NX_PACKS) if (p.f && own && own[p.id]) f = Math.max(f, p.f); return f; };

// Lo que entrega un pack a una cuenta que ya tiene `own`. Un Fundador más alto se paga por la diferencia con el que ya se tiene.
export function nxPackGrant(pack, own) {
  if (!pack.f) return { gs: pack.gs, nx: pack.nx, items: {} };
  const have = nxFounderLevel(own); if (have >= pack.f) return null;
  const prev = NX_PACKS.find(p => p.f === have);
  const items = {};
  for (const it of NX_ITEMS) if (it.f && it.f <= pack.f && !(own && own[it.id]) && !(it.only && it.only !== pack.f)) items[it.id] = 1;
  for (const [k, n] of Object.entries(pack.extra || {})) { const got = prev && prev.extra && prev.extra[k] || 0; if (n - got > 0) items[k] = n - got; }
  items[pack.id] = 1;
  return { gs: pack.gs - (prev ? prev.gs : 0), nx: pack.nx - (prev ? prev.nx : 0), items };
}
