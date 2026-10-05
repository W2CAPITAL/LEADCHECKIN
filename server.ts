import http,{type IncomingMessage, type ServerResponse} from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import leadDiscover from './api/lead-discover';
import publicScan from './api/public-scan';
import supabaseConfig from './api/supabase-config';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const DIST=path.join(__dirname,'dist');
const PORT=Math.max(1,Number(process.env.PORT)||3000);
const MAX_BODY=2_000_000;

type Req=IncomingMessage&{body?:unknown;query?:Record<string,string|string[]>};
type Res=ServerResponse&{status:(code:number)=>Res;json:(value:unknown)=>Res};
type Handler=(req:any,res:any)=>unknown|Promise<unknown>;

const routes=new Map<string,Handler>([
  ['/api/lead-discover',leadDiscover],
  ['/api/public-scan',publicScan],
  ['/api/supabase-config',supabaseConfig],
]);

const MIME:Record<string,string>={
  '.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2'
};

function enhance(res:ServerResponse):Res{
  const out=res as Res;
  out.status=(code:number)=>{out.statusCode=code;return out};
  out.json=(value:unknown)=>{
    if(!out.headersSent)out.setHeader('Content-Type','application/json; charset=utf-8');
    out.end(JSON.stringify(value));return out;
  };
  return out;
}
function parseQuery(url:URL){
  const out:Record<string,string|string[]>={};
  for(const [k,v] of url.searchParams){
    const old=out[k];
    out[k]=old===undefined?v:Array.isArray(old)?[...old,v]:[old,v];
  }
  return out;
}
function body(req:IncomingMessage):Promise<unknown>{
  return new Promise((resolve,reject)=>{
    const chunks:Buffer[]=[];let size=0;
    req.on('data',(chunk:Buffer)=>{
      size+=chunk.length;
      if(size>MAX_BODY){const e:any=new Error('Payload grande demais.');e.status=413;reject(e);req.destroy();return;}
      chunks.push(chunk);
    });
    req.on('end',()=>{
      if(!chunks.length)return resolve({});
      const raw=Buffer.concat(chunks).toString('utf8');
      try{resolve(JSON.parse(raw));}catch{const e:any=new Error('JSON inválido.');e.status=400;reject(e);}
    });
    req.on('error',reject);
  });
}
function safeFile(pathname:string){
  let decoded:string;
  try{decoded=decodeURIComponent(pathname)}catch{return null}
  const rel=path.posix.normalize(decoded.replace(/^\/+/, '')||'index.html');
  if(rel.startsWith('../')||rel.includes('\0'))return null;
  return path.join(DIST,rel);
}
function serve(req:IncomingMessage,res:ServerResponse,file:string){
  if(!file.startsWith(DIST+path.sep)&&file!==DIST)return false;
  let stat:fs.Stats;try{stat=fs.statSync(file)}catch{return false}
  if(!stat.isFile())return false;
  const type=MIME[path.extname(file).toLowerCase()];
  if(!type)return false;
  res.statusCode=200;res.setHeader('Content-Type',type);
  res.setHeader('X-Content-Type-Options','nosniff');
  if(path.basename(file)==='index.html')res.setHeader('Cache-Control','no-cache');
  else res.setHeader('Cache-Control','public, max-age=3600');
  if(req.method==='HEAD'){res.end();return true}
  fs.createReadStream(file).pipe(res);return true;
}

http.createServer(async(req:Req,res0)=>{
  const res=enhance(res0);
  const proto=String(req.headers['x-forwarded-proto']||'https').split(',')[0].trim();
  const host=String(req.headers['x-forwarded-host']||req.headers.host||'localhost').split(',')[0].trim();
  let url:URL;try{url=new URL(req.url||'/',proto+'://'+host)}catch{return res.status(400).json({error:'URL inválida'})}
  const handler=routes.get(url.pathname.replace(/\/$/,''));
  if(handler){
    try{
      req.query=parseQuery(url);
      req.body=['GET','HEAD'].includes(String(req.method||'GET').toUpperCase())?{}:await body(req);
      await handler(req,res);
      return;
    }catch(e:any){
      if(res.writableEnded)return;
      return res.status(Number(e?.status)||500).json({error:e?.message||'Falha interna'});
    }
  }
  if(!['GET','HEAD'].includes(String(req.method||'GET').toUpperCase()))return res.status(405).json({error:'Método não permitido'});
  const file=safeFile(url.pathname);
  if(file&&serve(req,res,file))return;
  if(!path.extname(url.pathname)&&serve(req,res,path.join(DIST,'index.html')))return;
  res.statusCode=404;res.end('Not Found');
}).listen(PORT,'0.0.0.0',()=>console.log('[leadcheckin] listening',{port:PORT}));
