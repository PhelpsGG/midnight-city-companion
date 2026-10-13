// Authored test rules, not the strategy engine or native mechanics. No network fallback.
import {randomUUID} from 'node:crypto';
import {MissionStore} from '../client/hybrid/mission/store.mjs';
import {validateAction,checkAction} from './actions.mjs';
const initial=id=>({id,name:id==='sandbox-river'?'River · Sandbox':'Juniper · Sandbox',status:'idle',position:{spaceId:'central',x:68,y:59},skills:{crafting:{level:1,xp:0,nextLevelXp:100},woodcutting:{level:1,xp:0,nextLevelXp:100}},inventory:{sandbox_wood:30,crystal:12},equipment:{},vitals:{health:100,maxHealth:100},completedContractIds:[]});
export class Sandbox {
 static async open(directory,{now=Date.now,delayMs=1500}={}){
  const store=await MissionStore.open(directory,s=>{if(s.version!==1||!s.agents||!Array.isArray(s.events))throw Error('Invalid synthetic observer save.');});
  const box=new Sandbox(store,now,delayMs);await store.save(box.state);return box;
 }
 constructor(store,now,delayMs){this.store=store;this.now=now;this.delayMs=delayMs;this.state=store.state??{version:1,agents:Object.fromEntries(['sandbox-river','sandbox-juniper'].map(id=>[id,initial(id)])),events:[],pending:{}};this.leases=new Map();this.tail=Promise.resolve();}
 serial(fn){const p=this.tail.then(fn);this.tail=p.catch(()=>{});return p;}
 capabilities(a){return {contentVersion:'synthetic-play-v1',sources:[{sourceId:'sandbox_trees',failureReason:null,availableNodeIds:['practice-tree']}],recipes:[{recipeId:'sandbox_plank',failureReason:a.inventory.sandbox_wood>0?null:'Requires practice wood',craftableBatches:a.inventory.sandbox_wood??0}],contracts:[{contractId:'sandbox_delivery',failureReason:(a.inventory.sandbox_plank??0)>=5&&!a.completedContractIds.includes('sandbox_delivery')?null:'Requires 5 practice planks, once only'}],equippableItemIds:[],healthItemIds:[]};}
 finish(id){
  const p=this.state.pending[id];if(!p||p.due>this.now())return false;
  const a=this.state.agents[id],x=p.action;let payload;
  if(x.kind==='craft'){a.inventory.sandbox_wood-=x.batches;a.inventory.sandbox_plank=(a.inventory.sandbox_plank??0)+x.batches;a.skills.crafting.xp+=10*x.batches;payload={kind:'item_crafted',recipeId:x.recipeId,batches:x.batches,outputs:{sandbox_plank:x.batches},inputs:{sandbox_wood:x.batches}};}
  if(x.kind==='gather'){a.inventory.sandbox_wood=(a.inventory.sandbox_wood??0)+1;a.skills.woodcutting.xp+=5;payload={kind:'resource_gathered',nodeId:x.nodeId,quantity:1,itemId:'sandbox_wood'};}
  if(x.kind==='move_to'){a.position=x.destination;payload={kind:'agent_arrived',at:x.destination};}
  if(x.kind==='deliver_contract'){a.inventory.sandbox_plank-=5;a.inventory.crystal+=10;a.completedContractIds.push('sandbox_delivery');payload={kind:'contract_completed',contractId:x.contractId,rewards:{crystal:10},inputs:{sandbox_plank:5}};}
  this.state.events.push({eventId:p.id,payload:{...payload,agentId:id},timestamp:this.now()});this.state.events=this.state.events.slice(-200);
  delete this.state.pending[id];a.status='idle';delete a.activeAction;return true;
 }
 transport(){const box=this;let authorized=false;return {
  async authorizedAgents(key){if(key!=='sandbox-test-key')throw Error('Unknown synthetic key');authorized=true;return Object.keys(box.state.agents);},
  async read(id){return box.serial(async()=>{if(!box.state.agents[id])throw Error();if(box.finish(id))await box.store.save(box.state);const a=box.state.agents[id],lease=box.leases.get(id);return structuredClone({agent:a,capabilities:box.capabilities(a),control:{state:lease?.expiresAt>box.now()?'active':'uncontrolled'},events:box.state.events.filter(e=>e.payload.agentId===id),resources:[],receivedAt:box.now()});});},
  async claim(id){if(!authorized||box.leases.get(id)?.expiresAt>box.now())throw Error();const lease={agentId:id,sessionId:randomUUID(),token:randomUUID(),expiresAt:box.now()+60000};box.leases.set(id,lease);return {...lease};},
  async heartbeat(lease){if(box.leases.get(lease.agentId)?.token!==lease.token||lease.expiresAt<=box.now())throw Error();const next={...lease,expiresAt:box.now()+60000};box.leases.set(lease.agentId,next);return next;},
  async release(lease){if(box.leases.get(lease.agentId)?.token===lease.token)box.leases.delete(lease.agentId);},
  async submit(lease,value){return box.serial(async()=>{
   if(box.leases.get(lease.agentId)?.token!==lease.token||lease.expiresAt<=box.now())throw Error('Control lost');
   const action=validateAction(value),a=box.state.agents[lease.agentId];
   const supported=(action.kind==='craft'&&action.recipeId==='sandbox_plank')||(action.kind==='gather'&&action.sourceId==='sandbox_trees'&&action.nodeId==='practice-tree')||action.kind==='move_to'||(action.kind==='deliver_contract'&&action.contractId==='sandbox_delivery');
   if(!supported)throw Object.assign(Error('Unsupported synthetic action'),{code:'ACTION_REJECTED'});
   checkAction(action,{agent:a,capabilities:box.capabilities(a),events:box.state.events});
   box.state.pending[a.id]={id:randomUUID(),action,due:box.now()+box.delayMs};a.status='working';a.activeAction=action;await box.store.save(box.state);
   return {accepted:true};
  });},
 };}
 async close(){await this.tail;await this.store.close();}
}
