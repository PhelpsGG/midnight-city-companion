// Browser-test adapter only. No fetch, credentials, production fallback or game actions.
export function fixtureTransport(){
 let controlled=false;const state=id=>({agent:{id,name:id==='test-river'?'River · test observer':'Juniper · test observer',status:'idle',position:{spaceId:'central',x:68,y:59},skills:{scavenging:{level:2,xp:464},engineering:{level:2,xp:604}},inventory:{transit_actuator:8,crystal:12},vitals:{health:100,maxHealth:100},completedContractIds:[]},control:{state:controlled?'active':'uncontrolled'},receivedAt:Date.now()});
 return {async authorizedAgents(key){if(key!=='sandbox-test-key')throw Error('Invalid fixture key');return ['test-river','test-juniper'];},async read(id){return state(id);},async claim(id){controlled=true;return {agentId:id,token:'fixture-private-lease',sessionId:'fixture-control',expiresAt:Date.now()+60000};},async heartbeat(lease){return {...lease,expiresAt:Date.now()+60000};},async release(){controlled=false;}};
}
