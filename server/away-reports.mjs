import {randomUUID} from 'node:crypto';
import {MissionStore} from '../client/hybrid/mission/store.mjs';
import {ConnectionError} from './connection.mjs';

const LIMIT=2000,ABSENCE=60000,FRESH=30000;
const own=(object,key)=>Object.hasOwn(object,key)?object[key]:null;
const number=n=>Number.isFinite(n)&&n>=0;
const counts=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.values(value).every(number)?{...value}:null;
const add=(target,id,n)=>{if(typeof id==='string'&&number(n)&&n>0)Object.defineProperty(target,id,{value:(own(target,id)??0)+n,writable:true,enumerable:true,configurable:true});};
function quantities(value){
 if(Array.isArray(value))return Object.fromEntries(value.filter(x=>typeof x?.itemId==='string'&&number(x.quantity)).map(x=>[x.itemId,x.quantity]));
 return counts(value)??{};
}
function capture(observation,at,seq){
 const a=observation.agent;
 return {at,seq,name:String(a.name??a.id).slice(0,120),skills:a.skills?Object.fromEntries(Object.entries(a.skills).filter(([,s])=>number(s?.xp)&&number(s.level)).map(([id,s])=>[id,{xp:s.xp,level:s.level}])):null,inventory:counts(a.inventory),contracts:Array.isArray(a.completedContractIds)?a.completedContractIds.filter(x=>typeof x==='string'):null,connections:number(observation.social?.connectionCount)?observation.social.connectionCount:null,eventsAvailable:Array.isArray(observation.events)};
}
function normalize(event,id,at,seq){
 const p=event?.payload;if(typeof event?.eventId!=='string'||!p)return null;
 const ours=p.agentId===id,incoming=p.kind==='agent_spoke'&&p.targetAgentId===id;
 if(!ours&&!incoming)return null;
 const e={id:event.eventId,at,seq,kind:String(p.kind??'unknown'),earned:{},consumed:{}};
 if(p.kind==='resource_gathered')add(e.earned,p.itemId,p.quantity);
 if(p.kind==='item_crafted'){e.earned=quantities(p.outputs);e.consumed=quantities(p.inputs);}
 if(p.kind==='contract_completed'){e.contractId=p.contractId;e.earned=quantities(p.rewards?.items);add(e.earned,'crystal',p.rewards?.crystal);e.consumed=quantities(p.inputs);}
 if(p.kind==='agent_spoke'){e.partner=ours?p.targetAgentId:p.agentId;e.thread=typeof p.threadId==='string'?p.threadId:null;e.message=true;}
 // Dialogue text and arbitrary payload fields are intentionally not retained.
 return e;
}
function reportFor(r,now){
 const before=r.baseline,after=r.latest,skills=[],items=[],gaps=[];
 if(before.skills&&after.skills){for(const id of new Set([...Object.keys(before.skills),...Object.keys(after.skills)])){const b=own(before.skills,id),s=own(after.skills,id);if(!b||!s)gaps.push('A skill observation is missing; its gains are unknown.');else if(s.xp!==b.xp||s.level!==b.level)skills.push({id,xp:s.xp-b.xp,levels:s.level-b.level,fromLevel:b.level,toLevel:s.level});}if(!Object.keys(after.skills).length||!Object.keys(before.skills).length)gaps.push('Skill observations are incomplete.');}else gaps.push('Skill observations are incomplete.');
 if(!before.eventsAvailable||!after.eventsAvailable)gaps.push('Recent game events were unavailable for part of this period.');
 if(before.inventory&&after.inventory){for(const id of new Set([...Object.keys(before.inventory),...Object.keys(after.inventory)])){const b=own(before.inventory,id)??0,a=own(after.inventory,id)??0;if(a!==b)items.push({id,before:b,after:a,net:a-b});}}else gaps.push('Inventory observations are incomplete; item changes are unknown.');
 const events=r.events.filter(e=>e.seq>before.seq&&e.seq<=after.seq),flows={earned:{},consumed:{}};
 for(const e of events){for(const [id,n] of Object.entries(e.earned))add(flows.earned,id,n);for(const [id,n] of Object.entries(e.consumed))add(flows.consumed,id,n);}
 if(before.seq<r.trimmedThrough)gaps.push('Older recorded events were trimmed. Receipt totals cover retained events only.');
 gaps.push(...r.gaps.filter(g=>g.seq>before.seq&&g.seq<=after.seq).map(g=>g.reason));
 const conversations=events.filter(e=>e.message);
 const contracts=before.contracts&&after.contracts?after.contracts.filter(id=>!before.contracts.includes(id)):[];
 if(!before.contracts||!after.contracts)gaps.push('Contract completion observations are incomplete.');
 const social={messages:conversations.length,threads:new Set(conversations.map(e=>e.thread).filter(Boolean)).size,partners:new Set(conversations.map(e=>e.partner).filter(Boolean)).size,connections:before.connections!==null&&after.connections!==null?after.connections-before.connections:null};
 return {id:randomUUID(),from:before.at,to:after.at,createdAt:now,name:after.name,skills,items,flows,contracts,social,eventCount:events.length,gaps:[...new Set(gaps)],hasChanges:Boolean(skills.length||items.length||contracts.length||events.length||gaps.length||social.connections),checkpoint:structuredClone(after)};
}

