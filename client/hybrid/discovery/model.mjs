// Read-only joins/comparisons of saved definitions and observed character state.
// No gameplay formulas, pathfinding, clock conversion or execution lives here.
const list=x=>Array.isArray(x)?x:[];
const map=xs=>new Map(list(xs).map(x=>[x.id,x]));
const levelOf=(agent,skill)=>Number.isSafeInteger(agent?.skills?.[skill]?.level)&&agent.skills[skill].level>=0?agent.skills[skill].level:null;
const ownedOf=(agent,id)=>agent?.inventory&&typeof agent.inventory==='object'?agent.inventory[id]??0:null;
const requirementStatus=(level,required)=>level===null?'unknown':level<required?'locked':'met';
const alphabetical=(a,b)=>a.name.localeCompare(b.name);
const matches=(station,recipe)=>station.workstationType===recipe.workstationType&&list(station.supportedRecipeFamilies).includes(recipe.family);
export function createIndex(catalog,geometry={}) {
 const ix={catalog,items:map(catalog.items),recipes:map(catalog.recipes),sources:map(catalog.sources),contracts:map(catalog.contracts),stations:map(catalog.workstations),areas:map(geometry.areas),spaces:map(geometry.spaces),skills:list(catalog.skillIds)};
 ix.itemName=id=>ix.items.get(id)?.name??id.replaceAll('_',' ');
 ix.search=new Map(list(catalog.recipes).map(r=>[r.id,[r.name,r.id,r.skill,r.family,r.workstationType,...list(r.inputs).map(i=>ix.itemName(i.itemId)),...list(r.outputs).map(i=>ix.itemName(i.itemId))].join(' ').toLowerCase()]));
 return ix;
}
export function recipeView(ix,id,agent,batches=1) {
 const r=ix.recipes.get(id);if(!r)return null;
 batches=Number.isSafeInteger(batches)&&batches>0&&batches<=100?batches:1;
 const level=levelOf(agent,r.skill),skillStatus=requirementStatus(level,r.requiredLevel);
 const inputs=list(r.inputs).map(i=>{const owned=ownedOf(agent,i.itemId),required=i.quantity*batches;return {...i,name:ix.itemName(i.itemId),owned,required,missing:owned===null?null:Math.max(0,required-owned)};});
 const status=skillStatus==='locked'?'locked':skillStatus==='unknown'||inputs.some(i=>i.owned===null)?'unknown':inputs.some(i=>i.missing>0)?'materials':'prepared';
 return {...r,level,skillStatus,status,batches,inputs,outputs:list(r.outputs).map(o=>({...o,name:ix.itemName(o.itemId),quantity:o.quantity*batches})),listedXp:r.xp*batches,stations:[...ix.stations.values()].filter(s=>matches(s,r)).sort(alphabetical)};
}
export function filterRecipes(ix,agent,{query='',skill='',status='',station=''}={}) {
 const q=query.trim().toLowerCase();
 return [...ix.recipes.values()].filter(r=>(!skill||r.skill===skill)&&ix.search.get(r.id).includes(q)&&(!station||ix.stations.has(station)&&matches(ix.stations.get(station),r)))
  .map(r=>recipeView(ix,r.id,agent)).filter(r=>!status||r.status===status).sort((a,b)=>a.requiredLevel-b.requiredLevel||alphabetical(a,b));
}
export function itemView(ix,id,agent) {
 const item=ix.items.get(id);if(!item)return null;
 const acquisition=[],uses=[];
 for(const r of ix.recipes.values()) {if(list(r.outputs).some(o=>o.itemId===id))acquisition.push({kind:'recipe',...r});if(list(r.inputs).some(o=>o.itemId===id))uses.push({kind:'recipe',...r});}
 for(const s of ix.sources.values()) {if(list(s.outputs).some(o=>o.itemId===id))acquisition.push({kind:'source',...s,rare:false});if(list(s.rareOutputs).some(p=>list(p.outputs).some(o=>o.itemId===id)))acquisition.push({kind:'source',...s,rare:true});}
 for(const c of ix.contracts.values()) {if(list(c.rewards).some(o=>o.itemId===id))acquisition.push({kind:'contract',...c});if(list(c.requirements).some(o=>o.itemId===id))uses.push({kind:'contract',...c});}
 return {...item,owned:ownedOf(agent,id),acquisition,uses};
}
export function stationView(ix,id) {
 const s=ix.stations.get(id);if(!s)return null;const area=ix.areas.get(s.areaId)??null;
 return {...s,area,space:ix.spaces.get(area?.spaceId)??null,recipes:[...ix.recipes.values()].filter(r=>matches(s,r)).sort((a,b)=>a.requiredLevel-b.requiredLevel||alphabetical(a,b))};
}
export function locationView(ix,id) {
 const area=ix.areas.get(id);if(!area)return null;
 return {...area,space:ix.spaces.get(area.spaceId)??null,stations:[...ix.stations.values()].filter(s=>s.areaId===id),contracts:[...ix.contracts.values()].filter(c=>c.areaId===id)};
}
export function skillGuide(ix,id,agent) {
 const level=levelOf(agent,id),entries=[];
 const add=(kind,def,requirement=def)=>{if(requirement.skill===id&&Number.isSafeInteger(requirement.requiredLevel))entries.push({kind,id:def.id,name:def.name,level:requirement.requiredLevel,status:def.dormant?'dormant':requirementStatus(level,requirement.requiredLevel),type:kind==='item'?(def.tool?'Tool':'Equipment'):kind});};
 for(const r of ix.recipes.values())add('recipe',r);
 for(const s of ix.sources.values())add('source',s);
 for(const c of ix.contracts.values())add('contract',c);
 for(const i of ix.items.values()){if(i.tool)add('item',i,i.tool);else if(i.equipment)add('item',i,i.equipment);}
 entries.sort((a,b)=>a.level-b.level||alphabetical(a,b));
 return {id,level,xp:agent?.skills?.[id]?.xp??null,entries,nextLevel:level===null?null:entries.find(e=>e.level>level&&e.status!=='dormant')?.level??null};
}
