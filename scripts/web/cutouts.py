#!/usr/bin/env python3
"""Recortes con transparencia para la web (fichas, capítulos y portada) a partir de las fotos de gallery.js.
   Uso: scripts/web/cutouts.py CARPETA_DE_FOTOS   (con subcarpetas alas/, mobs/, razas/, sets/, big/)"""
import os,glob,json
from PIL import Image,ImageOps
import sys
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WORK=os.environ.get('WORK') or (sys.argv[1] if len(sys.argv)>1 else '/tmp/nox-gal')
A=WORK+'/alas';AM=WORK+'/mobs';AR=WORK+'/razas';AS=WORK+'/sets';BIG=WORK+'/big';O=os.environ.get('OUT') or os.path.join(ROOT,'web/img/w')
os.makedirs(O,exist_ok=True)
def trim(im,pad=.04,thr=8):
    im=im.convert('RGBA');a=im.getchannel('A').point(lambda v:255 if v>thr else 0);bb=a.getbbox()
    if not bb:return im
    w,h=bb[2]-bb[0],bb[3]-bb[1];px,py=int(w*pad),int(h*pad)
    return im.crop((max(0,bb[0]-px),max(0,bb[1]-py),min(im.width,bb[2]+px),min(im.height,bb[3]+py)))
import numpy as np
from scipy import ndimage
def mainpart(im,thr=40,grow=.12):
    """Se queda con la pieza grande (y lo que la rodea): saca el cuervo u otras cosas sueltas."""
    im=im.convert('RGBA');a=np.asarray(im.getchannel('A'))>thr
    lab,n=ndimage.label(ndimage.binary_dilation(a,iterations=6))
    if n<=1:return im
    sizes=ndimage.sum(a,lab,range(1,n+1));big=int(np.argmax(sizes))+1
    sl=ndimage.find_objects(lab);y0,y1=sl[big-1][0].start,sl[big-1][0].stop;x0,x1=sl[big-1][1].start,sl[big-1][1].stop;gx,gy=(x1-x0)*grow,(y1-y0)*grow
    keepids=[i+1 for i,o in enumerate(sl) if o and o[1].stop>=x0-gx and o[1].start<=x1+gx and o[0].stop>=y0-gy and o[0].start<=y1+gy]
    keep=np.isin(lab,keepids)
    arr=np.asarray(im).copy();arr[...,3]=np.where(keep,arr[...,3],0)
    return Image.fromarray(arr,'RGBA')
