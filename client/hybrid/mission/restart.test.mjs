import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('abrupt service death recovers the pending mission from disk and finishes with no duplicate rewards',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'mcity-crash-')),children=[];
 t.after(async()=>{for(const child of children)if(child.exitCode===null&&child.signalCode===null){const exit=once(child,'exit');child.kill('SIGKILL');await exit;}await rm(directory,{recursive:true,force:true});});
 async function launch(){
  const code=`import {createMissionServer} from ${JSON.stringify(new URL('./server.mjs',import.meta.url).href)};const s=await createMissionServer({directory:${JSON.stringify(directory)},port:0,stepMs:50,intervalMs:10});console.log(s.server.address().port);`;
  const child=spawn(process.execPath,['--input-type=module','-e',code],{stdio:['ignore','pipe','pipe'],windowsHide:true});children.push(child);let error='';child.stderr.on('data',data=>error+=data);
  const port=await new Promise((resolve,reject)=>{child.stdout.once('data',data=>resolve(Number(String(data).trim())));child.once('exit',()=>reject(Error(error||'Child exited before ready')));});
  return {child,base:`http://127.0.0.1:${port}`};
 }
 let service=await launch();let d=await(await fetch(service.base+'/mission/state')).json();
 await fetch(service.base+'/mission/command',{method:'POST',headers:{Origin:service.base,'Content-Type':'application/json','X-CSRF-Token':d.csrf},body:JSON.stringify({type:'start',revision:d.state.revision})});
 for(let i=0;i<20;i++){d=await(await fetch(service.base+'/mission/state')).json();if(d.state.mission.pending)break;await new Promise(r=>setTimeout(r,5));}
 assert.ok(d.state.mission.pending);const missionId=d.state.mission.id,pendingId=d.state.mission.pending.id;
 const exited=once(service.child,'exit');service.child.kill('SIGKILL');await exited;
 service=await launch();await new Promise(r=>setTimeout(r,500));
 d=await(await fetch(service.base+'/mission/state')).json();assert.equal(d.state.mission.id,missionId);assert.equal(d.state.mission.status,'complete');assert.equal(d.state.receipts[0].id,pendingId);assert.equal(d.state.receipts.length,3);assert.equal(d.state.character.inventory.transit_actuator,1);assert.equal(d.state.character.skills.engineering.xp,268);
});
