// Imagen para compartir (og.jpg, 1200x630) armada con las mismas piezas de la portada. Uso: node og.js [BASE] [salida]
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
const BASE=process.argv[2]||'http://localhost:8788/';const OUT=process.argv[3]||path.join(__dirname,'../../web/img/w/og.jpg');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:630}});
  await p.route('**/*',r=>{const u=r.request().url();if(u.startsWith(BASE)||/fonts\./.test(u))return r.continue();return r.abort();});
  await p.goto(BASE,{waitUntil:'load'});
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600&family=Cormorant+Garamond:ital,wght@0,600;1,500&family=Alegreya+Sans:wght@400;700&display=swap">
  <style>body{margin:0;width:1200px;height:630px;background:#1a1d47;color:#f1e7d6;font-family:"Alegreya Sans",sans-serif;overflow:hidden;position:relative}
  .t{position:absolute;left:64px;top:70px;width:600px}.k{font-family:Cinzel,serif;font-size:15px;letter-spacing:.14em;color:#f6d892;display:flex;align-items:center;gap:10px}.k::before{content:"";width:22px;height:1px;background:#e2a83f}
  h1{font-family:"Cormorant Garamond",Georgia,serif;font-weight:600;font-size:64px;line-height:.98;margin:18px 0 20px}h1 i{color:#f6d892;font-weight:500}
  p{font-size:22px;line-height:1.4;color:#f1e7d6d0;margin:0 0 22px;max-width:30ch}.b{display:inline-block;background:linear-gradient(180deg,#f6d892,#e2a83f);color:#1d1208;font-weight:700;font-size:20px;padding:14px 28px;border-radius:999px}
  img{position:absolute;right:-40px;bottom:-10px;height:600px;filter:drop-shadow(0 20px 40px #000a)}.nox{position:absolute;left:64px;bottom:40px;font-family:Cinzel,serif;letter-spacing:.3em;font-size:18px;color:#f6d892}</style></head>
  <body><img src="${BASE}img/w/hero_portadores.webp"><div class="t"><div class="k">Un MMORPG gratis hecho en Paraguay</div><h1>La Noche Larga cayó sobre el Paraguay. <i>Vos sos quien la enfrenta.</i></h1><p>La mitología guaraní, hecha juego. Android, Windows, Mac, iPhone y navegador.</p><span class="b">noxparaguay.com</span></div><div class="nox">NOX · CRÓNICAS DEL PARAGUAY</div></body></html>`,{waitUntil:'load'});
  await new Promise(r=>setTimeout(r,1500));await p.screenshot({path:OUT,type:'jpeg',quality:88});console.log('og',OUT);await b.close();})();
