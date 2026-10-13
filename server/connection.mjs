export class ConnectionError extends Error {
 constructor(message,status=409){super(message);this.status=status;}
}
const reject=(message,status)=>{throw new ConnectionError(message,status);};
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(id);

// One owner credential and one selected agent per local browser session.
// Neither credentials nor leases are projected into browser state or persisted.
export class Connection {
 #transport;#now;#claims;#key='';#ids=[];#id=null;#state=null;#lease=null;#busy=false;#stale=false;#message='';#disconnecting=false;#waiters=[];
 constructor(transport,{now=Date.now,claims=new Map()}={}){this.#transport=transport;this.#now=now;this.#claims=claims;}
 #validLease(lease){return lease?.agentId===this.#id&&typeof lease.token==='string'&&Boolean(lease.token)&&typeof lease.sessionId==='string'&&Boolean(lease.sessionId)&&Number.isFinite(lease.expiresAt)&&lease.expiresAt>this.#now();}
 async #dropLease(){const lease=this.#lease;this.#lease=null;if(lease)try{await this.#transport.release(lease);}catch{/* The upstream lease expires independently. */}}
 async #exclusive(fn,disconnecting=false){if(this.#busy||(this.#disconnecting&&!disconnecting))throw Object.assign(new ConnectionError('Wait for the current request to finish.'),{code:'CONNECTION_BUSY'});this.#busy=true;try{await fn();return this.view();}finally{this.#busy=false;for(const resolve of this.#waiters.splice(0))resolve();}}
 async authorize(key){return this.#exclusive(async()=>{
  if(this.#id||this.#key)reject('Disconnect before changing the account.');
  if(typeof key!=='string'||!key.trim()||key.length>4096||/[\r\n]/.test(key))reject('Enter an existing agent API key.',400);
  let ids;try{ids=await this.#transport.authorizedAgents(key.trim());}catch{reject('The key could not be verified. Check your key and try again.',401);}
  if(!Array.isArray(ids)||!ids.every(validId))reject('The game returned an invalid character list.',502);
  this.#ids=[...new Set(ids)];this.#key=key.trim();this.#message=this.#ids.length?'Choose your character.':'No self-hosted characters are available for this key.';
 });}
 async #read(){
  try{const state=await this.#transport.read(this.#id);if(state.agent?.id!==this.#id)reject('The character response did not match this connection.',502);this.#state=state;this.#stale=false;}
  catch(e){if(e.code==='AGENT_OFFLINE'){this.#state={agent:{id:this.#id,name:this.#id,status:'offline'},control:{state:'offline'},receivedAt:Date.now()};this.#stale=false;}else{this.#stale=true;reject('Character refresh failed. The last observation is shown.',502);}}
 }
 async select(id){return this.#exclusive(async()=>{
  if(this.#id)reject('Disconnect before choosing another character.');
  if(!this.#key||!validId(id)||!this.#ids.includes(id))reject('Choose a character authorized by this key.',403);
  let ids;try{ids=await this.#transport.authorizedAgents(this.#key);}catch{reject('Authorization could not be refreshed.',401);}
  if(!ids.includes(id))reject('This key no longer authorizes that character.',403);
  this.#id=id;try{await this.#read();}catch(e){this.#id=null;this.#state=null;throw e;}this.#message='Observing. No control has been claimed.';
 });}
 async control(){return this.#exclusive(async()=>{
  if(!this.#id)reject('Choose a character first.');
  if(this.#validLease(this.#lease))return;
  const existing=this.#claims.get(this.#id);
  if(existing&&existing.connection!==this&&(existing.pending||existing.connection.view().controlled))reject('Another local browser session controls this character. Disconnect it first.');
  const reservation={connection:this,pending:true};this.#claims.set(this.#id,reservation);
  try{
  await this.#dropLease();await this.#read();
  const state=this.#state;
  if(state.control?.state==='active')reject('Another controller is active. Stop it before connecting control here.');
  if(!['uncontrolled','inactive','idle','offline'].includes(state.control?.state))reject('Current control availability could not be verified.');
  if(state.agent.activeAction||state.agent.activeWork||state.agent.isPerformingJob||state.agent.activeModule?.locksCommonActions)reject('The character is busy. Wait for its current activity to finish.');
  let lease;try{lease=await this.#transport.claim(this.#id);}catch{reject('Control could not be connected. Refresh before trying again.',502);}
  if(!this.#validLease(lease))reject('The control response could not be verified. No actions are enabled.',502);
  this.#lease=lease;this.#message='Control connected. Choose actions in Goals or pair your AI.';
  }finally{reservation.pending=false;if(!this.#lease&&this.#claims.get(this.#id)===reservation)this.#claims.delete(this.#id);}
 });}
 async refresh(){return this.#exclusive(async()=>{
  if(!this.#id)return;
  if(this.#lease){try{if(!this.#validLease(this.#lease))throw Error();const next=await this.#transport.heartbeat(this.#lease);if(!this.#validLease(next)||next.sessionId!==this.#lease.sessionId)throw Error();this.#lease=next;}catch{await this.#dropLease();this.#message='Control was lost or expired. Reconnect explicitly after checking the current controller.';}}
  try{await this.#read();}catch{this.#message='Character refresh failed. The last observation is shown.';}
 });}
 async disconnect(){this.#disconnecting=true;try{while(this.#busy)await new Promise(resolve=>this.#waiters.push(resolve));return await this.#exclusive(async()=>{
  const lease=this.#lease;if(this.#claims.get(this.#id)?.connection===this)this.#claims.delete(this.#id);this.#lease=null;this.#key='';this.#ids=[];this.#id=null;this.#state=null;this.#stale=false;this.#message='Disconnected. Local credentials cleared.';
  // LiveTransport keeps the verified key for claim; clear it as well.
  this.#transport.token=null;this.#transport.localToken='';
  if(lease)try{await this.#transport.release(lease);}catch{this.#message='Disconnected locally. Release was not confirmed; the game control session will expire.';}
 },true);}finally{this.#disconnecting=false;}}
 observation(){return structuredClone(this.#state);}
 async submit(action){return this.#exclusive(async()=>{if(!this.#validLease(this.#lease)||this.#stale)throw Object.assign(new ConnectionError('Fresh state and connected control are required.'),{code:'ACTION_NOT_SENT'});await this.#transport.submit(this.#lease,action);});}
 view(){return structuredClone({authorized:Boolean(this.#key),agentIds:this.#ids,agent:this.#state?.agent??null,control:this.#state?.control??null,controlled:this.#validLease(this.#lease),receivedAt:this.#state?.receivedAt??null,stale:this.#stale,message:this.#message});}
}
