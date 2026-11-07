const ready=p=>p.id==='ios'||p.id==='web'||p.id==='android'?true:!!LINKS[p.id];
const iconHTML=p=>'<img src="img/icon-256.png" alt="" width="72" height="72">'+ICONS[p.id];
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
/* ===== dispositivo de quien entra: el botón principal descarga directo lo que le sirve ===== */
const DEV=(()=>{const u=navigator.userAgent||'',tp=navigator.maxTouchPoints||0;
  if(/Android/i.test(u))return 'android';if(/iPhone|iPod/.test(u))return 'ios';if(/iPad/.test(u)||(/Macintosh/.test(u)&&tp>0))return 'ipad';
  if(/Windows/.test(u))return 'windows';if(/Macintosh|Mac OS X/.test(u))return 'mac';return null;})();
const DEVP=DEV==='ipad'?'ios':DEV;
const DEVLBL={android:'Instalar en Android',windows:'Descargar para Windows',mac:'Descargar para Mac',ios:'Instalar en iPhone',ipad:'Instalar en iPad'};
if(DEVP){const i=PLAT.findIndex(p=>p.id===DEVP);if(i>0)PLAT.unshift(PLAT.splice(i,1)[0]);}
const platHTML=PLAT.map((p,i)=>`<button class="plat${p.id===DEVP?' mine':''}" type="button" data-p="${p.id}" style="--i:${i}" aria-haspopup="dialog">${p.id===DEVP?'<span class="mine-tag">Tu dispositivo</span>':''}<div class="plat-icon">${iconHTML(p)}</div><div><div class="pn">${p.name}</div><div class="pr">${p.req}<br>${p.sub}${['android','windows','mac'].includes(p.id)?'<br>Versión '+VERSION:''}</div></div><div class="go"><span>Cómo instalarlo</span><span class="state ${ready(p)?'ok':''}">${ready(p)?'Disponible':'Pronto'}</span></div></button>`).join('');
$('#platforms').innerHTML=platHTML;$('#platforms2').innerHTML=platHTML;
const M=$('#modal'),DL=$('#dlModal');let lastFocus=null;
function lock(on){document.documentElement.classList.toggle('locked',on);}
function openPlat(id){const p=PLAT.find(x=>x.id===id);if(!p)return;lastFocus=document.activeElement;DL.hidden=true;
  $('#mIcon').innerHTML=iconHTML(p);$('#mReq').textContent=p.req+(['windows','mac'].includes(p.id)?' · versión '+VERSION:'');$('#mTitle').textContent='NOX para '+p.name;
  $('#mSteps').innerHTML=p.steps.map(s=>'<li><span>'+s+'</span></li>').join('');
  let extra='';if(p.copy)extra+='<div class="copy"><input id="mUrl" readonly value="'+webURL()+'" aria-label="Dirección del juego"><button type="button" id="mCopy">Copiar</button>'+(p.id==='ios'?'<button type="button" id="mShare">Agregar a inicio</button>':'')+'</div>';extra+='<p class="note">'+p.note+'</p>';if(p.beta&&LINKS.android)extra+='<p class="beta">¿Preferís un archivo para instalar? <a href="'+LINKS.android+'" data-track="android" rel="noopener">Beta para Android (APK)</a></p>';$('#mExtra').innerHTML=extra;
  const href=p.id==='ios'||p.id==='web'?webURL():p.id==='android'?webURL()+'?inicio=1':LINKS[p.id];
  $('#mActions').innerHTML=href?'<a class="btn btn-gold" href="'+href+'" data-track="'+p.id+'" target="_blank" rel="noopener">'+p.btn+'</a>'+(p.btn2?'<a class="btn btn-line" href="'+LINKS.macIntel+'" data-track="macIntel" target="_blank" rel="noopener">'+p.btn2+'</a>':''):'<span class="btn btn-gold" aria-disabled="true">'+p.btn+' · disponible pronto</span><a class="btn btn-line" href="'+webURL()+'" data-track="web" target="_blank" rel="noopener">Mientras tanto, jugar en el navegador</a>';
  $('#mActions').insertAdjacentHTML('beforeend','<button type="button" class="btn btn-line" data-dlall>Otros dispositivos</button>');
  M.hidden=false;lock(true);$('#mClose').focus();
  /* Compartir abre el menú del iPhone, donde está "Agregar a inicio" (solo si el navegador puede compartir) */
  /* Agregar a inicio: abre el juego en esta misma pestaña con una guía que señala el botón Compartir de Safari (iOS no deja agregarlo solo) */const sh=$('#mShare');if(sh)sh.onclick=()=>{const u=new URL($('#mUrl').value);u.searchParams.set('inicio','1');location.href=u.href;};
  const c=$('#mCopy');if(c)c.onclick=()=>{const i=$('#mUrl');const done=()=>{c.textContent='Copiado';setTimeout(()=>c.textContent='Copiar',1600);};try{navigator.clipboard.writeText(i.value).then(done,()=>{i.select();done();});}catch(e){i.select();done();}};}
