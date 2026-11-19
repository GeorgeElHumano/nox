/* Dragón Dorado de NOX v3: dragón occidental original, dorado, ojos negros, fuego por dentro.
   makeDragon(THREE) → {g, step(t), setPose(0 parado..1 vuelo), jaw, glow}. ~34 m de largo.
   Liviano: piezas unidas por material, alas y púas con instancias, patas rígidas con IK (sin rehacer mallas). */
window.makeDragon=function(THREE,opt={}){
const outer=new THREE.Group(),g=new THREE.Group(),V=(x,y,z)=>new THREE.Vector3(x,y,z),up=V(0,1,0);outer.add(g);
function cvs(w,h,f){const c=document.createElement('canvas');c.width=w;c.height=h;f(c.getContext('2d'),w,h);return c;}
function tex(c,srgb,rep){const t=new THREE.CanvasTexture(c);t.anisotropy=4;if(srgb)t.encoding=THREE.sRGBEncoding;if(rep)t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const MX=(p,e,s)=>new THREE.Matrix4().compose(p,new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0],e[1],e[2])),s||V(1,1,1));
/* entorno propio: el oro brilla igual en cualquier escena */
const env=(()=>{const sz=32,sun=V(.6,.55,.4).normalize(),blu=V(-.7,.3,-.5).normalize(),faces=[];
 for(let fi=0;fi<6;fi++){const c=document.createElement('canvas');c.width=c.height=sz;const x2=c.getContext('2d'),im=x2.createImageData(sz,sz);
  for(let y=0;y<sz;y++)for(let x=0;x<sz;x++){const u=(x+.5)/sz*2-1,v=(y+.5)/sz*2-1,d=[[1,-v,-u],[-1,-v,u],[u,1,v],[u,-1,-v],[u,-v,1],[-u,-v,-1]][fi];
   const p=V(d[0],d[1],d[2]).normalize(),t=Math.min(1,Math.max(0,(p.y+.2)/.8));let r=.10+.30*t,gg=.08+.22*t,bb=.14+.30*t;
   const s1=Math.pow(Math.max(0,p.dot(sun)),14)*2.4,s2=Math.pow(Math.max(0,p.dot(blu)),8);r+=1.1*s1+.3*s2;gg+=.8*s1+.38*s2;bb+=.4*s1+.6*s2;if(p.y<0){r+=.3*-p.y;gg+=.2*-p.y;bb+=.08*-p.y;}
   const k=(y*sz+x)*4;im.data[k]=Math.min(255,r*255);im.data[k+1]=Math.min(255,gg*255);im.data[k+2]=Math.min(255,bb*255);im.data[k+3]=255;}
  x2.putImageData(im,0,0);faces.push(c);}
 const ct=new THREE.CubeTexture(faces);ct.encoding=THREE.sRGBEncoding;ct.needsUpdate=true;return ct;})();
/* escamas: color + relieve (mapa de normales hecho del alto) */
function scales(c,w,h,col){const n=10,s=w/n;c.fillStyle=col?'#3c2206':'#000';c.fillRect(0,0,w,h);
 for(let r=-1;r<n*1.7;r++)for(let k=-1;k<=n;k++){const x=k*s+(r%2?s/2:0),y=r*s*.6,gr=c.createRadialGradient(x,y+s*.1,s*.04,x,y+s*.25,s*.72);
  if(col){gr.addColorStop(0,'#fff0b8');gr.addColorStop(.28,'#f0bd4e');gr.addColorStop(.7,'#b27a1e');gr.addColorStop(1,'#3e2306');}else{gr.addColorStop(0,'#fff');gr.addColorStop(.6,'#999');gr.addColorStop(1,'#000');}
  c.fillStyle=gr;c.beginPath();c.moveTo(x-s*.55,y);c.quadraticCurveTo(x-s*.52,y+s*.5,x,y+s*.74);c.quadraticCurveTo(x+s*.52,y+s*.5,x+s*.55,y);c.closePath();c.fill();
  if(col){c.strokeStyle='rgba(40,20,2,.95)';c.lineWidth=w/200;c.stroke();c.strokeStyle='rgba(255,236,170,.35)';c.lineWidth=w/400;c.beginPath();c.moveTo(x,y+s*.08);c.lineTo(x,y+s*.6);c.stroke();}}}
function normalFrom(hc,str){const w=hc.width,h=hc.height,src=hc.getContext('2d').getImageData(0,0,w,h).data,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),im=x.createImageData(w,h),Hh=(i,j)=>src[(((j+h)%h)*w+((i+w)%w))*4]/255;
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){const dx=(Hh(i+1,j)-Hh(i-1,j))*str,dy=(Hh(i,j+1)-Hh(i,j-1))*str,l=Math.hypot(dx,dy,1),k=(j*w+i)*4;im.data[k]=(-dx/l*.5+.5)*255;im.data[k+1]=(dy/l*.5+.5)*255;im.data[k+2]=(1/l*.5+.5)*255;im.data[k+3]=255;}
 x.putImageData(im,0,0);return c;}
