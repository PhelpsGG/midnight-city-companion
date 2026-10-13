import test from 'node:test';
import assert from 'node:assert/strict';
import {projectContracts,filterContracts} from './model.mjs';

const catalog={items:[{id:'wire',name:'Copper wire'}],contracts:[
 {id:'first',name:'Foundry order',skill:'engineering',requiredLevel:2,areaId:'workshop',requirements:[{itemId:'wire',quantity:3}],rewards:[{itemId:'crystal',quantity:4}],xp:80},
 {id:'later',name:'Future foundry',skill:'engineering',requiredLevel:5,areaId:'workshop',requirements:[],rewards:[],xp:100},
 {id:'unknown',name:'Garden order',skill:'gardening',requiredLevel:1,areaId:'garden',requirements:[],rewards:[],xp:20}
]};
const state=()=>({character:{skills:{engineering:{level:2,xp:100}},inventory:{wire:2},position:{areaId:'workshop'},completedContractIds:[]},trackedContractIds:['later'],receipts:[],mission:{status:'running',cursor:0,steps:[{inputs:[{id:'wire',amount:1}]}]}});

test('known eligibility, missing materials and unknown skills remain distinct',()=>{
 const p=projectContracts(catalog,state());
 assert.deepEqual(p.rows.map(r=>[r.id,r.status]),[['first','available'],['later','locked'],['unknown','unknown']]);
 assert.deepEqual(p.rows[0].requirements.map(r=>[r.owned,r.missing,r.missionNeeded]),[[2,1,1]]);
 assert.equal(p.rows[1].levelsMissing,3);assert.equal(p.rows[2].level,null);
 assert.deepEqual(p.counts,{available:1,tracked:1,locked:2,completed:0,unknown:1});
});
test('shared progression unlocks a contract and inventory changes its readiness without granting rewards',()=>{
 const s=state();s.character.skills.engineering.level=5;s.character.inventory.wire=3;
 const p=projectContracts(catalog,s);assert.equal(p.rows[0].readiness,'ready');assert.equal(p.rows[1].status,'available');
 assert.equal(p.rows[0].completion,null);assert.equal(s.character.inventory.crystal,undefined);
 s.character.position={spaceId:'central'};assert.equal(projectContracts(catalog,s).rows[0].readiness,'location-unknown');
 s.character.position.areaId='garden';assert.equal(projectContracts(catalog,s).rows[0].readiness,'travel');
});
test('completion ID is history, not proof of reward amount or timestamp',()=>{
 const s=state();s.character.completedContractIds=['first'];s.character.inventory={};
 const r=projectContracts(catalog,s).rows[0];assert.equal(r.status,'completed');assert.equal(r.completion.at,null);assert.equal(r.completion.rewards,null);
 assert.equal(r.rewards[0].quantity,4); // catalog offer is separate from earned receipt
 s.receipts=[{id:'receipt',action:{kind:'deliver_contract',contractId:'first'},at:123,items:[{id:'crystal',amount:3}],gains:[{skill:'engineering',amount:70}],evidence:'scripted-fixture'}];
 const c=projectContracts(catalog,s).rows[0].completion;assert.equal(c.at,123);assert.deepEqual(c.rewards,[{id:'crystal',amount:3}]);assert.equal(c.evidence,'scripted-fixture');
});
test('missing history/inventory never becomes a confirmed available or ready contract',()=>{
 const s=state();delete s.character.completedContractIds;
 assert.equal(projectContracts(catalog,s).rows[0].status,'unknown');
 s.character.completedContractIds=[];delete s.character.inventory;
 const r=projectContracts(catalog,s).rows[0];assert.equal(r.requirements[0].owned,null);assert.equal(r.readiness,'inventory-unknown');
});
test('view, skill, location and item search filters compose and tracked includes locked goals',()=>{
 const p=projectContracts(catalog,state());
 assert.deepEqual(filterContracts(p,{view:'tracked'}).map(r=>r.id),['later']);
 assert.deepEqual(filterContracts(p,{view:'available',query:'copper',skill:'engineering',area:'workshop'}).map(r=>r.id),['first']);
 assert.equal(filterContracts(p,{view:'available',area:'garden'}).length,0);
 assert.equal(filterContracts(p,{view:'completed'}).length,0);
});
