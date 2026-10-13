import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Orchestrator} from '../server/orchestrator.mjs';
import {validateAction,findReceipt} from '../server/actions.mjs';

async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'companion-runtime-'));let now=1000,uncertain=false;
 const state={agent:{id:'river',inventory:{wood:20},skills:{}},capabilities:{recipes:[{recipeId:'plank',failureReason:null,craftableBatches:10}]},events:[]};
 const calls=[];let controlled=true,stale=false;
 const c={view:()=>({agent:state.agent,controlled,stale}),observation:()=>structuredClone(state),async refresh(){},async submit(action){calls.push(action);if(uncertain)throw Object.assign(Error(),{code:'NETWORK_UNCERTAIN'});},};
 const open=()=>Orchestrator.open({directory:dir,now:()=>now,timeoutMs:100});let r=await open();await r.attach(c);
 t.after(async()=>{await r.close();await rm(dir,{recursive:true,force:true});});
 return {c,state,calls,get r(){return r;},async reopen(){await r.close();r=await open();await r.attach(c);},advance:n=>now+=n,lose:()=>controlled=false,stale:()=>stale=true,uncertain:()=>uncertain=true};
}
const action={kind:'craft',recipeId:'plank',batches:5};
const enqueue=(f,id='one')=>f.r.command(f.c,{type:'enqueue',requestId:id,action},'gui');
const receipt=(id='event-1')=>({eventId:id,payload:{kind:'item_crafted',agentId:'river',recipeId:'plank',batches:5,outputs:{plank:5}}});
test('shared queue preserves batch quantities, serializes GUI/AI, deduplicates and confirms only new matching events',async t=>{
 const f=await fixture(t);f.state.events.push(receipt('old'));await enqueue(f);
 await f.r.command(f.c,{type:'enqueue',requestId:'two',action},'ai');await enqueue(f);await f.r.pulse();
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].batches,5);assert.equal(f.r.view('river').jobs[0].status,'pending');
 await f.r.pulse();assert.equal(f.calls.length,1);
 f.state.events.push(receipt());await f.r.pulse();assert.equal(f.r.view('river').jobs[0].status,'confirmed');
 await f.r.pulse();assert.equal(f.calls.length,2);
 await assert.rejects(f.r.command(f.c,{type:'enqueue',requestId:'one',action:{...action,batches:1}},'ai'),/different/);
});
test('ambiguous dispatch blocks further work and restart never resends it',async t=>{
 const f=await fixture(t);f.uncertain();await enqueue(f);await enqueue(f,'two');await f.r.pulse();
 assert.equal(f.r.view('river').jobs[0].status,'uncertain');await f.reopen();await f.r.pulse();assert.equal(f.calls.length,1);
 await assert.rejects(f.r.command(f.c,{type:'resume'},'gui'),/unresolved/);
 f.state.events.push(receipt());await f.r.pulse();assert.equal(f.r.view('river').jobs[0].status,'confirmed');assert.equal(f.calls.length,1);
 await f.r.command(f.c,{type:'resume'},'gui');await f.r.pulse();assert.equal(f.calls.length,2);
});
test('pause and stop block dispatch; AI cannot override a browser pause; stale or lost control blocks work',async t=>{
 const f=await fixture(t);await enqueue(f);await f.r.command(f.c,{type:'pause'},'gui');await f.r.pulse();assert.equal(f.calls.length,0);
 await assert.rejects(f.r.command(f.c,{type:'resume'},'ai'),/companion/);
 await f.r.command(f.c,{type:'stop'},'gui');assert.equal(f.r.view('river').jobs[0].status,'canceled');
 await f.r.command(f.c,{type:'resume'},'gui');await enqueue(f,'new');f.stale();await f.r.pulse();assert.equal(f.calls.length,0);
 f.lose();await assert.rejects(enqueue(f,'lost'),/control/);
});
test('actions enforce native capabilities and strict allowlist, rejecting unknown fields/oversized batches',()=>{
 assert.throws(()=>validateAction({...action,batches:101}),/action/i);
 assert.throws(()=>validateAction({...action,agentId:'someone-else'}),/action/i);
 assert.throws(()=>validateAction({kind:'crystal_transfer',quantity:1}),/action/i);
 assert.equal(findReceipt([receipt()],[],{...action,agentId:'other'}),null);
 assert.equal(findReceipt([receipt()],[],{...action,batches:4,agentId:'river'}),null);
});
test('current capability gates are checked again at dispatch, and goals never manufacture completion',async t=>{
 const f=await fixture(t);await f.r.command(f.c,{type:'goal',text:'Make planks'},'gui');await enqueue(f);
 f.state.capabilities.recipes[0].craftableBatches=1;await f.r.pulse();assert.equal(f.calls.length,0);
 assert.equal(f.r.view('river').jobs[0].status,'failed');assert.equal(f.r.view('river').goal,'Make planks');
});
test('revocation is rechecked inside the serialized command, not just when HTTP starts',async t=>{
 const f=await fixture(t);let allowed=true,release;
 const held=f.r.serial(()=>new Promise(resolve=>release=resolve));await Promise.resolve();
 const actionRequest=f.r.command(f.c,{type:'enqueue',requestId:'revoked',action},'ai',()=>allowed);allowed=false;release();await held;
 await assert.rejects(actionRequest,/revoked/);assert.equal(f.r.view('river').jobs.length,0);
});
test('a refresh overlapping the persisted intent is safely deferred when submit proves nothing was sent',async t=>{
 const f=await fixture(t),submit=f.c.submit;let busy=true;
 f.c.submit=async action=>{if(busy)throw Object.assign(Error(),{code:'CONNECTION_BUSY'});return submit(action);};
 await enqueue(f);await f.r.pulse();assert.equal(f.calls.length,0);assert.equal(f.r.view('river').jobs[0].status,'queued');
 busy=false;await f.r.pulse();assert.equal(f.calls.length,1);assert.equal(f.r.view('river').jobs[0].status,'pending');
});
test('a newly authorized session can recover paused history after the previous session loses control',async t=>{
 const f=await fixture(t);await enqueue(f);f.lose();await f.r.pulse();const c={...f.c,view:()=>({agent:f.state.agent,controlled:true,stale:false})};
 await f.r.attach(c);assert.equal(f.r.view('river').mode,'paused');assert.equal(f.r.view('river').jobs.length,1);
 await f.r.command(c,{type:'resume'},'gui');await f.r.pulse();assert.equal(f.calls.length,1);
});
