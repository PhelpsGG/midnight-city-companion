import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {readFile,mkdir,writeFile,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Connection,ConnectionError} from './connection.mjs';
import {Orchestrator} from './orchestrator.mjs';
import {lookupCatalog} from './catalog.mjs';
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
export async function createServer({port=62761,transportFactory=()=>new LiveTransport(),asset=publicResource,stream=streamWorld,now=Date.now,ttlMs=30*60*1000,directory,pairingDirectory=resolve('.local/ai'),pulseMs=0,mode='live'}={}){
 const runtime=await Orchestrator.open({directory,now});
 const sessions=new Map(),claims=new Map(),pairs=new Map();let origin,closing=false,ticking=false;
 const project=s=>runtime.snapshot(s.connection);
 const visible=s=>({csrf:s.csrf,revision:s.revision,view:s.connection.view(),mode,runtime:project(s).runtime,choices:project(s).choices,ai:s.ai??null});
 const revoke=async s=>{if(s.pair){pairs.delete(s.pair);s.pair=null;}if(s.ai)await unlink(s.ai.connectionFile).catch(()=>{});s.ai=null;};
 const dispose=async s=>{await revoke(s);try{await runtime.detach(s.connection);}finally{for(const close of s.streams)close();await s.connection.disconnect().catch(()=>{});}};
 const routes={'/api/discover':['authorize','key'],'/api/select':['select','id'],'/api/control':['control'],'/api/refresh':['refresh'],'/api/disconnect':['disconnect'],'/api/command':['command','command'],'/api/pair':['pair'],'/api/revoke':['revoke']};
 const files={'/':['../client/live/index.html','text/html'],'/client.js':['../.local/build/client.js','text/javascript'],'/style.css':['../client/hybrid/style.css','text/css'],'/live.css':['../client/live/style.css','text/css'],'/contracts.css':['../client/hybrid/contracts/style.css','text/css'],'/discovery.css':['../client/hybrid/discovery/style.css','text/css']};
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; worker-src 'self' blob:; frame-src 'none'; frame-ancestors 'none'");
  if(closing||req.headers.host!==new URL(origin).host||(req.headers.origin&&req.headers.origin!==origin)||req.headers['sec-fetch-site']==='cross-site'){reply(res,403,{error:'Local browser access only.'});return;}
  try{
   const route=new URL(req.url,origin).pathname,cookieName='mcity_local_'+server.address().port;
   if(route==='/bridge'){
    if(req.method!=='POST')throw new ConnectionError('Use POST.',405);
    const token=req.headers.authorization?.replace(/^Bearer /,''),s=pairs.get(token);
    if(!s||!equal(token,s.pair))throw new ConnectionError('AI pairing expired or revoked. Pair again in the companion.',401);
    const agentId=s.connection.view().agent?.id;
    const authorized=()=>pairs.get(token)===s&&s.pair===token&&s.connection.view().agent?.id===agentId;
    const input=await body(req);if(!authorized())throw new ConnectionError('AI pairing revoked.',401);if(Object.keys(input).some(k=>!['op','command','kind','query'].includes(k)))throw new ConnectionError('Invalid bridge request.',400);
    if(input.op==='command'){await runtime.command(s.connection,input.command,'ai',authorized);if(!authorized())throw new ConnectionError('AI pairing revoked.',401);reply(res,200,project(s));}
    else if(input.op==='state'){await s.connection.refresh();if(!authorized())throw new ConnectionError('AI pairing revoked.',401);reply(res,200,{mode,connection:s.connection.view(),...project(s)});}
    else if(input.op==='catalog'){reply(res,200,await lookupCatalog(input));}
    else throw new ConnectionError('Unknown bridge operation.',400);return;
   }
   const cookie=(req.headers.cookie??'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
   let session=sessions.get(cookie);
   const active=s=>pulseMs>0&&s.connection.view().controlled;
   const renew=()=>{session.seen=now();res.setHeader('Set-Cookie',`${cookieName}=${session.id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${active(session)?604800:Math.max(1,Math.ceil(ttlMs/1000))}`);};
   const invalid=(message,status)=>{throw Object.assign(new ConnectionError(message,status),{invalidateSession:true});};
   if(session&&now()-session.seen>ttlMs&&!session.busy&&!active(session)){sessions.delete(cookie);await dispose(session);session=null;}
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
    session.busy=true;
    try{
     if(method==='command')await runtime.command(session.connection,input.command,'gui');
     else if(method==='revoke')await revoke(session);
     else if(method==='pair'){
      if(!session.connection.view().controlled)throw new ConnectionError('Connect control before pairing an AI.');
      await revoke(session);const bearer=nonce(),connectionFile=join(resolve(pairingDirectory),nonce()+'.json');
      await mkdir(pairingDirectory,{recursive:true});await writeFile(connectionFile,JSON.stringify({origin,bearer,agentId:session.connection.view().agent.id}),{mode:0o600,flag:'wx'});
      session.pair=bearer;pairs.set(bearer,session);session.ai={connectionFile,command:process.execPath,args:[fileURLToPath(new URL('../ai/mcp.mjs',import.meta.url)),'--connection',connectionFile]};
     }else if(method==='disconnect')await dispose(session);
     else {await session.connection[method](arg?input[arg]:undefined);if(method==='control')await runtime.attach(session.connection);}
     if(['authorize','select','control','disconnect'].includes(method))session.revision++;
     renew();reply(res,200,visible(session));
    }finally{session.busy=false;}return;
   }
   if(req.method!=='GET')throw new ConnectionError('Method unavailable.',405);
   if(route==='/stream'){if(!session?.connection.view().agent)throw new ConnectionError('Choose your character first.',401);await stream(req,res,session);return;}
   if(files[route]){const [file,type]=files[route];try{const data=await readFile(new URL(file,import.meta.url));res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(data);}catch{reply(res,503,{error:'Client is not built. Run npm run setup.'});}return;}
   const resource=await asset(route);if(!resource){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':resource.type,'Cache-Control':'public,max-age=300'});res.end(resource.data);
  }catch(e){if(!res.headersSent)reply(res,e instanceof ConnectionError?e.status:502,{error:e instanceof ConnectionError?e.message:'The game resource is unavailable. Try again.',...(e.invalidateSession?{invalidateSession:true}:{})});else res.end();}
 });
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});}catch(e){await runtime.close();throw e;}origin='http://127.0.0.1:'+server.address().port;
 const pulse=async()=>{if(ticking||closing)return;ticking=true;try{await runtime.pulse();}finally{ticking=false;}};
 const timer=setInterval(()=>{for(const [id,s] of sessions)if(!s.busy&&now()-s.seen>ttlMs&&!(pulseMs>0&&s.connection.view().controlled)){sessions.delete(id);void dispose(s).catch(()=>{});}},10000);timer.unref();
 const runner=pulseMs>0?setInterval(()=>void pulse().catch(()=>{}),pulseMs):null;runner?.unref();
 return {origin,pulse,async close(){if(closing)return;closing=true;clearInterval(timer);clearInterval(runner);await Promise.allSettled([...sessions.values()].map(dispose));sessions.clear();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await runtime.close();}};
}
