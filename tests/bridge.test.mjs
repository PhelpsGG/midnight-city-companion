import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from '../server/app.mjs';
import {Sandbox} from '../server/sandbox.mjs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
export async function browser(origin){
 const res=await fetch(origin+'/api/session');const cookie=res.headers.get('set-cookie').split(';')[0];let session=await res.json();
 return {get session(){return session;},cookie,async post(route,payload={}){const r=await fetch(origin+'/api/'+route,{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({revision:session.revision,...payload})});const data=await r.json();if(!r.ok)throw Error(data.error);session=data;return data;}};
}
test('download-style service onboarding -> real stdio MCP -> shared confirmed GUI state, revocation and recovery',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'companion-full-flow-'));let box=await Sandbox.open(join(dir,'world'),{delayMs:0});
 let service=await createServer({port:0,directory:join(dir,'runtime'),pairingDirectory:join(dir,'ai'),transportFactory:()=>box.transport(),asset:async()=>null,pulseMs:0,mode:'sandbox'});
 const client=new Client({name:'acceptance-test',version:'1'});
 t.after(async()=>{await client.close().catch(()=>{});await service.close();await box.close();await rm(dir,{recursive:true,force:true});});
 const b=await browser(service.origin);await assert.rejects(b.post('pair'),/control/);
 await b.post('discover',{key:'sandbox-test-key'});await b.post('select',{id:'sandbox-river'});assert.equal(b.session.view.controlled,false);
 await b.post('control');await b.post('command',{command:{type:'goal',text:'Make 5 practice planks'}});await b.post('pair');
 const file=b.session.ai.connectionFile;assert.ok(file);assert.doesNotMatch(JSON.stringify(b.session),/bearer|fixture-lease/);
 const config=JSON.parse(await readFile(file,'utf8'));
 await client.connect(new StdioClientTransport({command:process.execPath,args:['ai/mcp.mjs','--connection',file],cwd:process.cwd(),stderr:'pipe'}));
 const listed=await client.listTools();assert.ok(listed.tools.some(t=>t.name==='companion_action'));
 const call=async(name,args={})=>{const r=await client.callTool({name,arguments:args});assert.equal(r.isError,undefined,JSON.stringify(r));return JSON.parse(r.content[0].text);};
 await call('companion_action',{requestId:'craft-five',action:{kind:'craft',recipeId:'sandbox_plank',batches:5}});
 await service.pulse();await service.pulse();await b.post('refresh');
 assert.equal(b.session.view.agent.inventory.sandbox_plank,5);assert.equal(b.session.runtime.jobs[0].status,'confirmed');
 const state=await call('companion_state');assert.equal(state.observation.agent.inventory.sandbox_plank,5);
 for(const [requestId,action] of [['gather',{kind:'gather',sourceId:'sandbox_trees',nodeId:'practice-tree'}],['move',{kind:'move_to',destination:{spaceId:'central',x:70,y:60}}],['deliver',{kind:'deliver_contract',contractId:'sandbox_delivery'}]]){await call('companion_action',{requestId,action});await service.pulse();await service.pulse();}
 await b.post('refresh');assert.equal(b.session.view.agent.inventory.crystal,22);assert.equal(b.session.view.agent.inventory.sandbox_wood,26);assert.equal(b.session.view.agent.position.x,70);assert.deepEqual(b.session.view.agent.completedContractIds,['sandbox_delivery']);
 await b.post('command',{command:{type:'pause'}});
 const blocked=await client.callTool({name:'companion_action',arguments:{requestId:'blocked',action:{kind:'craft',recipeId:'sandbox_plank',batches:1}}});assert.equal(blocked.isError,true);
 await b.post('revoke');assert.equal((await fetch(service.origin+'/bridge',{method:'POST',headers:{Authorization:'Bearer '+config.bearer,'Content-Type':'application/json'},body:JSON.stringify({op:'state'})})).status,401);
 await assert.rejects(readFile(file),{code:'ENOENT'});
 await b.post('command',{command:{type:'resume'}});await b.post('command',{command:{type:'enqueue',requestId:'after-close',action:{kind:'craft',recipeId:'sandbox_plank',batches:2}}});
 // No browser requests while the background runtime finishes queued work.
 await service.pulse();await service.pulse();
 await service.close();await box.close();box=await Sandbox.open(join(dir,'world'),{delayMs:0});service=await createServer({port:0,directory:join(dir,'runtime'),pairingDirectory:join(dir,'ai'),transportFactory:()=>box.transport(),asset:async()=>null,mode:'sandbox'});
 const reopened=await browser(service.origin);assert.equal(reopened.session.view.authorized,false);
 await reopened.post('discover',{key:'sandbox-test-key'});await reopened.post('select',{id:'sandbox-river'});assert.equal(reopened.session.view.agent.inventory.sandbox_plank,2);assert.equal(reopened.session.runtime.jobs.filter(j=>j.status==='confirmed').length,5);assert.equal(reopened.session.runtime.mode,'paused');
});
