import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from './app.mjs';
import {Sandbox} from './sandbox.mjs';
import {publicResource} from './public-world.mjs';
import {missionProjection} from '../client/hybrid/mission/projection.mjs';
const root=new URL('../.local/play-sandbox/',import.meta.url);
const box=await Sandbox.open(fileURLToPath(new URL('world/',root)));
const geometry=JSON.parse(await readFile(new URL('../.local/renderer/geometry.json',import.meta.url),'utf8'));
const world=missionProjection({character:{},mission:{steps:[],cursor:0},receipts:[],revision:1,savedAt:Date.now()},geometry).world;
const service=await createServer({port:Number(process.env.PORT||62764),directory:fileURLToPath(new URL('runtime/',root)),pairingDirectory:fileURLToPath(new URL('ai/',root)),pulseMs:1000,mode:'sandbox',transportFactory:()=>box.transport(),
 asset:async route=>route==='/api/agent-look/appearance'?{type:'application/json',data:Buffer.from('{}')}:publicResource(route),
 stream:async(req,res,s)=>{res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'});let sequence=0;const emit=()=>{const agent=s.connection.view().agent;res.write('event: snapshot\ndata: '+JSON.stringify({...world,sequence:++sequence,dynamicWorld:{...world.dynamicWorld,agents:agent?[agent]:[]}})+'\n\n');};emit();const timer=setInterval(emit,1000);const close=()=>{clearInterval(timer);s.streams.delete(close);res.end();};s.streams.add(close);req.on('close',close);}
});
console.log(service.origin+' — playable synthetic sandbox. Test key: sandbox-test-key. No live agent connection.');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void service.close().then(()=>box.close()).then(()=>process.exit(0)));
