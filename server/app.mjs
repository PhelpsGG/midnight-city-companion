import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Connection,ConnectionError} from './connection.mjs';
import {LiveTransport} from '../client/play/live.mjs';
import {publicResource,streamWorld} from './public-world.mjs';
const nonce=()=>randomBytes(24).toString('hex');
const equal=(a,b)=>typeof a==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const reply=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
async function body(req){
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))throw new ConnectionError('JSON is required.',415);
 let value='',size=0;for await(const part of req){size+=part.length;if(size>8192)throw new ConnectionError('Request is too large.',413);value+=part;}
 try{const parsed=JSON.parse(value);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error();return parsed;}catch{throw new ConnectionError('Invalid request.',400);}
}
export async function createServer({port=62761,transportFactory=()=>new LiveTransport(),asset=publicResource,stream=streamWorld,now=Date.now,ttlMs=30*60*1000}={}){
 const sessions=new Map(),claims=new Map();let origin;
 const visible=s=>({csrf:s.csrf,revision:s.revision,view:s.connection.view()});
 const dispose=async s=>{for(const close of s.streams)close();await s.connection.disconnect().catch(()=>{});};
 const routes={'/api/discover':['authorize','key'],'/api/select':['select','id'],'/api/control':['control'],'/api/refresh':['refresh'],'/api/disconnect':['disconnect']};
 const files={'/':['../client/live/index.html','text/html'],'/client.js':['../.local/build/client.js','text/javascript'],'/style.css':['../client/hybrid/style.css','text/css'],'/live.css':['../client/live/style.css','text/css'],'/contracts.css':['../client/hybrid/contracts/style.css','text/css'],'/discovery.css':['../client/hybrid/discovery/style.css','text/css']};
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; worker-src 'self' blob:; frame-src 'none'; frame-ancestors 'none'");
  if(req.headers.host!==new URL(origin).host||(req.headers.origin&&req.headers.origin!==origin)||req.headers['sec-fetch-site']==='cross-site'){reply(res,403,{error:'Local browser access only.'});return;}
  try{
   const route=new URL(req.url,origin).pathname,cookieName='mcity_local_'+server.address().port;
   const cookie=(req.headers.cookie??'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
   let session=sessions.get(cookie);
   const renew=()=>{session.seen=now();res.setHeader('Set-Cookie',`${cookieName}=${session.id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.max(1,Math.ceil(ttlMs/1000))}`);};
   const invalid=(message,status)=>{throw Object.assign(new ConnectionError(message,status),{invalidateSession:true});};
   if(session&&now()-session.seen>ttlMs&&!session.busy){sessions.delete(cookie);await dispose(session);session=null;}
   if(req.method==='GET'&&route==='/api/session'){
    if(!session){if(sessions.size>=16)throw new ConnectionError('Too many local sessions; close unused clients.',429);const id=nonce();session={id,csrf:nonce(),revision:0,connection:new Connection(transportFactory(),{now,claims}),streams:new Set(),seen:now(),busy:false};sessions.set(id,session);}
    renew();reply(res,200,visible(session));return;
   }
   if(route.startsWith('/api/')&&route!=='/api/agent-look/appearance'&&!/^\/api\/characters\//.test(route)){
    if(!session)invalid('Reload to open a local session.',401);
    if(!routes[route])throw new ConnectionError('This capability is not connected.',404);
    if(req.method!=='POST')throw new ConnectionError('Use the connection controls.',405);
    if(req.headers.origin!==origin||!equal(req.headers['x-csrf-token'],session.csrf))invalid('Reload before retrying.',403);
    const input=await body(req),[method,arg]=routes[route];
    if(Object.keys(input).some(k=>!['revision',arg].includes(k)))throw new ConnectionError('Unexpected request fields.',400);
    if(input.revision!==session.revision)invalid('This connection changed in another tab. Reload before continuing.',409);
    if(session.busy)throw new ConnectionError('Wait for the current request.',409);
    session.busy=true;renew();
    try{await session.connection[method](arg?input[arg]:undefined);if(method!=='refresh')session.revision++;if(method==='disconnect')for(const close of session.streams)close();reply(res,200,visible(session));}finally{session.busy=false;}return;
   }
   if(req.method!=='GET')throw new ConnectionError('Method unavailable.',405);
   if(route==='/stream'){if(!session?.connection.view().agent)throw new ConnectionError('Choose your character first.',401);await stream(req,res,session);return;}
   if(files[route]){const [file,type]=files[route];try{const data=await readFile(new URL(file,import.meta.url));res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(data);}catch{reply(res,503,{error:'Client is not built. Run npm run setup.'});}return;}
   const resource=await asset(route);if(!resource){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':resource.type,'Cache-Control':'public,max-age=300'});res.end(resource.data);
  }catch(e){if(!res.headersSent)reply(res,e instanceof ConnectionError?e.status:502,{error:e instanceof ConnectionError?e.message:'The game resource is unavailable. Try again.',...(e.invalidateSession?{invalidateSession:true}:{})});else res.end();}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});origin='http://127.0.0.1:'+server.address().port;
 const timer=setInterval(()=>{for(const [id,s] of sessions)if(!s.busy&&now()-s.seen>ttlMs){sessions.delete(id);void dispose(s);}},10000);timer.unref();
 return {origin,async close(){clearInterval(timer);await Promise.all([...sessions.values()].map(dispose));sessions.clear();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
