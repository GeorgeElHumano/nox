# Genera el catálogo de la tienda (precios en guaraníes) a partir de los datos del juego
import json
d=json.load(open('/home/claude/nox/gamedata.json'))
CLS=['caballero','hechicero','arquera','gladiador','mburuvicha']
SLOTS=['helm','armor','pants','gloves','boots']
PIECE=[3000,5000,8000,12000,18000,26000,36000]
r500=lambda x:int(round(x/500.0))*500
def hexc(n):return '#%06x'%n
items=[]
def add(id,name,cat,price,give,cls=None,tier=None,col=None,desc=''):
    items.append(dict(id=id,name=name,cat=cat,price=price,give=give,cls=cls,tier=tier,col=col,desc=desc))
for c in CLS:
    cn=d['CLASSES'][c]['name']
    for t in range(7):
        col=hexc(d['TIERGLOW'][c][t]);lvl=d['TREQ_LVL'][t]
        slots=[s for s in SLOTS if not(c=='gladiador' and s=='helm')]
        for s in slots:
            add(f'eq:{c}:{s}:{t}',f"{d['SLOTN'][c][s]} {d['SETN'][c][t]}",'set',PIECE[t],[{'k':s,'c':c,'t':t}],c,t,col,f'Set {t+1} de {cn} · nivel {lvl}')
        add(f'full:{c}:{t}',f"Set completo {d['SETN'][c][t]}",'set',r500(PIECE[t]*len(slots)*0.8),[{'k':s,'c':c,'t':t} for s in slots],c,t,col,f'{len(slots)} piezas con 20% de descuento · nivel {lvl}')
        add(f'eq:{c}:weapon:{t}',d['WNAME'][c][t],'arma',r500(PIECE[t]*1.6),[{'k':'weapon','c':c,'t':t}],c,t,col,f'Arma {t+1} de {cn} · nivel {lvl}')
        if c=='caballero':
            add(f'eq:{c}:shield:{t}',d['SHNAME'][t],'arma',PIECE[t],[{'k':'shield','c':c,'t':t}],c,t,col,f'Escudo {t+1} · nivel {lvl}')
    W=d['WPALS'][c]
    for st,(lv,pr) in enumerate(zip([0,4,8,12],[25000,45000,70000,100000])):
        add(f'wings:{c}:{st}',f"{d['WINGN'][c]}"+(f' +{lv}' if lv else ''),'alas',pr,[{'k':'wings','c':c,'t':0,'lv':lv}],c,st,W[st]['mid'],f'Etapa {st+1} de 4')
    add(f'wings2:{c}',d['WINGN2'][c],'alas',150000,[{'k':'wings','c':c,'t':0,'lv':0,'g':2}],c,4,W[3]['tip'],'Segunda generación, con un segundo par')
for k,pr in [('imp',20000),('hada',20000),('rudolf',15000)]:
    p=d['PETS'][k];add(f'pet:{k}',p['n'],'mascota',pr,[{'k':'pet','sub':k}],None,None,p['col'],p['desc'])
for k,pr in [('tupa',2500),('jasy',4000),('yvy',5000),('kerana',3500)]:
    g=d['GEMS'][k]
    add(f'gem:{k}:1',g['name'],'gema',pr,[{'k':'gem','sub':k,'n':1}],None,None,g['col'],g['desc'])
    add(f'gem:{k}:10',g['name']+' ×10','gema',r500(pr*8),[{'k':'gem','sub':k,'n':10}],None,None,g['col'],'Diez gemas, pagás ocho')
for k,n,pr in [('hp3',100,5000),('mp3',100,5000)]:
    add(f'pot:{k}:{n}',d['POTS'][k]['name']+f' ×{n}','consumible',pr,[{'k':'pot','sub':k,'n':n}],None,None,'#ff5a5a' if k.startswith('hp') else '#5a8aff','')
add('scroll:regreso:20',d['SCROLLS']['regreso']['name']+' ×20','consumible',3000,[{'k':'scroll','sub':'regreso','n':20}],None,None,'#e6b04b',d['SCROLLS']['regreso']['desc'])
for n,pr in [(5000000,5000),(25000000,20000),(100000000,70000)]:
    add(f'gold:{n}',f'{n//1000000} millones de oro del reino','oro',pr,[{'k':'gold','n':n}],None,None,'#ffd23a','Llega al baúl de Ña Chela')
js='export const CATALOG='+json.dumps(items,ensure_ascii=False)+';\n'
open('/home/claude/nox/lib/catalog.js','w').write(js)
json.dump(items,open('/home/claude/nox/catalog.json','w'),ensure_ascii=False)
print(len(items),'ítems')
