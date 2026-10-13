import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';
import {createMissionServer} from './server.mjs';
test('HTTP mission continues with no clients; stale commands and cross-site access rejected',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'mcity-http-'));const service=await createMissionServer({directory,port:0,stepMs:15,intervalMs:5});
 t.after(async()=>{await service.close();await rm(directory,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${service.server.address().port}`;
 const initial=await (await fetch(base+'/mission/state')).json();
 const send=(body,headers={})=>fetch(base+'/mission/command',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,'X-CSRF-Token':initial.csrf,...headers},body:JSON.stringify(body)});
 assert.equal((await send({type:'start',revision:initial.state.revision},{Origin:'https://example.com'})).status,403);
 const badHost=await new Promise(resolve=>http.get(base+'/mission/state',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);}));assert.equal(badHost,403);
 assert.equal((await send({type:'start',revision:initial.state.revision})).status,200);
 // Observe internal status without sending HTTP or driving the clock. A fixed
 // 300ms sleep flaked when parallel durable-save tests contended for disk.
 const deadline=Date.now()+3000;
 while(service.runtime.snapshot().mission.status!=='complete'&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));
 const after=await(await fetch(base+'/mission/state')).json();assert.equal(after.state.mission.status,'complete');assert.equal(after.state.receipts.length,3);assert.equal(after.snapshot.view.agent.inventory.transit_actuator,1);
 assert.equal((await send({type:'start',revision:initial.state.revision})).status,409);
 assert.equal((await fetch(base+'/play/control',{method:'POST'})).status,404);
 assert.equal((await send({type:'select',revision:after.state.revision,count:3,fault:'normal'})).status,200);
});
