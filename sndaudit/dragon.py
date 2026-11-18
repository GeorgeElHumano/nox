# Sonidos del Dragón Dorado armados con grabaciones CC0 de OpenGameArt (ver CREDITOS-SONIDO.md): recortes, bajadas de tono y capas.
import numpy as np, subprocess, os, glob
from scipy.signal import butter, sosfilt, resample_poly
SR=44100; D='/home/claude/h/oga/dl/'; OUT='/home/claude/h/oga/out/'; os.makedirs(OUT,exist_ok=True)
def load(f):
    r=subprocess.run(['ffmpeg','-loglevel','error','-i',f if f.startswith('/') else D+f,'-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True);return np.frombuffer(r.stdout,dtype='<f4').astype(np.float64)
def lp(x,f): return sosfilt(butter(2,f/(SR/2),'low',output='sos'),x)
def hp(x,f): return sosfilt(butter(2,f/(SR/2),'high',output='sos'),x)
def envl(x,ms=20): return np.sqrt(np.maximum(lp(x*x,1000/ms/4),0)+1e-12)
def segs(x,th=.07,gap=.18,minlen=.15):
    e=envl(x);on=e>th*e.max();out=[];i=0;n=len(x);g=int(gap*SR)
    while i<n:
        if on[i]:
            j=i;last=i
            while j<n and j-last<g:
                if on[j]:last=j
                j+=1
            if (last-i)/SR>=minlen:out.append((max(0,i-int(.02*SR)),min(n,last+int(.12*SR))))
            i=j
        else:i+=1
    return out
def pitch(x,r):  # r<1: más grave y más lento
    return resample_poly(x,1000,int(1000*r))
def fade(x,a=.01,r=.15):
    x=x.copy();A=int(a*SR);R=min(len(x)-A,int(r*SR));x[:A]*=np.linspace(0,1,A);x[-R:]*=np.linspace(1,0,R)**1.5;return x
def norm(x,pk=.93): return x/(np.max(np.abs(x))+1e-9)*pk
def mix(*parts):  # (señal, ganancia, desplazamiento en s)
    n=max(int(o*SR)+len(x) for x,g,o in parts);y=np.zeros(n)
    for x,g,o in parts:i=int(o*SR);y[i:i+len(x)]+=norm(x,1)*g
    return y
def win(x,d):  # ventana de d segundos con más energía
    n=int(d*SR)
    if len(x)<=n:return x
    c=np.cumsum(x*x);e=c[n:]-c[:-n];i=int(np.argmax(e));return x[i:i+n]
def save(name,x,pk=.93):
    x=norm(np.tanh(norm(x,1)*1.25),pk);w=(x*32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg','-loglevel','error','-y','-f','s16le','-ar',str(SR),'-ac','1','-i','-','-b:a','96k',OUT+name+'.mp3'],input=w,check=True)
    print(name,round(len(x)/SR,2),'s rms',round(float(np.sqrt(np.mean(x**2))),3))
roar=load('monster_roar.wav');troll=load('troll-roars_0.ogg');ts=sorted(segs(troll),key=lambda s:s[0]-s[1]);print('rugidos de trol',[(round(a/SR,1),round((b-a)/SR,1)) for a,b in ts])
T=[troll[a:b] for a,b in ts]
rs=sorted(segs(roar,.05,.3),key=lambda s:s[0]-s[1]);print('rugido',[(round(a/SR,1),round((b-a)/SR,1)) for a,b in rs]);R0=roar[rs[0][0]:rs[0][1]]
# rugido: A = grabación grave tal cual (recortada), B = trol bajado de tono, C = las dos capas
A=fade(win(R0,3.4),.03,.9);B=fade(pitch(T[0],.62),.02,.5)
save('dr_rugido_A',A);save('dr_rugido_B',B);save('dr_rugido',mix((pitch(A,.9),1,0),(B,.6,.15)))
save('dr_muerte',fade(mix((pitch(win(R0,3.2),.68),1,0),(pitch(T[min(1,len(T)-1)],.5),.5,.6)),.05,2.2))
# fuego: de las 25 tomas de bastón de fuego, las dos ventanas de 2,4 s con más energía sostenida
fs=sorted(glob.glob(D+'legit_audio_fire_staff_-_free_0/*/Wavs/*.wav'));sc=[]
for f in fs:
    x=load(f);w=win(x,2.4);e=envl(w,60);sc.append((float(np.mean(e)*(e.min()/e.max()+.2)),f,w))
sc.sort(key=lambda s:-s[0]);print('fuego',[os.path.basename(s[1])[19:24] for s in sc[:4]])
rum=lp(load('shake.flac'),180)
save('dr_fuego',fade(mix((sc[0][2],1,0),(rum[:int(2.4*SR)],.5,0)),.12,.6));save('dr_fuego_B',fade(mix((sc[1][2],1,0),(pitch(sc[2][2],.7)[:int(2.4*SR)],.5,0)),.12,.6))
# pisotón: pisada de criatura y golpes secos bajados de tono, más cola grave de explosión lejana
st=load('80-CC0-creature-sfx-2/stomp_01.ogg');th=load('thwack-1.0/PCM/thwack-03.wav');ex=load('NenadSimic_-_Muffled_Distant_Explosion.wav')
save('dr_pisa',fade(mix((pitch(st,.5),1,0),(pitch(th,.45),.8,0),(lp(win(ex,1.3),300),.7,.02)),.002,.7))
# aleteo: la toma tal cual, recortada
fl=load('dragonflap.wav');s=segs(fl,.06,.25);save('dr_ala',fade(pitch(fl[s[0][0]:s[-1][1]] if s else fl,.85),.02,.3),.8)
# coletazo: silbido de aire bajado de tono y golpe seco al final
sw=[load(f) for f in sorted(glob.glob(D+'swishes/swishes/*.wav'))];sw.sort(key=lambda x:-len(x));w=pitch(sw[0],.5)
save('dr_cola',fade(mix((w,1,0),(pitch(sw[1],.4),.6,.05),(pitch(load('thwack-1.0/PCM/thwack-05.wav'),.6),.9,len(w)/SR*.75)),.01,.3))
# mordida: gruñido de ataque corto y chasquido
sn=load('monster-snarl-attack.ogg');ss=[sn[a:b] for a,b in segs(sn,.08,.15,.2)];ss.sort(key=lambda x:abs(len(x)/SR-.6));print('gruñidos',len(ss))
save('dr_mord',fade(mix((pitch(ss[0],.7),1,0),(pitch(load('thwack-1.0/PCM/thwack-01.wav'),.8),.9,len(ss[0])/SR*.7)),.01,.2))
# explosión: explosión lejana con arranque de fuego
save('dr_explo',fade(mix((win(ex,2.2),1,0),(win(sc[3][2],.9),.6,0),(pitch(th,.4),.7,0)),.002,1.2))
