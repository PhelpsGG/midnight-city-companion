import {esc,title} from './view.mjs';
const signed=n=>(n>0?'+':'')+n.toLocaleString();
export function awayPanel(r,{mode,names=new Map(),icon=()=>''}={}){
 const name=id=>names.get(id)??title(id),xp=r.skills.reduce((n,s)=>n+s.xp,0),levels=r.skills.reduce((n,s)=>n+Math.max(0,s.levels),0),crystals=r.items.find(i=>i.id==='crystal')?.net;
 const ids=[...new Set([...Object.keys(r.flows.earned),...Object.keys(r.flows.consumed),...r.items.map(i=>i.id)])],duration=Math.max(0,Math.round((r.to-r.from)/60000));
 const value=(collection,id)=>Object.hasOwn(collection,id)?collection[id].toLocaleString():'—';
 return `<div class="away-topline"><span>${mode==='sandbox'?'SYNTHETIC SANDBOX':'CHARACTER ACTIVITY'}</span><button id="away-dismiss" aria-label="Dismiss return report">×</button></div><div class="away-heading"><small>WELCOME BACK, ${esc(r.name)}</small><h1 id="away-title">While you were away<span>.</span></h1><p id="away-description">${duration<1?'A moment':duration+' min'} of progress · ${esc(new Date(r.from).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))} – ${esc(new Date(r.to).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))}</p></div><div class="away-metrics"><div><strong>${signed(xp)}</strong><span>XP change</span></div><div><strong>${levels}</strong><span>Level-ups</span></div><div><strong>${crystals===undefined?'—':signed(crystals)}</strong><span>Crystal change</span></div><div><strong>${r.eventCount}</strong><span>Recorded events</span></div></div><div class="away-content"><section><h2>Your progress</h2>${r.skills.length?r.skills.map(s=>`<div class="away-skill"><b>${esc(title(s.id))}</b><strong>${signed(s.xp)} XP</strong><span>${s.levels?`Level ${s.fromLevel} → ${s.toLevel}`:'Same level'}</span></div>`).join(''):'<p class="sub">No measured skill changes in this period.</p>'}${r.contracts.length?`<h3>Contracts completed</h3>${r.contracts.map(id=>`<button class="away-contract" data-away-contract="${esc(id)}">✓ ${esc(name(id))} <span>View →</span></button>`).join('')}`:''}<h2>Conversations & connections</h2><p class="away-social">${r.social.messages} recorded messages · ${r.social.threads} identified threads · ${r.social.partners} conversation partners</p><p class="sub">${r.social.connections===null?'Connections not reported. Relationship gains are unavailable.':signed(r.social.connections)+' connections (observed count change).'}</p></section><section><h2>What went into your pack</h2>${ids.length?`<table class="away-items"><thead><tr><th scope="col">Item</th><th scope="col">Collected</th><th scope="col">Used</th><th scope="col">Net change</th></tr></thead><tbody>${ids.slice(0,40).map(id=>{const delta=r.items.find(i=>i.id===id);return `<tr><th scope="row"><button data-away-item="${esc(id)}">${icon(id,24)}<span>${esc(name(id))}</span></button></th><td>${value(r.flows.earned,id)}</td><td>${value(r.flows.consumed,id)}</td><td>${delta?signed(delta.net):'—'}</td></tr>`;}).join('')}</tbody></table>${ids.length>40?`<p class="sub">Showing 40 of ${ids.length} changed items. Open Inventory for current quantities.</p>`:''}`:'<p class="sub">No measured inventory changes or item receipts.</p>'}<p class="sub">Collected / used comes from explicit recorded receipts. Net change compares your inventory at departure and return. A dash means no recorded value; receipt totals may be partial.</p></section></div>${r.gaps.length?`<aside class="away-gaps"><b>Part of the story is missing</b><ul>${r.gaps.map(g=>`<li>${esc(g)}</li>`).join('')}</ul></aside>`:''}<div class="away-now"><span>RIGHT NOW</span><p id="away-current"></p></div><p id="away-error" role="alert"></p><div class="away-actions"><button id="away-journal">Review activity</button><button id="away-goals">Choose next goal</button><button id="away-continue" class="primary">Continue playing →</button></div>`;
}

export function mountAway({dialog,getSession,acknowledge,navigate,names,icon}){
 let rendered=null,autoShown=null,identity=null,restoreFocus=null,working=false;
 async function finish(destination){
  if(working)return;working=true;for(const b of dialog.querySelectorAll('button'))b.disabled=true;
  const s=getSession(),ok=!s?.away?.unread||await acknowledge(s.away.report.id);
  working=false;for(const b of dialog.querySelectorAll('button'))b.disabled=false;
  if(!ok){dialog.querySelector('#away-error').textContent='Could not save this acknowledgement. Your report is still unread; try again.';return;}
  dialog.close();restoreFocus?.focus?.();if(destination)navigate(destination);
 }
 function open(){if(!getSession()?.away?.report)return;if(!dialog.open){restoreFocus=document.activeElement;dialog.showModal();dialog.querySelector('#away-continue')?.focus();}}
 function render(){
  const s=getSession(),r=s?.away?.report;
  if(identity!==s?.view?.agent?.id){dialog.close();rendered=null;autoShown=null;identity=s?.view?.agent?.id;}
  if(!r)return;
  if(rendered!==r.id){dialog.innerHTML=awayPanel(r,{mode:s.mode,names,icon});rendered=r.id;
   for(const id of ['away-dismiss','away-continue'])dialog.querySelector('#'+id).onclick=()=>void finish();
   dialog.querySelector('#away-journal').onclick=()=>void finish({tab:'Journal'});
   dialog.querySelector('#away-goals').onclick=()=>void finish({tab:'Goals'});
   for(const b of dialog.querySelectorAll('[data-away-item]'))b.onclick=()=>void finish({tab:'Inventory',item:b.dataset.awayItem});
   for(const b of dialog.querySelectorAll('[data-away-contract]'))b.onclick=()=>void finish({tab:'Contracts',contract:b.dataset.awayContract});
   // A resumed visit can replace the report while the modal is already open.
   // Replacing its contents must not leave keyboard focus behind in the world.
   if(dialog.open)dialog.querySelector('#away-continue')?.focus();
  }
  dialog.querySelector('#away-current').textContent=[s.runtime.goal||'No goal selected',s.runtime.mode,s.runtime.message].filter(Boolean).join(' · ');
  if(s.away.fault)dialog.querySelector('#away-error').textContent='Visit history storage is unavailable. This report cannot be marked seen until recovery.';
  if(s.away.unread&&autoShown!==r.id&&!document.hidden){autoShown=r.id;open();}
 }
 dialog.addEventListener('cancel',e=>{e.preventDefault();void finish();});
 return {render,open};
}
