import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {MissionRuntime} from './runtime.mjs';
import {missionProjection} from './projection.mjs';
const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(body));};
const equal=(a,b)=>typeof a==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export async function createMissionServer({directory,port=62759,stepMs=5000,intervalMs=250,staticWorld={},assetHandler}={}){
 const runtime=await MissionRuntime.open({directory,stepMs}),csrf=randomBytes(24).toString('hex');let closing=false,timer,inFlight;
 const state=()=>{const current=runtime.snapshot();return {csrf,state:current,snapshot:missionProjection(current,staticWorld)};};
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; worker-src 'self' blob:; frame-src 'none'; frame-ancestors 'none'");res.setHeader('X-Content-Type-Options','nosniff');
  const origin=`http://127.0.0.1:${req.socket.localPort}`;
  if(closing||req.headers.host!==new URL(origin).host||(req.headers.origin&&req.headers.origin!==origin)||req.headers['sec-fetch-site']==='cross-site'){json(res,403,{message:'Local sandbox access only.'});return;}
  try{
   const route=new URL(req.url,origin).pathname;
   if(route==='/mission/state'&&req.method==='GET'){json(res,200,state());return;}
   if(route==='/mission/command'&&req.method==='POST'){
    if(req.headers.origin!==origin||!equal(req.headers['x-csrf-token'],csrf)){json(res,403,{message:'Refresh the sandbox connection before sending a command.'});return;}
    if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??'')){json(res,415,{message:'JSON required.'});return;}
    let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>16384){json(res,413,{message:'Mission command too large.'});return;}body+=chunk;}
    let command;try{command=JSON.parse(body);}catch{json(res,400,{message:'Invalid JSON command.'});return;}
    if(!command||typeof command!=='object'||Array.isArray(command)){json(res,400,{message:'Invalid command.'});return;}
    await runtime.command(command);json(res,200,state());return;
   }
   if(req.method==='GET'&&assetHandler&&await assetHandler(route,res))return;
   json(res,404,{message:'This isolated service supports sandbox missions only.'});
  }catch(e){json(res,e.status??400,{message:e.message});}
 });
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});}catch(e){await runtime.close();throw e;}
 async function work(){if(closing)return;inFlight=runtime.pulse();try{await inFlight;}catch{/* snapshot exposes storage failure; execution stays halted */}finally{inFlight=null;if(!closing){timer=setTimeout(work,intervalMs);timer.unref();}}}
 timer=setTimeout(work,intervalMs);timer.unref();
 return {server,runtime,async close(){if(closing)return;closing=true;clearTimeout(timer);await inFlight?.catch(()=>{});await new Promise(resolve=>server.close(resolve));await runtime.close();}};
}
