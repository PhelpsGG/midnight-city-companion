// Presentation-only differences between observations. Never forecast earned XP.
export function observeFeedback(previous,snapshot){
 const worldId=snapshot.sandbox.worldId;
 const xp=Object.fromEntries(Object.entries(snapshot.view.agent.skills).map(([k,v])=>[k,v.xp]));
 const statuses=Object.fromEntries(snapshot.sandbox.recentResults.map(r=>[r.requestId,r.status]));
 const inventory={...snapshot.view.agent.inventory};
 const comparable=previous?.worldId===worldId;
 const gains=comparable?Object.entries(xp).filter(([k,v])=>Number.isFinite(previous.xp[k])&&v>previous.xp[k]).map(([skill,v])=>({skill,amount:v-previous.xp[skill]})):[];
 const completed=comparable?snapshot.sandbox.recentResults.filter(r=>r.status==='confirmed'&&previous.statuses[r.requestId]!=='confirmed'):[];
 const items=comparable?Object.entries(inventory).filter(([k,v])=>v>(previous.inventory[k]??0)).map(([id,v])=>({id,amount:v-(previous.inventory[id]??0)})):[];
 return {gains,items,completed,memory:{worldId,xp,statuses,inventory}};
}
