#!/usr/bin/env python3
"""Arma public/index.html a partir de las piezas de web/:
   shell_head.html (cabecera y CSS) + views.css + shell_body.html (con views.html adentro) + dl_block.js + shell_js.js (con views.js y data.json adentro).
   Uso: scripts/web/assemble.py   (desde la raíz del repo)"""
import json,os,sys
R=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
W=os.path.join(R,'web');P=os.path.join(R,'public')
rd=lambda n:open(os.path.join(W,n),encoding='utf-8').read()
head=rd('shell_head.html');assert '</style>' in head
head=head.replace('</style>',rd('views.css')+'</style>')
body=rd('shell_body.html').replace('__VIEWS__',rd('views.html'))
js=rd('shell_js.js').replace('/* ===== arranque: el sol de NOX','/* ===== fichas ===== */\n'+rd('views.js')+'\n/* ===== arranque: el sol de NOX')
data=json.dumps(json.load(open(os.path.join(W,'data.json'),encoding='utf-8')),ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
js=js.replace('__DATA__',data).replace('__GLOS__',rd('glos.js'))
page=head+'\n'+body+'\n<script>\n'+rd('dl_block.js')+'\n'+js+'\n</script>\n'
# versión de cada imagen en la dirección (?v=huella): cuando una foto cambia, el celular y la caché de Cloudflare la bajan de nuevo en vez de mostrar la vieja
import hashlib,re
VER={}
for dp,_,fs in os.walk(os.path.join(W,'img','w')):
    for f in fs:
        if f.endswith('.webp'):
            rel=os.path.relpath(os.path.join(dp,f),os.path.join(W,'img','w'))[:-5].replace(os.sep,'/')
            VER[rel]=hashlib.md5(open(os.path.join(dp,f),'rb').read()).hexdigest()[:8]
page=re.sub(r'img/w/([a-z0-9_/]+)\.webp(?!\?)',lambda m:'img/w/'+m.group(1)+'.webp'+('?v='+VER[m.group(1)] if m.group(1) in VER else ''),page)
page=page.replace("const IMG=n=>'img/w/'+n+'.webp';const ic=n=>'img/w/ic/'+n+'.webp';","const IMGV="+json.dumps(VER,separators=(',',':'))+";const IMG=n=>'img/w/'+n+'.webp'+(IMGV[n]?'?v='+IMGV[n]:'');const ic=n=>'img/w/ic/'+n+'.webp'+(IMGV['ic/'+n]?'?v='+IMGV['ic/'+n]:'');",1)
assert 'IMGV=' in page
top='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#1a1d47"><style>img{max-width:100%}[hidden]{display:none!important}</style>'
i=page.index('<div id="intro"')
os.makedirs(P,exist_ok=True)
open(os.path.join(P,'index.html'),'w',encoding='utf-8').write(top+page[:i]+'</head><body>'+page[i:]+'</body></html>')
print('public/index.html',len(page))
