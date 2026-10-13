import {createIndex} from './model.mjs';
import {renderDiscovery} from './panel.mjs';
export function resolveReturnFocus(origin,doc=document){return (origin?.isConnected?origin:doc.getElementById(origin?.id))??doc.querySelector('#tabs [aria-selected="true"]')??doc.getElementById('explore');}

export function createNavigation() {
 return {screen:null,history:[],suspended:false,open(screen,focus){if(this.screen)this.history.push({...this.screen,focus});this.screen={limit:24,...screen};return this.screen;},back(){if(this.history.length)this.screen=this.history.pop();return this.screen;},reset(screen){this.history=[];this.suspended=false;this.screen={limit:24,...screen};},suspend(focus,scroll){Object.assign(this.screen,{focus,scroll});this.suspended=true;},resume(){this.suspended=false;return this.screen;}};
}

// One set of delegated handlers for the window's entire lifetime. Repainting after
// a server observation never adds handlers and never advances a mission.
export function mountDiscovery({root,body,closeButton,catalog,getSnapshot,onContract,icon,onClose=()=>{}}) {
 const nav=createNavigation();let index,geometry,visible=false,last='',origin=null;
 root.classList.add('discovery-window');root.setAttribute('role','region');root.setAttribute('aria-label','Field guide');
 closeButton.setAttribute('aria-label','Close field guide');
 function currentIndex(){const g=getSnapshot()?.world?.staticWorld;if(!index||geometry!==g){geometry=g;index=createIndex(catalog,g??{});}return index;}
 function render({focusTitle=false,restore=false}={}) {
  if(!visible||!nav.screen)return;
  const active=document.activeElement,focus=body.contains(active)?active.id:null,caret=active?.selectionStart,scroll=restore?nav.screen.scroll??0:root.scrollTop;
  const section=['recipe','recipes','item','source'].includes(nav.screen.kind)?'recipes':['station','location','places'].includes(nav.screen.kind)?'places':'skills';
  const html=`<div class="discovery-heading"><span>FIELD GUIDE</span><small>SAVED CATALOG</small></div><nav class="discovery-nav" aria-label="Field guide sections">${[['recipes','Recipes'],['places','Places'],['skills','Skills']].map(([kind,name])=>`<button id="discovery-nav-${kind}" data-root="${kind}" aria-pressed="${kind===section}">${name}</button>`).join('')}</nav>${nav.history.length?'<button id="discovery-back" class="text-button">← Back</button>':''}${renderDiscovery(currentIndex(),nav.screen,getSnapshot()?.view?.agent,{icon})}`;
  if(html!==last){body.innerHTML=html;last=html;let n=0;for(const b of body.querySelectorAll('[data-open],[data-station-recipes]'))if(!b.id)b.id='discovery-link-'+n++;if(focus){const next=body.querySelector('#'+focus);next?.focus({preventScroll:true});if(next&&typeof caret==='number')try{next.setSelectionRange(caret,caret);}catch{}}}
  root.scrollTop=scroll;
  if(focusTitle)body.querySelector('#discovery-title')?.focus({preventScroll:true});
  if(restore&&nav.screen.focus)body.querySelector('#'+nav.screen.focus)?.focus({preventScroll:true});
 }
 function go(screen,rootNav=false){if(nav.screen)nav.screen.scroll=root.scrollTop;const focus=document.activeElement?.id;rootNav?nav.reset(screen):nav.open(screen,focus);root.scrollTop=0;render({focusTitle:true});}
 function close(){visible=false;nav.suspended=false;root.hidden=true;resolveReturnFocus(origin)?.focus({preventScroll:true});onClose();}
 body.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||!body.contains(b))return;
  if(b.dataset.open){if(b.dataset.open==='contract'){nav.suspend(b.id,root.scrollTop);visible=false;root.hidden=true;onClose();onContract(b.dataset.id);}else go({kind:b.dataset.open,id:b.dataset.id});}
  else if(b.dataset.root)go({kind:b.dataset.root},true);
  else if(b.dataset.stationRecipes)go({kind:'recipes',station:b.dataset.stationRecipes});
  else if(b.id==='discovery-back'){nav.back();render({restore:true});}
  else if(b.id==='discovery-more'){nav.screen.limit+=24;render();}
  else if(b.id==='discovery-clear'){Object.assign(nav.screen,{query:'',skill:'',status:'',station:'',limit:24});render();body.querySelector('#discovery-query')?.focus();}
 });
 function change(e){const key={'discovery-query':'query','discovery-skill':'skill','discovery-status':'status','discovery-batches':'batches','discovery-view':'view','discovery-category':'category'}[e.target.id];if(!key)return;nav.screen[key]=key==='batches'?Number(e.target.value):e.target.value;nav.screen.limit=24;render();}
 body.addEventListener('input',e=>{if(e.target.id==='discovery-query')change(e);});
 body.addEventListener('change',e=>{if(e.target.id!=='discovery-query')change(e);});
 return {open(screen){origin=document.activeElement;visible=true;root.hidden=false;nav.reset(screen);last='';root.scrollTop=0;render({focusTitle:true});},resume(){if(!nav.suspended)return;nav.resume();visible=true;root.hidden=false;last='';render({restore:true});},render,close,get visible(){return visible;},get canResume(){return nav.suspended;}};
}
