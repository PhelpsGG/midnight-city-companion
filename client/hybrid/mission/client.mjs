// Browser is only an observer/controller. It never advances the fixture clock.
export function returnSummary(state,seen){
 const comparable=seen?.worldId===state.worldId&&Number.isSafeInteger(seen.receipts)&&seen.receipts>=0&&seen.receipts<=state.receipts.length;
 const receipts=state.receipts.slice(comparable?seen.receipts:0),events=state.events.slice(comparable&&Number.isSafeInteger(seen.events)?seen.events:0);
 if(!receipts.length&&!events.some(e=>['complete','blocked','recovery'].includes(e.type)))return null;
 const gains={};for(const r of receipts)for(const g of r.gains)gains[g.skill]=(gains[g.skill]??0)+g.amount;
 const previous=comparable?seen.inventory??{}:{};
 const items=[...new Set([...Object.keys(state.character.inventory),...Object.keys(previous)])].map(id=>({id,amount:(state.character.inventory[id]??0)-(previous[id]??0)})).filter(i=>i.amount!==0);
 return {actions:receipts.length,gains:Object.entries(gains).map(([skill,amount])=>({skill,amount})),items,completed:events.some(e=>e.type==='complete'),blocked:state.mission.status==='blocked',firstVisit:!comparable};
}
export class MissionClient {
 constructor(onChange=()=>{},fetcher=(...args)=>fetch(...args)){this.onChange=onChange;this.fetcher=fetcher;this.durable=true;this.connected=false;this.sending=false;this.snapshot=null;this.state=null;this.goal={type:'item',id:'transit_actuator',target:1};this.error='';this.away=null;}
 get busy(){return this.sending||!this.connected||Boolean(this.state?.runtimeError);}
 get mode(){return !this.connected||this.state?.runtimeError?'blocked':this.state?.mission.status??'ready';}
 get message(){return this.error||this.state?.runtimeError||this.state?.mission.message||'';}
 accept(data){
  this.csrf=data.csrf;this.connected=true;
  if(this.state?.worldId===data.state.worldId&&data.state.revision<this.state.revision)return;
  this.state=data.state;this.snapshot=data.snapshot;this.goal.target=data.state.mission.target;this.baseline=data.state.baseline;
  this.ranking={candidates:[{steps:data.state.mission.steps.slice(data.state.mission.cursor).map(s=>({label:s.label,actionLabel:'Scripted fixture step'}))}]};
 }
 async request(body){const response=await this.fetcher(body?'/mission/command':'/mission/state',body?{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':this.csrf},body:JSON.stringify(body),keepalive:true,signal:AbortSignal.timeout(5000)}:{signal:AbortSignal.timeout(5000)});const data=await response.json();if(!response.ok)throw Error(data.message??'Sandbox request failed');this.accept(data);}
 async refresh(){try{await this.request();if(this.error.startsWith('Service unavailable'))this.error='';}catch{this.connected=false;this.error='Service unavailable. Showing the last saved observation. Start the local service to reconnect.';}this.onChange();}
 async command(type,fields={}){if(this.busy)return;this.sending=true;this.error='';this.onChange();try{await this.request({type,revision:this.state.revision,...(['pause','stop'].includes(type)?{missionId:this.state.mission.id}:{}),...fields});}catch(e){this.error=e.message;await this.refresh();}finally{this.sending=false;this.onChange();}}
 start(){return this.command(this.mode==='paused'?'resume':'start');} pause(){return this.command('pause');} stop(){return this.command('stop');}
 resume(){return this.command('resume');}
 async initialize(){await this.request();let seen;try{seen=JSON.parse(localStorage.getItem('mcity-mission-seen'));}catch{}this.away=returnSummary(this.state,seen);this.onChange();}
 seen(){if(!this.state||this.away||document.visibilityState!=='visible')return;try{localStorage.setItem('mcity-mission-seen',JSON.stringify({worldId:this.state.worldId,receipts:this.state.receipts.length,events:this.state.events.length,inventory:this.state.character.inventory}));}catch{/* Summary becomes saved history if local preferences are disabled. */}}
 dismissAway(){this.away=null;this.seen();this.onChange();}
}
