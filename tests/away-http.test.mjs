import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createServer} from '../server/app.mjs';import {Sandbox} from '../server/sandbox.mjs';
test('GUI departure -> background AI craft -> return report -> acknowledgement; AI cannot mark seen',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'away-http-'));let now=10000;
 const box=await Sandbox.open(join(dir,'world'),{now:()=>now,delayMs:0});
 const service=await createServer({port:0,now:()=>now,directory:join(dir,'runtime'),pairingDirectory:join(dir,'ai'),transportFactory:()=>box.transport(),asset:async()=>null});
 t.after(async()=>{await service.close();await box.close();await rm(dir,{recursive:true,force:true});});
 const initial=await fetch(service.origin+'/api/session'),cookie=initial.headers.get('set-cookie').split(';')[0];let session=await initial.json();
 async function post(route,payload={}){const r=await fetch(service.origin+'/api/'+route,{method:'POST',headers:{Cookie:cookie,Origin:service.origin,'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({revision:session.revision,...payload})});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return session=data;}
 await post('discover',{key:'sandbox-test-key'});await post('select',{id:'sandbox-river'});await post('control');await post('pair');
 const pair=JSON.parse(await readFile(session.ai.connectionFile,'utf8'));
 const ai=input=>fetch(service.origin+'/bridge',{method:'POST',headers:{Authorization:'Bearer '+pair.bearer,'Content-Type':'application/json'},body:JSON.stringify(input)});
 await post('visit',{visit:{clientId:'browser-a',visible:true}});await post('visit',{visit:{clientId:'browser-a',visible:false}});now+=100;
 assert.equal((await ai({op:'command',command:{type:'enqueue',requestId:'away-craft',action:{kind:'craft',recipeId:'sandbox_plank',batches:5}}})).status,200);
 await service.pulse();await service.pulse();await ai({op:'state'});await post('refresh');assert.equal(session.away.report,null);
 await post('visit',{visit:{clientId:'browser-b',visible:true}});const report=session.away.report;
 assert.equal(report.skills[0].xp,50);assert.equal(report.flows.earned.sandbox_plank,5);assert.equal(report.flows.consumed.sandbox_wood,5);assert.equal(session.away.unread,true);
 await ai({op:'state'});await post('refresh');assert.equal(session.away.report.id,report.id);assert.equal(session.away.unread,true);
 assert.equal((await ai({op:'visit',command:{ackId:report.id}})).status,400);
 await post('visit',{visit:{clientId:'browser-b',visible:true,ackId:report.id}});assert.equal(session.away.unread,false);assert.equal(session.away.report.id,report.id);
});
