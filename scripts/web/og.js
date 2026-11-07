// Imagen para compartir (og.jpg, 1200x630): una invitación con el logo, los personajes y el llamado a jugar. Uso: node og.js [BASE] [salida]
const {chromium}=require('playwright');const path=require('path');
const BASE=process.argv[2]||'http://localhost:8788/';const OUT=process.argv[3]||path.join(__dirname,'../../web/img/w/og-invita.jpg');
const STARS=Array.from({length:70},(_,i)=>{const r=n=>((Math.sin(i*12.9898+n*78.233)*43758.5453)%1+1)%1;return `<i style="left:${(r(1)*1200)|0}px;top:${(r(2)*630)|0}px;opacity:${(.25+r(3)*.6).toFixed(2)};width:${(1+r(4)*2).toFixed(1)}px;height:${(1+r(4)*2).toFixed(1)}px"></i>`;}).join('');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:630}});
  await p.route('**/*',r=>{const u=r.request().url();if(u.startsWith(BASE)||/fonts\./.test(u))return r.continue();return r.abort();});
  await p.goto(BASE,{waitUntil:'load'});
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Cormorant+Garamond:ital,wght@0,600;1,500;1,600&family=Alegreya+Sans:wght@500;700&display=swap">
  <style>
  *{box-sizing:border-box}body{margin:0;width:1200px;height:630px;overflow:hidden;position:relative;color:#f1e7d6;font-family:"Alegreya Sans",sans-serif;
    background:radial-gradient(ellipse 620px 420px at 840px 400px,rgba(226,168,63,.32),transparent 70%),radial-gradient(ellipse 500px 360px at 230px 250px,rgba(90,100,220,.25),transparent 70%),linear-gradient(160deg,#23275c 0%,#1a1d47 45%,#0c0e28 100%)}
  .st i{position:absolute;border-radius:50%;background:#fff6dc}
  .frame{position:absolute;inset:18px;border:2px solid #e2a83f;border-radius:18px;box-shadow:inset 0 0 0 6px rgba(12,14,40,.0),inset 0 0 0 7px rgba(246,216,146,.35)}
  .frame b{position:absolute;width:26px;height:26px;border:3px solid #f6d892;transform:rotate(45deg);background:#1a1d47}
  .frame b:nth-child(1){left:-15px;top:-15px}.frame b:nth-child(2){right:-15px;top:-15px}.frame b:nth-child(3){left:-15px;bottom:-15px}.frame b:nth-child(4){right:-15px;bottom:-15px}
  .crew{position:absolute;right:-6px;bottom:30px;height:485px;width:760px;background:url(${BASE}img/w/hero_portadores.webp) 62% 100%/auto 100% no-repeat;
    -webkit-mask:linear-gradient(90deg,transparent 0,#000 22%,#000 92%,transparent 100%)}
  .floor{position:absolute;right:40px;bottom:30px;width:700px;height:60px;background:radial-gradient(ellipse at center,rgba(0,0,0,.55),transparent 70%)}
  .t{position:absolute;left:62px;top:52px;width:470px}
  .k{font-family:Cinzel,serif;font-weight:700;font-size:17px;letter-spacing:.22em;color:#f6d892;display:flex;align-items:center;gap:12px}.k::before,.k::after{content:"";height:1px;width:34px;background:#e2a83f}
  .inv{font-family:"Cormorant Garamond",serif;font-style:italic;font-weight:600;font-size:46px;color:#fff3d8;margin:16px 0 0;line-height:1}
  .logo{display:block;width:440px;margin:-6px 0 -10px -14px;filter:drop-shadow(0 6px 18px rgba(0,0,0,.6))}
  p{font-size:22px;line-height:1.35;margin:4px 0 20px;max-width:430px;color:#efe4cf}p b{color:#f6d892}
  .cta{display:inline-flex;align-items:center;gap:12px;background:linear-gradient(180deg,#f8df9c,#e2a83f);color:#1d1208;font-weight:700;font-size:24px;padding:14px 30px;border-radius:999px;box-shadow:0 6px 24px rgba(226,168,63,.45)}
  .cta s{text-decoration:none;font-size:20px;opacity:.75;font-weight:500}
  .pl{margin-top:16px;font-size:16px;letter-spacing:.06em;color:#cfc3e8}
  </style></head><body><div class="st">${STARS}</div><div class="floor"></div><div class="crew"></div><div class="frame"><b></b><b></b><b></b><b></b></div>
  <div class="t"><div class="k">Invitación</div><div class="inv">Te invito a jugar</div><img class="logo" src="${BASE}img/logo.webp">
  <p>Elegí tu clase, armá tu grupo y enfrentá a los <b>mitos guaraníes</b>. La Noche Larga te espera.</p>
  <span class="cta">Jugá gratis <s>· noxparaguay.com</s></span><div class="pl">ANDROID · IPHONE · WINDOWS · MAC · NAVEGADOR</div></div></body></html>`,{waitUntil:'load'});
  await p.evaluate(()=>document.fonts.ready);await new Promise(r=>setTimeout(r,1200));await p.screenshot({path:OUT,type:'jpeg',quality:88});console.log('og',OUT);await b.close();})();
