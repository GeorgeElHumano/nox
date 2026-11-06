// Galería: abre el juego en un navegador sin ventana y saca las fotos de la web (alas solas, criaturas, razas, sets, íconos).
// Uso: ALPHA=1 node gallery.js SALIDA MODO [solo,estos] [nivel]   MODO: wingsonly | mobs | razas | sets | bigicons | icons2 | shield | npcs | wings
// Variables: BASE (http://localhost:8788/jugar/), VENDOR (carpeta desktop/vendor con three.js), ZOOM, ALPHA=1 para fondo transparente.
const {chromium}=require('playwright');const fs=require('fs');
const path=require('path');const VENDOR=process.env.VENDOR||path.join(__dirname,'../../desktop/vendor');const BASE=process.env.BASE||'http://localhost:8788/jugar/';const ORIGIN=BASE.slice(0,BASE.indexOf('/',8));const MAP={'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js':VENDOR+'/three.min.js'};
for(const f of ['loaders/GLTFLoader.js','utils/SkeletonUtils.js','shaders/CopyShader.js','shaders/LuminosityHighPassShader.js','postprocessing/EffectComposer.js','postprocessing/RenderPass.js','postprocessing/ShaderPass.js','postprocessing/UnrealBloomPass.js'])MAP['https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/'+f]=VENDOR+'/examples/'+f;
const OUT=process.argv[2]||'/tmp/nox-gal';fs.mkdirSync(OUT,{recursive:true});
const MODE=process.argv[3]||'mobs';const ONLY=(process.argv[4]||'').split(',').filter(Boolean);
const NOGLOW=`(()=>{const X=window.__NOX,H=X.HERO;if(!H||!window.__ALPHA_HIDE)return;const Wg=H.wings&&H.wings.g;const inW=o=>{let q=o;while(q){if(q===Wg)return true;q=q.parent;}return false;};(H.g.parent||H.g).traverse(o=>{const m=o.material;if(!m)return;if((m.blending===THREE.AdditiveBlending||o.isSprite||o.isPoints)&&!inW(o))o.visible=false;});})()`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
/* foto con pose congelada: dos fotos del mismo modelo salen iguales */
let shot=null;
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errs=[];
  shot=async path=>{await p.evaluate(()=>{try{window.__NOX.STUDIO.freeze();}catch(e){}});await wait(200);await p.screenshot({path,timeout:180000,omitBackground:!!process.env.ALPHA});};
  const PORT=['razas','sets','wings','wingsonly','npcs'].includes(MODE);const c=await b.newContext({viewport:PORT?{width:760,height:1000}:{width:800,height:800}});const p=await c.newPage();if(process.env.ALPHA)await p.addInitScript(()=>{window.__ALPHA=1;});
  p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|404/.test(m.text()))errs.push(m.text().slice(0,200));});
  await p.route('**/*',r=>{const u=r.request().url();if(MAP[u])return r.fulfill({path:MAP[u],contentType:'application/javascript'});if(u.startsWith(ORIGIN))return r.continue();return r.abort();});
  await p.goto(BASE,{waitUntil:'commit',timeout:120000});
  const until=async(sel,ms=150000)=>{const t0=Date.now();while(Date.now()-t0<ms){if(await p.evaluate(s=>!!document.querySelector(s),sel).catch(()=>false))return true;await wait(800);}throw new Error('no aparece '+sel);};
  /* con servidor aparece la pantalla de cuenta (botón 'jugar sin cuenta'); sin servidor va directo a crear personaje */
  await until('[data-act=playOffline],#nameIn');await p.evaluate(()=>{const b=document.querySelector('[data-act=playOffline]');if(b)b.click();});
  await until('#nameIn');await p.evaluate(()=>{const b=document.querySelector(`[data-act=selClass][data-c=caballero]`);if(b)b.click();});await wait(500);
  await p.evaluate(()=>{const i=document.querySelector('#nameIn');i.value='Galeria';i.dispatchEvent(new Event('input'));document.querySelector('[data-act=selCreate]').click();});
  await until('#hud:not([hidden])');await wait(1500);
  await p.addStyleTag({content:'#hud,#labels,#nums,#chatLog,#liveSt,#boot,#toast,#toasts,.toast,#zone,#fade{display:none!important}'+(process.env.ALPHA?'html,body,canvas,#game{background:transparent!important}#sel,.embers{display:none!important}':'')});
  await p.evaluate(z=>{window.__STUDIO_DARK=1;window.__ZOOM=z;window.__NOX.STUDIO.go();},process.env.ZOOM||'.8');await wait(2500);if(process.env.ALPHA){await p.evaluate(()=>{window.__NOX.STUDIO.alpha();window.__ALPHA_HIDE=1;});await wait(300);}
  if(MODE==='mobs'){const keys=await p.evaluate(()=>Object.keys(window.__NOX.MOBS));
    for(const k of keys){if(ONLY.length&&!ONLY.includes(k))continue;
      await p.evaluate(k=>window.__NOX.STUDIO.mob(k),k);
      // esperar modelos externos (hasta 12 s) y que se re-arme
      for(let i=0;i<44;i++){await wait(500);const st=await p.evaluate(()=>{const e=window.__NOX.enemies[0];return e?{kind:e.kind,oad:!!(e.oad||e.mixer)}:null});if(st&&['glb','snake','scorp','lizard'].includes(st.kind)||i>40)break;}
      await wait(800);await p.evaluate(()=>{const e=window.__NOX.enemies[0];if(e){const S=window.__NOX.STUDIO;S.frame(e.hgt,e.rad,.55,['snake','lizard','scorp'].includes(e.kind)||e.B&&e.B.len>3?.55:.28);const d=S.cam.clone().sub(S.look).multiplyScalar(+(window.__ZOOM||.8));S.cam.copy(S.look).add(d);}});await wait(400);
      await shot(`${OUT}/${k}.png`);console.log('foto',k);}}
  if(MODE==='sets'){const LV=+(process.argv[5]||0);const classes=ONLY.length?ONLY:['caballero','hechicero','arquera','gladiador','mburuvicha'];
    await p.evaluate(()=>{window.__NOX.STUDIO.hero();});
    for(const cls of classes)for(let t=0;t<7;t++){
      await p.evaluate(([cls,t,LV])=>{const X=window.__NOX;const eq={};for(const k of ['helm','armor','pants','gloves','boots'])eq[k]=X.newEquip(cls,k,t,{lv:LV});eq.weapon=X.newEquip(cls,'weapon',Math.min(4,t),{lv:LV});if(cls==='caballero')eq.shield=X.newEquip(cls,'shield',Math.min(4,t),{lv:LV});X.setEq(cls,eq);X.STUDIO.hero();},[cls,t,LV]);
      for(let i=0;i<30;i++){await wait(500);const ok=await p.evaluate(()=>{const X=window.__NOX;return !!(X.HERO&&X.HERO.oad&&X.HERO.forge&&X.HERO.forge.length);});if(ok)break;}
      await wait(1200);await p.evaluate(()=>{window.__NOX.STUDIO.hero();});await p.evaluate(NOGLOW);await wait(300);await shot(`${OUT}/${cls}_${t}.png`);console.log('foto',cls,t);}
    for(const cls of classes)for(const g of [1,2]){
      await p.evaluate(([cls,g])=>{const X=window.__NOX;const eq={};for(const k of ['helm','armor','pants','gloves','boots'])eq[k]=X.newEquip(cls,k,g===1?4:6,{lv:9});eq.weapon=X.newEquip(cls,'weapon',4,{lv:9});eq.wings={u:9999,k:'wings',c:cls,t:0,lv:g===1?5:13,g};X.setEq(cls,eq);X.STUDIO.hero();},[cls,g]);
      for(let i=0;i<30;i++){await wait(500);const ok=await p.evaluate(()=>{const X=window.__NOX;return !!(X.HERO&&X.HERO.oad&&X.HERO.forge&&X.HERO.forge.length&&X.HERO.wings);});if(ok)break;}
      await wait(1500);await p.evaluate(()=>{window.__NOX.STUDIO.hero();window.__NOX.STUDIO.frame(2.6,.9,.35,.2);});await wait(300);await shot(`${OUT}/${cls}_w${g}.png`);console.log('foto alas',cls,g);}}
  if(MODE==='shield'){await p.evaluate(()=>{window.__NOX.STUDIO.hero();});
    for(const sh of [1,0]){await p.evaluate(sh=>{const X=window.__NOX;const cls='caballero';const eq={};for(const k of ['helm','armor','pants','gloves','boots'])eq[k]=X.newEquip(cls,k,6,{lv:9});eq.weapon=X.newEquip(cls,'weapon',4,{lv:9});if(sh)eq.shield=X.newEquip(cls,'shield',4,{lv:9});X.setEq(cls,eq);X.STUDIO.hero();},sh);
      for(let i=0;i<30;i++){await wait(500);const ok=await p.evaluate(()=>{const X=window.__NOX;return !!(X.HERO&&X.HERO.oad&&X.HERO.forge&&X.HERO.forge.length);});if(ok)break;}
      await wait(1500);await p.evaluate(()=>{window.__NOX.STUDIO.hero();window.__NOX.STUDIO.frame(2.3,.5,.35,.18);});await wait(300);await shot(`${OUT}/shield_${sh}.png`);console.log('foto escudo',sh);}}
  if(MODE==='razas'){const classes=ONLY.length?ONLY:['caballero','hechicero','arquera','gladiador','mburuvicha'];await p.evaluate(()=>{window.__NOX.STUDIO.hero();});
    for(const cls of classes){
      await p.evaluate(cls=>{const X=window.__NOX;const eq={};for(const k of ['helm','armor','pants','gloves','boots'])eq[k]=X.newEquip(cls,k,6,{lv:9});eq.weapon=X.newEquip(cls,'weapon',4,{lv:9});if(cls==='caballero')eq.shield=X.newEquip(cls,'shield',4,{lv:9});eq.wings={u:9999,k:'wings',c:cls,t:0,lv:12,g:2};X.setEq(cls,eq);X.STUDIO.hero();},cls);
      for(let i=0;i<30;i++){await wait(500);const ok=await p.evaluate(()=>{const X=window.__NOX;return !!(X.HERO&&X.HERO.oad&&X.HERO.forge&&X.HERO.forge.length&&X.HERO.wings);});if(ok)break;}
      await wait(1500);await p.evaluate(()=>{window.__NOX.STUDIO.hero();window.__NOX.STUDIO.frame(2.9,1.0,.35,.18);});await p.evaluate(NOGLOW);await wait(300);await shot(`${OUT}/raza_${cls}.png`);console.log('foto raza',cls);}}
  if(MODE==='wings'){const classes=ONLY.length?ONLY:['caballero','hechicero','arquera','gladiador','mburuvicha'];await p.evaluate(()=>{window.__NOX.STUDIO.hero();});
    for(const cls of classes)for(const [g,lv] of [[1,0],[1,4],[1,8],[1,12],[2,12],[3,15]]){
      await p.evaluate(([cls,g,lv])=>{const X=window.__NOX;const eq={};for(const k of ['helm','armor','pants','gloves','boots'])eq[k]=X.newEquip(cls,k,Math.min(6,Math.floor(lv/2)),{lv});eq.weapon=X.newEquip(cls,'weapon',4,{lv});eq.wings={u:9999,k:'wings',c:cls,t:0,lv,g};X.setEq(cls,eq);X.STUDIO.hero();},[cls,g,lv]);
      for(let i=0;i<30;i++){await wait(500);const ok=await p.evaluate(()=>{const X=window.__NOX;return !!(X.HERO&&X.HERO.oad&&X.HERO.wings);});if(ok)break;}
      await wait(1500);await p.evaluate(()=>{window.__NOX.STUDIO.hero();window.__NOX.STUDIO.frame(2.9,1.0,.35,.18);});await wait(300);await shot(`${OUT}/${cls}_g${g}_${lv}.png`);console.log('foto alas',cls,g,lv);}}
  if(MODE==='wingsonly'){const classes=ONLY.length?ONLY:['caballero','hechicero','arquera','gladiador','mburuvicha'];await p.evaluate(()=>{window.__NOX.STUDIO.hero();});
    for(const cls of classes)for(const [g,lv] of [[1,0],[1,4],[1,8],[1,12],[2,12],[3,15]]){
      await p.evaluate(([cls,g,lv])=>{const X=window.__NOX;const eq={};eq.wings={u:9999,k:'wings',c:cls,t:0,lv,g};X.setEq(cls,eq);X.STUDIO.hero();},[cls,g,lv]);
      for(let i=0;i<30;i++){await wait(500);const ok=await p.evaluate(()=>{const X=window.__NOX;return !!(X.HERO&&X.HERO.oad&&X.HERO.wings);});if(ok)break;}
      await wait(1200);
      await p.evaluate(()=>{const X=window.__NOX,H=X.HERO,Wg=H.wings.g;(H.g.parent||H.g).traverse(o=>{if(!(o.isMesh||o.isSkinnedMesh||o.isPoints||o.isSprite||o.isLine))return;let q=o,inW=false;while(q){if(q===Wg){inW=true;break;}q=q.parent;}if(!inW)o.visible=false;});
        H.g.updateMatrixWorld(true);const bb=new THREE.Box3();Wg.traverse(o=>{if(o.isMesh&&o.visible&&!o.isSprite)bb.expandByObject(o);});const c=bb.getCenter(new THREE.Vector3()),sz=bb.getSize(new THREE.Vector3());const S=X.STUDIO;const R=Math.max(sz.x,sz.y*1.3)+.2;S.look.copy(c);S.cam.set(c.x+Math.sin(Math.PI+.25)*R*1.65,c.y+R*.95,c.z+Math.cos(Math.PI+.25)*R*1.65);});
      await wait(400);await shot(`${OUT}/${cls}_g${g}_${lv}.png`);console.log('ala sola',cls,g,lv);}}
  if(MODE==='icons'){/* íconos de inventario: equipo por raza y set, escudos, gemas, pociones y alas (fondo transparente siempre) */
    const shot=async(name,it)=>{let d=null;for(let i=0;i<40;i++){d=await p.evaluate(it=>{const X=window.__NOX;try{return X.irIcon(it);}catch(e){return 'ERR '+e.message;}},it);if(d&&d!=='WAIT'&&!String(d).startsWith('ERR'))break;await wait(400);}
      if(d&&d!=='WAIT'&&!String(d).startsWith('ERR'))fs.writeFileSync(`${OUT}/${name}.png`,Buffer.from(d.split(',')[1],'base64'));else console.log('sin icono',name,String(d).slice(0,80));};
    const CLS=ONLY.length?ONLY:['caballero','hechicero','arquera','gladiador','mburuvicha'];
    for(const cls of CLS){await p.evaluate(cls=>{const X=window.__NOX;X.setEq(cls,{weapon:X.newEquip(cls,'weapon',0,{})});X.STUDIO.hero();},cls);for(let i=0;i<40;i++){await wait(500);if(await p.evaluate(()=>!!(window.__NOX.HERO&&window.__NOX.HERO.oad)))break;}await wait(800);
      for(let t=0;t<7;t++)for(const k of ['weapon','helm','armor','pants','gloves','boots']){if(cls==='gladiador'&&k==='helm')continue;const it=await p.evaluate(([c,k,t])=>window.__NOX.newEquip(c,k,t,{}),[cls,k,t]);if(it)await shot(`${cls}_${t}_${k}`,it);}
      for(const g of [1,2,3])await shot(`wings_${cls}_g${g}`,{u:1,k:'wings',c:cls,t:0,lv:0,g});
      console.log('iconos',cls);}
    for(let t=0;t<7;t++){const it=await p.evaluate(t=>window.__NOX.newEquip('caballero','shield',t,{}),t);if(it)await shot(`shield_${t}`,it);}
    for(const g of ['tupa','jasy','yvy','kerana'])await shot('gem_'+g,{u:1,k:'gem',sub:g});
    for(const q of ['hp1','hp2','hp3','mp1','mp2','mp3'])await shot('pot_'+q,{u:1,k:'pot',sub:q});
    console.log('iconos listos');}
  if(MODE==='bigicons'){const shot=async(name,mk)=>{let d=null;for(let i=0;i<40;i++){d=await p.evaluate(mk);if(d&&d!=='WAIT')break;await wait(500);}
      if(d&&d!=='WAIT')require('fs').writeFileSync(`${OUT}/${name}.png`,Buffer.from(d.split(',')[1],'base64'));else console.log('sin icono',name,JSON.stringify(d));};
    await p.evaluate(()=>{const X=window.__NOX;X.irIcon(X.newEquip('caballero','weapon',1,{}));const I=X.IR;I.r.setSize(512,640,false);I.W=512;I.H=640;I.N=512;});await wait(1500);
    for(const cls of ['caballero','hechicero','arquera','gladiador','mburuvicha']){await p.evaluate(cls=>{const X=window.__NOX;const eq={weapon:X.newEquip(cls,'weapon',6,{})};X.setEq(cls,eq);X.STUDIO.hero();},cls);for(let i=0;i<40;i++){await wait(500);if(await p.evaluate(()=>!!(window.__NOX.HERO&&window.__NOX.HERO.oad)))break;}await wait(800);await shot(cls+'_weapon',`(()=>{const X=window.__NOX;return X.irIcon(X.newEquip('${cls}','weapon',6,{}));})()`);}
    await shot('shield',`(()=>{const X=window.__NOX;return X.irIcon(X.newEquip('caballero','shield',5,{}));})()`);
    console.log('bigicons listos');}
  if(MODE==='npcs'){await p.evaluate(()=>{window.__NOX.STUDIO.off();window.__NOX.travel('asuncion');});await wait(12000);
    const ids=await p.evaluate(()=>window.__NOX.npcs.map(n=>n.id));
    for(const id of ids){await p.evaluate(id=>{const X=window.__NOX;const n=X.npcs.find(n=>n.id===id);const a=n.ry0;X.P.x=n.x+Math.sin(a)*2.5;X.P.z=n.z+Math.cos(a)*2.5;X.P.moveTo=null;X.HERO.g.visible=false;X.STUDIO.on=true;X.STUDIO.cam.set(n.x+Math.sin(a+.35)*4.4,2.0,n.z+Math.cos(a+.35)*4.4);X.STUDIO.look.set(n.x,1.15,n.z);},id);
      for(let i=0;i<24;i++){await wait(500);const ok=await p.evaluate(id=>{const n=window.__NOX.npcs.find(n=>n.id===id);return !!(n.m&&n.m.oad&&n.m.npcP);},id);if(ok)break;}
      await wait(1500);await shot(`${OUT}/npc_${id}.png`);console.log('foto',id);}}
  if(MODE==='icons2'){const shot=async(name,mk)=>{let d=null;for(let i=0;i<40;i++){d=await p.evaluate(mk);if(d&&d!=='WAIT')break;await wait(500);}
      if(d&&d!=='WAIT')require('fs').writeFileSync(`${OUT}/${name}.png`,Buffer.from(d.split(',')[1],'base64'));else console.log('sin icono',name,JSON.stringify(d));};
    for(const [cls,t] of [['hechicero',1],['hechicero',1]]){await p.evaluate(([cls,t])=>{const X=window.__NOX;const eq={weapon:X.newEquip(cls,'weapon',t,{})};X.setEq(cls,eq);X.STUDIO.hero();},[cls,t]);for(let i=0;i<40;i++){await wait(500);if(await p.evaluate(()=>!!(window.__NOX.HERO&&window.__NOX.HERO.oad)))break;}await wait(1000);await shot(`${cls}_${t}_weapon`,`(()=>{const X=window.__NOX;const it=X.newEquip('${cls}','weapon',${t},{});return X.irIcon(it);})()`);}
    console.log('iconos2 listos');}
  console.log(errs.slice(0,8).join('\n')||'no errors');await b.close();})();