function closeAll(){M.hidden=true;DL.hidden=true;$('#fmodal').hidden=true;$('#viewer').hidden=true;lock(false);if(lastFocus&&lastFocus.focus)lastFocus.focus();}
function openDl(){lastFocus=document.activeElement;M.hidden=true;DL.hidden=false;lock(true);$('#dlClose').focus();}
/* botón principal: en Android y Windows arranca la descarga y muestra cómo instalar; en iPhone, iPad y Mac muestra los pasos; si no se reconoce, la lista completa */
function smartDl(){if(!DEVP)return openDl();if(DEVP==='windows'&&LINKS[DEVP]&&!PREVIEW){/* la descarga va por un marco oculto: la página no se mueve aunque la red falle */const f=document.createElement('iframe');f.hidden=true;f.src=LINKS[DEVP];document.body.appendChild(f);setTimeout(()=>f.remove(),60000);track(DEVP);openPlat(DEVP);$('#mExtra').insertAdjacentHTML('afterbegin','<p class="note"><b>La descarga ya empezó.</b> Si no arrancó, tocá el botón de abajo.</p>');return;}openPlat(DEVP);}
if(DEV)$$('[data-dl]').forEach(b=>{if(/gratis/i.test(b.textContent)||b.closest('.dock')||b.closest('.dlch'))b.textContent=DEVLBL[DEV];});
document.addEventListener('click',e=>{const b=e.target.closest('[data-p]');if(b){openPlat(b.dataset.p);return;}if(e.target.closest('[data-dlall]')){openDl();return;}if(e.target.closest('[data-dl]')){smartDl();return;}
  const o=e.target.closest('[data-open]');if(o){openDeep(o.dataset.open);return;}
  const g=e.target.closest('[data-go]');if(g){go(g.dataset.go);return;}
  const im=e.target.closest('img[data-zoom]');if(im){lastFocus=document.activeElement;$('#vImg').src=im.dataset.zoom||im.src;$('#vImg').alt=im.alt;$('#vCap').textContent=im.dataset.cap||im.alt;$('#viewer').hidden=false;lock(true);}});
document.addEventListener('keydown',e=>{const p=e.target.closest&&e.target.closest('.pan[data-go]');if(p&&(e.key==='Enter'||e.key===' ')){e.preventDefault();go(p.dataset.go);}});
$('#mClose').onclick=closeAll;$('#dlClose').onclick=closeAll;$('#fClose').onclick=closeAll;$('#vClose').onclick=closeAll;
[M,DL,$('#fmodal'),$('#viewer')].forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeAll();}));
$$('[data-web]').forEach(a=>{a.href=webURL();a.target='_blank';a.rel='noopener';});