const scaleTex=tex(cvs(512,512,(c,w,h)=>scales(c,w,h,1)),1,1),scaleN=tex(normalFrom(cvs(256,256,(c,w,h)=>scales(c,w,h,0)),3.2),0,1);
const bellyTex=tex(cvs(64,128,(c,w,h)=>{const gr=c.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#f6dc9a');gr.addColorStop(.55,'#d9a850');gr.addColorStop(.86,'#7a4a12');gr.addColorStop(1,'#1c0c02');c.fillStyle=gr;c.fillRect(0,0,w,h);}),1,1);
const bellyGlow=tex(cvs(64,128,(c,w,h)=>{c.fillStyle='#000';c.fillRect(0,0,w,h);const gr=c.createLinearGradient(0,h*.72,0,h);gr.addColorStop(0,'rgba(255,90,0,0)');gr.addColorStop(.7,'rgba(255,120,10,.9)');gr.addColorStop(1,'rgba(255,220,120,1)');c.fillStyle=gr;c.fillRect(0,h*.72,w,h*.28);}),1,1);
const membTex=tex(cvs(512,256,(c,w,h)=>{const gr=c.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#f2b040');gr.addColorStop(.45,'#c26a14');gr.addColorStop(.85,'#6a2406');gr.addColorStop(1,'#2a0c02');c.fillStyle=gr;c.fillRect(0,0,w,h);
 for(const [col,lw] of [['rgba(60,18,0,.55)',3],['rgba(255,225,150,.3)',1.2]])for(let i=0;i<70;i++){c.strokeStyle=col;c.lineWidth=lw;c.beginPath();let x=rnd()*w,y=rnd()*h*.3;c.moveTo(x,y);for(let k=0;k<7;k++){x+=(rnd()-.5)*50;y+=rnd()*45;c.lineTo(x,y);}c.stroke();}
 for(let p=0;p<=4;p++){const x=p/4*w,g2=c.createLinearGradient(x-14,0,x+14,0);g2.addColorStop(0,'rgba(40,12,0,0)');g2.addColorStop(.5,'rgba(40,12,0,.7)');g2.addColorStop(1,'rgba(40,12,0,0)');c.fillStyle=g2;c.fillRect(x-14,0,28,h);}}),1,0);
const glowTex=tex(cvs(64,64,(c)=>{const gr=c.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,230,150,1)');gr.addColorStop(.35,'rgba(255,190,70,.45)');gr.addColorStop(1,'rgba(255,150,30,0)');c.fillStyle=gr;c.fillRect(0,0,64,64);}));
/* materiales */
const E={envMap:env,envMapIntensity:1.2};
const gold=new THREE.MeshStandardMaterial({color:0xffffff,map:scaleTex,normalMap:scaleN,normalScale:new THREE.Vector2(.9,.9),metalness:.86,roughness:.32,vertexColors:true,emissive:0xb07a1c,emissiveMap:scaleTex,emissiveIntensity:.42,...E});
const goldS=new THREE.MeshStandardMaterial({color:0xd99a34,metalness:.92,roughness:.28,emissive:0x7a4c0c,emissiveIntensity:.55,...E});
const plateM=new THREE.MeshStandardMaterial({color:0xffcf6a,metalness:.95,roughness:.2,...E});
const hornM=new THREE.MeshStandardMaterial({color:0x070504,metalness:0,roughness:.9,...E,envMapIntensity:.12});
const toothM=new THREE.MeshStandardMaterial({color:0xfff1d2,roughness:.25,metalness:.1,...E,envMapIntensity:.5});
const eyeM=new THREE.MeshStandardMaterial({color:0x020202,metalness:.5,roughness:.03,...E,envMapIntensity:2.4});
const mawM=new THREE.MeshStandardMaterial({color:0x1c0301,roughness:.6,emissive:0xff3a08,emissiveIntensity:.1});
const bellyM=new THREE.MeshStandardMaterial({map:bellyTex,emissiveMap:bellyGlow,emissive:0xffffff,emissiveIntensity:.9,metalness:.7,roughness:.34,...E});
const membM=new THREE.MeshStandardMaterial({color:0xffffff,map:membTex,side:THREE.DoubleSide,metalness:.2,roughness:.5,emissive:0x8a2c04,emissiveIntensity:.35,...E,envMapIntensity:.5});
/* utilidades de malla */
function taper(pts,r0,r1,seg=12,rad=8,prof){const c=new THREE.CatmullRomCurve3(pts),q=new THREE.TubeGeometry(c,seg,1,rad,false),p=q.attributes.position;
 for(let i=0;i<=seg;i++){const t=i/seg,rr=prof?prof(t):r0+(r1-r0)*t,cp=c.getPointAt(t);for(let j=0;j<=rad;j++){const k=i*(rad+1)+j;p.setXYZ(k,cp.x+(p.getX(k)-cp.x)*rr,cp.y+(p.getY(k)-cp.y)*rr,cp.z+(p.getZ(k)-cp.z)*rr);}}
 q.computeVertexNormals();return q;}
function merge(parts){let n=0;const gs=parts.map(p=>{const q=p.g.index?p.g.toNonIndexed():p.g;if(p.m)q.applyMatrix4(p.m);if(!q.attributes.normal)q.computeVertexNormals();n+=q.attributes.position.count;return q;});
 const Pp=new Float32Array(n*3),Nn=new Float32Array(n*3),U=new Float32Array(n*2),C=new Float32Array(n*3);let o=0;
 gs.forEach((q,i)=>{const c=q.attributes.position.count,p=parts[i],col=p.c||[1,1,1],uv=p.uv||[1,1];Pp.set(q.attributes.position.array.subarray(0,c*3),o*3);Nn.set(q.attributes.normal.array.subarray(0,c*3),o*3);
  for(let k=0;k<c;k++){if(q.attributes.uv){U[(o+k)*2]=q.attributes.uv.getX(k)*uv[0];U[(o+k)*2+1]=q.attributes.uv.getY(k)*uv[1];}C[(o+k)*3]=col[0];C[(o+k)*3+1]=col[1];C[(o+k)*3+2]=col[2];}o+=c;q.dispose();p.g.dispose();});
 const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.BufferAttribute(Pp,3));out.setAttribute('normal',new THREE.BufferAttribute(Nn,3));out.setAttribute('uv',new THREE.BufferAttribute(U,2));out.setAttribute('color',new THREE.BufferAttribute(C,3));return out;}
const mk=(parts,mat,par)=>{const m=new THREE.Mesh(merge(parts),mat);m.castShadow=true;(par||g).add(m);return m;};
/* ---- columna: dos poses, por puntos de control (cabeza → cola) ---- */
const STAND=[[14.2,9.4],[12.9,10.9],[11,12.1],[8.8,11.8],[6.8,9.7],[4.6,7.4],[2.2,6.3],[-.4,6.0],[-2.8,5.9],[-5,5.9],[-7.6,5.3],[-10.6,3.9],[-13.8,2.4],[-17.5,1.5],[-21.5,1.4],[-25.5,2.0],[-29,3.1]];
const FLY=[[15.4,6.0],[13.6,6.5],[11.5,6.8],[9.3,6.6],[7.2,6.3],[4.8,6.0],[2.2,5.9],[-.4,5.9],[-2.8,5.9],[-5,5.9],[-7.6,5.7],[-10.8,5.4],[-14.2,5.1],[-17.8,4.9],[-21.4,4.9],[-25,5.1],[-28.6,5.5]];
if(opt.baby)for(const A of [STAND,FLY])for(const p of A){if(p[0]>2.2){p[0]=2.2+(p[0]-2.2)*.5;p[1]=6+(p[1]-6)*.62;}else if(p[0]<-5){p[0]=-5+(p[0]+5)*.42;p[1]=5.9+(p[1]-5.9)*.6;}}
const NC=STAND.length,U_SH=6/(NC-1),U_HIP=9/(NC-1);
const Z0={pose:0,gy:0,gx:0,gry:0,sw:0,nx:0,ny:0,nz:0,by:0,pitch:0,tz:0,tamp:1,hp:0,jaw:.25,glow:.9,wflap:null,wfold:null,dead:0,flapSpd:1};
const st=Object.assign({t:0},Z0);
const N=opt.pet?46:132,RING=opt.pet?12:24,BR=opt.pet?4:8; /* opt.pet: versión liviana para la cría y las alas del jugador */
const P=[],TG=[],SD=[],UP=[];for(let i=0;i<=N;i++){P.push(V(0,0,0));TG.push(V(0,0,0));SD.push(V(0,0,0));UP.push(V(0,0,0));}
const RT=[[0,.8],[.06,.95],[.2,1.15],[.3,1.75],[U_SH,2.9],[.47,2.75],[U_HIP,2.45],[.64,1.6],[.75,1.05],[.88,.5],[1,.07]];
function radius(u){for(let k=1;k<RT.length;k++)if(u<=RT[k][0]){const a=RT[k-1],b=RT[k],t=(u-a[0])/(b[0]-a[0]),s=t*t*(3-2*t);return (a[1]+(b[1]-a[1])*s)*(opt.baby?1.3:1);}return .07;}
const Gs=(u,c,w)=>Math.exp(-((u-c)/w)*((u-c)/w));
const ctrl=STAND.map(()=>V(0,0,0)),curve=new THREE.CatmullRomCurve3(ctrl,false,'centripetal');
function spineAt(time){const k=st.pose,dd=st.dead,lv=1-dd;for(let i=0;i<NC;i++){const a=STAND[i],f=FLY[i],tt=i/(NC-1);let X=a[0]+(f[0]-a[0])*k,Y=a[1]+(f[1]-a[1])*k,Z=0;
  if(tt<.36){const w=1-tt/.36,w2=w*w*(3-2*w);Y+=Math.sin(time*1.3)*.22*w*lv+st.ny*w2;X+=Math.sin(time*1.3+.6)*.18*w*lv+st.nx*w2;Z+=Math.sin(time*.7)*.5*w*(1-k*.6)*lv+st.nz*w2;}
  if(tt<.62){Y+=st.by+st.pitch*(.62-tt)*9;Z+=st.sw*(X+5);}
  if(tt>.58){const a2=(tt-.58)/.42;Z+=Math.sin(time*(1.6+k*.6)-tt*5)*a2*a2*(2.6+k)*st.tamp*lv+st.tz*a2*(1+a2)*9;X+=Math.abs(st.tz)*a2*a2*7;Y+=Math.sin(time*1.1-tt*4)*a2*.5*lv+st.by*(1-a2);}
  if(tt>.3&&tt<.62)Y+=Math.sin(time*(k?2.4*st.flapSpd:1.3))*(.06+.22*k)*lv;
  if(dd>0){const gy2=i<2?1.5:radius(tt)*.88+.05;Y+=(gy2-Y)*dd;if(tt>.58)Z+=Math.sin(tt*7)*2.5*dd*(tt-.58);}
  ctrl[i].set(X,Y,Z);}
 for(let i=0;i<=N;i++)curve.getPoint(i/N,P[i]);
 for(let i=0;i<=N;i++){TG[i].subVectors(P[Math.min(N,i+1)],P[Math.max(0,i-1)]).normalize();SD[i].crossVectors(TG[i],up).normalize();UP[i].crossVectors(SD[i],TG[i]).normalize();}}
/* cuerpo: un tubo con hombros, caderas y quilla; normales directas (sin recalcular) */
function ring(i,u,ca,sa,r,k,out,nout){const lat=1+(.2*Gs(u,U_SH,.05)+.18*Gs(u,U_HIP,.05))*ca*ca;let ys=u>.3&&u<.6?.9:.96;if(sa>0)ys*=1+.12*Math.pow(sa,6);else ys*=1+.14*Gs(u,.43,.09)*sa*sa;
 out.copy(P[i]).addScaledVector(SD[i],ca*r*lat*k).addScaledVector(UP[i],sa*r*ys*k);if(nout)nout.copy(SD[i]).multiplyScalar(ca/lat).addScaledVector(UP[i],sa/ys).normalize();}
function tube(R){const n=(N+1)*(R+1),q=new THREE.BufferGeometry(),idx=[];for(let i=0;i<N;i++)for(let j=0;j<R;j++){const a=i*(R+1)+j,b=a+R+1;idx.push(a,b,a+1,b,b+1,a+1);}
 q.setIndex(idx);for(const [k,s] of [['position',3],['normal',3],['uv',2]])q.setAttribute(k,new THREE.BufferAttribute(new Float32Array(n*s),s));return q;}
const bG=tube(RING);bG.setAttribute('color',new THREE.BufferAttribute(new Float32Array((N+1)*(RING+1)*3),3));
const body=new THREE.Mesh(bG,gold);body.castShadow=true;body.receiveShadow=true;body.frustumCulled=false;g.add(body);
const beG=tube(BR),belly=new THREE.Mesh(beG,bellyM);belly.frustumCulled=false;g.add(belly);
{const c=bG.attributes.color.array,uv=bG.attributes.uv.array,buv=beG.attributes.uv.array;
 for(let i=0;i<=N;i++){const u=i/N;for(let j=0;j<=RING;j++){const sa=Math.sin(j/RING*Math.PI*2),k=i*(RING+1)+j,t=Math.min(1,Math.max(0,(sa-.15)/.75)),s=t*t*(3-2*t);c[k*3]=1-.34*s;c[k*3+1]=.97-.42*s;c[k*3+2]=.9-.5*s;uv[k*2]=u*20;uv[k*2+1]=j/RING*3;}
  for(let j=0;j<=BR;j++){const k=i*(BR+1)+j;buv[k*2]=j/BR;buv[k*2+1]=u*46;}}}
const v0=V(0,0,0),n0=V(0,0,0);
function rebuild(){const p=bG.attributes.position.array,nn=bG.attributes.normal.array,bp=beG.attributes.position.array,bn=beG.attributes.normal.array;
 for(let i=0;i<=N;i++){const u=i/N,r=radius(u);
  for(let j=0;j<=RING;j++){const a=j/RING*Math.PI*2;ring(i,u,Math.cos(a),Math.sin(a),r,1,v0,n0);const k=(i*(RING+1)+j)*3;p[k]=v0.x;p[k+1]=v0.y;p[k+2]=v0.z;nn[k]=n0.x;nn[k+1]=n0.y;nn[k+2]=n0.z;}
  for(let j=0;j<=BR;j++){const a=Math.PI*(1.22+.56*j/BR);ring(i,u,Math.cos(a),Math.sin(a),r,1.03,v0,n0);const k=(i*(BR+1)+j)*3;bp[k]=v0.x;bp[k+1]=v0.y;bp[k+2]=v0.z;bn[k]=n0.x;bn[k+1]=n0.y;bn[k+2]=n0.z;}}
 for(const q of [bG,beG]){q.attributes.position.needsUpdate=true;q.attributes.normal.needsUpdate=true;}}
/* ---- cabeza: cráneo en cuña, ceño fruncido, colmillos, cuernos negros, fauces con brasa ---- */
const head=new THREE.Group();g.add(head);const jaw=new THREE.Group();head.add(jaw);jaw.position.set(.1,-.28,0);
{const hm=gold.clone();hm.map=scaleTex.clone();hm.map.repeat.set(2.6,2.4);hm.map.needsUpdate=true;
 const lathe=(pr,sx,sy,sz,def)=>{const q=new THREE.LatheGeometry(pr.map(([r,y])=>new THREE.Vector2(r,y)),24);q.rotateZ(-Math.PI/2);q.scale(sx,sy,sz);if(def){const p=q.attributes.position;for(let i=0;i<p.count;i++){v0.fromBufferAttribute(p,i);def(v0);p.setXYZ(i,v0.x,v0.y,v0.z);}}q.computeVertexNormals();return q;};
 const G=[],PL=[],HO=[],TO=[],EY=[],MW=[],JG=[],JH=[],JT=[],JM=[];
 G.push({g:lathe([[0,-1.5],[.9,-1.3],[1.2,-.6],[1.22,.2],[1.02,1.1],[.82,2.1],[.7,3],[.6,3.7],[.42,4.3],[0,4.5]],1,.62,.95,p=>{if(p.y>0){p.y+=.2*Math.exp(-Math.pow((p.x-.2)/.8,2))*Math.min(1,Math.abs(p.z)/.5)+.14*Math.exp(-Math.pow((p.x-3.7)/.45,2));}else p.y*=.8;p.z*=1-.12*Math.exp(-Math.pow((p.x-2)/.9,2));}),m:MX(V(-.2,.25,0),[0,0,0])});
 MW.push({g:new THREE.SphereGeometry(1,14,8),m:MX(V(1.7,-.2,0),[0,0,-.08],V(1.9,.2,.56))});
 for(const s of [-1,1]){
  // ceño: placa gruesa que baja hacia el hocico (mirada enojada) + pómulo
  PL.push({g:taper([V(-1.2,1.2,s*.9),V(.1,1.12,s*.8),V(1.5,.68,s*.46)],.25,.08,10,7)});PL.push({g:taper([V(-1,-.02,s*1.05),V(.6,.0,s*.92),V(2.3,-.1,s*.62)],.22,.06,10,6)});
  EY.push(opt.baby?{g:new THREE.SphereGeometry(.5,16,12),m:MX(V(.5,.5,s*.86),[0,s*.3,0],V(1.05,1.05,.5))}:{g:new THREE.SphereGeometry(.34,14,10),m:MX(V(.35,.56,s*.9),[0,s*.3,-.2],V(1.45,.62,.5))});if(opt.baby)TO.push({gl:1,g:new THREE.SphereGeometry(.12,8,6),m:MX(V(.74,.7,s*1.1),[0,0,0])});
  PL.push({g:new THREE.TorusGeometry(.35,.04,5,18),m:MX(V(.35,.56,s*.93),[0,s*.3,-.2],V(1.45,.62,1))});
  // cuernos: par grande hacia atrás, par de mejilla y gola
  HO.push({g:taper([V(-.9,.95,s*.55),V(-2.6,1.75,s*.95),V(-4.6,2.1,s*1.3),V(-6.4,1.6,s*1.45),V(-7.7,.6,s*1.4)],.52,.02,22,8)});
  HO.push({g:taper([V(-1,.1,s*1.0),V(-2.6,.15,s*1.75),V(-4.2,-.2,s*2.05),V(-5.5,-.9,s*1.9)],.36,.02,14,7)});
  for(let k=0;k<3;k++)HO.push({g:taper([V(-1.3,.45+.2*k,s*(.95-.1*k)),V(-2.4-k*.3,.9+.45*k,s*(1.45-.12*k)),V(-3.4-k*.5,1.0+.6*k,s*(1.7-.15*k))],.22,.02,8,6)});
  MW.push({g:new THREE.SphereGeometry(.07,8,6),m:MX(V(4.12,.36,s*.2),[0,0,0],V(1.4,.8,1))});
  // dientes de arriba: irregulares, con dos colmillos
  for(let i=0;i<9;i++){const L=.34+((i*7)%4)*.09;TO.push({g:new THREE.ConeGeometry(.07,L,7),m:MX(V(.9+i*.36,-.26-L/2,s*(.66-i*.045)),[0,0,Math.PI+((i%3)-1)*.08])});}
  TO.push({g:new THREE.ConeGeometry(.12,1.2,8),m:MX(V(3.7,-.72,s*.33),[0,0,Math.PI-.12])});TO.push({g:new THREE.ConeGeometry(.1,.85,8),m:MX(V(2.5,-.62,s*.5),[0,0,Math.PI-.06])});
  // mandíbula: dientes, colmillo y púas del mentón
  for(let i=0;i<7;i++){const L=.3+((i*5)%3)*.09;JT.push({g:new THREE.ConeGeometry(.065,L,7),m:MX(V(.8+i*.38,.14+L/2,s*(.52-i*.04)),[0,0,((i%3)-1)*.08])});}
  JT.push({g:new THREE.ConeGeometry(.1,.9,8),m:MX(V(3.25,.5,s*.26),[0,0,.1])});
  for(let k=0;k<3;k++)JH.push({g:taper([V(1.6-k*.8,-.25,s*(.4+.08*k)),V(1.2-k*.8,-.6,s*(.5+.1*k)),V(.6-k*.8,-.95-.1*k,s*(.56+.1*k))],.15,.02,6,5)});
 }
 // cresta y cuerno nasal
 for(let k=0;k<6;k++)HO.push({g:new THREE.ConeGeometry(.17-k*.008,.85-k*.05,5),m:MX(V(2.3-k*.66,.86+.05*k,0),[0,0,.55+.07*k])});
 HO.push({g:new THREE.ConeGeometry(.2,.9,6),m:MX(V(3.75,.72,0),[0,0,.5])});
 JG.push({g:lathe([[0,-.3],[.72,0],[.64,1.3],[.48,2.5],[.3,3.5],[0,3.85]],1,.36,.82)});
 JM.push({g:taper([V(.2,.14,0),V(1.5,.22,0),V(2.7,.1,0)],.34,.08,8,6)});
 mk(G,hm,head);mk(PL,plateM,head);mk(HO,hornM,head);mk(opt.baby?TO.filter(p=>p.gl):TO,toothM,head);mk(EY,eyeM,head);mk(MW,mawM,head);
 mk(JG,hm,jaw);mk(JH,hornM,jaw);if(!opt.baby)mk(JT,toothM,jaw);mk(JM,mawM,jaw);if(opt.baby)head.scale.set(1.2,2.2,2.2);else head.scale.setScalar(1.5);}
/* púas del lomo + garras de las alas: una sola malla con instancias */
const spG=new THREE.ConeGeometry(.3,1,5);spG.translate(0,.5,0);const SPK=new THREE.InstancedMesh(spG,hornM,96);SPK.castShadow=true;SPK.frustumCulled=false;g.add(SPK);
/* punta de la cola: hoja con púas */
const tip=mk([{g:(()=>{const s=new THREE.Shape();s.moveTo(-.4,0);s.lineTo(-1,1.35);s.lineTo(.4,.75);s.lineTo(3.2,0);s.lineTo(.4,-.75);s.lineTo(-1,-1.35);s.lineTo(-.4,0);const q=new THREE.ExtrudeGeometry(s,{depth:.14,bevelEnabled:true,bevelSize:.07,bevelThickness:.07,bevelSegments:1});q.translate(0,0,-.07);q.rotateX(Math.PI/2);return q;})()}],plateM);
/* ---- alas: huesos con instancias y membrana que se actualiza por cuadro ---- */
const boneG=new THREE.CylinderGeometry(.5,1,1,7,1,true);boneG.translate(0,.5,0);const WB=new THREE.InstancedMesh(boneG,goldS,12);WB.castShadow=true;WB.frustumCulled=false;g.add(WB);
const wl={S:V(0,0,0),E:V(.9,1.6,4.2),W:V(-.2,2.6,8.6),T:[V(-.4,3.3,18.5),V(-6,2.4,17.2),V(-10.8,1.2,13.6),V(-13.6,.4,8.4)],R:V(-9,-1,.5)};
if(opt.baby){for(const k of ['E','W','R'])wl[k].multiplyScalar(.62);wl.T.forEach(t=>t.multiplyScalar(.62));}
const WJ=[0,1].map(()=>Array.from({length:8},()=>V(0,0,0)));
const NU=6,NV=5,PAN=4,per=(NU+1)*(NV+1),mG=new THREE.BufferGeometry();
{const n=2*PAN*per,idx=[],uv=new Float32Array(n*2);for(let w=0;w<2;w++)for(let p=0;p<PAN;p++){const o=(w*PAN+p)*per;for(let a=0;a<NU;a++)for(let b=0;b<NV;b++){const i0=o+a*(NV+1)+b,i1=i0+NV+1;idx.push(i0,i1,i0+1,i1,i1+1,i0+1);}
  for(let a=0;a<=NU;a++)for(let b=0;b<=NV;b++){const k=o+a*(NV+1)+b;uv[k*2]=(p+a/NU)/PAN;uv[k*2+1]=1-b/NV;}}
 mG.setIndex(idx);mG.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));mG.setAttribute('uv',new THREE.BufferAttribute(uv,2));}
const memb=new THREE.Mesh(mG,membM);memb.castShadow=true;memb.frustumCulled=false;g.add(memb);
const wF=V(0,0,0),wU=V(0,0,0),wS=V(0,0,0),wO=V(0,0,0);
function wingJoints(out,s,flap,fold){const put=(k,p,outer,fl)=>{let x=p.x,y=p.y,z=p.z;
  if(outer){let dx=x-wl.W.x,dy=y-wl.W.y,dz=z-wl.W.z;const a=fold*outer,cx=Math.cos(a),sx=Math.sin(a);let nx=dx*cx-dz*sx,nz=dx*sx+dz*cx;dx=nx;dz=nz;const c2=Math.cos(flap*.45),s2=Math.sin(flap*.45),ny=dy*c2+dz*s2;nz=dz*c2-dy*s2;x=wl.W.x+dx;y=wl.W.y+ny;z=wl.W.z+nz;}
  const c=Math.cos(fl),sn=Math.sin(fl),y2=y*c+z*sn,z2=z*c-y*sn;out[k].copy(wO).addScaledVector(wF,x).addScaledVector(wU,y2).addScaledVector(wS,s*z2);};
 put(0,wl.S,0,flap);put(1,wl.E,0,flap);put(2,wl.W,0,flap);wl.T.forEach((t,i)=>put(3+i,t,.45+i*.28,flap));put(7,wl.R,0,0);}
const Mx=new THREE.Matrix4(),Qt=new THREE.Quaternion(),Vt=V(0,0,0),Sc=V(1,1,1),d0=V(0,0,0);
function inst(mesh,n,a,b,r,len){d0.subVectors(b,a);const L=d0.length();d0.multiplyScalar(1/L);Qt.setFromUnitVectors(up,d0);Sc.set(r,len||L,r);Mx.compose(a,Qt,Sc);mesh.setMatrixAt(n,Mx);}
const la=V(0,0,0),lb=V(0,0,0);
function wings(time,nspk){const i=Math.round((U_SH-.012)*N),r=radius(U_SH),k=st.pose,mp=mG.attributes.position.array;wF.copy(TG[i]).negate();wU.copy(UP[i]);wS.crossVectors(wF,wU);
 const ph=time*(2.6*st.flapSpd),fa=.62+Math.sin(time*1.1)*.07,fb=.12+Math.sin(ph)*.62,flap=st.wflap!=null?st.wflap:fa+(fb-fa)*k,fold=st.wfold!=null?st.wfold:.42+(.05+Math.max(0,-Math.cos(ph))*.18-.42)*k;
 for(let w=0;w<2;w++){const s=w?-1:1,J=WJ[w];wO.copy(P[i]).addScaledVector(wU,r*.7).addScaledVector(wS,s*r*.4);wingJoints(J,s,flap,fold);
  const rr=[.72,.52,.3,.28,.25,.22];inst(WB,w*6,J[0],J[1],rr[0]);inst(WB,w*6+1,J[1],J[2],rr[1]);for(let f=0;f<4;f++){inst(WB,w*6+2+f,J[2],J[3+f],rr[2+f]);la.copy(J[3+f]).addScaledVector(d0,-.3);inst(SPK,nspk++,la,la.clone().add(d0),.42,1.1);}
  la.copy(J[2]);lb.copy(J[2]).addScaledVector(wF,1).addScaledVector(wU,.5);inst(SPK,nspk++,la,lb,.8,1.5);
  const L=[[J[2],J[3],J[2],J[4]],[J[2],J[4],J[2],J[5]],[J[2],J[5],J[2],J[6]],[J[2],J[6],J[0],J[7]]];
  for(let p=0;p<PAN;p++){const [a0,a1,b0,b1]=L[p],o=(w*PAN+p)*per,sc=p===3?.1:.24;for(let a=0;a<=NU;a++)for(let b=0;b<=NV;b++){const u=a/NU,v=b/NV,ve=v*(1-sc*Math.sin(Math.PI*u)*v);
    la.lerpVectors(a0,a1,ve);lb.lerpVectors(b0,b1,ve);la.lerp(lb,u).addScaledVector(wU,-.55*Math.sin(Math.PI*u)*v);const q=(o+a*(NV+1)+b)*3;mp[q]=la.x;mp[q+1]=la.y;mp[q+2]=la.z;}}}
 mG.attributes.position.needsUpdate=true;mG.computeVertexNormals();WB.instanceMatrix.needsUpdate=true;return nspk;}
/* ---- patas: tres piezas rígidas por pata, IK de dos huesos ---- */
const dark=[.07,.055,.045];
function segGeo(L,r0,r1,bul){return merge([{g:taper([V(0,0,0),V(0,-L*.5,0),V(0,-L,0)],0,0,8,10,t=>(r0+(r1-r0)*t)*(1+bul*Math.sin(Math.PI*Math.pow(t,.8)))),uv:[3,2]},{g:new THREE.SphereGeometry(r0*1.03,10,8),uv:[3,2]},{g:new THREE.SphereGeometry(r1*1.05,8,6),m:MX(V(0,-L,0),[0,0,0])}]);}
function footGeo(){const parts=[{g:taper([V(0,0,0),V(.5,-.6,0),V(.95,-1.0,0)],.52,.46,5,8),uv:[2,2]},{g:new THREE.SphereGeometry(.62,10,8),m:MX(V(1,-.98,0),[0,0,0],V(1.15,.55,1.25)),uv:[2,2]}];
 for(let i=-1;i<=1;i++){const a=i*.45,d=V(Math.cos(a),0,Math.sin(a)),p0=V(1,-1.0,0),p1=p0.clone().addScaledVector(d,1.0).add(V(0,.14,0)),p2=p0.clone().addScaledVector(d,1.75).add(V(0,-.1,0));
  parts.push({g:taper([p0,p1,p2],.32,.21,5,7)});parts.push({g:taper([p2,p2.clone().addScaledVector(d,.55).add(V(0,.12,0)),p2.clone().addScaledVector(d,1.15).add(V(0,-.2,0))],.2,.01,6,6),c:dark});}
 parts.push({g:taper([V(.5,-.75,0),V(-.2,-.85,0),V(-.75,-1.25,0)],.2,.01,5,5),c:dark});return merge(parts);}
const legs=[];{const gT=segGeo(3.5,1.55,.85,.22),gS=segGeo(3.2,.98,.62,.14),gU=segGeo(3.0,1.25,.8,.2),gF=segGeo(2.9,.78,.54,.12),gFt=footGeo();
 for(const s of [1,-1]){legs.push({off:V(0,0,0),s,u:U_HIP,L1:3.5,L2:3.2,bend:1,stand:V(-6.3,1.66,s*3.1),fly:V(-8.8,3.9,s*1.8),fa:-1.9,sc:1.25,gs:[gT,gS,gFt]});legs.push({off:V(0,0,0),s,u:U_SH,L1:3.0,L2:2.9,bend:-1,stand:V(3.3,1.46,s*2.8),fly:V(4.9,3.5,s*1.6),fa:-1.2,sc:1.1,gs:[gU,gF,gFt]});}
 for(const L of legs){L.m=L.gs.map((q,k)=>{const m=new THREE.Mesh(q,gold);m.castShadow=true;if(k<2)m.scale.z=.82;else m.scale.setScalar(L.sc);g.add(m);return m;});}}
const hip=V(0,0,0),ank=V(0,0,0),kn=V(0,0,0),dn=V(0,-1,0),pp=V(0,0,0);
function legIK(){for(const L of legs){const i=Math.round(L.u*N),r=radius(L.u);hip.copy(P[i]).addScaledVector(SD[i],-L.s*r*.62).addScaledVector(UP[i],-r*.18);ank.lerpVectors(L.stand,L.fly,st.pose).add(L.off);if(st.dead){ank.z+=L.s*1.6*st.dead;ank.x+=L.bend*-1.8*st.dead;}
  d0.subVectors(ank,hip);let d=d0.length();const mx=(L.L1+L.L2)*.995;if(d>mx){d0.multiplyScalar(mx/d);ank.copy(hip).add(d0);d=mx;}d0.multiplyScalar(1/d);
  const a=(L.L1*L.L1-L.L2*L.L2+d*d)/(2*d),h=Math.sqrt(Math.max(0,L.L1*L.L1-a*a));pp.set(L.bend,0,L.s*.12);pp.addScaledVector(d0,-pp.dot(d0)).normalize();kn.copy(hip).addScaledVector(d0,a).addScaledVector(pp,h);
  const [m1,m2,m3]=L.m;m1.position.copy(hip);m1.quaternion.setFromUnitVectors(dn,pp.subVectors(kn,hip).normalize());m2.position.copy(kn);m2.quaternion.setFromUnitVectors(dn,pp.subVectors(ank,kn).normalize());
  m3.position.copy(ank);m3.rotation.set(0,-L.s*.22,L.fa*st.pose);}}
/* chispas */
const SPN=opt.pet?2:opt.lite?40:120,spA=new Float32Array(SPN*3),sseed=[];for(let i=0;i<SPN;i++)sseed.push([rnd(),rnd()*6.28,rnd()*3+1,rnd()]);
const spG2=new THREE.BufferGeometry();spG2.setAttribute('position',new THREE.BufferAttribute(spA,3));const sparks=new THREE.Points(spG2,new THREE.PointsMaterial({map:glowTex,size:.4,color:0xffd070,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sparks.frustumCulled=false;g.add(sparks);
const hf=V(0,0,0),hs=V(0,0,0),hu=V(0,0,0),Mb=new THREE.Matrix4();
function step(time){st.t=time;spineAt(time);if(!opt.wingsOnly){rebuild();legIK();}
 {const pa=(-.3+.24*st.pose)*(1-st.dead)+st.hp;hf.copy(TG[1]).negate().lerp(Vt.set(Math.cos(pa),Math.sin(pa),0),.7).normalize();}g.position.set(st.gx,st.gy,0);g.rotation.y=st.gry;hs.crossVectors(hf,up).normalize();hu.crossVectors(hs,hf);
 head.position.copy(P[0]).addScaledVector(hf,-.9);head.quaternion.setFromRotationMatrix(Mb.makeBasis(hf,hu,hs));head.rotateZ(Math.sin(time*1.3)*.04);head.rotateX(Math.sin(time*.7)*.05*(1-st.dead)+st.dead*1.15);sparks.material.opacity=Math.min(1,st.glow);
 jaw.rotation.z=-.1-st.jaw*.75-.05*(.5+.5*Math.sin(time*1.9));mawM.emissiveIntensity=.03+st.glow*.08+.05*Math.sin(time*3);bellyM.emissiveIntensity=st.glow*(.8+.25*Math.sin(time*2.2));
 let n=0;for(let i=5;i<N-6&&n<70&&!opt.wingsOnly;i+=2+(i>N*.6?1:0)){const u=i/N,r=radius(u),big=n%2?.62:1,hgt=1.35*(.8+1.6*Gs(u,U_SH+.03,.12)+.5*Gs(u,U_HIP,.1)+(u>.7?(1-u)*-.6:0))*big;
  Qt.setFromUnitVectors(up,Vt.copy(UP[i]).addScaledVector(TG[i],.75).normalize());ring(i,u,0,1,r,.9,v0);Sc.set(.6+r*.42,Math.max(.25,hgt),.5+r*.3);Mx.compose(v0,Qt,Sc);SPK.setMatrixAt(n++,Mx);}
 n=wings(time,n);SPK.count=n;SPK.instanceMatrix.needsUpdate=true;
 tip.position.copy(P[N]);hf.copy(TG[N]);hs.crossVectors(hf,up).normalize();hu.crossVectors(hs,hf);tip.quaternion.setFromRotationMatrix(Mb.makeBasis(hf,hu,hs));
 for(let i=0;i<SPN;i++){const s=sseed[i],k=Math.min(N,Math.round(s[0]*N*.85)),r=radius(k/N)+1.2+s[3]*2.5,life=(time*s[2]*.25+s[3])%1;Vt.copy(P[k]).addScaledVector(SD[k],Math.cos(s[1]+time*.5)*r).addScaledVector(UP[k],Math.sin(s[1]+time*.5)*r+life*4);spA[i*3]=Vt.x;spA[i*3+1]=Vt.y;spA[i*3+2]=Vt.z;}spG2.attributes.position.needsUpdate=true;}
/* opt.wingsOnly: solo las alas (premio «Alas del Dragón Dorado»); opt.goldWing: membrana dorada */
if(opt.wingsOnly){for(const m of [body,belly,head,tip,sparks])m.visible=false;for(const L of legs)L.m.forEach(m=>m.visible=false);}
if(opt.goldWing){membM.emissiveMap=null;membM.emissive.setRGB(.9,.58,.12);membM.emissiveIntensity=.42;membM.color.setRGB(1.12,.96,.55);membM.metalness=.5;membM.roughness=.35;membM.needsUpdate=true;}
if(opt.pet){sparks.visible=false;g.traverse(o=>{if(o.isMesh)o.castShadow=false;});}
step(0);
/* ---- animaciones: cada una mueve unos pocos mandos (cuello, cuerpo, cola, patas, alas, boca) ---- */
const sm=(t,a,b)=>{t=Math.min(1,Math.max(0,(t-a)/(b-a)));return t*t*(3-2*t);},bp=(t,a,b,c,d)=>sm(t,a,b)*(1-sm(t,c,d)),FR=legs.find(L=>L.s===1&&L.bend===-1);
const PI2=Math.PI*2;
function gait(t,cyc,stride,lift){const ph=[0,.5,.5,0];legs.forEach((L,i)=>{const p=((t*cyc+ph[i])%1+1)%1;if(p<.6)L.off.x+=stride*(.5-p/.6);else{const q=(p-.6)/.4;L.off.x+=stride*(-.5+q);L.off.y+=lift*Math.sin(Math.PI*q);}});}
const CLIPS={
 quieto:{d:4,loop:1,f(){}},
 vuelo:{d:4,loop:1,f(t,o){o.pose=1;o.gy=14;}},
 caminar:{d:1.8,loop:1,speed:3.4/(.6*1.8),f(t,o){gait(t,1,3.4,1.5);o.by=.2*Math.sin(t*PI2*2);o.sw=.04*Math.sin(t*PI2);o.ny=.35*Math.sin(t*PI2*2+1);o.nz=1.2*Math.sin(t*PI2);o.tamp=1.5;}},
 girar:{d:1.6,loop:1,f(t,o){gait(t,1,1.2,1.3);o.by=.15*Math.sin(t*PI2*2);o.tamp=1.5;}},
 rugido:{d:2.8,f(t,o){const k=bp(t,.05,.3,.75,1),sh=bp(t,.3,.4,.7,.82);o.nx=-4.5*k;o.ny=5.2*k;o.hp=1.05*k;o.pitch=.13*k;o.jaw=.25+.75*bp(t,.2,.34,.74,.9);o.glow=.9+1.8*k;o.nz=Math.sin(t*90)*.5*sh;o.wflap=.62-.42*k;o.wfold=.42-.36*k;o.tamp=1+k;}},
 mordida:{d:1.3,f(t,o){const b=bp(t,0,.3,.36,.48),f=bp(t,.36,.48,.62,1);o.nx=-2.6*b+5.5*f;o.ny=1.2*b-5*f;o.hp=.25*b-.2*f;o.by=-.6*f;o.jaw=.25+.75*bp(t,.08,.34,.47,.52);o.wflap=.62+.15*f;}},
 zarpazo:{d:1.7,f(t,o){const u=bp(t,.05,.32,.42,.5),h=sm(t,.42,.52)*(1-sm(t,.76,1));FR.off.set(-2.2*u+5.2*h,6*u,1.8*u-3*h);o.pitch=.17*u-.03*h;o.sw=.13*u-.24*h;o.by=.7*u-1.0*h;o.nx=-1.8*u+3.2*h;o.ny=1.8*u-3.6*h;o.nz=3*u-4.5*h;o.hp=.25*u-.15*h;o.jaw=.25+.75*u+.4*h;o.wflap=.62+.25*u-.3*h;o.wfold=.42-.25*u;o.tz=-.25*u+.3*h;o.glow=.9+.8*u;}},
 coletazo:{d:2.3,f(t,o){const w=bp(t,.02,.26,.32,.42),sp=sm(t,.34,.5)*(1-sm(t,.64,1)),hop=bp(t,.33,.41,.5,.6);o.tz=-1.2*w+1.6*sp;o.gry=-.42*w+1.05*sp;o.sw=.12*w-.2*sp;o.tamp=.15;o.nz=-4*w+3.5*sp;o.ny=1.5*w-1*sp;o.by=-1.0*w+.6*hop-.5*sp;o.pitch=-.04*sp;o.jaw=.25+.75*bp(t,.3,.42,.62,.85);o.wflap=.62+.2*w-.4*sp;o.wfold=.42-.3*sp;o.glow=.9+1.5*bp(t,.1,.34,.6,.9);for(const L of legs)L.off.y+=1.3*hop;}},
 embestida:{d:2.5,move:t=>opt.host?0:26*sm(t,.36,.9),f(t,o){const w=bp(t,0,.26,.33,.42),r=bp(t,.36,.46,.84,1);o.gx=this.move(t);o.nx=-2.6*w+3.6*r;o.ny=.6*w-4.4*r;o.by=-1.0*w-.5*r;o.hp=.1*w;o.wfold=.42+.65*r;o.wflap=.62-.38*r;o.jaw=.25+.3*w+.5*r;o.glow=.9+1.2*w;gait((t-.36)/.54,3,5*r,1.7*r);o.tamp=.4;}},
 pisoton:{d:2,f(t,o){const u=bp(t,.04,.3,.42,.5),h=sm(t,.42,.5)*(1-sm(t,.72,1));for(const L of legs)if(L.bend===-1)L.off.set(-1.2*u+1.2*h,5.2*u,.8*L.s*u);o.pitch=.2*u-.04*h;o.by=1.2*u-1.5*h;o.nx=-2.5*u+1.5*h;o.ny=3*u-3.5*h;o.hp=.5*u-.35*h;o.jaw=.25+.75*u;o.wflap=.62+.3*u-.45*h;o.wfold=.42-.3*u;o.glow=.9+1.2*u;o.tamp=.4;}},
 brasa:{d:3.4,f(t,o){const c=bp(t,0,.3,.8,1),b=bp(t,.44,.5,.75,.95);o.by=-1.5*c;o.ny=-2.2*c+1.5*b;o.nx=-1.5*c;o.hp=-.2*c+.5*b;o.jaw=.25+.3*c+.45*b;o.glow=.9+3.2*sm(t,0,.44)*(1-sm(t,.8,1));o.wflap=.62-.5*c-.1*Math.sin(t*50)*b;o.wfold=.42-.36*c;o.tamp=.3;for(const L of legs)L.off.z+=L.s*.8*c;}},
 fuego:{d:3.6,f(t,o){const i=bp(t,0,.24,.29,.36),f=bp(t,.3,.38,.84,.94);o.nx=-3.2*i+2.6*f;o.ny=2.6*i-3.3*f;o.hp=.4*i-.12*f;o.pitch=.06*i;o.jaw=.25+.2*i+.75*f;o.glow=.9+2.4*sm(t,0,.3)*(1-sm(t,.86,1));o.nz=f*Math.sin((t-.3)*PI2*1.4)*5.5;o.wflap=.62-.3*f;o.wfold=.42-.25*f;o.by=-.4*f;}},
 lluvia:{d:4,f(t,o){const k=bp(t,.03,.2,.7,.9);o.nx=-4.2*k;o.ny=5.6*k;o.hp=1.2*k;o.pitch=.15*k;o.jaw=.25+.75*k;o.glow=.9+1.6*k;o.wflap=.62-.5*k+.05*Math.sin(t*60)*k;o.wfold=.42-.36*k;o.nz=Math.sin(t*80)*.4*k;}},
 despegue:{d:2.6,next:'vuelo',f(t,o){o.by=-1.4*bp(t,0,.22,.28,.4);o.pose=sm(t,.3,.85);o.gy=14*sm(t,.3,1);o.flapSpd=1.5;o.jaw=.25+.3*bp(t,.2,.4,.6,.9);}},
 aterrizaje:{d:2.6,f(t,o){o.pose=1-sm(t,.3,.8);o.gy=14*(1-sm(t,0,.72));o.by=-1.2*bp(t,.66,.8,.84,1);o.flapSpd=1.4;}},
 muerte:{d:4.2,hold:1,f(t,o){const u=bp(t,0,.18,.3,.42),d=sm(t,.36,.72);o.ny=3.2*u;o.nx=-2*u;o.hp=.75*u;o.jaw=.25+.75*u+.35*d;o.dead=d;o.glow=.9*(1-sm(t,.36,.95))+1.2*u;o.wfold=.42+.75*d;o.wflap=.62-1.0*d;o.nz=3.5*d;o.tamp=1-d;}}};
/* ---- efectos: partículas (fuego, oro, polvo), meteoros y suelo en llamas, en coordenadas del mundo.
   Sin luces nuevas (no recompila nada del juego). opt.host: el juego pone las marcas y el daño; acá solo va lo que se ve ---- */
const HOST=!!opt.host,LQ=opt.lite?.5:1,gH=(x,z)=>opt.H?opt.H(x,z):0;
const fx=new THREE.Group(),mkG=new THREE.Group();outer.add(mkG);if(HOST)mkG.visible=false;
const FXN=opt.pet?4:opt.lite?600:1100,fP=new Float32Array(FXN*3),fC=new Float32Array(FXN*3),fS=new Float32Array(FXN),fV=new Float32Array(FXN*3),fL=new Float32Array(FXN*3),fF=new Float32Array(FXN),fK=new Uint8Array(FXN);let fI=0;
const fG=new THREE.BufferGeometry();fG.setAttribute('position',new THREE.BufferAttribute(fP,3));fG.setAttribute('col',new THREE.BufferAttribute(fC,3));fG.setAttribute('sz',new THREE.BufferAttribute(fS,1));
const fM=new THREE.ShaderMaterial({uniforms:{map:{value:glowTex},sc:{value:500}},blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,fog:false,
 vertexShader:'uniform float sc;attribute float sz;attribute vec3 col;varying vec3 vC;void main(){vC=col;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=min(256.,sz*sc/-mv.z);gl_Position=projectionMatrix*mv;}',
 fragmentShader:'uniform sampler2D map;varying vec3 vC;void main(){float a=texture2D(map,gl_PointCoord).a;gl_FragColor=vec4(vC*a*1.25,a);}'});
const fPts=new THREE.Points(fG,fM);fPts.frustumCulled=false;fPts.renderOrder=5;fx.add(fPts);
function emit(px,py,pz,vx,vy,vz,life,size,kind){const i=fI;fI=(fI+1)%FXN;fP[i*3]=px;fP[i*3+1]=py;fP[i*3+2]=pz;fV[i*3]=vx;fV[i*3+1]=vy;fV[i*3+2]=vz;fL[i*3]=life;fL[i*3+1]=life;fL[i*3+2]=size;fK[i]=kind;fF[i]=gH(px,pz)+.35;}
function burst(x,z,n,sp,kind,size){const y=gH(x,z)+.5;n=Math.ceil(n*LQ);for(let i=0;i<n;i++){const a=rnd()*PI2,e=rnd()*1.2,v=sp*(.4+rnd()*.6);emit(x,y,z,Math.cos(a)*Math.cos(e)*v,Math.sin(e)*v*.9,Math.sin(a)*Math.cos(e)*v,.5+rnd()*.7,size*(.6+rnd()*.8),kind);}}
function fxSim(dt){for(let i=0;i<FXN;i++){if(fL[i*3]<=0){fS[i]=0;continue;}const l=fL[i*3]-=dt,a=Math.max(0,l/fL[i*3+1]),k=fK[i],j=i*3;
  if(k===0){const dr=1-.45*dt;fV[j]*=dr;fV[j+2]*=dr;fV[j+1]=fV[j+1]*dr+2.5*dt;}else if(k===1)fV[j+1]-=24*dt;else{const dr=1-2*dt;fV[j]*=dr;fV[j+2]*=dr;fV[j+1]=fV[j+1]*dr+1.2*dt;}
  fP[j]+=fV[j]*dt;fP[j+1]+=fV[j+1]*dt;fP[j+2]+=fV[j+2]*dt;if(fP[j+1]<fF[i]){fP[j+1]=fF[i];fV[j+1]=Math.abs(fV[j+1])*.25;if(k===0){fV[j]*=.86;fV[j+2]*=.86;}}
  if(k===0){fC[j]=Math.min(1,a*3);fC[j+1]=Math.min(1,a*a*1.5);fC[j+2]=a*a*a*.7;fS[i]=fL[j+2]*(.45+1.6*(1-a));}
  else if(k===1){fC[j]=Math.min(1,a*2.2);fC[j+1]=.8*Math.min(1,a*1.7);fC[j+2]=.3*a;fS[i]=fL[j+2]*(.4+.6*a);}
  else{fC[j]=.5*a;fC[j+1]=.38*a;fC[j+2]=.22*a;fS[i]=fL[j+2]*(.6+1.8*(1-a));}}
 fG.attributes.position.needsUpdate=fG.attributes.col.needsUpdate=fG.attributes.sz.needsUpdate=true;}
const mkM=(op)=>new THREE.MeshBasicMaterial({color:0xff1505,transparent:true,opacity:op,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,side:THREE.DoubleSide});
function marker(geo,rect,par){const grp=new THREE.Group(),b=new THREE.Mesh(geo,mkM(.3)),f=new THREE.Mesh(geo,mkM(.5));b.rotation.x=f.rotation.x=-Math.PI/2;b.position.y=.1;f.position.y=.14;b.renderOrder=3;f.renderOrder=4;grp.add(b,f);grp.visible=false;(par||mkG).add(grp);
 return {grp,show(p,x,z,y){grp.visible=true;if(x!==undefined)grp.position.set(x,y||0,z);const q=Math.max(.02,Math.min(1,p));if(rect)f.scale.set(q,1,1);else f.scale.set(q,q,1);f.material.opacity=p>=1?.6+.25*Math.sin(st.t*22):.5;}};}
const sect=(r,ang,c)=>new THREE.CircleGeometry(r,40,c-ang/2,ang);
const MK=HOST?null:{fuego:marker(sect(23,1.25,0)),cola:marker(sect(25,3.9,Math.PI)),zarpa:marker(sect(11,1.7,-.35)),mord:marker(new THREE.CircleGeometry(4.5,28)),pisa:marker(new THREE.CircleGeometry(10.5,36)),brasa:marker(new THREE.CircleGeometry(14,40)),lane:marker((()=>{const q=new THREE.PlaneGeometry(32,10);q.translate(16,0,0);return q;})(),1)};
const rainMk=HOST?[]:Array.from({length:10},()=>marker(new THREE.CircleGeometry(3.4,24),0,fx));
let facc=0,hitCb=opt.onHit||null;const mo=V(0,0,0),md=V(0,0,0),wq=new THREE.Quaternion();
function hit(name,data){if(hitCb)hitCb(name,data);}
/* del espacio del dragón al mundo (toW: punto; dirW: dirección) */
const toW=v=>v.applyAxisAngle(up,st.gry).add(g.position).applyMatrix4(outer.matrixWorld),dirW=v=>v.applyAxisAngle(up,st.gry).applyQuaternion(wq);
const wv=V(0,0,0),wxz=(x,z)=>{toW(wv.set(x,0,z));return wv;};
/* suelo en llamas: cada impacto deja un charco de fuego unos segundos */
const burnG=new THREE.CircleGeometry(1,24),burns=Array.from({length:14},()=>{const grp=new THREE.Group(),d=new THREE.Mesh(burnG,new THREE.MeshBasicMaterial({color:0x0a0503,transparent:true,opacity:.6,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4})),gl=new THREE.Mesh(burnG,new THREE.MeshBasicMaterial({color:0xff5a10,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-6}));
 d.rotation.x=gl.rotation.x=-Math.PI/2;d.position.y=.08;gl.position.y=.12;d.renderOrder=2;gl.renderOrder=3;grp.add(d,gl);grp.visible=false;fx.add(grp);return {grp,d,gl,t:0,life:7,acc:0,x:0,z:0,r:3.4};});
function ignite(x,z,r,life){let b=burns[0];for(const q of burns)if(q.t<b.t)b=q;b.life=b.t=life||7;b.x=x;b.z=z;b.r=r||3.4;b.y=gH(x,z);b.grp.position.set(x,b.y,z);b.d.scale.setScalar(b.r*1.18);b.grp.visible=true;}
function burnSim(dt){for(const b of burns){if(b.t<=0)continue;b.t-=dt;if(b.t<=0){b.grp.visible=false;continue;}const k=Math.min(1,b.t/1.5),gr=Math.min(1,(b.life-b.t)/.3);b.d.material.opacity=.6*Math.min(1,b.t/.8);b.gl.material.opacity=(.4+.15*Math.sin(st.t*14+b.x))*k;b.gl.scale.setScalar(b.r*.95*gr);
  b.acc+=dt*26*k*LQ*Math.min(5,b.r*b.r/11.6);while(b.acc>=1){b.acc--;const a=rnd()*PI2,r=Math.sqrt(rnd())*b.r*.9;emit(b.x+Math.cos(a)*r,b.y+.4,b.z+Math.sin(a)*r,(rnd()-.5)*1.2,3.5+rnd()*4.5,(rnd()-.5)*1.2,.55+rnd()*.6,1.7+rnd()*1.5,0);}}}
const burning=()=>burns.filter(b=>b.t>0).map(b=>({x:b.x,z:b.z,r:b.r,t:b.t}));
/* meteoros de oro: caen del cielo sobre un punto del mundo, estallan y prenden el suelo */
const mets=[];
function meteor(x,z,dur,burn,delay,r){mets.push({x,z,y:gH(x,z),t:-(delay||0),dur:dur||1.6,burn:burn==null?7:burn,r:r||3.4,mk:HOST?null:rainMk.find(m=>!m.busy)});const m=mets[mets.length-1];if(m.mk)m.mk.busy=1;}
function metSim(dt){for(let i=mets.length-1;i>=0;i--){const m=mets[i];m.t+=dt;if(m.t<0)continue;const p=m.t/m.dur;if(m.mk)m.mk.show(p/.97,m.x,m.z,m.y);
  const q=(p-.82)/.18;if(q>0&&q<1){const x=m.x+7*(1-q),y=m.y+44*(1-q),z=m.z+3*(1-q);for(let k=0;k<5;k++)emit(x+(rnd()-.5),y+(rnd()-.5)*2,z+(rnd()-.5),(rnd()-.5)*2,4+rnd()*4,(rnd()-.5)*2,.35+rnd()*.3,2.6+rnd()*1.6,1);emit(x,y,z,0,-20,0,.12,5,1);}
  if(p>=1){burst(m.x,m.z,46,15,1,2.4);burst(m.x,m.z,14,6,2,4);burst(m.x,m.z,22,9,0,2.6);if(m.burn>0)ignite(m.x,m.z,m.r,m.burn);hit('lluvia',{x:m.x,z:m.z,r:m.r});if(m.mk){m.mk.grp.visible=false;m.mk.busy=0;}mets.splice(i,1);}}}
function fxUpdate(dt,name,pt,tn){outer.updateWorldMatrix(true,false);outer.getWorldQuaternion(wq);if(MK)for(const k in MK)MK[k].grp.visible=false;
 const cross=x=>pt<x&&tn>=x;
 if(name==='fuego'){if(MK&&tn<.9)MK.fuego.show(sm(tn,0,.32)>=.999?1:tn/.32,13,0);
  if(tn>.32&&tn<.86){toW(mo.set(5.2,-.4,0).applyQuaternion(head.quaternion).add(head.position));dirW(md.set(1,-.3,0).applyQuaternion(head.quaternion));facc+=dt*300*LQ;
   while(facc>=1){facc--;const sp=28+rnd()*10,sx=(rnd()-.5)*.36,sy=(rnd()-.5)*.26;hs.crossVectors(md,up).normalize();emit(mo.x,mo.y,mo.z,(md.x+hs.x*sx)*sp,(md.y+sy)*sp,(md.z+hs.z*sx)*sp,.75+rnd()*.45,2.2+rnd()*1.6,0);}
   if(cross(.34))hit('fuego',{t:'inicio'});}}
 else if(name==='lluvia'){if(!HOST&&cross(.02)){const T=(opt.rainTargets&&opt.rainTargets())||Array.from({length:10},(_, i)=>{const a=i/10*PI2+rnd()*.5,r=12+rnd()*16;const w=wxz(4+Math.cos(a)*r,Math.sin(a)*r);return [w.x,w.z];});T.forEach((p,j)=>meteor(p[0],p[1],1.6,7,.3+j*.14));}}
 else if(name==='coletazo'){if(MK&&tn<.48)MK.cola.show(tn/.36,-5,0);
  if(tn>.33&&tn<.66){for(const i of [N,N-7,N-15,N-24,N-34]){toW(mo.copy(P[i]));emit(mo.x+(rnd()-.5),mo.y+rnd(),mo.z+(rnd()-.5),(rnd()-.5)*2,1+rnd()*3,(rnd()-.5)*2,.4+rnd()*.35,2.2+rnd()*1.6,0);emit(mo.x,gH(mo.x,mo.z)+.5,mo.z,(rnd()-.5)*5,2+rnd()*4,(rnd()-.5)*5,.6+rnd()*.5,3.5+rnd()*2.5,2);if(rnd()<.6)emit(mo.x,mo.y,mo.z,(rnd()-.5)*12,5+rnd()*8,(rnd()-.5)*12,.5+rnd()*.4,1.3,1);}}
  if(cross(.5)){hit('coletazo',{});for(let k=0;k<90*LQ;k++){const a=Math.PI*.35+rnd()*Math.PI*1.3,v=16+rnd()*14,kd=k%3===0?1:2,w=wxz(-5+Math.cos(a)*6,Math.sin(a)*6),wx=w.x,wz=w.z;dirW(md.set(Math.cos(a),0,Math.sin(a)));emit(wx,gH(wx,wz)+.5,wz,md.x*v,kd===1?4+rnd()*6:1+rnd()*2,md.z*v,.7+rnd()*.5,kd===1?1.5:4+rnd()*2.5,kd);}}}
 else if(name==='zarpazo'){if(MK&&tn<.54)MK.zarpa.show(tn/.42,9,0);if(cross(.52)){const p=FR.stand,w=wxz(p.x+5,p.z-2.5),wx=w.x,wz=w.z;burst(wx,wz,34,11,2,3.6);burst(wx,wz,24,13,1,1.6);hit('zarpazo',{});}}
 else if(name==='mordida'){if(MK&&tn<.52)MK.mord.show(tn/.4,20.5,0);if(cross(.5))hit('mordida',{});}
 else if(name==='embestida'){if(MK&&tn<.9)MK.lane.show(tn/.36,10,0);if(tn>.4&&tn<.9){for(let k=0;k<3;k++){const w=wxz(-4+rnd()*8,(rnd()-.5)*7),wx=w.x,wz=w.z;emit(wx,gH(wx,wz)+.5,wz,(rnd()-.5)*4,2+rnd()*3,(rnd()-.5)*4,.6+rnd()*.5,3+rnd()*2,2);}}if(cross(.4))hit('embestida',{});}
 else if(name==='pisoton'){if(MK&&tn<.52){MK.pisa.show(tn/.46,1,0);}if(cross(.5)){hit('pisoton',{});for(let k=0;k<70*LQ;k++){const a=rnd()*PI2,r0=3+rnd()*5,v=9+rnd()*10,w=wxz(1+Math.cos(a)*r0,Math.sin(a)*r0),wx=w.x,wz=w.z;dirW(md.set(Math.cos(a),0,Math.sin(a)));emit(wx,gH(wx,wz)+.5,wz,md.x*v,1+rnd()*3,md.z*v,.6+rnd()*.5,k%4?4+rnd()*2.5:1.6,k%4?2:1);}}}
 else if(name==='brasa'){if(MK&&tn<.5)MK.brasa.show(tn/.44,-1,0);if(tn>.2&&tn<.46){for(let k=0;k<2;k++){const i=Math.round(N*(.3+rnd()*.3));toW(mo.copy(P[i]));emit(mo.x+(rnd()-.5)*3,mo.y-2,mo.z+(rnd()-.5)*3,(rnd()-.5)*3,-3-rnd()*3,(rnd()-.5)*3,.3+rnd()*.3,1.6+rnd(),0);}}
  if(cross(.46)){hit('brasa',{});const c=wxz(-1,0),cx=c.x,cz=c.z;for(let k=0;k<150*LQ;k++){const a=rnd()*PI2,v=10+rnd()*16;emit(cx+Math.cos(a)*2,gH(cx,cz)+.8,cz+Math.sin(a)*2,Math.cos(a)*v,1+rnd()*5,Math.sin(a)*v,.6+rnd()*.6,2.4+rnd()*2,0);}if(!HOST)ignite(cx,cz,14,6);}}
 else if(name==='aterrizaje'&&cross(.72)){const w=wxz(0,0);burst(w.x,w.z,50,12,2,4.5);}
 metSim(dt);burnSim(dt);fxSim(dt);}
function anim(name,t){const c=CLIPS[name]||CLIPS.quieto;const T0=st.t;Object.assign(st,Z0);st.t=T0;for(const L of legs)L.off.set(0,0,0);c.f(Math.min(1,Math.max(0,t/c.d)),st);}
const cur={name:'quieto',t:0};
function play(name){if(CLIPS[name]){cur.name=name;cur.t=0;}}
function update(dt){const c=CLIPS[cur.name],pt=cur.t/c.d;cur.t+=dt;let done=false;if(cur.t>=c.d){if(c.loop)cur.t%=c.d;else if(c.hold)cur.t=c.d;else done=true;}
 if(done){if(c.move)outer.translateX(c.move(1));cur.name=c.next||'quieto';cur.t=0;}
 const c2=CLIPS[cur.name];anim(cur.name,cur.t);if(c2.speed&&!HOST)outer.translateX(c2.speed*dt);fxUpdate(dt,cur.name,done?0:Math.min(pt,cur.t/c2.d),cur.t/c2.d);step(st.t+dt);}
return {g:outer,step,st,head,CLIPS,anim,play,update,cur,fx,fxMat:fM,burning,meteor,ignite,onHit:f=>{hitCb=f;},setPose:p=>{Z0.pose=p;st.pose=p;}};};
