import test from 'node:test';import assert from 'node:assert/strict';
import {LiveTransport} from '../client/play/live.mjs';
import {validateAction,findReceipt} from '../server/actions.mjs';
const cases=[
 [{kind:'craft',recipeId:'plank',batches:5},{kind:'item_crafted',recipeId:'plank',batches:5}],
 [{kind:'gather',sourceId:'tree',nodeId:'tree-1'},{kind:'resource_gathered',nodeId:'tree-1'}],
 [{kind:'move_to',destination:{spaceId:'central',x:1,y:2}},{kind:'agent_arrived',at:{spaceId:'central',x:1,y:2}}],
 [{kind:'travel_to_district',districtId:'central'},{kind:'agent_transferred',to:{spaceId:'central'}}],
 [{kind:'deliver_contract',contractId:'contract'},{kind:'contract_completed',contractId:'contract'}],
 [{kind:'equip',itemId:'axe'},{kind:'equipment_changed',itemId:'axe'}],
 [{kind:'unequip',slot:'hand'},{kind:'equipment_changed',slot:'hand',itemId:null}],
 [{kind:'use_item',itemId:'potion'},{kind:'agent_healed',itemId:'potion'}],
 [{kind:'attack',enemyId:'enemy',style:'melee'},{kind:'enemy_damaged',enemyId:'enemy'}],
 [{kind:'eat'},{kind:'agent_ate'}],
 [{kind:'stop_job'},{kind:'activity_completed',activity:'stop_job'}],
];
for(const [action,payload] of cases)test('native adapter request and receipt mapping: '+action.kind,async()=>{
 const t=new LiveTransport({fetchImpl:async(url,options)=>{assert.equal(url,'https://midnight.city/observer/api/actions');assert.equal(options.headers.Authorization,'Bearer synthetic-lease');assert.deepEqual(JSON.parse(options.body),{...action,agentId:'river'});assert.equal(options.redirect,'error');return Response.json({accepted:true});}});
 await t.submit({token:'synthetic-lease',agentId:'river'},validateAction(action));
 const event={eventId:'new',payload:{...payload,agentId:'river'}};
 assert.equal(findReceipt([event],[],{...action,agentId:'river'}).status,'confirmed');assert.equal(findReceipt([event],['new'],{...action,agentId:'river'}),null);
});