/* ===== datos del juego ===== */
const TAU_=Math.PI*2;const W=__DATA__;
const CK=['caballero','hechicero','arquera','gladiador','mburuvicha'];const ZK=['asuncion','campos','ruinas','chaco','esteros','ybytyruzu','monday','mbaracayu','cerrocora','bahianegra'];
const IMG=n=>'img/w/'+n+'.webp';const ic=n=>'img/w/ic/'+n+'.webp';const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const zoom=(src,cap,extra)=>`<img src="${src}" data-zoom="${src}" data-cap="${esc(cap)}" alt="${esc(cap)}" loading="lazy" ${extra||''}>`;
const CCOL={caballero:'#ff5a3a',hechicero:'#7ad0ff',arquera:'#5aff9a',gladiador:'#3ac8ff',mburuvicha:'#c080ff'};
const SONS=['teju','mboitui','monai','jasyjatere','kurupi','aoao','luison'];
const BOSSZ={};Object.entries(W.mobs).forEach(([k,m])=>{if(m.boss&&m.zones)m.zones.forEach(z=>{(BOSSZ[z]=BOSSZ[z]||[]).push(k);});});

/* el mapa del capítulo VI, dibujado con el contorno real del país */
(()=>{const PY=[[-62.65,-22.23],[-62.28,-21.0],[-62.2,-20.55],[-61.9,-19.98],[-61.5,-19.65],[-60.5,-19.3],[-59.3,-19.3],[-58.4,-19.6],[-58.16,-20.16],[-57.9,-20.9],[-57.85,-21.6],[-57.95,-22.1],[-57.3,-22.2],[-56.6,-22.25],[-56.0,-22.1],[-55.7,-22.55],[-55.55,-23.3],[-55.4,-23.95],[-54.6,-24.0],[-54.3,-24.1],[-54.55,-25.0],[-54.6,-25.6],[-54.75,-26.5],[-55.4,-27.1],[-55.9,-27.4],[-56.6,-27.5],[-57.3,-27.45],[-58.0,-27.3],[-58.62,-27.28],[-58.45,-26.8],[-58.0,-26.2],[-57.6,-25.5],[-57.65,-25.3],[-58.1,-24.9],[-58.9,-24.4],[-59.7,-23.9],[-60.5,-23.5],[-61.5,-23.0],[-62.65,-22.23]];
  const RIO=[[-58.16,-20.16],[-57.9,-20.9],[-57.85,-21.6],[-57.95,-22.1],[-57.75,-22.9],[-57.85,-23.8],[-57.65,-25.3],[-57.6,-25.5],[-58.0,-26.2],[-58.45,-26.8],[-58.62,-27.28]];
  const PINS={asuncion:[-57.63,-25.28],campos:[-57.2,-25.33],ruinas:[-55.7,-27.12],chaco:[-60.6,-21.4],esteros:[-58.0,-26.9],ybytyruzu:[-56.3,-25.9],monday:[-54.75,-25.6],mbaracayu:[-55.3,-24.15],cerrocora:[-56.05,-22.65],bahianegra:[-58.17,-20.22]};
  const LP={asuncion:[-.4,.05,'end'],campos:[.4,-.4,'start'],ruinas:[.4,.1,'start'],chaco:[.4,0,'start'],esteros:[-.4,.12,'end'],ybytyruzu:[0,.6,'middle'],monday:[.4,0,'start'],mbaracayu:[.4,-.1,'start'],cerrocora:[.4,0,'start'],bahianegra:[.4,0,'start']};
  const X=p=>(p[0]+63.2).toFixed(2),Y=p=>(-p[1]-18.9).toFixed(2);
  const f=$('#mapfig');if(!f)return;const svg=document.createElement('div');svg.innerHTML=`<svg class="mapsvg" viewBox="-.6 -.2 12.8 9.4" aria-hidden="true"><path class="land" d="M${PY.map(p=>X(p)+','+Y(p)).join('L')}Z"/><path class="river" d="M${RIO.map(p=>X(p)+','+Y(p)).join('L')}"/><path class="route" d="M${ZK.map(k=>X(PINS[k])+','+Y(PINS[k])).join('L')}"/>${ZK.map(k=>`<g class="pin"><circle class="halo" cx="${X(PINS[k])}" cy="${Y(PINS[k])}" r=".3"/><circle cx="${X(PINS[k])}" cy="${Y(PINS[k])}" r=".17"/><text style="text-anchor:${LP[k][2]}" x="${(+X(PINS[k])+LP[k][0]).toFixed(2)}" y="${(+Y(PINS[k])+LP[k][1]).toFixed(2)}">${esc(W.zones[k].name)}</text></g>`).join('')}</svg>`;
  f.insertBefore(svg.firstChild,f.querySelector('.ola'));})();

