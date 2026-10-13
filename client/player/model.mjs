export const title = value => String(value ?? '').replace(/[_:-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const rows = value => Array.isArray(value) ? value : Object.values(value ?? {});
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const matching = (agent,view) => view?.connected && agent?.id === view.agent?.id ? view : null;
const unresolved = action => action?.unresolved??['submitting','pending','unknown'].includes(action?.status);
function currentStep(agent,view) {
  const own=matching(agent,view), plan=own?.plan;
  if(!plan || plan.stale || Date.now()>plan.expiresAt || (own.action?.planId===plan.id && own.action.status==='confirmed'))return null;
  return plan.step;
}
export function resolvePlayer({world,view,selectedId,worldFresh=false}) {
  const publicAgent=world?.dynamicWorld?.agents?.find(a=>a.id===selectedId)??null;
  const own=view?.connected && view.agent?.id===selectedId ? view : null;
  const agent=own ? (worldFresh && publicAgent ? {...own.agent,...publicAgent} : own.agent) : publicAgent;
  return {agent,view:own};
}
export function worldForRenderer(world,view,worldFresh=false) {
  if(!world||!view?.connected||!view.agent)return world;
  if(view.mode!=='rehearsal'&&worldFresh)return world;
  if(view.agent.status==='offline')return {...world,dynamicWorld:{...world.dynamicWorld,agents:world.dynamicWorld.agents.filter(agent=>agent.id!==view.agent.id)}};
  // The map and HUD must use the same latest own-character read, even if the
  // public stream has stopped. Never mutate the stream reducer's baseline.
  let found=false;
  const agents=world.dynamicWorld.agents.map(agent=>{
    if(agent.id!==view.agent.id)return agent;
    found=true;return {...agent,...view.agent};
  });
  if(!found)agents.push(view.agent);
  return {...world,dynamicWorld:{...world.dynamicWorld,agents}};
}
function positionLabel(position) {
  if(!position)return '';
  const coordinates=number(position.x)!==null&&number(position.y)!==null ? ` (${position.x}, ${position.y})` : '';
  return `${title(position.spaceId)}${coordinates}`.trim();
}
export function activityFor(agent,{view=null,content={}}={}) {
  if(!agent)return {state:'unknown',label:'Choose a character',detail:'Connect in Journey or select someone on the map.',destination:'',notice:''};
  const own=matching(agent,view), action=agent.activeAction, work=agent.activeWork;
  const request=own?.action && (!own.plan || own.action.planId===own.plan.id) ? own.action : null;
  const moving=['travel','traveling','travelling'].includes(action?.phase) || ['walking','moving','traveling','travelling'].includes(agent.status) || ['move','move_to','travel_to_district','enter_building','exit_building'].includes(action?.kind);
  let destination=positionLabel(action?.destination);
  if(!destination && unresolved(request) && request.step?.destination)destination=request.step.destination.name || positionLabel(request.step.destination.position);
  let state='unknown',label='Activity unavailable',detail='The latest state does not describe an activity.';
  if(moving){state='travel';label='Walking';detail=destination?`Heading to ${destination}`:'Moving through the city';}
  else if(action?.phase==='waiting'){state='waiting';label='Waiting for a work site';detail='The character is waiting for access.';}
  else if(work?.kind==='gather' || action?.kind==='gather'){
    state='working';label='Gathering';detail=rows(content.sources).find(s=>s.id===(work?.sourceId??action?.sourceId))?.name || title(work?.sourceId??action?.sourceId) || 'Collecting resources';
  }else if(work?.kind==='craft' || action?.kind==='craft'){
    state='working';label='Crafting';const id=work?.recipeId??action?.recipeId;detail=rows(content.recipes).find(r=>r.id===id)?.name || title(id) || 'Making an item';label+=` · ${detail}`;
  }else if(['rest','sleep','sleeping','resting'].includes(action?.kind??agent.status)){state='resting';label='Resting';detail='Your character is resting.';}
  else if(agent.isPerformingJob || ['working','busy'].includes(agent.status)){state='working';label='Working';detail='An activity is in progress.';}
  else if(agent.activeModule?.locksCommonActions){state='blocked';label='In an event';detail='Finish the current event before starting another action.';}
  else if(unresolved(request)){state='checking';label='Checking the result';detail='A request is outstanding. Waiting for confirmed character state.';}
  else if(['failed','interrupted'].includes(request?.status)){state='blocked';label=request.status==='failed'?'Action blocked':'Control interrupted';detail=request.message || 'Check Journey before continuing.';}
  else if(agent.status==='idle' && !action && !work){state='idle';label='Ready for the next step';detail='Between actions';}
  else if(['offline','disconnected'].includes(agent.status)){state='offline';label='Offline';detail='Showing the last reported activity.';}
  else if(action?.kind){state='working';label=title(action.kind);detail='Reported by the character state.';}
  const notice=request?.status==='unknown'?'Response uncertain · waiting for confirmation':request?.status==='submitting'?'Sending request':request?.status==='pending'?'Action requested · result not yet confirmed':request?.status==='interrupted'&&unresolved(request)?'Control interrupted · result still being checked':'';
  return {state,label,detail,destination,notice,location:positionLabel(agent.position)};
}
function descriptionFor(item) {
  if(!item)return 'Item definition unavailable. Its name and quantity come from character state.';
  if(item.tool)return `${title(item.tool.skill)} tool · requires level ${item.tool.requiredLevel ?? 'unknown'}. Applies when equipped; condition is not reported here.`;
  if(item.equipment)return `${title(item.equipment.slot)} equipment. Listed benefits apply when equipped.`;
  if(item.consumable){const effects=[];for(const [key,label] of [['healthRestore','health'],['hungerRestore','hunger relief']])if(number(item.consumable[key])>0)effects.push(`${item.consumable[key]} ${label}`);return `Consumed on use${effects.length?` · ${effects.join(', ')}`:'.'}`;}
  return {raw_resource:'Raw material used in production. Check its recipes below.',processed_material:'A refined material used in further production or contracts.',currency:'Currency used for priced goods and services.',trade_good:'A trade good. Exchange options depend on available merchant offers.',contract_item:'An item requested by game contracts.',construction_part:'A component used in construction.',cosmetic:'An appearance item.'}[item.category] || item.description || 'Check its catalog uses below.';
}
export function inventoryFor(agent,content={},view=null) {
  if(!agent)return [];
  const inventory=agent.inventory??{}, equipped=new Map();
  for(const [slot,id] of Object.entries(agent.equipment??{}))if(typeof id==='string'&&id){if(!equipped.has(id))equipped.set(id,[]);equipped.get(id).push(slot);}
  const ids=new Set([...Object.keys(inventory).filter(id=>number(inventory[id])>0),...equipped.keys()]);
  const inputs=currentStep(agent,view)?.inputs??[];
  return [...ids].map(id=>{
    const item=rows(content.items).find(i=>i.id===id),uses=[];
    for(const recipe of rows(content.recipes)){const input=recipe.inputs?.find(i=>i.itemId===id);if(input)uses.push({kind:'recipe',id:recipe.id,name:recipe.name??title(recipe.id),quantity:input.quantity,skill:recipe.skill,requiredLevel:recipe.requiredLevel});}
    for(const contract of rows(content.contracts)){const input=contract.requirements?.find(i=>i.itemId===id);if(input)uses.push({kind:'contract',id:contract.id,name:contract.name??title(contract.id),quantity:input.quantity,skill:contract.skill,requiredLevel:contract.requiredLevel,completed:agent.completedContractIds?.includes(contract.id)??false});}
    const quantity=agent.inventory && typeof agent.inventory==='object' ? number(Object.hasOwn(inventory,id)?inventory[id]:0) : null;
    return {id,name:item?.name??title(id),category:item?.category??'unknown',description:descriptionFor(item),quantity,slots:equipped.get(id)??[],uses,needed:inputs.find(i=>i.itemId===id)?.quantity??0,known:Boolean(item)};
  }).sort((a,b)=>Boolean(b.slots.length)-Boolean(a.slots.length)||Boolean(b.needed)-Boolean(a.needed)||a.name.localeCompare(b.name));
}
export function resourcesFor(agent,view=null) {
  const inventory=agent?.inventory;
  const crystals=inventory && typeof inventory==='object' ? number(Object.hasOwn(inventory,'crystal')?inventory.crystal:0) : null;
  return {crystals,health:{value:number(agent?.vitals?.health??agent?.vitals?.hp),max:number(agent?.vitals?.maxHealth??agent?.vitals?.maxHp)},hunger:number(agent?.hunger?.value),
    materials:(currentStep(agent,view)?.inputs??[]).map(i=>({id:i.itemId,name:i.name??title(i.itemId),held:inventory?number(inventory[i.itemId]??0):null,required:i.quantity}))};
}
export function followState({agent,following,rendered=true}) {
  const available=Boolean(agent?.position?.spaceId && number(agent.position.x)!==null && number(agent.position.y)!==null);
  return {available,active:available&&Boolean(following)&&rendered,label:!available?'Location unavailable':following?(rendered?'Following':'Locating character…'):'Follow character'};
}
