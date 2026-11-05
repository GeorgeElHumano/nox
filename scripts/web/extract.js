// Saca los datos de la web directamente del juego (window.__NOX.GAMEDATA) y escribe data.json
// Uso: node extract.js SALIDA.json [BASE_URL]   (BASE por defecto http://localhost:8788/jugar/)
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const OUT=process.argv[2]||path.join(__dirname,'../../web/data.json');const BASE=process.argv[3]||process.env.BASE||'http://localhost:8788/jugar/';
const VENDOR=process.env.VENDOR||path.join(__dirname,'../../desktop/vendor');
const MAP={'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js':VENDOR+'/three.min.js'};
for(const f of ['loaders/GLTFLoader.js','utils/SkeletonUtils.js','shaders/CopyShader.js','shaders/LuminosityHighPassShader.js','postprocessing/EffectComposer.js','postprocessing/RenderPass.js','postprocessing/ShaderPass.js','postprocessing/UnrealBloomPass.js'])MAP['https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/'+f]=VENDOR+'/examples/'+f;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage();
  await p.route('**/*',r=>{const u=r.request().url();if(MAP[u])return r.fulfill({path:MAP[u],contentType:'application/javascript'});if(u.startsWith(BASE.slice(0,BASE.indexOf('/',8))))return r.continue();return r.abort();});
  await p.goto(BASE,{waitUntil:'commit',timeout:120000});
  for(let i=0;i<200;i++){if(await p.evaluate(()=>!!(window.__NOX&&window.__NOX.GAMEDATA)).catch(()=>false))break;await wait(500);}
  const D=await p.evaluate(()=>{const G=window.__NOX.GAMEDATA;const hex=h=>'#'+h.toString(16).padStart(6,'0');
    const ZK=Object.keys(G.ZONES).filter(k=>k!=='studio');const zones={};for(const k of ZK){const z=G.ZONES[k];zones[k]={name:z.name,sub:z.sub,lvl:z.lvl,cost:z.cost,spots:(z.spots||[]).map(s=>[s.n,s.m]),portals:(z.portals||[]).map(p=>p[2])};}
    const mobs={};for(const [k,m] of Object.entries(G.MOBS)){const zs=ZK.filter(z=>(G.ZONES[z].spots||[]).some(s=>s.m===k)||(G.ZONES[z].boss&&G.ZONES[z].boss[0]===k)||m.zone===z);mobs[k]={name:m.name,lvl:m.lvl,boss:!!m.boss,ficha:(G.MYTH[k]&&G.MYTH[k].ficha)||m.ficha||'',zones:zs};}
    const cls={};for(const [k,c] of Object.entries(G.CLASSES)){cls[k]={name:c.name,evo:c.evo,base:c.base,desc:c.desc,hint:c.hint,unlock:c.unlock||null,
      skills:(G.CSK[k]||[]).map(id=>{const s=G.SKILLS[id];return {cls:k,name:s.name,lvl:s.lvl,evo:!!s.evo,mp:s.mp,desc:s.desc};}),
      sets:G.SETN[k].map((n,i)=>({n,col:hex(G.TIERGLOW[k][i])})),w:G.WNAME[k],slots:G.SLOTN[k],wn:G.WINGN[k],wn2:G.WINGN2[k]};}
    const loot={};for(const [k,L] of Object.entries(G.LOOTDEF)){if(!L||L.length<3)continue;loot[k]={t1:L[0][1],t2:L[1][1],slot:L[2][1],uniq:L[2][2],flavor:L[2][3]};}
    const gems={};for(const [k,g] of Object.entries(G.GEMS))gems[k]={name:g.name,col:g.col,desc:g.desc};
    const pots={};for(const [k,x] of Object.entries(G.POTS))pots[k]={name:x.name,kind:x.kind,pct:x.pct,add:x.add,price:x.price};
    const pets={};for(const [k,x] of Object.entries(G.PETS))pets[k]={name:x.n,col:x.col,desc:x.desc};
    const rar={};for(const [k,x] of Object.entries(G.RAR))rar[k]={n:x.n,c:x.c};
    const ancs={};for(const [k,x] of Object.entries(G.ANCS))ancs[k]={n:x.n,b:x.b.map(([n,t])=>`${n}${n===2?' piezas':''}: ${t}`)};
    const npcs={};for(const [k,n] of Object.entries(G.NPCS)){const g=G.NPC_GEAR[k]||{};npcs[k]={name:n.name,role:n.role,greet:n.greet,cls:g.cls,t:g.t,wg:g.wg,lv:g.lv};}
    const quests=G.QUESTS.map(q=>({mob:q.mob,n:q.n,gold:q.gold,txt:q.txt}));
    const lore=G.LORE.map(l=>({t:l.t,p:l.p,lock:l.lock||null}));
    return {zones,mobs,cls,lv:G.TREQ_LVL,sh:G.SHNAME,lore,gems,pots,pets,loot,rar,ancs,npcs,quests};});
  fs.writeFileSync(OUT,JSON.stringify(D,null,1));console.log('data.json',Object.keys(D).join(','),'mobs',Object.keys(D.mobs).length);await b.close();})();
