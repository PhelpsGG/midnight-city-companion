import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,rename,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {MissionRuntime} from './runtime.mjs';

async function setup(t){
 const directory=await mkdtemp(join(tmpdir(),'mcity-mission-'));let time=1000;
 const options={directory,now:()=>time,stepMs:10};let runtime=await MissionRuntime.open(options);
 t.after(async()=>{await runtime.close();await rm(directory,{recursive:true,force:true});});
 return {directory,options,get runtime(){return runtime;},async reopen(){await runtime.close();runtime=await MissionRuntime.open(options);return runtime;},async step(){time+=11;await runtime.pulse();},async command(type,fields={}){return runtime.command({type,revision:runtime.snapshot().revision,...(['pause','stop'].includes(type)?{missionId:runtime.snapshot().mission.id}:{}),...fields});}};
}
test('background progress survives reopen with exactly one receipt per step',async t=>{
 const s=await setup(t);await s.command('select',{count:3,fault:'normal'});await s.command('start');
 await s.step();assert.ok(s.runtime.snapshot().mission.pending);
 await s.reopen();for(let i=0;i<20;i++)await s.step();
 const state=s.runtime.snapshot();assert.equal(state.mission.status,'complete');assert.equal(state.character.inventory.transit_actuator,3);
 assert.equal(state.character.skills.scavenging.xp,174);assert.equal(state.character.skills.engineering.xp,364);
 assert.equal(state.receipts.length,9);assert.equal(new Set(state.receipts.map(r=>r.id)).size,9);
 await s.reopen();assert.deepEqual(s.runtime.snapshot().receipts,state.receipts);
});
test('pause and stop are durable, and a new goal preserves earned progress',async t=>{
 const s=await setup(t);await s.command('start');await s.step();await s.command('pause');
 const paused=s.runtime.snapshot();await s.reopen();await s.step();assert.deepEqual(s.runtime.snapshot(),paused);
 await s.command('resume');await s.step();assert.equal(s.runtime.snapshot().receipts.length,1);
 await s.command('stop');for(let i=0;i<8;i++)await s.step();assert.equal(s.runtime.snapshot().receipts.length,1);
 await s.command('select',{count:1,fault:'normal'});await s.command('start');for(let i=0;i<8;i++)await s.step();
 assert.equal(s.runtime.snapshot().character.inventory.transit_actuator,1);assert.equal(s.runtime.snapshot().receipts.length,4);
});
test('stale or competing starts cannot dispatch duplicate loops; active mission cannot be replaced',async t=>{
 const s=await setup(t),revision=s.runtime.snapshot().revision;
 const results=await Promise.allSettled([s.runtime.command({type:'start',revision}),s.runtime.command({type:'start',revision})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 await assert.rejects(s.command('select',{count:1,fault:'normal'}),/Stop/);
 await assert.rejects(MissionRuntime.open(s.options),/already running/);
});
test('uncertain result is reconciled from the saved receipt without resubmission or duplicate XP',async t=>{
 const s=await setup(t);await s.command('select',{count:1,fault:'uncertain'});await s.command('start');await s.step();await s.step();
 assert.equal(s.runtime.snapshot().mission.status,'blocked');assert.equal(s.runtime.snapshot().receipts.length,0);
 await s.reopen();await assert.rejects(s.command('resume'),/Reconcile/);
 await s.command('reconcile');assert.equal(s.runtime.snapshot().receipts.length,1);assert.equal(s.runtime.snapshot().character.skills.scavenging.xp,29);
 await assert.rejects(s.command('reconcile'),/uncertain/);
 await s.command('resume');for(let i=0;i<6;i++)await s.step();assert.equal(s.runtime.snapshot().receipts.length,3);
});
test('disconnected fixture blocks before submission and resumes explicitly',async t=>{
 const s=await setup(t);await s.command('select',{count:1,fault:'disconnected'});await s.command('start');await s.step();
 assert.equal(s.runtime.snapshot().mission.status,'blocked');assert.equal(s.runtime.snapshot().mission.pending,null);
 await s.command('resume');for(let i=0;i<8;i++)await s.step();assert.equal(s.runtime.snapshot().mission.status,'complete');
});
test('corrupt primary restores backup paused, while corrupt primary and backup fail without reset',async t=>{
 const s=await setup(t);await s.command('start');await s.step();await s.runtime.close();
 await writeFile(join(s.directory,'state.json'),'broken');await s.reopen();
 assert.equal(s.runtime.snapshot().mission.status,'paused');assert.match(s.runtime.snapshot().recovery,/backup/);
 await s.runtime.close();await writeFile(join(s.directory,'state.json'),'broken again');await writeFile(join(s.directory,'state.backup.json'),'also broken');
 await assert.rejects(s.reopen(),/No valid/);assert.equal(await readFile(join(s.directory,'state.json'),'utf8'),'broken again');
});
test('input validation rejects unsupported goals, faults and commands without changing state',async t=>{
 const s=await setup(t),before=s.runtime.snapshot();
 for(const fields of [{type:'select',count:0,fault:'normal'},{type:'select',count:10000,fault:'normal'},{type:'select',count:1,fault:'live'},{type:'warp'}])await assert.rejects(s.runtime.command({revision:before.revision,...fields}));
 assert.deepEqual(s.runtime.snapshot(),before);
});
test('pause and stop target the mission even when a background step advanced; wrong mission is rejected',async t=>{
 const s=await setup(t);await s.command('start');const before=s.runtime.snapshot();await s.step();
 await s.runtime.command({type:'pause',revision:before.revision,missionId:before.mission.id});assert.equal(s.runtime.snapshot().mission.status,'paused');
 await assert.rejects(s.runtime.command({type:'stop',revision:before.revision,missionId:'old-mission'}),/mission changed/);
 await s.runtime.command({type:'stop',revision:before.revision,missionId:before.mission.id});assert.equal(s.runtime.snapshot().mission.status,'stopped');
});
test('failed disk replacement halts execution without publishing unpersisted progress',async t=>{
 const s=await setup(t),before=s.runtime.snapshot();const path=join(s.directory,'state.json');
 await rename(path,join(s.directory,'held.json'));await mkdir(path);
 await assert.rejects(s.command('start'));
 const after=s.runtime.snapshot();assert.equal(after.revision,before.revision);assert.equal(after.mission.status,'ready');assert.match(after.runtimeError,/Saving failed/);
 await assert.rejects(s.step(),/halted/);assert.equal(s.runtime.snapshot().receipts.length,0);
});
