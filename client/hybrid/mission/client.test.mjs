import test from 'node:test';
import assert from 'node:assert/strict';
import {returnSummary,MissionClient} from './client.mjs';
test('away summary counts persisted receipts since last visible checkpoint and preserves evidence label',()=>{
 const state={worldId:'a',revision:9,receipts:[{id:'r1',gains:[{skill:'engineering',amount:48}]},{id:'r2',gains:[{skill:'scavenging',amount:29}]}],events:[{type:'complete'}],character:{inventory:{transit_actuator:1,copper_wiring:0}},mission:{status:'complete'}};
 const summary=returnSummary(state,{worldId:'a',receipts:1,events:0,inventory:{copper_wiring:1}});
 assert.equal(summary.actions,1);assert.deepEqual(summary.gains,[{skill:'scavenging',amount:29}]);assert.deepEqual(summary.items,[{id:'transit_actuator',amount:1},{id:'copper_wiring',amount:-1}]);assert.equal(summary.completed,true);
 assert.equal(returnSummary(state,{worldId:'a',receipts:2,events:1,inventory:state.character.inventory}),null);
 assert.equal(returnSummary(state,null).firstVisit,true);
});
test('client ignores late older polls and never automatically starts a mission',()=>{
 const client=new MissionClient();const response=revision=>({csrf:'test',state:{worldId:'a',revision,mission:{status:'running',target:1,baseline:{},steps:[],cursor:0},baseline:{}},snapshot:{revision}});
 client.accept(response(8));client.accept(response(7));assert.equal(client.state.revision,8);assert.equal(client.snapshot.revision,8);assert.equal(client.mode,'running');
});