export class AwayReports {
 static async open({directory,now=Date.now}={}){
  const store=directory?await MissionStore.open(directory,s=>{if(s.version!==1||!s.agents)throw Error('Unsupported visit history.');for(const r of Object.values(s.agents))if(!Number.isSafeInteger(r.seq)||!Array.isArray(r.events)||!Array.isArray(r.seen)||!Array.isArray(r.gaps))throw Error('Invalid visit history.');}):null;
  const reports=new AwayReports(store,now);
  for(const r of Object.values(reports.state.agents)){r.away=true;r.gaps.push({seq:++r.seq,reason:'The service restarted. Activity during downtime may be missing from recorded events.'});r.freshAt=null;}
  await reports.save();return reports;
 }
 constructor(store,now){this.store=store;this.now=now;this.state=store?.state??{version:1,agents:{}};this.tabs=new Map();this.tail=Promise.resolve();this.fault=false;}
 serial(fn){const p=this.tail.then(fn);this.tail=p.catch(()=>{});return p;}
 async save(){try{await this.store?.save(this.state);}catch{this.fault=true;throw new ConnectionError('Visit history could not be saved. The report has not been marked seen.',503);}}
 observe(observation){return this.serial(async()=>{
  const id=observation?.agent?.id;if(typeof id!=='string')return;
  if(!observation.agent.skills&&!observation.agent.inventory){const previous=own(this.state.agents,id);if(previous)previous.freshAt=null;return;}
  const now=this.now();let r=own(this.state.agents,id),first=!r;
  if(!r){r={seq:0,seen:[],events:[],gaps:[],trimmedThrough:0,latest:null,baseline:null,lastSeenAt:null,away:false,pending:null,lastReport:null};Object.defineProperty(this.state.agents,id,{value:r,writable:true,enumerable:true,configurable:true});}
  const current=Array.isArray(observation.events)?observation.events:[],relevant=current.filter(e=>normalize(e,id,now,0));
  if(!Array.isArray(observation.events)&&r.latest?.eventsAvailable!==false)r.gaps.push({seq:++r.seq,reason:'Recent game events were unavailable.'});
  if(r.recent?.length&&relevant.length&&!relevant.some(e=>r.recent.includes(e.eventId)))r.gaps.push({seq:++r.seq,reason:'The recent-event window no longer overlaps the previous observation. Some activity may be missing.'});
  for(const e of relevant)if(!r.seen.includes(e.eventId)){r.seen.push(e.eventId);if(!first)r.events.push(normalize(e,id,now,++r.seq));}
  r.recent=relevant.map(e=>e.eventId);r.seen=r.seen.slice(-LIMIT*2);
  if(r.events.length>LIMIT)r.trimmedThrough=r.events.at(-LIMIT-1).seq;
  r.events=r.events.slice(-LIMIT);r.gaps=r.gaps.slice(-100);
  const latest=capture(observation,now,r.seq),changed=JSON.stringify({...latest,at:0})!==JSON.stringify({...r.latest,at:0});
  r.latest=latest;r.freshAt=now;
  // Event/state changes are durable; unchanged polling does not rewrite the save.
  if(first||changed)await this.save();
 });}
 visit(id,input){return this.serial(async()=>{
  if(this.fault)throw new ConnectionError('Visit history could not be saved. Restart after checking the save.',503);
  const r=own(this.state.agents,id),now=this.now();
  if(!r?.latest||r.freshAt===null||now-r.freshAt>FRESH)throw new ConnectionError('A fresh character observation is required before updating this visit.');
  if(!input||Object.keys(input).some(k=>!['clientId','visible','ackId'].includes(k))||typeof input.clientId!=='string'||!/^[\w-]{1,100}$/.test(input.clientId)||typeof input.visible!=='boolean')throw new ConnectionError('Invalid visit notification.',400);
  let tabs=this.tabs.get(id);if(!tabs){tabs=new Map();this.tabs.set(id,tabs);}for(const [key,seen] of tabs)if(now-seen>=ABSENCE)tabs.delete(key);
  const previous=structuredClone(r),previousTabs=new Map(tabs);
  const persist=async()=>{try{await this.save();}catch(e){Object.defineProperty(this.state.agents,id,{value:previous,writable:true,enumerable:true,configurable:true});this.tabs.set(id,previousTabs);throw e;}};
  if(input.ackId!==undefined){if(typeof input.ackId!=='string'||r.pending?.id!==input.ackId)throw new ConnectionError('The return report changed. Refresh before dismissing it.');r.baseline=structuredClone(r.pending.checkpoint);r.lastReport=r.pending;r.pending=null;r.lastSeenAt=now;r.away=false;}
  if(!input.visible){if(!tabs.delete(input.clientId))return this.view(id);if(!tabs.size){r.away=true;if(!r.pending){r.baseline=structuredClone(r.latest);r.lastSeenAt=now;}}await persist();return this.view(id);}
  const returning=r.baseline&&(r.away||(!tabs.size&&now-r.lastSeenAt>=ABSENCE));
  if(returning){const report=reportFor(r,now);if(report.hasChanges)r.pending=report;}
  tabs.set(input.clientId,now);r.away=false;
  if(!r.pending)r.baseline=structuredClone(r.latest);
  r.lastSeenAt=now;await persist();return this.view(id);
 });}
 view(id){const r=own(this.state.agents,id),report=r?.pending??r?.lastReport;if(!report)return {unread:false,report:null,fault:this.fault};const {checkpoint,...publicReport}=report;return structuredClone({unread:Boolean(r.pending),report:publicReport,fault:this.fault});}
 async close(){await this.tail;await this.store?.close();}
}
