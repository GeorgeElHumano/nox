// NOX para Windows: abre el juego desde tu dominio (siempre actualizado) o, sin internet, la copia incluida.
const {app,BrowserWindow,protocol,net,shell,Menu}=require('electron');
const path=require('path'),fs=require('fs'),{pathToFileURL}=require('url');
protocol.registerSchemesAsPrivileged([{scheme:'nox',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
function readCfg(){let c={url:''};for(const f of [path.join(__dirname,'config.json'),path.join(path.dirname(process.execPath),'config.json')]){try{Object.assign(c,JSON.parse(fs.readFileSync(f,'utf8')));}catch(e){}}return c;}
app.whenReady().then(()=>{
  Menu.setApplicationMenu(null);
  protocol.handle('nox',req=>{const u=new URL(req.url);let p=decodeURIComponent(u.pathname);if(!p||p==='/')p='/index.html';const f=path.join(__dirname,'game',path.normalize(p).replace(/^([.][.][\\/])+/,''));return net.fetch(pathToFileURL(f).toString());});
  const win=new BrowserWindow({width:1280,height:800,minWidth:800,minHeight:500,backgroundColor:'#0f0b09',title:'NOX',icon:path.join(__dirname,'icon.png'),autoHideMenuBar:true,webPreferences:{contextIsolation:true,sandbox:true}});
  const local='nox://game/index.html',cfg=readCfg();let fell=false;
  const toLocal=()=>{if(fell)return;fell=true;win.loadURL(local);};
  if(cfg.url){win.webContents.on('did-fail-load',(e,code,desc,url,isMain)=>{if(isMain&&!String(url).startsWith('nox:'))toLocal();});win.loadURL(cfg.url).catch(toLocal);}
  else win.loadURL(local);
  win.webContents.setWindowOpenHandler(({url})=>{if(/^https?:/.test(url))shell.openExternal(url);return{action:'deny'};});
  win.webContents.on('before-input-event',(e,inp)=>{if(inp.type==='keyDown'&&inp.key==='F11'){win.setFullScreen(!win.isFullScreen());e.preventDefault();}});
});
app.on('window-all-closed',()=>app.quit());
