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
def savew(im,name,w,q=86):
    if im.width>w:im=im.resize((w,round(im.height*w/im.width)),Image.LANCZOS)
    im.save(f'{O}/{name}.webp','WEBP',quality=q,method=6)
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
def lineup(order,W,H,step,heights,name):
    c=canvas(W,H);n=len(order);ims=[]
    for i,k in enumerate(order):
        im=fit(R[k],W,int(H*heights[i]));ims.append(im)
    centre=sorted(range(n),key=lambda i:-abs(i-(n-1)/2))
    for i in centre:
        im=ims[i];x=int(W/2-im.width/2+(i-(n-1)/2)*step);y=H-im.height;c.alpha_composite(im,(max(0,x),y)) if 0<=x<=W-im.width else c.alpha_composite(im,(min(max(0,x),W-im.width),y))
    savew(c,name,1400)
if len(R)==5:
    lineup(['hechicero','arquera','caballero','gladiador','mburuvicha'],1400,1250,300,[.86,.93,1,.93,.86],'hero_portadores')
    lineup(['mburuvicha','gladiador','caballero','arquera','hechicero'],1500,1050,320,[.86,.92,1,.92,.86],'cut_razas')
# ---- sets: retratos de ficha y recorte del capítulo
S={}
for f in glob.glob(AS+'/*_[0-6].png'):
    b=os.path.basename(f)[:-4];cls,t=b.rsplit('_',1)
    if cls not in CLS:continue
    im=trim(mainpart(Image.open(f)),.03);S[(cls,int(t))]=im
    c=canvas(max(im.width,int(im.height*3/4)),max(im.height,int(im.width*4/3)));c.paste(im,((c.width-im.width)//2,c.height-im.height));savew(c,f'set_{cls}_{t}',720)
if all((k,6) in S for k in CLS):
    R0=R;R={k:S[(k,6)] for k in CLS}
    lineup(['hechicero','caballero','gladiador','mburuvicha','arquera'],1500,1050,330,[.86,.95,1,.95,.86],'cut_sets')
    R=R0
# ---- ítems: armas en abanico, el escudo atrás
names=['caballero_weapon','hechicero_weapon','arquera_weapon','gladiador_weapon','mburuvicha_weapon']
if all(ok(f'{BIG}/{n}.png') for n in names+['shield']):
    c=canvas(1400,1050)
    sh=trim(Image.open(f'{BIG}/shield.png'),.02);sh=fit(sh,520,760);c.alpha_composite(sh,(700-sh.width//2,1050-sh.height-40))
    for i,n in enumerate(names):
        im=trim(Image.open(f'{BIG}/{n}.png'),.02)
        # cada arma apunta hacia arriba y se abre en abanico
        if im.width>im.height:im=im.rotate(90,expand=True)
        im=fit(im,260,820);ang=-34+i*17;im=im.rotate(-ang,expand=True,resample=Image.BICUBIC)
        import math;x=int(700+math.sin(math.radians(ang))*330-im.width//2);y=int(1050-im.height-20-abs(ang)*1.2)
        c.alpha_composite(im,(max(0,x),max(0,y)))
    savew(c,'cut_items',1400)
# ---- íconos de inventario a 128 px (ic/)
IC=WORK+'/icons'
if os.path.isdir(IC):
    os.makedirs(O+'/ic',exist_ok=True)
    for f in glob.glob(IC+'/*.png'):
        im=Image.open(f).convert('RGBA');bg=Image.new('RGB',im.size,(31,23,19));bg.paste(im,mask=im.split()[3]);w,h=bg.size
        bg=bg.crop((int(w*.1),int(h*.1),int(w*.9),int(h*.9))).resize((128,128),Image.LANCZOS);bg.save(f'{O}/ic/{os.path.basename(f)[:-4]}.webp','WEBP',quality=85)
# ---- ícono de la app para el panel de descarga
ic=Image.open(os.path.join(ROOT,'web/img/icon-512.png')).convert('RGBA');m=Image.new('L',ic.size,0)
from PIL import ImageDraw;ImageDraw.Draw(m).rounded_rectangle((0,0,511,511),radius=110,fill=255);ic.putalpha(m)
c=canvas(620,620);c.alpha_composite(ic,(54,54));savew(c,'cut_app',620)
print('listo',len(os.listdir(O)))
