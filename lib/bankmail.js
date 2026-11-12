// NOX · lee los avisos de "Transferencia de otros bancos" de Banco Familiar (operbancaweb@familiar.com.py).
// Entra el correo crudo (MIME) tal como lo reenvía Gmail; sale { ref, amt, payer, bank, when } o null si no es un aviso de
// transferencia recibida y acreditada. El comentario del que paga no llega (probado el 12/11/2026), así que el pago se
// identifica por el monto exacto. Si el banco cambia el formato del aviso, esto devuelve null y el pago queda para aprobar a mano.

export const BANK_FROM = 'operbancaweb@familiar.com.py';

const dec = (bytes, cs) => { try { return new TextDecoder(/8859|latin|1252/i.test(cs || '') ? 'windows-1252' : 'utf-8').decode(bytes); } catch { return new TextDecoder().decode(bytes); } };
function qp(s) { const out = []; s = s.replace(/=\r?\n/g, ''); for (let i = 0; i < s.length; i++) { if (s[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(s.substr(i + 1, 2))) { out.push(parseInt(s.substr(i + 1, 2), 16)); i += 2; } else out.push(s.charCodeAt(i) & 255); } return new Uint8Array(out); }
function b64(s) { const bin = atob(s.replace(/[^A-Za-z0-9+/=]/g, '')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function split(raw) { const m = raw.match(/\r?\n\r?\n/); if (!m) return [raw, '']; return [raw.slice(0, m.index), raw.slice(m.index + m[0].length)]; }
function headers(h) { const o = {}; for (const l of h.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) { const i = l.indexOf(':'); if (i > 0) { const k = l.slice(0, i).trim().toLowerCase(); o[k] = o[k] ? o[k] + '\n' + l.slice(i + 1).trim() : l.slice(i + 1).trim(); } } return o; }
// devuelve los textos (html o plano) de todas las partes del correo, ya decodificados
function texts(raw, depth = 0) {
  const [h, body] = split(raw), H = headers(h), ct = H['content-type'] || 'text/plain';
  const bd = ct.match(/boundary="?([^";\s]+)"?/i);
  if (/^multipart\//i.test(ct) && bd && depth < 6) {
    const out = []; for (const part of body.split('--' + bd[1]).slice(1)) { if (part.startsWith('--')) break; out.push(...texts(part.replace(/^\r?\n/, ''), depth + 1)); } return out;
  }
  if (/^message\/rfc822/i.test(ct) && depth < 6) return texts(body, depth + 1);
  if (!/^text\//i.test(ct)) return [];
  const enc = (H['content-transfer-encoding'] || '').toLowerCase(), cs = (ct.match(/charset="?([^";\s]+)/i) || [])[1];
  let bytes; if (enc === 'base64') bytes = b64(body); else if (enc === 'quoted-printable') bytes = qp(body); else { bytes = new Uint8Array(body.length); for (let i = 0; i < body.length; i++) bytes[i] = body.charCodeAt(i) & 255; }
  return [dec(bytes, cs)];
}
const ent = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();
// Lee la tabla celda por celda: el valor es la celda que sigue a la etiqueta. Si una etiqueta aparece más de una vez
// (por ejemplo, un nombre de pagador armado para colar otro monto), el aviso no se acepta.
function cells(html) { const out = []; const re = /<td\b[^>]*>([\s\S]*?)<\/td>/gi; let m; const h = html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' '); while ((m = re.exec(h))) { if (/<td\b/i.test(m[1])) { re.lastIndex = m.index + 3; continue; } out.push(ent(m[1].replace(/<[^>]+>/g, ' '))); } return out; }
function field(c, re) { const idx = []; c.forEach((x, i) => { if (re.test(x)) idx.push(i); }); return idx.length === 1 && idx[0] + 1 < c.length ? c[idx[0] + 1] : null; }

// `raw` = correo completo como texto binario (un carácter por byte). Devuelve también los encabezados para que el servidor decida si confía.
export function parseBankMail(raw) {
  const [h] = split(raw), H = headers(h);
  const from = ((H['from'] || '').match(/[\w.+-]+@[\w.-]+/) || [''])[0].toLowerCase();
  const info = { from, subject: H['subject'] || '', auth: (H['authentication-results'] || '').slice(0, 600), pay: null };
  for (const tx of texts(raw)) {
    if (!/<td\b/i.test(tx)) continue;
    const flat = ent(tx.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
    if ((flat.match(/TRANSFERENCIA DE OTRAS ENTIDADES RECIBIDA/g) || []).length !== 1) continue;
    const c = cells(tx);
    const ref = field(c, /^Referencia:$/i), monto = field(c, /^Moneda y Monto:$/i), razon = field(c, /^Raz[oó]n de comunicaci[oó]n:$/i);
    const mm = (monto || '').match(/^PYG\s+(\d{1,3}(?:\.\d{3})*|\d+)$/);
    if (!ref || !/^[A-Z0-9]{12,40}$/.test(ref) || !mm || razon !== 'Transferencia acreditada en cuenta.') continue;
    const amt = +mm[1].replace(/\./g, ''); if (!(amt > 0) || amt > 5e8) continue;
    info.pay = { ref, amt, payer: (field(c, /^Cliente Pagador:$/i) || '').slice(0, 80), bank: (field(c, /^Entidad Pagadora:$/i) || '').slice(0, 60), when: (field(c, /^Fecha y hora de Operaci[oó]n:$/i) || '').slice(0, 24) };
    break;
  }
  return info;
}
