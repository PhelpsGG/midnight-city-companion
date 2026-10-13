import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveTransport} from '../client/play/live.mjs';

function fixture(){
 const calls=[];let status=200,wrong=false;
 const fetchImpl=async(url,options)=>{
  calls.push({url,options});const route=new URL(url).pathname;
  let data={};const agent={id:wrong?'different-agent':'river',name:'River'};
  if(route.endsWith('/claimable'))data={agentIds:['river']};
  else if(route.endsWith('/context'))data={agent,controlStatus:null,tick:1};
  else if(route.endsWith('/progression'))data={agent,skills:{engineering:{level:2,xp:604}},capabilities:{contentVersion:'fixture-v1'},tick:1};
  else if(route.endsWith('/inventory'))data={agent,inventory:{crystal:12},tick:1};
  else if(route.endsWith('/resources'))data={agent,resources:[]};
  else if(route.endsWith('/recent-events'))data={recentEvents:[]};
  else if(route.endsWith('/session')||route.endsWith('/heartbeat'))data={agentId:'river',sessionId:'fixture-session',token:'fixture-lease',expiresAt:Date.now()+60000};
  return Response.json(data,{status});
 };
 return {transport:new LiveTransport({fetchImpl}),calls,setStatus:x=>status=x,setWrong:x=>wrong=x};
}
test('real transport maps public observations and keeps owner/lease credentials on their intended routes',async()=>{
 const {transport,calls}=fixture();assert.deepEqual(await transport.authorizedAgents('fixture-key'),['river']);
 const state=await transport.read('river');assert.equal(state.agent.inventory.crystal,12);assert.equal(state.agent.skills.engineering.xp,604);assert.equal(state.control.state,'uncontrolled');
 assert.ok(calls.filter(x=>x.url.includes('/api/skill/')).every(x=>!x.options.headers.Authorization));
 assert.ok(calls.every(x=>x.options.method==='GET'));
 const lease=await transport.claim('river');await transport.heartbeat(lease);await transport.release(lease);
 assert.deepEqual(calls.filter(x=>x.options.method==='POST').map(x=>new URL(x.url).pathname),['/observer/api/local-control/session','/observer/api/local-control/session/heartbeat','/observer/api/local-control/session/release']);
 assert.equal(calls.find(x=>x.url.endsWith('/session')).options.headers.Authorization,'Bearer fixture-key');
 assert.equal(calls.at(-1).options.headers.Authorization,'Bearer fixture-lease');
 assert.ok(calls.every(x=>x.options.redirect==='error'&&!x.url.includes('fixture-key')));
});
test('real transport rejects wrong identity, offline context and lost sessions without reading error bodies',async()=>{
 const {transport,setWrong,setStatus}=fixture();setWrong(true);await assert.rejects(transport.read('river'),{code:'WRONG_AGENT'});
 setWrong(false);setStatus(404);await assert.rejects(transport.read('river'),{code:'AGENT_OFFLINE'});
 setStatus(403);await assert.rejects(transport.heartbeat({token:'fixture',sessionId:'s'}),{code:'CONTROL_LOST'});
});
