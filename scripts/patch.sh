#!/bin/sh
# Marca un parche nuevo antes de publicar el juego.
# Uso: scripts/patch.sh "Título" "novedad 1" "novedad 2" ...   (OPCIONAL=1 para que no sea obligatorio)
# - Pone la versión (AAAAMMDDHHMM, hora de Paraguay) en public/jugar/index.html (NOX_BUILD)
# - Escribe public/jugar/build.json: build, min (igual a build: obligatorio para jugar en línea), título y notas
set -e
cd "$(dirname "$0")/.."
B=$(TZ=America/Asuncion date +%Y%m%d%H%M)
T="$1"; shift || true
python3 - "$B" "$T" "$@" <<'PY'
import json,re,sys,os
b,t,notes=sys.argv[1],sys.argv[2],sys.argv[3:]
p='public/jugar/index.html';s=open(p,encoding='utf-8').read()
s2=re.sub(r"const NOX_BUILD='[^']*';",f"const NOX_BUILD='{b}';",s,count=1)
assert s2!=s or f"'{b}'" in s,'no encontré NOX_BUILD'
open(p,'w',encoding='utf-8').write(s2)
old={}
try:old=json.load(open('public/jugar/build.json',encoding='utf-8'))
except Exception:pass
mn=old.get('min',b) if os.environ.get('OPCIONAL')=='1' else b
json.dump({'build':b,'min':mn,'title':t or 'Hay un parche nuevo de NOX','notes':notes},open('public/jugar/build.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
print('parche',b,'mínimo',mn)
PY
