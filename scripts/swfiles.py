#!/usr/bin/env python3
# Arma public/jugar/cache.json: la lista de archivos que el juego guarda en el dispositivo (service worker sw.js),
# cada uno con su huella (md5 corto) y su tamaño. Si la huella de un archivo cambia, el celular baja solo ese archivo.
# Lo llama scripts/patch.sh; correrlo a mano si se tocan assets sin sacar parche.
import hashlib,json,os
root=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','public','jugar')
f={};tot=0
for d in ('vendor','assets'):
    for base,_,names in sorted(os.walk(os.path.join(root,d))):
        for n in sorted(names):
            if n.startswith('.'):continue
            p=os.path.join(base,n);b=open(p,'rb').read()
            f[os.path.relpath(p,root).replace(os.sep,'/')]=[hashlib.md5(b).hexdigest()[:10],len(b)];tot+=len(b)
json.dump({'v':1,'n':len(f),'bytes':tot,'f':f},open(os.path.join(root,'cache.json'),'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
print('cache.json:',len(f),'archivos,',round(tot/1048576,1),'MB')
