export class GoalRunner {
 constructor(api,onChange=()=>{}){this.api=api;this.onChange=onChange;this.mode='ready';this.busy=false;this.message='';}
 pause(){if(this.mode==='running'){this.mode='paused';this.onChange();}}
 stop(){if(['running','paused'].includes(this.mode)){this.mode='stopped';this.onChange();}}
 async start(){
  if(this.busy||['blocked','complete'].includes(this.mode))return;
  this.mode='running';this.busy=true;this.message='';this.onChange();
  try{while(this.mode==='running'){
   await this.api.refresh();if(this.mode!=='running')break;
   if(this.api.uncertain())throw Error('An action outcome is unresolved. No action will be resent.');
   if(this.api.pending()){await this.api.tick();}
   else{const p=await this.api.plan();if(this.mode!=='running')break;
    if(p.complete){this.mode='complete';break;}
    if(!p.action)throw Error(p.reason||'No currently executable plan is available.');
    const preview=await this.api.preview(p.action);if(this.mode!=='running')break;
    await this.api.commit(preview);
   }
   this.onChange();if(this.api.wait)await this.api.wait();
  }}catch(e){this.mode='blocked';this.message=e.message;}
  finally{this.busy=false;this.onChange();}
 }
}