/* ===== el recorrido: capítulos a pantalla completa ===== */
const CH=['inicio','mitologia','razas','sets','alas','items','mapas','bestiario','historia','descargar'];
const CHN={inicio:'Portada',mitologia:'Mitología',razas:'Razas',sets:'Sets',alas:'Alas',items:'Ítems',mapas:'Mapas',bestiario:'Bestiario',historia:'Historia',descargar:'Descargar'};
const ROM=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
const stage=$('#stage'),deep=$('#deep');const VIEWS=$$('#deep [data-view]');let cur='inicio',deepView=null,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const chEl=k=>$('#ch-'+k);
$('#dots').innerHTML=CH.map(k=>`<button type="button" data-ch="${k}" aria-current="false"><span>${CHN[k]}</span><i></i></button>`).join('');
$('#menuNav').innerHTML=CH.map((k,i)=>`<button type="button" data-ch="${k}" aria-current="false"><small>${i===0?'':ROM[i-1]}</small>${k==='inicio'?'Portada':CHN[k]}</button>`).join('');
function setActive(k,fromScroll){if(!CH.includes(k))return;cur=k;
  document.documentElement.style.setProperty('--bg',getComputedStyle(document.documentElement).getPropertyValue('--c-'+k).trim());
  $$('.ch').forEach(s=>{if(s.dataset.ch===k)s.classList.add('on');});
  $$('#dots button,#menuNav button').forEach(b=>b.setAttribute('aria-current',b.dataset.ch===k));
  const i=CH.indexOf(k);$('#counter').innerHTML=`<b>${String(i+1).padStart(2,'0')}</b> / ${String(CH.length).padStart(2,'0')}`;$('#pline').style.setProperty('--p',((i+1)/CH.length*100)+'%');
  document.title=(k==='inicio'?'':CHN[k]+' · ')+'NOX · Crónicas del Paraguay';
  if(fromScroll&&!deep.classList.contains('open'))history.replaceState(null,'','#'+(k==='inicio'?'':k));}
const io=new IntersectionObserver(es=>{es.forEach(e=>{const k=e.target.dataset.ch;const rh=e.rootBounds?e.rootBounds.height:innerHeight;const vis=e.intersectionRect.height/rh;if(e.intersectionRatio>=.5||vis>=.55)setActive(k,true);else if(e.intersectionRatio<.15&&vis<.2)e.target.classList.remove('on');});},{root:stage,threshold:[0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1]});
$$('.ch').forEach(s=>io.observe(s));
function scrollToCh(k,smooth=true){const el=chEl(k);if(!el)return;stage.scrollTo({top:el.offsetTop,behavior:smooth&&!reduced?'smooth':'instant'});}
function go(path,push=true){const [v,...rest]=path.split('/');const arg=rest.join('/');const k=CH.includes(v)?v:'inicio';
  closeMenu();if(push)history.pushState(null,'','#'+(k==='inicio'&&!arg?'':path));
  if(arg&&VIEWS.some(s=>s.dataset.view===k)){setActive(k,false);scrollToCh(k,false);openDeep(k,arg,false);}
  else{closeDeep(false);scrollToCh(k,push);}}