STATS={'nuevas':0,'cambiadas':0,'iguales':0}
FORCE=os.environ.get('FORCE')=='1'
def same(a,b,tol=9.0,frac=.04):
    """¿Son la misma imagen a ojo? Tolera el ruido de render (partículas, brillos) para no ensuciar el repo."""
    if abs(a.width-b.width)>max(4,a.width*.03) or abs(a.height-b.height)>max(4,a.height*.03):return False
    if a.size!=b.size:  # recortes que difieren por un par de píxeles: se centran en el mismo lienzo
        W,H=max(a.width,b.width),max(a.height,b.height);ca=Image.new('RGBA',(W,H),(0,0,0,0));cb=Image.new('RGBA',(W,H),(0,0,0,0))
        ca.paste(a.convert('RGBA'),((W-a.width)//2,(H-a.height)//2));cb.paste(b.convert('RGBA'),((W-b.width)//2,(H-b.height)//2));a,b=ca,cb
    x=np.asarray(a.convert('RGBA')).astype(np.int16);y=np.asarray(b.convert('RGBA')).astype(np.int16)
    best=None
    for dy in (-1,0,1):  # un píxel de corrimiento no cuenta como cambio
        for dx in (-1,0,1):
            xs=x[max(0,dy):x.shape[0]+min(0,dy),max(0,dx):x.shape[1]+min(0,dx)];ys=y[max(0,-dy):y.shape[0]+min(0,-dy),max(0,-dx):y.shape[1]+min(0,-dx)]
            d=np.abs(xs-ys).max(2);m=(d.mean(),(d>40).mean())
            if best is None or m[0]<best[0]:best=m
    return best[0]<tol and best[1]<frac
def guard(path,im):
    """Guarda solo si la imagen cambió de verdad respecto de la que ya está en el repo."""
    if not FORCE and os.path.exists(path):
        try:
            old=Image.open(path);old.load()
            if same(old,im):STATS['iguales']+=1;return False
            STATS['cambiadas']+=1
        except Exception:STATS['cambiadas']+=1
    else:STATS['nuevas']+=1
    return True
def soft(im,F=.07):
    """Bordes suaves: el resplandor que llega al borde de la foto se apaga de a poco (sin recuadro) y se borra la neblina casi invisible."""
    im=im.convert('RGBA');a=np.asarray(im.getchannel('A')).astype(np.float32);h,w=a.shape
    f=max(4,int(min(w,h)*F));y=np.minimum(np.arange(h),np.arange(h)[::-1])[:,None];x=np.minimum(np.arange(w),np.arange(w)[::-1])[None,:]
    t=np.clip(np.minimum(y,x)/f,0,1);fade=t*t*(3-2*t)
    k=np.clip((a-40)/160,0,1)   # lo sólido (cuerpo) no se toca; lo translúcido (brillo, humo) se apaga hacia el borde
    a2=a*(k+(1-k)*fade)
    a2=np.where(a2<8,0,np.where(a2<24,(a2-8)*1.5,a2))
    im.putalpha(Image.fromarray(np.clip(a2,0,255).astype(np.uint8)));return im
def savew(im,name,w,q=86):
    if im.width>w:im=im.resize((w,round(im.height*w/im.width)),Image.LANCZOS)
    im=soft(im)
    path=f'{O}/{name}.webp'
    if not guard(path,im):return
    im.save(path,'WEBP',quality=q,method=6)
def ok(f):return os.path.exists(f)
def fit(im,w,h):
    s=min(w/im.width,h/im.height);return im.resize((max(1,int(im.width*s)),max(1,int(im.height*s))),Image.LANCZOS)
def canvas(w,h):return Image.new('RGBA',(w,h),(0,0,0,0))
# ---- alas: una por raza/etapa (para la ficha) y el recorte del capítulo
for f in glob.glob(A+'/*_g*_*.png'):
    b=os.path.basename(f)[:-4];cls,g,lv=b.split('_');im=trim(mainpart(Image.open(f)),.06)
    c=canvas(max(im.width,int(im.height*4/3)),max(im.height,int(im.width*3/4)));c.paste(im,((c.width-im.width)//2,(c.height-im.height)//2));savew(c,f'wing_{cls}_{g[1]}_{lv}',900)
if ok(A+'/arquera_g2_12.png'):savew(trim(mainpart(Image.open(A+'/arquera_g2_12.png')),.05),'cut_alas',1200)
elif ok(A+'/caballero_g2_12.png'):savew(trim(Image.open(A+'/caballero_g2_12.png'),.05),'cut_alas',1200)
# ---- mobs: ficha (cuadrado) y recortes de capítulos
M=list(json.load(open(os.path.join(ROOT,'web/data.json'),encoding='utf-8'))['mobs'].keys())
for k in M:
    f=f'{AM}/{k}.png'
    if not ok(f):continue
    im=trim(Image.open(f),.06);s=max(im.width,im.height);c=canvas(s,s);c.paste(im,((s-im.width)//2,(s-im.height)//2));savew(c,'mob_'+k,640)
for k,name in [('jasyjatere','cut_jasyjatere'),('teju','cut_teju'),('tau','cut_tau')]:
    f=f'{AM}/{k}.png'
    if ok(f):savew(trim(Image.open(f),.04),name,1000)
# ---- razas: retratos (ficha, 3:4 con aire) y lineup de portada y capítulo
CLS=['caballero','hechicero','arquera','gladiador','mburuvicha']
R={}
for k in CLS:
    f=f'{AR}/raza_{k}.png'
    if ok(f):R[k]=trim(mainpart(Image.open(f)),.03)
for k,im in R.items():
    c=canvas(max(im.width,int(im.height*3/4)),max(im.height,int(im.width*4/3)));c.paste(im,((c.width-im.width)//2,c.height-im.height));savew(c,'raza_'+k,720)
def body(im):
    """Columnas del cuerpo: el ancho ocupado en la franja de piernas y torso (las alas quedan más arriba)."""
    a=np.asarray(im.getchannel('A'))>60;h=a.shape[0]
    # piernas y pies: franja baja y densa, donde las puntas de las alas casi no llegan
    cols=np.where(a[int(h*.8):int(h*.97)].mean(0)>.18)[0]
    return (int(cols[0]),int(cols[-1])+1) if len(cols) else (0,im.width)
def lineup(order,H,scales,lift,name,gap=-.05,w=1600):
    """Fila en V: el del medio adelante, los demás más chicos y atrás. Primero se pegan todos enteros (alas incluidas),
       después solo los cuerpos encima, así las alas del vecino nunca tapan a un personaje."""
    ims=[fit(R[k],10**5,int(H*s)) for k,s in zip(order,scales)];n=len(ims)
    bs=[body(im) for im in ims];bw=[b[1]-b[0] for b in bs];cx=[0.0]
    # paso fijo según la altura: los cuerpos quedan parejos y separados; las alas se cruzan solo por detrás
    step=H*(.36+gap*.5)
    for i in range(1,n):cx.append(cx[-1]+step*(scales[i-1]+scales[i])/2)
    mid=(cx[0]+cx[-1])/2;xs=[int(c-mid-(b[0]+b[1])/2) for c,b in zip(cx,bs)]
    x0=min(xs);x1=max(x+im.width for x,im in zip(xs,ims));Hc=H+max(lift)
    c=canvas(x1-x0,Hc);pos=[(x-x0,Hc-im.height-l) for x,im,l in zip(xs,ims,lift)]
    back=sorted(range(n),key=lambda i:-abs(i-(n-1)/2))
    for i in back:c.alpha_composite(ims[i],pos[i])
    for i in back:
        b=bs[i];m=int(bw[i]*.12);box=(max(0,b[0]-m),0,min(ims[i].width,b[1]+m),ims[i].height)
        c.alpha_composite(ims[i].crop(box),(pos[i][0]+box[0],pos[i][1]))
    savew(trim(c,.02),name,w)
V5=([.8,.9,1,.9,.8],[120,55,0,55,120])
# separación positiva: cada portador queda entero y a la vista; solo las puntas de las alas se cruzan por detrás
if len(R)==5:
    lineup(['hechicero','arquera','caballero','gladiador','mburuvicha'],1100,*V5,'hero_portadores',gap=.22)
    lineup(['mburuvicha','gladiador','caballero','arquera','hechicero'],1100,*V5,'cut_razas',gap=.22)
# ---- sets: retratos de ficha y recorte del capítulo
S={}
for f in glob.glob(AS+'/*_[0-6].png'):
    b=os.path.basename(f)[:-4];cls,t=b.rsplit('_',1)
    if cls not in CLS:continue
    im=trim(mainpart(Image.open(f)),.03);S[(cls,int(t))]=im
    c=canvas(max(im.width,int(im.height*3/4)),max(im.height,int(im.width*4/3)));c.paste(im,((c.width-im.width)//2,c.height-im.height));savew(c,f'set_{cls}_{t}',720)
if all((k,6) in S for k in CLS):
    R0=R;R={k:S[(k,6)] for k in CLS}
    lineup(['hechicero','caballero','gladiador','mburuvicha','arquera'],1100,*V5,'cut_sets',gap=.12)
    R=R0
# ---- ítems: armas en abanico, el escudo atrás
names=['caballero_weapon','hechicero_weapon','arquera_weapon','gladiador_weapon','mburuvicha_weapon']
if all(ok(f'{BIG}/{n}.png') for n in names+['shield']):
    c=canvas(1400,1050)
    sh=trim(Image.open(f'{BIG}/shield.png'),.02);sh=fit(sh,430,620);c.alpha_composite(sh,(700-sh.width//2,1050-sh.height-60))
    for i,n in enumerate(names):
        im=trim(Image.open(f'{BIG}/{n}.png'),.02)
        # cada arma apunta hacia arriba y se abre en abanico
        # los íconos vienen en diagonal (empuñadura abajo a la izquierda): se enderezan antes de armar el abanico
        a=np.asarray(im.getchannel('A'))>40;h0,w0=a.shape;bl=a[h0//2:,:w0//2].sum();br=a[h0//2:,w0//2:].sum()
        im=trim(im.rotate(45 if bl>=br else -45,expand=True,resample=Image.BICUBIC),.02)
        if im.width>im.height:im=im.rotate(90,expand=True)
        im=fit(im,230,860);ang=-34+i*17;im=im.rotate(-ang,expand=True,resample=Image.BICUBIC)
        import math;x=int(700+math.sin(math.radians(ang))*330-im.width//2);y=int(1050-im.height-20-abs(ang)*1.2)
        c.alpha_composite(im,(max(0,x),max(0,y)))
    savew(c,'cut_items',1400)
# ---- íconos de inventario a 128 px (ic/)
IC=WORK+'/icons'
if os.path.isdir(IC):
    os.makedirs(O+'/ic',exist_ok=True)
    for f in glob.glob(IC+'/*.png'):
        im=Image.open(f).convert('RGBA');bg=Image.new('RGB',im.size,(31,23,19));bg.paste(im,mask=im.split()[3]);w,h=bg.size
        bg=bg.crop((int(w*.1),int(h*.1),int(w*.9),int(h*.9))).resize((128,128),Image.LANCZOS);pth=f'{O}/ic/{os.path.basename(f)[:-4]}.webp'
        if guard(pth,bg):bg.save(pth,'WEBP',quality=85)
# ---- ícono de la app para el panel de descarga
ic=Image.open(os.path.join(ROOT,'web/img/icon-512.png')).convert('RGBA');m=Image.new('L',ic.size,0)
from PIL import ImageDraw;ImageDraw.Draw(m).rounded_rectangle((0,0,511,511),radius=110,fill=255);ic.putalpha(m)
c=canvas(620,620);c.alpha_composite(ic,(54,54));savew(c,'cut_app',620)
print('listo:',STATS['nuevas'],'nuevas,',STATS['cambiadas'],'cambiadas,',STATS['iguales'],'sin cambios (no se tocaron)')
