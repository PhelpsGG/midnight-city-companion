import {filterRecipes,recipeView,itemView,skillGuide,stationView,locationView} from './model.mjs';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title=x=>String(x??'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const labels={prepared:'Level & materials met',materials:'Missing materials',locked:'Level locked',unknown:'Needs character data'};
const choices=(values,current)=>values.map(([id,name])=>`<option value="${esc(id)}" ${id===current?'selected':''}>${esc(name)}</option>`).join('');
const note='<p class="discovery-disclaimer">Catalog reference · quantities and levels use the observed character. This guide cannot craft, deliver or travel. Listed rewards are not earned rewards.</p>';
const heading=(kicker,name)=>`<small class="discovery-kicker">${esc(kicker)}</small><h2 id="discovery-title" tabindex="-1">${esc(name)}</h2>`;
const link=(kind,id,name,meta='',art='')=>`<button class="discovery-entry" data-open="${esc(kind)}" data-id="${esc(id)}">${art}<span><b>${esc(name)}</b>${meta?`<small>${esc(meta)}</small>`:''}</span><em aria-hidden="true">›</em></button>`;
const empty=message=>`<p class="discovery-empty">${esc(message)}</p>`;
const more=(length,limit)=>length>limit?`<button id="discovery-more" class="text-button">Show more · ${length-limit} remaining</button>`:'';
const section=(label,body)=>`<section class="discovery-section"><h3>${label}</h3>${body}</section>`;
const levelLink=(skill,required,observed)=>link('skill',skill,`${title(skill)} · level ${required}`,observed===null?'Character level unknown':`Your level ${observed}${observed>=required?' · requirement met':` · ${required-observed} levels away`}`);
const amount=n=>n===null?'Unknown':Number(n).toLocaleString();

export function renderDiscovery(ix,screen,agent,{icon=()=>''}={}) {
 const {kind,id}=screen,limit=screen.limit??24;
 const refs=entries=>entries.slice(0,limit).map(e=>link(e.kind,e.id,e.name,`${title(e.kind)}${e.rare?' · rare output':''}${e.skill?` · ${title(e.skill)} ${e.requiredLevel}`:''}`)).join('');
 const materials=(entries,requirements=false,prefix='')=>entries.map((i,n)=>`<button class="discovery-material" data-open="item" data-id="${esc(i.itemId)}" id="discovery-material-${prefix}${requirements?'input':'output'}-${n}">${icon(i.itemId,28)}<span><b>${esc(ix.itemName(i.itemId))}</b>${requirements?`<small>${i.missing===null?'Inventory unknown':i.missing?`Missing ${i.missing}`:'In your pack'}</small>`:''}</span><strong>${requirements?`${amount(i.owned)}<small> / ${i.required}</small>`:`×${i.quantity}`}</strong></button>`).join('');
 if(kind==='recipes') {
  const rows=filterRecipes(ix,agent,screen),skills=[...new Set([...ix.recipes.values()].map(r=>r.skill))].sort();
  const station=ix.stations.get(screen.station);
  return heading('CRAFTING / REFERENCE',station?station.name:'Recipe book')+`<p class="discovery-intro">${ix.recipes.size} saved recipes. Find what you need, then follow the materials.</p><label class="search-label" for="discovery-query">Find a recipe or material</label><input id="discovery-query" type="search" placeholder="Plank, steel, engineering…" value="${esc(screen.query)}"><div class="discovery-filters"><label>Skill<select id="discovery-skill">${choices([['','All skills'],...skills.map(s=>[s,title(s)])],screen.skill??'')}</select></label><label>Requirements<select id="discovery-status">${choices([['','All recipes'],...Object.entries(labels)],screen.status??'')}</select></label></div><div class="discovery-results"><span>${rows.length} recipes · one batch</span><button id="discovery-clear" class="text-button">Clear filters</button></div><div class="discovery-list">${rows.slice(0,limit).map(r=>link('recipe',r.id,r.name,`${title(r.skill)} ${r.requiredLevel} · ${labels[r.status]}`,icon(r.outputs[0]?.itemId,28))).join('')||empty('No recipes match. Try another skill or clear filters.')}</div>${more(rows.length,limit)}${note}`;
 }
 if(kind==='recipe') {
  const r=recipeView(ix,id,agent,screen.batches);if(!r)return heading('RECIPE','No saved details');
  return heading('RECIPE / '+title(r.family),r.name)+`<div class="discovery-state ${r.status}">${labels[r.status]}</div><label class="discovery-batches">Material checklist<select id="discovery-batches">${choices([1,5,10,25,100].map(n=>[String(n),`${n} ${n===1?'batch':'batches'}`]),String(r.batches))}</select></label>`+section('Ingredients',materials(r.inputs,true))+`<p class="discovery-fine">Pack quantities are shared with Inventory and Contracts. This checklist does not reserve materials or include other goals.</p>`+section('Produces',materials(r.outputs))+`<div class="discovery-reward"><span>Listed recipe XP · ${r.batches} ${r.batches===1?'batch':'batches'}</span><b>+${amount(r.listedXp)}</b></div>`+section('Skill requirement',levelLink(r.skill,r.requiredLevel,r.level))+section('Where to make it',r.stations.map(s=>link('station',s.id,s.name,ix.areas.get(s.areaId)?.name??'Location name unavailable')).join('')||empty('No matching workstation recorded.'))+note;
 }
 if(kind==='item') {
  const item=itemView(ix,id,agent);if(!item)return heading('ITEM','No saved details');
  const contractUses=item.uses.filter(e=>e.kind==='contract'),recipeUses=item.uses.filter(e=>e.kind==='recipe');
  const total=Math.max(item.acquisition.length,recipeUses.length,contractUses.length);
  const requirement=item.tool??item.equipment,level=requirement?agent?.skills?.[requirement.skill]?.level??null:null;
  return heading(item.fixture?'SANDBOX ITEM':'ITEM / '+title(item.category??'catalog'),item.name)+`<div class="discovery-item-hero">${icon(id,48)}<div><small>In your pack</small><strong>${amount(item.owned)}</strong></div>${item.dormant?'<span class="tag">DORMANT</span>':''}</div>${item.dormant?'<p class="discovery-empty">Dormant in the saved catalog. Availability is not confirmed.</p>':''}`+(requirement?section(item.tool?'Tool requirement':'Equipment requirement',levelLink(requirement.skill,requirement.requiredLevel,level)):'')+(item.consumable?section('Consumable effects',`<p class="discovery-fine">${esc([item.consumable.healthRestore?`Health +${item.consumable.healthRestore}`:'',item.consumable.hungerRestore?`Hunger +${item.consumable.hungerRestore}`:''].filter(Boolean).join(' · ')||'No effect details recorded.')}</p>`):'')+section(`Acquisition <span>${item.acquisition.length}</span>`,refs(item.acquisition)||empty('No acquisition method recorded.'))+(contractUses.length?section(`Contract needs <span>${contractUses.length}</span>`,refs(contractUses)):'')+section(`Recipes using this <span>${recipeUses.length}</span>`,refs(recipeUses)||empty('No recipe use recorded.'))+more(total,limit)+note;
 }
 if(kind==='source') {
  const s=ix.sources.get(id);if(!s)return heading('SOURCE','No saved details');
  return heading('GATHERING SOURCE',s.name)+section('Skill requirement',levelLink(s.skill,s.requiredLevel,agent?.skills?.[s.skill]?.level??null))+`<p class="discovery-fine">${s.toolType?`Tool type: ${esc(title(s.toolType))}`:'No tool requirement recorded.'}</p>`+section('Regular outputs',materials(s.outputs??[],false,'regular-'))+((s.rareOutputs??[]).length?section('Rare outputs · not guaranteed',s.rareOutputs.map((r,n)=>materials(r.outputs??[],false,'rare-'+n+'-')).join('')):'')+`<p class="discovery-empty">Location not recorded. The saved source definition has no map placement.</p>`+note;
 }
 if(kind==='places') {
  const q=(screen.query??'').trim().toLowerCase();
  const stations=[...ix.stations.values()].filter(s=>`${s.name} ${s.workstationType} ${ix.areas.get(s.areaId)?.name??s.areaId}`.toLowerCase().includes(q));
  const areas=[...ix.areas.values()].filter(a=>`${a.name} ${a.id} ${ix.spaces.get(a.spaceId)?.name??''}`.toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name));
  return heading('CITY / SAVED LOCATIONS','Places & workstations')+`<label class="search-label" for="discovery-query">Find a place</label><input id="discovery-query" type="search" value="${esc(screen.query)}" placeholder="Workstation, district, building…">`+section(`Workstations <span>${stations.length}</span>`,stations.map(s=>link('station',s.id,s.name,ix.areas.get(s.areaId)?.name??'Location name unavailable')).join('')||empty('No matching workstations.'))+section(`Locations <span>${areas.length}</span>`,areas.slice(0,limit).map(a=>link('location',a.id,a.name,ix.spaces.get(a.spaceId)?.name??'Space name unavailable')).join('')||empty('No matching saved locations.'))+more(areas.length,limit)+note;
 }
 if(kind==='station') {
  const s=stationView(ix,id);if(!s)return heading('WORKSTATION','No saved details');
  return heading('WORKSTATION / '+title(s.workstationType),s.name)+section('Location',s.area?link('location',s.area.id,s.area.name,s.space?.name??'Space name unavailable'):empty('Location name unavailable.'))+section('Supported recipe families',`<p class="discovery-fine">${esc(s.supportedRecipeFamilies.map(title).join(' · '))}</p>`)+`<button class="discovery-entry" data-station-recipes="${esc(id)}"><span><b>Browse ${s.recipes.length} recipes</b><small>Recipes supported by this workstation</small></span><em>›</em></button>`+note;
 }
 if(kind==='location') {
  const p=locationView(ix,id);if(!p)return heading('LOCATION','No saved details')+empty('This area is absent from the saved map.');
  return heading('LOCATION / '+(p.space?.name??'Unknown space'),p.name)+section('Workstations',p.stations.map(s=>link('station',s.id,s.name,title(s.workstationType))).join('')||empty('No workstation recorded here.'))+section(`Contracts <span>${p.contracts.length}</span>`,p.contracts.slice(0,limit).map(c=>link('contract',c.id,c.name,`${title(c.skill)} ${c.requiredLevel}`)).join('')||empty('No contracts recorded here.'))+more(p.contracts.length,limit)+`<p class="discovery-fine">Saved location information. Following your character and browsing places do not move them.</p>`+note;
 }
 if(kind==='skills')return heading('PROGRESSION / REFERENCE','Skill guides')+ix.skills.map(s=>link('skill',s,title(s),agent?.skills?.[s]?`Your level ${agent.skills[s].level}`:'Character level unknown')).join('')+note;
 if(kind==='skill') {
  const g=skillGuide(ix,id,agent),view=screen.view??'all',category=screen.category??'';
  const entries=g.entries.filter(e=>(view==='all'||e.status===view)&&(!category||e.kind===category));
  return heading('SKILL / UNLOCK GUIDE',title(id))+`<div class="discovery-skill-current">${g.level===null?'Character level unknown':`Level <b>${g.level}</b> <span>· ${amount(g.xp)} XP</span>`}</div><p class="discovery-intro">${g.nextLevel===null?(g.level===null?'Load character progression to compare requirements.':'No later unlock recorded in this catalog.'): `Next recorded unlock at level ${g.nextLevel}.`}</p><div class="discovery-filters"><label>Progress<select id="discovery-view">${choices([['all','All unlocks'],['met','Level met'],['locked','Upcoming'],['unknown','Unverified'],['dormant','Dormant']],view)}</select></label><label>Type<select id="discovery-category">${choices([['','All types'],['recipe','Recipes'],['source','Sources'],['item','Gear & tools'],['contract','Contracts']],category)}</select></label></div><div class="discovery-results">${entries.length} recorded unlocks</div>`+entries.slice(0,limit).map(e=>link(e.kind,e.id,e.name,`Level ${e.level} · ${title(e.type)} · ${{met:'Level requirement met',locked:'Upcoming',unknown:'Level requirement unverified',dormant:'Dormant catalog item'}[e.status]}`)).join('')+(entries.length?'':empty('No unlocks match these filters.'))+more(entries.length,limit)+`<p class="discovery-fine">Not a complete skill tree. This guide joins recorded recipes, sources, contracts, tools and gear. Meeting a level requirement does not confirm other requirements or execution support.</p>`+note;
 }
 return heading('FIELD GUIDE','No saved details');
}