addEventListener('popstate',()=>go(location.hash.slice(1)||'inicio',false));
$('#dots').addEventListener('click',e=>{const b=e.target.closest('[data-ch]');if(b)go(b.dataset.ch);});
$('#menuNav').addEventListener('click',e=>{const b=e.target.closest('[data-ch]');if(b)go(b.dataset.ch);});
/* teclado: flechas y espacio pasan de capítulo */
addEventListener('keydown',e=>{if(e.key==='Escape'){if(!M.hidden||!DL.hidden||!$('#fmodal').hidden||!$('#viewer').hidden){closeAll();return;}if($('#menu').classList.contains('open')){closeMenu();return;}if(deep.classList.contains('open')){closeDeep();return;}}
  if(deep.classList.contains('open')||!M.hidden||!DL.hidden||$('#menu').classList.contains('open')||e.target.matches('input,textarea'))return;
  const i=CH.indexOf(cur);if(['ArrowDown','PageDown',' '].includes(e.key)&&i<CH.length-1){e.preventDefault();go(CH[i+1]);}if(['ArrowUp','PageUp'].includes(e.key)&&i>0){e.preventDefault();go(CH[i-1]);}
  if(e.key==='Home'){e.preventDefault();go('inicio');}if(e.key==='End'){e.preventDefault();go('descargar');}});

/* la ficha de cada capítulo */
const DEF={mitologia:'leer',razas:()=>curR,sets:()=>curS+'/'+curT,alas:()=>curWc+'/'+curWi,items:()=>curI,mapas:()=>curZ,bestiario:'codice',historia:()=>curCh};
function openDeep(k,arg,push=true){if(!VIEWS.some(s=>s.dataset.view===k))return;const a=arg||(typeof DEF[k]==='function'?DEF[k]():DEF[k]);
  VIEWS.forEach(s=>{s.hidden=s.dataset.view!==k;});deepView=k;$('#deepTitle').textContent=CHN[k];
  const i=CH.indexOf(k);$('#deepNext').innerHTML=(i<CH.length-1?`<button type="button" data-next="${CH[i+1]}">Siguiente: ${CHN[CH[i+1]]} →</button>`:'');
  closeAll();deep.setAttribute('aria-hidden','false');deep.classList.add('open');deep.scrollTo({top:0,behavior:'instant'});stagger(chEl(k)?VIEWS.find(s=>s.dataset.view===k):null);
  if(k==='mapas'){const r=deep.querySelector('.route');if(r){r.style.animation='none';r.getBoundingClientRect();r.style.animation='';}}
  if(k==='razas'&&a)setRaza(a);if(k==='sets'&&a){const [c,t]=a.split('/');setForge(c,t);}if(k==='alas'&&a){const [c,i2]=a.split('/');setWing(c,i2);}
  if(k==='mapas')setZone(a||curZ);if(k==='bestiario'&&a&&W.mobs[a])openFicha(a);if(k==='items'&&a)setItems(a);if(k==='historia'&&a!=null&&a!=='')setChapter(+a);
  if(push)history.pushState(null,'','#'+k+'/'+a);setTimeout(()=>$('#deepBack').focus({preventScroll:true}),400);}
function closeDeep(push=true){if(!deep.classList.contains('open'))return;deep.classList.remove('open');deep.setAttribute('aria-hidden','true');closeAll();if(push)history.pushState(null,'','#'+(cur==='inicio'?'':cur));}
$('#deepBack').onclick=()=>closeDeep();
$('#deepNext').addEventListener('click',e=>{const b=e.target.closest('[data-next]');if(b){closeDeep(false);go(b.dataset.next);}});

/* menú */
const menu=$('#menu'),mb=$('#menuBtn');
function openMenu(){menu.classList.add('open');menu.setAttribute('aria-hidden','false');mb.setAttribute('aria-expanded','true');$('#menuClose').focus();}
function closeMenu(){if(!menu.classList.contains('open'))return;menu.classList.remove('open');menu.setAttribute('aria-hidden','true');mb.setAttribute('aria-expanded','false');}
mb.onclick=()=>menu.classList.contains('open')?closeMenu():openMenu();$('#menuClose').onclick=closeMenu;

