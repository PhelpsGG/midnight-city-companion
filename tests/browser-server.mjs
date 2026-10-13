// Manual browser fixture: no production agent reads, leases or action calls.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server/app.mjs';
import {publicResource} from '../server/public-world.mjs';
import {fixtureTransport} from './fixture-observer.mjs';
import {missionProjection} from '../client/hybrid/mission/projection.mjs';
import {MissionRuntime} from '../client/hybrid/mission/runtime.mjs';
const runtime=await MissionRuntime.open({directory:fileURLToPath(new URL('../.local/browser-fixture/',import.meta.url))});
const geometry=JSON.parse(await readFile(new URL('../.local/renderer/geometry.json',import.meta.url),'utf8'));
const world=missionProjection(runtime.snapshot(),geometry).world;await runtime.close();
const service=await createServer({port:62763,transportFactory:fixtureTransport,
 asset:async route=>route==='/api/agent-look/appearance'?{type:'application/json',data:Buffer.from('{}')}:publicResource(route),
 stream:async(req,res,s)=>{const a=s.connection.view().agent;res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'});res.write('event: snapshot\ndata: '+JSON.stringify({...world,dynamicWorld:{...world.dynamicWorld,agents:[{...world.dynamicWorld.agents[0],...a}]}})+'\n\n');const close=()=>{s.streams.delete(close);res.end();};s.streams.add(close);req.on('close',close);}
});
console.log(service.origin+' — SYNTHETIC observer; fake key: sandbox-test-key');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void service.close().then(()=>process.exit(0)));
