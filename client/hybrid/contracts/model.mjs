// Catalog comparisons only: no XP formulas, reward application or route planning.
export function projectContracts(catalog,state){
 const character=state.character??{},historyKnown=Array.isArray(character.completedContractIds);
 const completed=new Set(character.completedContractIds??[]),tracked=new Set(state.trackedContractIds??[]);
 const names=new Map((catalog.items??[]).map(i=>[i.id,i.name]));
 const missionInputs={};
 if(['running','paused','blocked','ready'].includes(state.mission?.status))for(const step of state.mission.steps.slice(state.mission.cursor))for(const i of step.inputs??[])missionInputs[i.id]=(missionInputs[i.id]??0)+i.amount;
 const rows=catalog.contracts.map(c=>{
  const record=(state.receipts??[]).findLast(r=>r.action?.kind==='deliver_contract'&&r.action.contractId===c.id);
  const isComplete=completed.has(c.id)||Boolean(record);
  const observed=character.skills?.[c.skill]?.level,level=Number.isSafeInteger(observed)&&observed>=0?observed:null;
  const status=isComplete?'completed':level!==null&&level<c.requiredLevel?'locked':level===null||!historyKnown?'unknown':'available';
  const requirements=c.requirements.map(r=>{const owned=character.inventory?(character.inventory[r.itemId]??0):null;return {...r,name:names.get(r.itemId)??r.itemId,owned,missing:owned===null?null:Math.max(0,r.quantity-owned),missionNeeded:missionInputs[r.itemId]??0};});
  const readiness=requirements.some(r=>r.owned===null)?'inventory-unknown':requirements.some(r=>r.missing>0)?'materials':!character.position?.areaId?'location-unknown':character.position.areaId===c.areaId?'ready':'travel';
  const completion=isComplete?{at:record?.at??null,rewards:record?.items??null,gains:record?.gains??null,evidence:record?.evidence??'completion-record'}:null;
  return {...c,level,status,requirements,readiness,completion,tracked:tracked.has(c.id),levelsMissing:level===null?null:Math.max(0,c.requiredLevel-level),searchText:[c.name,c.id,c.skill,c.areaId,...requirements.map(r=>r.name)].join(' ').toLowerCase()};
 });
 return {rows,historyKnown,source:'saved-catalog',counts:{available:rows.filter(r=>r.status==='available').length,tracked:rows.filter(r=>r.tracked).length,locked:rows.filter(r=>['locked','unknown'].includes(r.status)).length,completed:rows.filter(r=>r.status==='completed').length,unknown:rows.filter(r=>r.status==='unknown').length}};
}
export function filterContracts(projection,{view='available',query='',skill='',area=''}={}){
 return projection.rows.filter(r=>(view==='tracked'?r.tracked:view==='locked'?['locked','unknown'].includes(r.status):r.status===view)&&(!skill||r.skill===skill)&&(!area||r.areaId===area)&&r.searchText.includes(query.trim().toLowerCase()))
  .sort((a,b)=>(a.status==='unknown')-(b.status==='unknown')||(a.readiness==='materials')-(b.readiness==='materials')||a.requiredLevel-b.requiredLevel||a.name.localeCompare(b.name));
}
