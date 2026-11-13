// NOX · entrada de correo. No decide nada: reenvía el correo crudo a la API, que es la que valida y acredita.
export default {
  async email(message, env) {
    const to = String(message.to || '').toLowerCase();
    if (env.BANK_TO && to !== String(env.BANK_TO).toLowerCase()) { message.setReject('Dirección desconocida'); return; }
    if (message.rawSize > 300000) return;
    const raw = await new Response(message.raw).arrayBuffer();
    const r = await fetch(env.API, { method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-nox-bank': env.BANK_SECRET || '', 'x-nox-envfrom': String(message.from || '') }, body: raw });
    console.log('aviso', r.status, (await r.text()).slice(0, 120));
    if (!r.ok) throw new Error('La API respondió ' + r.status); // Cloudflare reintenta la entrega
  }
};
