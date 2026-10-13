import {randomUUID} from 'node:crypto';
import {MissionStore} from './store.mjs';
import {initialCharacter,fixtureSteps,fixtureVersion,applyFixtureResult} from './fixture.mjs';
import {contractIds} from '../contracts/catalog.mjs';
const copy=structuredClone;
const modes=['ready','running','paused','stopped','complete','blocked'];
function validate(s){
 if(s.trackedContractIds!==undefined&&(!Array.isArray(s.trackedContractIds)||new Set(s.trackedContractIds).size!==s.trackedContractIds.length||s.trackedContractIds.some(id=>!contractIds.has(id))))throw Error('Invalid saved contract tracking');
 if(s.version!==1||s.fixtureVersion!==fixtureVersion)throw Error('Unsupported mission version; migration required.');
 if(!Number.isSafeInteger(s.revision)||s.revision<0||!s.worldId||!s.character?.skills||!Array.isArray(s.receipts)||!Array.isArray(s.events)||!modes.includes(s.mission?.status)||!Array.isArray(s.mission.steps))throw Error('Invalid saved mission');
 if(!Number.isSafeInteger(s.mission.cursor)||s.mission.cursor<0||s.mission.cursor>s.mission.steps.length)throw Error('Invalid saved step cursor');
 if(new Set(s.receipts.map(r=>r.id)).size!==s.receipts.length)throw Error('Duplicate saved receipt');
 for(const v of Object.values(s.character.inventory))if(!Number.isSafeInteger(v)||v<0)throw Error('Invalid saved inventory');
 for(const v of Object.values(s.character.skills))if(!Number.isSafeInteger(v.xp)||v.xp<0)throw Error('Invalid saved XP');
}
function mission(character,count,fault,now){return {id:randomUUID(),title:count===1?'Craft an actuator':`Craft ${count} actuators`,count,target:(character.inventory.transit_actuator??0)+count,status:'ready',cursor:0,steps:fixtureSteps(count),pending:null,baseline:copy(character.skills),fault,faultUsed:false,createdAt:now,startedAt:null,completedAt:null,message:''};}
function event(s,type,message,now){s.events.push({id:randomUUID(),missionId:s.mission.id,type,message,at:now});}
export class MissionRuntime {
 static async open({directory,now=Date.now,stepMs=5000}){
  if(!Number.isSafeInteger(stepMs)||stepMs<1)throw Error('Invalid step duration');
  const store=await MissionStore.open(directory,validate);
  try{
   const recovered=store.recovered;let state=store.state;
   if(!state){const character=initialCharacter();state={version:1,fixtureVersion,worldId:randomUUID(),revision:0,createdAt:now(),savedAt:now(),character,baseline:copy(character.skills),mission:mission(character,1,'normal',now()),receipts:[],events:[],recovery:null};await store.save(state);}
   const runtime=new MissionRuntime(store,state,now,stepMs);
   if(recovered){const next=copy(state);next.recovery='Recovered the last verified backup. Review progress before resuming; the newest interrupted save may be missing.';if(['running','ready'].includes(next.mission.status))next.mission.status='paused';event(next,'recovery',next.recovery,now());await runtime.persist(next);}
   return runtime;
  }catch(e){await store.close();throw e;}
 }
 constructor(store,state,now,stepMs){Object.assign(this,{store,state,now,stepMs,closed:false,failure:null});this.queue=Promise.resolve();}
 snapshot(){const state=copy(this.state);if(this.failure)state.runtimeError=this.failure;return state;}
 serial(fn){const operation=this.queue.then(()=>{if(this.closed)throw Error('Runtime closed');if(this.failure)throw Error(this.failure);return fn();});this.queue=operation.catch(()=>{});return operation;}
 async persist(next){next.revision=this.state.revision+1;next.savedAt=this.now();validate(next);try{await this.store.save(next);}catch(e){this.failure='Saving failed. Execution is halted; restart after fixing local storage.';throw e;}this.state=next;return this.snapshot();}
 command(body){return this.serial(async()=>{
  const interrupt=['pause','stop'].includes(body.type);
  if(interrupt&&body.missionId!==this.state.mission.id)throw Object.assign(Error('The mission changed. Refresh before controlling it.'),{status:409});
  if(!Number.isSafeInteger(body.revision)||body.revision<0||body.revision>this.state.revision||(!interrupt&&body.revision!==this.state.revision))throw Object.assign(Error('Progress changed in another tab or in the background. Review the refreshed mission and try again.'),{status:409});
  const allowed={select:['type','revision','count','fault'],start:['type','revision'],pause:['type','revision','missionId'],resume:['type','revision'],stop:['type','revision','missionId'],reconcile:['type','revision'],'track-contract':['type','revision','contractId','tracked']}[body.type];
  if(!allowed||Object.keys(body).some(k=>!allowed.includes(k)))throw Error('Unsupported mission command');
  const next=copy(this.state),m=next.mission,at=this.now();
  if(body.type==='track-contract'){
   if(!contractIds.has(body.contractId)||typeof body.tracked!=='boolean')throw Error('Unsupported contract or tracking state');
   const ids=new Set(next.trackedContractIds??[]);if(body.tracked)ids.add(body.contractId);else ids.delete(body.contractId);next.trackedContractIds=[...ids];
  }else if(body.type==='select'){
   if(['running','paused','blocked'].includes(m.status))throw Error('Stop the current mission before selecting another goal.');
   if(![1,3,5].includes(body.count)||!['normal','delayed','disconnected','uncertain'].includes(body.fault))throw Error('Unsupported fixture goal or condition');
   next.mission=mission(next.character,body.count,body.fault,at);next.recovery=null;event(next,'selected','Goal selected; execution has not started.',at);
  }else if(body.type==='start'){
   if(m.status!=='ready')throw Error('Only a reviewed, ready mission can start.');m.status='running';m.startedAt=at;event(next,'started','Mission started. Continues while the companion is closed.',at);
  }else if(body.type==='pause'){
   if(m.status!=='running')throw Error('Mission is not running.');m.status='paused';if(m.pending)m.pending.remainingMs=Math.max(0,m.pending.dueAt-at);event(next,'paused','Mission paused; pending fixture step saved.',at);
  }else if(body.type==='stop'){
   if(!['running','paused','blocked'].includes(m.status))throw Error('Mission is not active.');if(m.pending?.receipt)throw Error('Reconcile the uncertain result before stopping.');m.status='stopped';m.pending=null;event(next,'stopped','Mission stopped. Earned rewards retained; unfinished fixture step cancelled.',at);
  }else if(body.type==='resume'){
   if(m.pending?.receipt)throw Error('Reconcile the uncertain outcome before resuming.');
   if(!['paused','blocked'].includes(m.status))throw Error('Mission cannot resume.');m.status='running';m.message='';next.recovery=null;if(m.pending)m.pending.dueAt=at+(m.pending.remainingMs??this.stepMs);event(next,'resumed','Mission resumed.',at);
  }else if(body.type==='reconcile'){
   if(m.status!=='blocked'||!m.pending?.receipt)throw Error('No uncertain receipt to reconcile.');this.confirm(next,at);if(next.mission.status!=='complete')next.mission.status='paused';event(next,'reconciled','Saved fixture receipt verified. No action was resent.',at);
  }
  return this.persist(next);
 });}
 confirm(s,at){const m=s.mission,p=m.pending,step=m.steps[m.cursor];if(!p||s.receipts.some(r=>r.id===p.id))throw Error('Pending receipt identity conflict');applyFixtureResult(s.character,step);s.receipts.push({id:p.id,missionId:m.id,index:m.cursor,at,label:step.label,action:copy(step.action),gains:copy(step.gains),items:copy(step.items),inputs:copy(step.inputs),evidence:'scripted-fixture'});m.cursor++;m.pending=null;m.message='';if(m.cursor===m.steps.length){m.status='complete';m.completedAt=at;event(s,'complete','Goal complete. Choose your next journey.',at);}}
 pulse(){return this.serial(async()=>{
  if(this.state.mission.status!=='running')return this.snapshot();
  const next=copy(this.state),m=next.mission,at=this.now();
  if(m.pending){
   if(at<m.pending.dueAt)return this.snapshot();
   if(m.fault==='uncertain'&&!m.faultUsed){m.faultUsed=true;m.pending.receipt={id:m.pending.id,fixtureVersion};m.status='blocked';m.message='The fixture response was lost. Reconcile its saved receipt before continuing; nothing will be resent.';event(next,'blocked',m.message,at);}
   else this.confirm(next,at);
  }else{
   if(m.fault==='disconnected'&&!m.faultUsed){m.faultUsed=true;m.status='blocked';m.message='Simulated connection interrupted before submission. Resume to reconnect.';event(next,'blocked',m.message,at);}
   else{m.pending={id:randomUUID(),index:m.cursor,dueAt:at+this.stepMs*(m.fault==='delayed'?3:1),remainingMs:this.stepMs*(m.fault==='delayed'?3:1)};}
  }
  return this.persist(next);
 });}
 async close(){if(this.closed)return;await this.queue;this.closed=true;await this.store.close();}
}
