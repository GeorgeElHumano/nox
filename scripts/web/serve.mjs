// Servidor estático mínimo para sacar las fotos de la web desde public/ (sin API). Uso: node serve.mjs [carpeta] [puerto]
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const ROOT=process.argv[2]||'public',PORT=+(process.argv[3]||8788);
const MT={'.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.css':'text/css','.glb':'model/gltf-binary','.webmanifest':'application/manifest+json','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
http.createServer((q,s)=>{const u=new URL(q.url,'http://x');let f=path.join(ROOT,decodeURIComponent(u.pathname));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');
  if(!fs.existsSync(f)){s.writeHead(404);s.end('no');return;}s.writeHead(200,{'content-type':MT[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s);}).listen(PORT,()=>console.log('sirviendo',ROOT,'en',PORT));
