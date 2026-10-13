// Scripted interface rehearsal only. This is not a planner or full game simulator.
// Reuse imported definitions and the existing sandbox's threshold projection.
import {content,skillRecord} from '../../sandbox/schema.mjs';
export const fixtureVersion='actuator-rehearsal-v1';
export const fixtureCatalog=content;
export function initialCharacter(){return {id:'rookie',name:'River · sandbox player',kind:'agent',profession:'hacker',position:{spaceId:'central',x:68,y:59},status:'idle',skills:{scavenging:skillRecord(0),engineering:skillRecord(220)},inventory:{},equipment:{},completedContractIds:[],vitals:{health:100,maxHealth:100},hunger:{value:15,state:'fixture'},activeAction:null,activeWork:null,isPerformingJob:false,activeModule:{locksCommonActions:false}};}
export function fixtureSteps(count){
 const steps=[
  {label:'Gather copper wiring',action:{kind:'gather',sourceId:'market_parts_bin',nodeId:'wiring-node'},inputs:[],items:[{id:'copper_wiring',amount:1}],gains:[{skill:'scavenging',amount:29}],position:{spaceId:'central',x:73,y:61}},
  {label:'Gather scrap steel',action:{kind:'gather',sourceId:'transit_scrap_heap',nodeId:'scrap-node'},inputs:[],items:[{id:'scrap_steel',amount:1}],gains:[{skill:'scavenging',amount:29}],position:{spaceId:'central',x:70,y:61}},
  {label:'Craft a transit actuator',action:{kind:'craft',recipeId:'refine_transit_actuator',batches:1},inputs:[{id:'copper_wiring',amount:1},{id:'scrap_steel',amount:1}],items:[{id:'transit_actuator',amount:1}],gains:[{skill:'engineering',amount:48}],position:{spaceId:'central',x:76,y:62}}
 ];
 return Array.from({length:count},()=>structuredClone(steps)).flat();
}
export function applyFixtureResult(character,step){
 for(const i of step.inputs)if((character.inventory[i.id]??0)<i.amount)throw Error('Fixture input missing; no result applied.');
 for(const i of step.inputs)character.inventory[i.id]-=i.amount;
 for(const i of step.items)character.inventory[i.id]=(character.inventory[i.id]??0)+i.amount;
 for(const g of step.gains)character.skills[g.skill]=skillRecord(character.skills[g.skill].xp+g.amount);
 character.position=structuredClone(step.position);
}