/* cascada: cada hijo de las grillas entra con un pequeño retraso */
function stagger(root){if(!root)return;root.querySelectorAll('.rsel,.codex,.igrid,.uniq,.myth-grid,.sons ol,.events,.steps2,.gems').forEach(g=>{g.classList.remove('stag');void g.offsetWidth;[...g.children].forEach((c,i)=>c.style.setProperty('--i',Math.min(i,24)));g.classList.add('stag');});}
/* luciérnagas de la noche larga */
(()=>{const cv=$('#fire');if(!cv||reduced){if(cv)cv.remove();return;}const x=cv.getContext('2d');let Wd=0,H=0,P=[];const N=innerWidth<700?12:26;
  function size(){Wd=cv.width=innerWidth;H=cv.height=innerHeight;}size();addEventListener('resize',size);
  for(let i=0;i<N;i++)P.push({x:Math.random()*Wd,y:Math.random()*H,r:.7+Math.random()*1.6,a:Math.random()*TAU_,s:.15+Math.random()*.35,ph:Math.random()*TAU_,k:.6+Math.random()*.8});
  let t0=performance.now();function draw(t){const dt=Math.min(.05,(t-t0)/1000);t0=t;x.clearRect(0,0,Wd,H);
    for(const p of P){p.a+=(Math.random()-.5)*.3;p.x+=Math.cos(p.a)*p.s*60*dt;p.y+=Math.sin(p.a)*p.s*60*dt-6*dt;if(p.x<-10)p.x=Wd+10;if(p.x>Wd+10)p.x=-10;if(p.y<-10)p.y=H+10;if(p.y>H+10)p.y=-10;
      const o=(.35+.65*Math.abs(Math.sin(t/1000*p.k+p.ph)))*.9;const g=x.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*5);g.addColorStop(0,`rgba(255,226,140,${o})`);g.addColorStop(.35,`rgba(246,200,90,${o*.35})`);g.addColorStop(1,'rgba(246,200,90,0)');x.fillStyle=g;x.beginPath();x.arc(p.x,p.y,p.r*5,0,TAU_);x.fill();}
    requestAnimationFrame(draw);}requestAnimationFrame(draw);})();
/* el puntero mueve las figuras de la portada y de los capítulos; inclina las tarjetas de las fichas */
if(matchMedia('(hover:hover) and (prefers-reduced-motion: no-preference)').matches){
  document.addEventListener('pointermove',e=>{const px=(e.clientX/innerWidth-.5),py=(e.clientY/innerHeight-.5);
    $$('.ch.home .pfig img').forEach(im=>{im.style.setProperty('--px',(px*-18)+'px');im.style.setProperty('--py',(py*-10)+'px');});
    const f=$('.ch.on:not(.home) .fig img');if(f)f.style.translate=(px*-14)+'px '+(py*-8)+'px';
    const t=e.target.closest('.rimg,.fimg,.zcard,.wimg,.rsel button,.codex button');$$('.tilt.hot').forEach(el=>{if(el!==t){el.classList.remove('hot');el.style.transform='';}});
    if(t){const r=t.getBoundingClientRect();const qx=(e.clientX-r.left)/r.width-.5,qy=(e.clientY-r.top)/r.height-.5;t.classList.add('tilt','hot');t.style.transform=`perspective(900px) rotateX(${(-qy*7).toFixed(2)}deg) rotateY(${(qx*8).toFixed(2)}deg) translateZ(6px)`;}});
  document.addEventListener('pointerleave',()=>{$$('.tilt.hot').forEach(el=>{el.classList.remove('hot');el.style.transform='';});},true);}

/* ===== arranque: el sol de NOX y la ola dorada ===== */
(function intro(){const I=$('#intro'),Wv=$('#wave');let seen=false;try{seen=sessionStorage.getItem('nox-intro')==='1';sessionStorage.setItem('nox-intro','1');}catch(e){}
  const start=location.hash.slice(1)||'inicio';
  const done=()=>{I.remove();Wv.classList.remove('go','rev');go(start,false);};
  if(reduced){done();return;}
  if(seen){I.classList.add('out');Wv.classList.add('go','rev');setTimeout(()=>{I.hidden=true;go(start,false);},450);setTimeout(()=>{Wv.classList.remove('go','rev');I.remove();},1150);return;}
  setTimeout(()=>Wv.classList.add('go'),1900);setTimeout(()=>I.classList.add('out'),2300);setTimeout(()=>{I.hidden=true;go(start,false);},2650);setTimeout(()=>{Wv.classList.remove('go');I.remove();},3450);})();
