import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionClient} from '../client/live/session.mjs';

test('stale or expired tab clears identity before any retry, without reclaiming',async()=>{
 for(const status of [401,409]){
  const changes=[],calls=[];let invalid=false;
  const client=createSessionClient({onChange:s=>changes.push(s),fetchImpl:async(url,options)=>{
   calls.push([url,options]);return Response.json(invalid?{error:'Reload',invalidateSession:true}:{csrf:'fixture',revision:1,view:{agent:{id:'river'},controlled:true}},{status:invalid?status:200});
  }});
  await client.open();invalid=true;await assert.rejects(client.command('refresh'));
  assert.equal(client.snapshot,null);assert.equal(changes.at(-1),null);
  await assert.rejects(client.command('control'),/Reload/);assert.equal(calls.length,2);
 }
});
test('ordinary upstream failure keeps the observation and does not retry the command',async()=>{
 let fail=false;const client=createSessionClient({fetchImpl:async()=>Response.json(fail?{error:'Unavailable'}:{csrf:'fixture',revision:0,view:{agent:{id:'river'}}},{status:fail?502:200})});
 await client.open();fail=true;await assert.rejects(client.command('refresh'));assert.equal(client.snapshot.view.agent.id,'river');
});
