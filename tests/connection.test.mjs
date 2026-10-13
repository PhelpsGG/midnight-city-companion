import test from 'node:test';
import assert from 'node:assert/strict';
import {Connection} from '../server/connection.mjs';

function setup(options){
 const calls=[];let control={state:'uncontrolled'},offline=false,broken=false;
 const transport={async authorizedAgents(token){calls.push('authorize');if(token!=='fixture-key')throw Error('SECRET upstream response');return ['river','other'];},async read(id){calls.push('read');if(offline)throw Object.assign(Error(),{code:'AGENT_OFFLINE'});if(broken)throw Error('SECRET');return {agent:{id,name:id,inventory:{crystal:7},skills:{engineering:{level:2,xp:268}}},control,receivedAt:Date.now()};},async claim(id){calls.push('claim');return {agentId:id,sessionId:'owned-session',token:'private-lease',expiresAt:Date.now()+60000};},async heartbeat(lease){calls.push('heartbeat');if(broken)throw Error();return lease;},async release(){calls.push('release');}};
 return {c:new Connection(transport,options),transport,calls,setControl:x=>control=x,setOffline:x=>offline=x,setBroken:x=>broken=x};
}
test('discovery and selection are read only; explicit control/release never returns secrets',async()=>{
 const {c,calls}=setup();assert.deepEqual((await c.authorize('fixture-key')).agentIds,['river','other']);await c.select('river');assert.equal(c.view().agent.name,'river');assert.ok(!calls.includes('claim'));
 await c.control();assert.equal(c.view().controlled,true);assert.equal(calls.filter(x=>x==='claim').length,1);assert.doesNotMatch(JSON.stringify(c.view()),/fixture-key|private-lease|owned-session/);
 await c.disconnect();assert.equal(c.view().agent,null);assert.deepEqual(c.view().agentIds,[]);assert.equal(calls.at(-1),'release');
});
test('bad key, wrong agent, and active/unknown controller cannot claim or leak upstream errors',async()=>{
 const {c,calls,setControl}=setup();await assert.rejects(c.authorize('wrong'),e=>!e.message.includes('SECRET'));await c.authorize('fixture-key');await assert.rejects(c.select('stranger'));await c.select('river');
 for(const status of [{state:'active'},null,{}, {state:'unexpected'}]){setControl(status);await assert.rejects(c.control());}assert.ok(!calls.includes('claim'));
 await assert.rejects(c.authorize('another-key'));assert.equal(c.view().agent.id,'river');
});
test('offline agent can be selected honestly; only explicit control claims it',async()=>{
 const {c,calls,setOffline}=setup();setOffline(true);await c.authorize('fixture-key');await c.select('river');assert.equal(c.view().agent.status,'offline');assert.equal(c.view().agent.inventory,undefined);assert.ok(!calls.includes('claim'));await c.control();assert.equal(calls.filter(x=>x==='claim').length,1);
});
test('failed refresh keeps stale data, clears lost control and never reclaims automatically',async()=>{
 const {c,calls,setBroken}=setup();await c.authorize('fixture-key');await c.select('river');await c.control();setBroken(true);await c.refresh();assert.equal(c.view().stale,true);assert.equal(c.view().agent.inventory.crystal,7);assert.equal(c.view().controlled,false);assert.equal(calls.filter(x=>x==='claim').length,1);await c.disconnect();assert.equal(c.view().agent,null);
});
test('concurrent commands cannot switch owners or double claim',async()=>{
 const {c,calls}=setup();await c.authorize('fixture-key');await c.select('river');const a=c.control();await assert.rejects(c.control());await a;assert.equal(calls.filter(x=>x==='claim').length,1);await assert.rejects(c.select('other'));
});
test('expired or malformed control never renews silently',async()=>{
 let now=1000;const {c,transport,calls}=setup({now:()=>now});
 transport.claim=async id=>({agentId:id,sessionId:'test',token:'fixture',expiresAt:2000});
 await c.authorize('fixture-key');await c.select('river');await c.control();now=3000;
 await c.refresh();assert.equal(c.view().controlled,false);assert.ok(!calls.includes('heartbeat'));assert.ok(calls.includes('release'));
 for(const bad of [{expiresAt:NaN},{token:''}]){
  now=1000;await c.control();transport.heartbeat=async lease=>({...lease,...bad});await c.refresh();assert.equal(c.view().controlled,false);
 }
});
test('shared local sessions cannot acquire the same agent concurrently',async()=>{
 const claims=new Map(),a=setup({claims}),b=setup({claims});
 for(const x of [a,b]){await x.c.authorize('fixture-key');await x.c.select('river');}
 const results=await Promise.allSettled([a.c.control(),b.c.control()]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal([...a.calls,...b.calls].filter(x=>x==='claim').length,1);
 await a.c.disconnect();await b.c.control();assert.equal(b.c.view().controlled,true);
});
