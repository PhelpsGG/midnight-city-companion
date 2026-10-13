import {MissionStore} from '../client/hybrid/mission/store.mjs';
import {ConnectionError} from './connection.mjs';
import {validateAction,checkAction,findReceipt,actionChoices} from './actions.mjs';
const unresolved=j=>['submitting','pending','uncertain'].includes(j.status);
const required=(ok,message)=>{if(!ok)throw new ConnectionError(message);};
export class Orchestrator {
 static async open({directory,now=Date.now,timeoutMs=60000,onObservation=async()=>{}}={}){
  const store=directory?await MissionStore.open(directory,s=>{if(s.version!==1||!s.agents||typeof s.agents!=='object')throw Error('Unsupported orchestrator save.');for(const r of Object.values(s.agents)){if(!Array.isArray(r.jobs)||!['running','paused','stopped'].includes(r.mode))throw Error('Invalid orchestrator history.');for(const j of r.jobs){validateAction(j.action);if(!['queued','submitting','pending','uncertain','confirmed','failed','canceled'].includes(j.status))throw Error('Invalid action state.');}}}):null;
  const r=new Orchestrator(store,now,timeoutMs);r.onObservation=onObservation;
  for(const a of Object.values(r.state.agents)){a.mode='paused';a.message='Service restarted. Reconnect control, review history and resume explicitly.';for(const j of a.jobs)if(unresolved(j))j.status='uncertain';}
  await r.save();return r;
 }
 constructor(store,now,timeoutMs){this.store=store;this.now=now;this.timeoutMs=timeoutMs;this.state=store?.state??{version:1,agents:{}};this.connections=new Map();this.tail=Promise.resolve();this.fault=false;}
 serial(fn){const p=this.tail.then(fn);this.tail=p.catch(()=>{});return p;}
 async save(){try{await this.store?.save(this.state);}catch{this.fault=true;throw new ConnectionError('Progress could not be saved. Execution stopped; preserve the save and restart the service.',503);}}
 view(id){const r=this.state.agents[id];return r?structuredClone({...r,totalJobs:r.jobs.length,jobs:r.jobs.slice(-100).map(({before,...j})=>j),fault:this.fault}):{mode:'paused',goal:'',jobs:[],message:'Connect control to enable actions.',fault:this.fault};}
 async attach(connection){return this.serial(async()=>{const v=connection.view();required(v.controlled,'Connect control in the companion first.');const id=v.agent.id,previous=this.connections.get(id);required(!previous||previous===connection||!previous.view().controlled,'Another local session owns this runtime.');this.connections.set(id,connection);if(!Object.hasOwn(this.state.agents,id))Object.defineProperty(this.state.agents,id,{value:{mode:'running',goal:'',jobs:[],baseline:structuredClone(v.agent.skills??{}),message:'Ready for your next action.'},enumerable:true,writable:true,configurable:true});else if(previous&&previous!==connection){this.state.agents[id].mode='paused';this.state.agents[id].message='Control recovered in a new connection. Review and resume explicitly.';}await this.save();});}
 async detach(connection){return this.serial(async()=>{for(const [id,c] of this.connections)if(c===connection){this.connections.delete(id);this.state.agents[id].mode='paused';this.state.agents[id].message='Disconnected. Reconnect and resume explicitly.';}await this.save();});}
 command(c,input,actor='gui',authorized=()=>true){return this.serial(async()=>{
  required(authorized(),'AI pairing was revoked. Pair again in the companion.');
  required(!this.fault,'Progress storage is unavailable. Restart after inspecting the save.');
  const v=c.view(),id=v.agent?.id,r=this.state.agents[id];required(v.controlled&&this.connections.get(id)===c&&r,'Connect control in the companion first.');
  required(input&&typeof input==='object'&&!Array.isArray(input),'Invalid runtime command.');
  const allowed={enqueue:['type','requestId','action'],goal:['type','text'],pause:['type'],stop:['type'],resume:['type']};
  required(allowed[input.type]&&Object.keys(input).every(k=>allowed[input.type].includes(k)),'Invalid runtime command.');
  if(input.type==='enqueue'){
   const action=validateAction(input.action);required(typeof input.requestId==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(input.requestId),'A stable requestId is required.');
   const existing=r.jobs.find(j=>j.id===input.requestId);if(existing){required(JSON.stringify(existing.action)===JSON.stringify(action),'This requestId was used for a different action.');return this.view(id);}
   required(r.mode==='running','Resume execution in the companion before adding actions.');required(!r.jobs.some(unresolved),'Wait for the unresolved action before adding work.');required(r.jobs.filter(j=>j.status==='queued').length<100&&r.jobs.length<5000,'Queue or history limit reached. Start a new save after exporting history.');
   r.jobs.push({id:input.requestId,action,actor,status:'queued',createdAt:this.now()});r.message='Queued. Awaiting game confirmation.';
  }else if(input.type==='goal'){required(typeof input.text==='string'&&input.text.trim().length>0&&input.text.length<=500,'Describe a goal in 1–500 characters.');r.goal=input.text.trim();}
  else if(input.type==='resume'){required(actor==='gui','Resume is available only in the companion.');required(!r.jobs.some(unresolved),'Resolve the unresolved action before resuming.');r.mode='running';r.message='Ready. Queued actions will continue.';}
  else {r.mode=input.type==='stop'?'stopped':'paused';r.message='Dispatch '+r.mode+'. Already submitted actions still need confirmation.';if(input.type==='stop')for(const j of r.jobs)if(j.status==='queued')j.status='canceled';}
  await this.save();return this.view(id);
 });}
 pulse(){return this.serial(async()=>{
  if(this.fault)return;
  for(const [id,c] of this.connections){
   const r=this.state.agents[id];try{await c.refresh();}catch{continue;}const v=c.view();
   if(!v.stale)await this.onObservation(c.observation()).catch(()=>{});
   if(!v.controlled||v.stale){r.mode='paused';r.message=v.stale?'Fresh state unavailable. Refresh and resume after recovery.':'Control lost. Reconnect explicitly.';await this.save();continue;}
   const state=c.observation(),pending=r.jobs.find(unresolved);
   if(pending){
    const receipt=findReceipt(state.events,pending.before??[],{...pending.action,agentId:id});
    if(receipt){Object.assign(pending,{...receipt,finishedAt:this.now()});delete pending.before;r.message=receipt.message;}
    else if(this.now()-pending.startedAt>=this.timeoutMs){pending.status='uncertain';r.mode='paused';r.message='Outcome unverified. No retry will be sent. Inspect game history; confirmation may still arrive.';}
    await this.save();continue;
   }
   if(r.mode!=='running')continue;const job=r.jobs.find(j=>j.status==='queued');if(!job)continue;
   try{checkAction(job.action,state);}catch(e){job.status='failed';job.message=e.message;r.mode='paused';r.message=e.message;await this.save();continue;}
   job.status='submitting';job.startedAt=this.now();job.before=(state.events??[]).map(e=>e.eventId);await this.save();
   // Both the primary and recovery copy must contain intent before sending.
   // Otherwise recovering the previous queued state could duplicate a dispatch.
   await this.save();
   try{await c.submit(job.action);job.status='pending';job.message='Submitted; waiting for a game event.';}
   catch(e){
    if(e.code==='CONNECTION_BUSY'){job.status='queued';delete job.before;delete job.startedAt;job.message='Waiting for the current observation. No action was sent.';}
    else {job.status=['ACTION_REJECTED','ACTION_NOT_SENT'].includes(e.code)?'failed':'uncertain';job.message=job.status==='failed'?'This request was rejected before game acceptance.':'Delivery is uncertain. It will not be retried.';r.mode='paused';r.message=job.message;}
   }
   await this.save();
  }
 });}
 snapshot(c){const v=c.view();return {observation:c.observation(),runtime:this.view(v.agent?.id),choices:v.stale?[]:actionChoices(c.observation())};}
 async close(){await this.tail;await this.store?.close();}
}
