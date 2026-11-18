# Sonidos del Dragón Dorado, hechos por síntesis (sin grabaciones de terceros). Salida: mp3 mono 44,1 kHz como el resto del juego.
import numpy as np, subprocess, wave, os
from scipy.signal import butter, sosfilt, lfilter
SR=44100; rng=np.random.default_rng(7)
def t(d): return np.arange(int(SR*d))/SR
def bp(x,lo,hi,o=2): return sosfilt(butter(o,[lo/(SR/2),min(.99,hi/(SR/2))],'band',output='sos'),x)
def lp(x,f,o=2): return sosfilt(butter(o,f/(SR/2),'low',output='sos'),x)
def hp(x,f,o=2): return sosfilt(butter(o,f/(SR/2),'high',output='sos'),x)
def env(n,a,r,hold=None,curve=2.):
    e=np.ones(n);A=int(a*SR);Rr=int(r*SR);e[:A]=np.linspace(0,1,A)**.7;e[n-Rr:]=np.linspace(1,0,Rr)**curve;return e
def noise(n): return rng.standard_normal(n)
def sweep(n,f0,f1,exp=1.): k=np.linspace(0,1,n)**exp; return f0*(f1/f0)**k
def osc_saw(f): ph=np.cumsum(f)/SR; return 2*(ph%1)-1
def osc_sin(f): return np.sin(2*np.pi*np.cumsum(f)/SR)
def sat(x,g): return np.tanh(x*g)
def norm(x,pk=.9): return x/np.max(np.abs(x))*pk
def rev(x,d=.9,mix=.25):
    n=len(x);out=np.concatenate([x,np.zeros(int(SR*d))]);ir=noise(int(SR*d))*np.exp(-np.linspace(0,7,int(SR*d)));ir=lp(ir,3500)
    from scipy.signal import fftconvolve
    w=fftconvolve(x,ir)[:len(out)];w=np.pad(w,(0,len(out)-len(w)));w=w/np.max(np.abs(w)+1e-9)*np.max(np.abs(x));return out*(1-mix)+w*mix
def growl(d,f0,f1,rough=28,bright=1400,vib=.04,exp=1.):
    n=int(SR*d);f=sweep(n,f0,f1,exp)*(1+vib*np.sin(2*np.pi*5.5*t(d))+.03*lp(noise(n),12)*8)
    s=osc_saw(f)+.6*osc_saw(f*1.503)+.5*osc_saw(f*.5)
    am=.55+.45*np.clip(np.sin(2*np.pi*np.cumsum(rough*(1+.25*lp(noise(n),6)*6))/SR)*3,-1,1)   # aspereza de la garganta
    s=s*am;s=bp(s,70,bright)+.5*bp(s,500,2600)            # formantes
    br=bp(noise(n),700,5200)*(.35+.4*am)                  # aire
    return sat(s*1.6+br*.5,2.2)
