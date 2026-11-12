#!/bin/sh
# Marca un parche nuevo antes de publicar el juego.
# Uso: scripts/patch.sh "Título" "novedad 1" "novedad 2" ...   (OPCIONAL=1 para que no sea obligatorio)
# - Pone la versión (AAAAMMDDHHMM, hora de Paraguay) en public/jugar/index.html (NOX_BUILD)
# - Escribe public/jugar/build.json: build, min (igual a build: obligatorio para jugar en línea), título y notas
# - Rehace public/jugar/cache.json (scripts/swfiles.py): la lista de archivos con huella que el juego guarda en el dispositivo
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
# historial de parches (botón "Historial de parches" en el inicio): el más nuevo primero, hasta 80
try:hist=json.load(open('public/jugar/patches.json',encoding='utf-8'))
except Exception:hist=[]
hist=[h for h in hist if h.get('build')!=b]
hist.insert(0,{'build':b,'title':t or 'Parche de NOX','notes':notes})
json.dump(hist[:80],open('public/jugar/patches.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
assert notes,'el parche necesita al menos una novedad (se muestran en la actualización obligatoria)'
print('parche',b,'mínimo',mn)
PY
python3 scripts/swfiles.py
echo "Recordatorio: actualizar también la web en el mismo push (ver CLAUDE.md: sync.sh datos + fotos de lo que cambió)."
