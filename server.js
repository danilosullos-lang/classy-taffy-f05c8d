import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream, stat } from 'node:fs';

const root = path.dirname(fileURLToPath(import.meta.url));
const routes = new Map([
  ['/api/auth/register', (await import('./api/auth/register.js')).default],
  ['/api/auth/login', (await import('./api/auth/login.js')).default],
  ['/api/characters', (await import('./api/characters.js')).default]
]);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.bin':'application/octet-stream','.ktx2':'image/ktx2','.wasm':'application/wasm','.woff2':'font/woff2','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav'};
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url||'/', 'http://localhost');
  const handler=routes.get(url.pathname);
  if(handler){
   const adapted={status(code){res.statusCode=code;return this;},setHeader(name,value){res.setHeader(name,value);return this;},end(body){res.end(body);}};
   await handler(req,adapted);return;
  }
  if(url.pathname.startsWith('/api/'))return json(res,404,{error:'not_found'});
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'method_not_allowed'});
  const decoded=decodeURIComponent(url.pathname),relative=decoded==='/'?'index.html':decoded.replace(/^\/+/,''),target=path.resolve(root,relative);
  if(target!==root&&!target.startsWith(root+path.sep))return json(res,403,{error:'forbidden'});
  const info=await stat(target);if(!info.isFile())return json(res,404,{error:'not_found'});
  const ext=path.extname(target).toLowerCase();
  res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Content-Length':info.size,'Cache-Control':ext==='.html'?'no-cache':'public, max-age=86400'});
  if(req.method==='HEAD')return res.end();
  createReadStream(target).pipe(res);
 }catch(error){
  if(error.code==='ENOENT')return json(res,404,{error:'not_found'});
  console.error('[Aetheria server]',error);if(!res.headersSent)json(res,500,{error:'internal_error'});else res.end();
 }
});
const port=Number(process.env.PORT)||3000;
server.listen(port,'0.0.0.0',()=>console.log('Aetheria RPG listening on '+port));
