import { randomUUID } from 'node:crypto';
import { PlayError, fail, identifier } from './domain.mjs';
const ORIGIN='https://midnight.city/observer';
export class LiveTransport {
  constructor({localToken='',fetchImpl=fetch}={}){this.mode='live';this.localToken=localToken;this.fetch=fetchImpl;this.token=null;}
  async request(route,{token,body,mutation=false}={}) {
    let response;
    try{response=await this.fetch(ORIGIN+route,{method:body===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(12000),headers:{Accept:'application/json',...(token?{Authorization:`Bearer ${token}`}:{ }),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});}
    catch{throw new PlayError(mutation?'NETWORK_UNCERTAIN':'READ_UNAVAILABLE',mutation?'The request response was interrupted.':'The game read is unavailable.',502);}
    if(!response.ok){
      if(!mutation&&response.status===404&&/^\/api\/skill\/agents\/[^/]+\/context$/.test(route))fail('AGENT_OFFLINE','This character is offline. Connect control to bring it online.',404);
      if(route.includes('/session/') && [401,403,404,409].includes(response.status))fail('CONTROL_LOST','Control is no longer available.');
      if(!mutation && [401,403].includes(response.status))fail('AUTH_REQUIRED','The key was not accepted. Check the existing agent key.',401);
      if(mutation && response.status<500)fail('ACTION_REJECTED','The game rejected the request.');
      fail(mutation?'NETWORK_UNCERTAIN':'READ_UNAVAILABLE','The game service is unavailable.',502);
    }
    try{return await response.json();}catch{if(mutation)fail('NETWORK_UNCERTAIN','The action response could not be read.');fail('READ_UNAVAILABLE','The game read could not be interpreted.',502);}
  }
  async authorizedAgents(token){
    const key=token===undefined||token===''?this.localToken:token;
    if(typeof key!=='string'||!key.trim()||key.length>4096||/[\r\n]/.test(key))fail('INVALID_KEY','An existing agent API key is required.',400);
    const data=await this.request('/api/local-control/claimable',{token:key.trim()});
    if(!Array.isArray(data.agentIds)||!data.agentIds.every(id=>typeof id==='string'))fail('READ_UNAVAILABLE','The authorized character list was not available.',502);
    this.token=key.trim();return data.agentIds;
  }
  async read(agentId){
    identifier(agentId);const base='/api/skill/agents/'+encodeURIComponent(agentId)+'/';
    // Read existence first: offline characters have no public skill endpoints.
    const context=await this.request(base+'context');
    const [progression,inventory,resources,needs,events]=await Promise.all(['progression','inventory','resources','needs','recent-events?limit=100'].map(route=>this.request(base+route)));
    if([context,progression,inventory,resources].some(row=>row.agent?.id!==agentId))fail('WRONG_AGENT','A game read returned a different character.',502);
    if(!progression.skills||!inventory.inventory||!progression.capabilities?.contentVersion||!Array.isArray(events.recentEvents))fail('READ_UNAVAILABLE','The character state is incomplete.',502);
    // The live context uses explicit null when no controller is attached.
    // Missing/malformed status remains unknown and cannot authorize a claim.
    const control=context.controlStatus===null?{state:'uncontrolled'}:context.controlStatus;
    return {agent:{...context.agent,skills:progression.skills,inventory:inventory.inventory,equipment:progression.equipment,
      completedContractIds:progression.completedContractIds,activeWork:progression.activeWork,vitals:progression.vitals,hunger:needs.hunger},
      capabilities:progression.capabilities,resources:resources.resources??[],control,load:inventory.load,
      context,events:events.recentEvents,tick:Math.max(context.tick,progression.tick,inventory.tick),receivedAt:Date.now()};
  }
  async claim(agentId){
    if(!this.token)fail('AUTH_REQUIRED','Connect an authorized character first.',401);
    identifier(agentId);
    // Recheck the selected account's authority, including when the character
    // is offline and the public context cannot report a controller.
    if(!(await this.authorizedAgents(this.token)).includes(agentId))fail('NOT_AUTHORIZED','This key no longer authorizes that character.',403);
    return this.request('/api/local-control/session',{token:this.token,body:{agentId,clientInstanceId:'midnight-companion-'+randomUUID(),modelId:'companion-manual'},mutation:true});
  }
  async heartbeat(lease){return this.request('/api/local-control/session/heartbeat',{token:lease.token,body:{sessionId:lease.sessionId},mutation:true});}
  async submit(lease,action){return this.request('/api/actions',{token:lease.token,body:{...action,agentId:lease.agentId},mutation:true});}
  async release(lease){return this.request('/api/local-control/session/release',{token:lease.token,body:{sessionId:lease.sessionId},mutation:true});}
}
