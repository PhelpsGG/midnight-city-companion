import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AwayReports} from '../server/away-reports.mjs';
const observation=(id='river')=>({agent:{id,name:'River',skills:{crafting:{xp:90,level:1}},inventory:{wood:20,crystal:12},completedContractIds:[]},events:[],receivedAt:1});
async function setup(t){let now=1000;const directory=await mkdtemp(join(tmpdir(),'companion-away-'));let reports=await AwayReports.open({directory,now:()=>now});t.after(async()=>{await reports.close();await rm(directory,{recursive:true,force:true});});return {get reports(){return reports;},advance:n=>now+=n,async reopen(){await reports.close();reports=await AwayReports.open({directory,now:()=>now});}};}
test('first visit seeds state; background observation never consumes gains; recorded flows differ from net inventory',async t=>{
 const f=await setup(t),s=observation();await f.reports.observe(s);await f.reports.visit('river',{clientId:'tab-a',visible:true});assert.equal(f.reports.view('river').report,null);
 await f.reports.visit('river',{clientId:'tab-a',visible:false});f.advance(100);
 s.agent.skills.crafting={xp:140,level:2};s.agent.inventory={wood:15,plank:5,crystal:22};s.agent.completedContractIds=['starter'];
 s.events=[{eventId:'craft',payload:{agentId:'river',kind:'item_crafted',outputs:{plank:5},inputs:{wood:5}}},{eventId:'reward',payload:{agentId:'river',kind:'contract_completed',contractId:'starter',rewards:{crystal:10}}}];
 await f.reports.observe(s);await f.reports.observe(s);assert.equal(f.reports.view('river').report,null);
 await f.reports.visit('river',{clientId:'tab-b',visible:true});const r=f.reports.view('river').report;
 assert.equal(r.skills[0].xp,50);assert.equal(r.skills[0].levels,1);assert.equal(r.items.find(x=>x.id==='wood').net,-5);assert.equal(r.flows.earned.plank,5);assert.equal(r.flows.consumed.wood,5);assert.equal(r.flows.earned.crystal,10);assert.deepEqual(r.contracts,['starter']);assert.equal(r.eventCount,2);
});
test('pending report survives restart, acknowledges exact version, and remains reopenable',async t=>{
 const f=await setup(t),s=observation();await f.reports.observe(s);await f.reports.visit('river',{clientId:'a',visible:true});f.advance(61000);s.agent.skills.crafting.xp+=10;await f.reports.observe(s);await f.reports.visit('river',{clientId:'b',visible:true});const r=f.reports.view('river').report;
 await f.reopen();assert.equal(f.reports.view('river').report.id,r.id);
 await f.reports.observe(s);await assert.rejects(f.reports.visit('river',{clientId:'b',visible:true,ackId:'wrong'}),/changed/);
 await f.reports.visit('river',{clientId:'b',visible:true,ackId:r.id});assert.equal(f.reports.view('river').unread,false);assert.equal(f.reports.view('river').report.id,r.id);
 f.advance(1000);await f.reports.visit('river',{clientId:'b',visible:true});assert.equal(f.reports.view('river').unread,false);
});
test('visible tabs coalesce; unknown state never fabricates losses, and characters remain isolated',async t=>{
 const f=await setup(t),s=observation();await f.reports.observe(s);await f.reports.visit('river',{clientId:'a',visible:true});await f.reports.visit('river',{clientId:'b',visible:true});await f.reports.visit('river',{clientId:'a',visible:false});
 f.advance(1000);s.agent.skills.crafting.xp+=10;await f.reports.observe(s);await f.reports.visit('river',{clientId:'b',visible:true});assert.equal(f.reports.view('river').unread,false);
 await f.reports.visit('river',{clientId:'b',visible:false});f.advance(2000);delete s.agent.inventory;await f.reports.observe(s);await f.reports.visit('river',{clientId:'c',visible:true});const r=f.reports.view('river').report;assert.equal(r.items.length,0);assert.ok(r.gaps.some(x=>/inventory/i.test(x)));
 await f.reports.observe(observation('juniper'));await f.reports.visit('juniper',{clientId:'c',visible:true});assert.equal(f.reports.view('juniper').report,null);
});
test('conversation events are deduplicated; unknown connection gains stay unknown; stale snapshots cannot mark seen',async t=>{
 const f=await setup(t),s=observation();await f.reports.observe(s);await f.reports.visit('river',{clientId:'a',visible:true});await f.reports.visit('river',{clientId:'a',visible:false});f.advance(1000);
 s.events=[{eventId:'one',payload:{kind:'agent_spoke',agentId:'river',targetAgentId:'friend',threadId:'chat-1',text:'Do not persist this text'}},{eventId:'two',payload:{kind:'agent_spoke',agentId:'river',targetAgentId:'friend',threadId:'chat-1'}},{eventId:'foreign',payload:{kind:'agent_spoke',agentId:'other',targetAgentId:'friend'}}];
 await f.reports.observe(s);await f.reports.observe(s);await f.reports.visit('river',{clientId:'b',visible:true});const r=f.reports.view('river').report;assert.equal(r.social.messages,2);assert.equal(r.social.threads,1);assert.equal(r.social.partners,1);assert.equal(r.social.connections,null);assert.doesNotMatch(JSON.stringify(r),/Do not persist/);
 f.advance(61000);await assert.rejects(f.reports.visit('river',{clientId:'b',visible:true,ackId:r.id}),/fresh/);assert.equal(f.reports.view('river').unread,true);
});
test('failed acknowledgement storage preserves the unread report; invalid inventory is unknown, not a loss',async t=>{
 const f=await setup(t),s=observation();await f.reports.observe(s);await f.reports.visit('river',{clientId:'a',visible:true});await f.reports.visit('river',{clientId:'a',visible:false});f.advance(1000);
 s.agent.inventory.wood='unavailable';await f.reports.observe(s);await f.reports.visit('river',{clientId:'b',visible:true});const r=f.reports.view('river').report;assert.equal(r.items.length,0);assert.ok(r.gaps.length);
 const save=f.reports.store.save;f.reports.store.save=async()=>{throw Error('Disk failure');};
 await assert.rejects(f.reports.visit('river',{clientId:'b',visible:true,ackId:r.id}),/could not be saved/);assert.equal(f.reports.view('river').unread,true);f.reports.store.save=save;
});
test('a newer offline observation invalidates freshness and cannot acknowledge a pending report',async t=>{
 const f=await setup(t),s=observation();await f.reports.observe(s);await f.reports.visit('river',{clientId:'a',visible:true});await f.reports.visit('river',{clientId:'a',visible:false});s.agent.skills.crafting.xp+=10;await f.reports.observe(s);await f.reports.visit('river',{clientId:'b',visible:true});const id=f.reports.view('river').report.id;
 await f.reports.observe({agent:{id:'river',status:'offline'}});
 await assert.rejects(f.reports.visit('river',{clientId:'b',visible:true,ackId:id}),/fresh/);assert.equal(f.reports.view('river').unread,true);
 await f.reports.observe(s);await f.reports.visit('river',{clientId:'b',visible:true,ackId:id});assert.equal(f.reports.view('river').unread,false);
});
test('missing skills and unavailable event coverage are surfaced in every reporting period',async t=>{
 const f=await setup(t),s=observation();delete s.events;await f.reports.observe(s);await f.reports.visit('river',{clientId:'a',visible:true});await f.reports.visit('river',{clientId:'a',visible:false});s.agent.skills={};await f.reports.observe(s);await f.reports.visit('river',{clientId:'b',visible:true});let r=f.reports.view('river').report;
 assert.ok(r?.gaps.some(g=>/skill/i.test(g)));assert.ok(r.gaps.some(g=>/events.*unavailable/i.test(g)));assert.equal(r.skills.length,0);
 await f.reports.visit('river',{clientId:'b',visible:true,ackId:r.id});await f.reports.visit('river',{clientId:'b',visible:false});await f.reports.observe(s);await f.reports.visit('river',{clientId:'c',visible:true});r=f.reports.view('river').report;assert.ok(r.gaps.some(g=>/events.*unavailable/i.test(g)));
});
test('event coverage remains unavailable when it was already missing at the baseline',async t=>{
 const f=await setup(t),s=observation();delete s.events;await f.reports.observe(s);await f.reports.visit('river',{clientId:'a',visible:true});await f.reports.visit('river',{clientId:'a',visible:false});s.agent.skills.crafting.xp+=10;await f.reports.observe(s);await f.reports.visit('river',{clientId:'b',visible:true});assert.ok(f.reports.view('river').report.gaps.some(g=>/events.*unavailable/i.test(g)));
});
