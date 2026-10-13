import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../server/app.mjs';
test('local HTTP onboarding is isolated, CSRF guarded, revision bound and secret free',async t=>{
 const calls=[];const transport=()=>({async authorizedAgents(key){assert.equal(key,'fake-key');return ['river'];},async read(id){return {agent:{id,name:'River',skills:{},inventory:{}},control:{state:'uncontrolled'},receivedAt:Date.now()};},async claim(id){calls.push('claim');return {agentId:id,sessionId:'private-id',token:'private-token',expiresAt:Date.now()+60000};},async release(){calls.push('release');}});
 const server=await createServer({port:0,transportFactory:transport,asset:async()=>null});t.after(()=>server.close());const base=server.origin;
 let response=await fetch(base+'/api/session');const cookie=response.headers.get('set-cookie').split(';')[0];let s=await response.json();const original=s.revision;
 const post=(route,body={},extra={})=>fetch(base+route,{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json','X-CSRF-Token':s.csrf,...extra},body:JSON.stringify({revision:s.revision,...body})});
 assert.equal((await post('/api/discover',{key:'fake-key'},{Origin:'https://elsewhere.invalid'})).status,403);
 response=await post('/api/discover',{key:'fake-key'});assert.match(response.headers.get('set-cookie')??'',/Max-Age=1800/);s=await response.json();assert.deepEqual(s.view.agentIds,['river']);assert.doesNotMatch(JSON.stringify(s),/fake-key/);
 assert.equal((await post('/api/select',{id:'river',revision:original})).status,409);
 response=await post('/api/select',{id:'river'});s=await response.json();assert.equal(s.view.agent.id,'river');assert.deepEqual(calls,[]);
 const separate=await (await fetch(base+'/api/session')).json();assert.equal(separate.view.agent,null);
 assert.equal((await fetch(base+'/api/control')).status,401);
 response=await post('/api/control');s=await response.json();assert.equal(s.view.controlled,true);assert.doesNotMatch(JSON.stringify(s),/private-token|private-id/);
 response=await post('/api/disconnect');s=await response.json();assert.equal(s.view.agent,null);assert.deepEqual(calls,['claim','release']);
 assert.equal((await post('/api/actions',{kind:'craft'})).status,404);
});
test('two browser sessions cannot claim the same agent; expiry releases and invalidates',async t=>{
 let now=1000,claims=0,releases=0;
 const server=await createServer({port:0,now:()=>now,ttlMs:1000,asset:async()=>null,transportFactory:()=>({
  async authorizedAgents(){return ['river'];},async read(id){return {agent:{id},control:{state:'inactive'}};},
  async claim(agentId){claims++;return {agentId,token:'fake',sessionId:'fake',expiresAt:5000};},async release(){releases++;}
 })});t.after(()=>server.close());
 async function browser(){const r=await fetch(server.origin+'/api/session'),cookie=r.headers.get('set-cookie').split(';')[0];let s=await r.json();return {async post(route,payload={}){const res=await fetch(server.origin+'/api/'+route,{method:'POST',headers:{Cookie:cookie,Origin:server.origin,'Content-Type':'application/json','X-CSRF-Token':s.csrf},body:JSON.stringify({revision:s.revision,...payload})});const body=await res.json();if(res.ok)s=body;return {res,body};}};}
 const a=await browser(),b=await browser();for(const client of [a,b]){await client.post('discover',{key:'fixture'});await client.post('select',{id:'river'});}
 const outcomes=await Promise.all([a.post('control'),b.post('control')]);assert.deepEqual(outcomes.map(x=>x.res.status).sort(),[200,409]);assert.equal(claims,1);
 now=3000;for(const client of [a,b]){const {res,body}=await client.post('refresh');assert.equal(res.status,401);assert.equal(body.invalidateSession,true);}assert.equal(releases,1);
});
