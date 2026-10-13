import {publicAsset} from '../client/sandbox/assets.mjs';
const origin='https://midnight.city';
export async function publicGet(route){
 const res=await fetch(origin+route,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'*/*'}});
 if(!res.ok)throw Error('Public game resource unavailable.');return res;
}
const cache=new Map();let bytes=0;
export async function publicResource(route){
 if(!publicAsset(route)&&route!=='/api/agent-look/appearance'&&!/^\/api\/characters\/[A-Za-z0-9_-]+\.png$/.test(route))return null;
 if(cache.has(route))return cache.get(route);
 const res=await publicGet(route),data=Buffer.from(await res.arrayBuffer());if(data.length>32*1024*1024)throw Error('Resource too large.');
 let type=res.headers.get('content-type')??'';if(/\.(json|tsj)$/.test(route)||route==='/api/agent-look/appearance'){JSON.parse(data.toString('utf8'));type='application/json';}
 if(!/^(image\/|font\/|application\/json)/.test(type))return null;
 const result={data,type};if(bytes+data.length<128*1024*1024){cache.set(route,result);bytes+=data.length;}return result;
}
export async function streamWorld(req,res,session){
 if(session.streams.size>=2){res.writeHead(429).end();return;}
 res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store',Connection:'keep-alive'});
 let socket,stopped=false;
 const emit=(event,data)=>{if(!res.destroyed)res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);};
 const close=()=>{if(stopped)return;stopped=true;session.streams.delete(close);socket?.close();if(!res.destroyed){emit('finished',{reason:'World connection ended'});res.end();}};
 session.streams.add(close);req.on('close',close);
 try{
  const base=await(await publicGet('/observer/api/spectator/bootstrap')).json();
  const catalog=await(await publicGet('/observer/api/static-world/'+encodeURIComponent(base.staticVersion))).json();
  if(stopped)return;if(catalog.staticVersion!==base.staticVersion)throw Error();
  emit('snapshot',{...base,staticWorld:catalog.staticWorld,agentSeeds:catalog.agentSeeds});let sequence=base.sequence;
  socket=new WebSocket('wss://midnight.city/observer/ws?'+new URLSearchParams({staticVersion:base.staticVersion,sequence:String(sequence)}));
  socket.onmessage=e=>{try{if(stopped)return;const delta=JSON.parse(e.data);if(delta.type!=='spectator_delta'||delta.staticVersion!==base.staticVersion||delta.fromSequence!==sequence||delta.toSequence<=sequence)throw Error();sequence=delta.toSequence;emit('delta',delta);}catch{close();}};
  socket.onerror=close;socket.onclose=close;
 }catch{close();}
}
