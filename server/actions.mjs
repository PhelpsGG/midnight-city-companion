import {z} from 'zod';
import {ConnectionError} from './connection.mjs';
const id=z.string().regex(/^[A-Za-z0-9_-]{1,160}$/);
const point=z.strictObject({spaceId:id,x:z.number().int().min(0).max(10000),y:z.number().int().min(0).max(10000)});
export const actionSchema=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('move_to'),destination:point}),
 z.strictObject({kind:z.literal('travel_to_district'),districtId:id}),
 z.strictObject({kind:z.literal('gather'),sourceId:id,nodeId:id}),
 z.strictObject({kind:z.literal('craft'),recipeId:id,batches:z.number().int().min(1).max(100)}),
 ...['equip','use_item'].map(kind=>z.strictObject({kind:z.literal(kind),itemId:id})),
 z.strictObject({kind:z.literal('unequip'),slot:id}),
 z.strictObject({kind:z.literal('attack'),enemyId:id,style:z.enum(['melee','ranged'])}),
 z.strictObject({kind:z.literal('deliver_contract'),contractId:id}),
 ...['eat','stop_job'].map(kind=>z.strictObject({kind:z.literal(kind)})),
]);
export function validateAction(value){const r=actionSchema.safeParse(value);if(!r.success)throw new ConnectionError('Unsupported or invalid action. Use the advertised action schema.',400);return r.data;}
const row=(list,id,key)=>(Array.isArray(list)?list:[]).find(r=>(r[key]??r.id)===id);
export function checkAction(action,state){
 const c=state?.capabilities,a=state?.agent;
 if(!a||!Array.isArray(state.events))throw new ConnectionError('A fresh complete game observation is required.');
 if(action.kind!=='stop_job'&&(a.activeAction||a.activeWork||a.isPerformingJob||a.activeModule?.locksCommonActions))throw new ConnectionError('Character is busy. Wait for its current activity to finish.');
 let ready=true;
 switch(action.kind){
  case 'craft':{const r=row(c?.recipes,action.recipeId,'recipeId');ready=r?.failureReason===null&&r.craftableBatches>=action.batches;break;}
  case 'gather':{const r=row(c?.sources,action.sourceId,'sourceId');ready=r?.failureReason===null&&r.availableNodeIds?.includes(action.nodeId);break;}
  case 'deliver_contract':ready=row(c?.contracts,action.contractId,'contractId')?.failureReason===null;break;
  case 'equip':ready=c?.equippableItemIds?.includes(action.itemId);break;
  case 'use_item':ready=c?.healthItemIds?.includes(action.itemId);break;
  case 'unequip':ready=Boolean(a.equipment?.[action.slot]);break;
  // Combat eligibility is resolved by the game; no combat or XP formulas here.
  case 'attack':ready=Array.isArray(c?.enemies)&&c.enemies.some(r=>(r.enemyId??r.id)===action.enemyId&&(r.styles?.[action.style]?.failureReason===null||r[action.style]?.failureReason===null));break;
  case 'move_to':ready=a.position?.spaceId===action.destination.spaceId;break;
 }
 if(!ready)throw new ConnectionError('Current game capabilities do not permit this action or quantity. Refresh and inspect requirements.');
}
export function findReceipt(events,before,action){
 const seen=new Set(before);
 for(const event of events??[]){
  const p=event?.payload;if(!event.eventId||seen.has(event.eventId)||p?.agentId!==action.agentId)continue;
  if(p.kind==='action_failed'&&p.actionKind===action.kind)return {eventId:event.eventId,status:'failed',message:'The game reported action failure.'};
  const matches={
   craft:()=>p.kind==='item_crafted'&&p.recipeId===action.recipeId&&p.batches===action.batches,
   gather:()=>p.kind==='resource_gathered'&&p.nodeId===action.nodeId,
   equip:()=>p.kind==='equipment_changed'&&p.itemId===action.itemId,
   unequip:()=>p.kind==='equipment_changed'&&p.slot===action.slot&&p.itemId==null,
   use_item:()=>p.kind==='agent_healed'&&p.itemId===action.itemId,
   attack:()=>['enemy_defeated','enemy_damaged'].includes(p.kind)&&p.enemyId===action.enemyId,
   deliver_contract:()=>p.kind==='contract_completed'&&p.contractId===action.contractId,
   move_to:()=>p.kind==='agent_arrived'&&['spaceId','x','y'].every(k=>p.at?.[k]===action.destination[k]),
   travel_to_district:()=>p.kind==='agent_transferred'&&p.to?.spaceId===action.districtId,
   eat:()=>p.kind==='agent_ate',stop_job:()=>p.kind==='activity_completed'&&p.activity==='stop_job',
  };
  if(matches[action.kind]?.())return {eventId:event.eventId,status:'confirmed',message:'Confirmed by a new game event.'};
 }
 return null;
}

// These are choices reported by the game, not a plan or a promise of success.
export function actionChoices(state){
 const c=state?.capabilities??{},choices=[];
 for(const r of c.sources??[])if(r.failureReason===null)for(const nodeId of (r.availableNodeIds??[]).slice(0,20))choices.push({label:`Gather · ${r.sourceId??r.id}`,action:{kind:'gather',sourceId:r.sourceId??r.id,nodeId}});
 for(const r of c.recipes??[])if(r.failureReason===null&&r.craftableBatches>0)choices.push({label:`Craft · ${r.recipeId??r.id}`,maxBatches:Math.min(100,r.craftableBatches),action:{kind:'craft',recipeId:r.recipeId??r.id,batches:1}});
 for(const r of c.contracts??[])if(r.failureReason===null)choices.push({label:`Deliver · ${r.contractId??r.id}`,action:{kind:'deliver_contract',contractId:r.contractId??r.id}});
 for(const [key,kind] of [['equippableItemIds','equip'],['healthItemIds','use_item']])for(const itemId of c[key]??[])choices.push({label:`${kind} · ${itemId}`,action:{kind,itemId}});
 return choices.slice(0,500);
}