def save(name,x,pk=.92):
    x=norm(x,pk);x[:64]*=np.linspace(0,1,64);x[-400:]*=np.linspace(1,0,400)
    w=wave.open(name+'.wav','wb');w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes((x*32767).astype('<i2').tobytes());w.close()
    subprocess.run(['ffmpeg','-loglevel','error','-y','-i',name+'.wav','-ac','1','-ar','44100','-b:a','96k',name+'.mp3'],check=True);os.remove(name+'.wav')
    print(name,round(len(x)/SR,2),'s',os.path.getsize(name+'.mp3')//1024,'KB','rms',round(float(np.sqrt(np.mean(x**2))),3))
# rugido: sube, sostiene áspero y cae
d=2.9;n=int(SR*d);r=growl(d,62,96,rough=30,bright=1700,exp=.5)*env(n,.35,1.3,curve=1.6)
r+=growl(d,124,170,rough=47,bright=2600,exp=.6)*env(n,.5,1.6)*.45+lp(noise(n),160)*env(n,.3,1.5)*.5
save('dr_rugido',rev(r,1.1,.3))
# muerte: rugido largo que se quiebra y baja
d=3.6;n=int(SR*d);r=growl(d,150,44,rough=24,bright=2000,vib=.09,exp=1.4)*env(n,.12,2.4,curve=1.4)
r*=1-.35*np.clip(np.sin(2*np.pi*3.2*t(d)**1.3),0,1)*np.linspace(0,1,n);save('dr_muerte',rev(r+lp(noise(n),120)*env(n,.2,2.6)*.5,1.3,.35))
# fuego: soplete con rugido de fondo
d=2.4;n=int(SR*d);fl=bp(noise(n),180,3800)*(.7+.3*lp(noise(n),18)*5)+hp(noise(n),4200)*.18+lp(noise(n),140)*1.2
fl=fl*env(n,.22,.7)+growl(d,70,58,rough=36,bright=900)*env(n,.3,.9)*.35;save('dr_fuego',sat(fl,1.3))
# pisotón / aterrizaje: golpe grave con tierra
d=1.1;n=int(SR*d);th=osc_sin(sweep(n,95,34,.4))*np.exp(-t(d)*5.5)*1.5+osc_sin(sweep(n,48,26,.5))*np.exp(-t(d)*3)*1.1
cr=bp(noise(n),300,2600)*np.exp(-t(d)*22)*.8+lp(noise(n),420)*np.exp(-t(d)*6)*.7
deb=bp(noise(n),900,5000)*np.clip(lp(noise(n),30)*9,0,1)*np.exp(-t(d)*3.2)*.25;save('dr_pisa',rev(sat(th+cr,1.6)+deb,.7,.22))
# aleteo: aire pesado
d=.62;n=int(SR*d);w=lp(noise(n),1)*0;f=sweep(n,260,900,1.);ns=noise(n);o=np.zeros(n)
for k in range(0,n,256): seg=slice(k,min(n,k+512));o[seg]+=bp(ns[seg]*np.hanning(len(ns[seg])),max(60,f[k]*.5),f[k]*1.7,1)
e=np.sin(np.pi*np.linspace(0,1,n))**1.6;save('dr_ala',(o+lp(ns,180)*.9)*e,.75)
# coletazo / zarpazo: silbido de aire y chasquido
d=.85;n=int(SR*d);f=sweep(n,300,2400,2.2);ns=noise(n);o=np.zeros(n)
for k in range(0,n,128): seg=slice(k,min(n,k+384));o[seg]+=bp(ns[seg]*np.hanning(len(ns[seg])),f[k]*.6,f[k]*1.5,1)
e=np.exp(-((t(d)-.5)/.16)**2);ck=np.zeros(n);i=int(.56*SR);m=n-i;ck[i:]=bp(noise(m),900,7000)*np.exp(-np.arange(m)/SR*38)*1.4+osc_sin(sweep(m,160,50,.4))*np.exp(-np.arange(m)/SR*14)*.9
save('dr_cola',rev(o*e*1.4+ck,.5,.18))
# mordida: gruñido corto y chasquido de mandíbula
d=.55;n=int(SR*d);g=growl(d,150,90,rough=40,bright=2200)*env(n,.03,.3)*.7;ck=np.zeros(n);i=int(.2*SR);m=n-i
ck[i:]=bp(noise(m),1200,8000)*np.exp(-np.arange(m)/SR*60)*1.6+osc_sin(sweep(m,240,70,.3))*np.exp(-np.arange(m)/SR*20);save('dr_mord',g+ck)
# meteoro / llamarada: explosión con cola de fuego
d=1.5;n=int(SR*d);ex=osc_sin(sweep(n,120,30,.35))*np.exp(-t(d)*4)*1.6+lp(noise(n),900)*np.exp(-t(d)*5)*1.2+bp(noise(n),1500,7000)*np.exp(-t(d)*14)*.7
tail=bp(noise(n),200,2600)*(.6+.4*lp(noise(n),14)*5)*np.exp(-t(d)*2.2)*.45;save('dr_explo',rev(sat(ex,1.8)+tail,.9,.25))
