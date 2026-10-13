import {menuIcon} from './icons.mjs';
import {createSessionClient} from './session.mjs';
import {itemVisualFor} from '@/features/items/itemVisuals';
import saved from '../hybrid/game-catalog.json';
import {mountDiscovery} from '../hybrid/discovery/controller.mjs';
import {projectContracts} from '../hybrid/contracts/model.mjs';
import {contractsPanel,bindContracts} from '../hybrid/contracts/panel.mjs';
import {activityFor} from '../player/model.mjs';
import {createWorld} from './world.js';
import {esc,title,connectionPanel,inventoryPanel,skillsPanel} from './view.mjs';
const $=id=>document.getElementById(id),catalog=saved.content,tabs=['Goals','Inventory','Skills','Contracts','Journal','Connection'];
let session,view={authorized:false,agentIds:[],agent:null},tab='Connection',busy=false,error='',lastHTML='',baseline={},characterId=null,tracked=new Set(),following=true;
const contracts={view:'available',query:'',skill:'',area:'',limit:24,selected:null};
const names=new Map(catalog.items.map(i=>[i.id,i.name]));
const icon=(id,size=32)=>{const v=itemVisualFor(id);return v?`<span class="item-art" aria-hidden="true" style="width:${size}px;height:${size}px;background-image:url('${v.src}');background-size:${size*8}px ${size*8}px;background-position:-${v.cell[0]*size}px -${v.cell[1]*size}px"></span>`:'<span aria-hidden="true">◇</span>';};
const world=createWorld($('world'),$('loading'),value=>{following=value;render();});
const guide=mountDiscovery({root:$('context'),body:$('context-body'),closeButton:$('close-context'),catalog,icon,getSnapshot:()=>({view:{agent:view.agent},world:world.snapshot}),onContract:id=>{tab='Contracts';contracts.selected=id;lastHTML='';render();$('contract-heading')?.focus();}});
const api={get snapshot(){return {contracts:projectContracts(catalog,{character:view.agent??{},trackedContractIds:[...tracked]})};},async command(type,{contractId,tracked:enabled}){if(type!=='track-contract')return;if(enabled)tracked.add(contractId);else tracked.delete(contractId);render();}};
const connection=createSessionClient({onChange:s=>{session=s;if(s)return;view={authorized:false,agentIds:[],agent:null};characterId=null;baseline={};tracked.clear();contracts.selected=null;guide.close();world.clear();tab='Connection';lastHTML='';}});
async function request(route,payload={},quiet=false){
 if(busy)return;busy=true;if(!quiet){error='';render();}
 try{const data=await connection.command(route,payload);session=data;view=data.view;error='';
  if(characterId!==view.agent?.id){characterId=view.agent?.id??null;baseline=structuredClone(view.agent?.skills??{});tracked.clear();contracts.selected=null;guide.close();if(characterId)tab='Inventory';else tab='Connection';}
  world.set(view);
 }catch(e){error=e.message;if(quiet)view={...view,stale:true};}finally{busy=false;render();}
}
function render(){
 const a=view.agent,active=document.activeElement?.id,scroll=$('panel').scrollTop;
 $('character-name').textContent=a?.name||a?.id||'Not connected';$('character-place').textContent=a?.position?title(a.position.spaceId):a?'Location not reported':'Local companion';
 $('resources').textContent=a?`♥ ${a.vitals?.health??a.vitals?.hp??'?'} / ${a.vitals?.maxHealth??a.vitals?.maxHp??'?'}   ◈ ${a.inventory?.crystal??'?'} crystals`:'Observed resources appear here.';
 $('connection-badge').textContent=!a?'DISCONNECTED':view.stale?'LAST OBSERVATION':view.controlled?'CONTROL CONNECTED':'OBSERVATION ONLY';
 $('connection-message').textContent=error||view.message||'Connect your own existing self-hosted agent.';$('connection-message').classList.toggle('error',Boolean(error||view.stale));
 $('refresh').disabled=busy||!a;$('follow').disabled=!a?.position;$('follow').textContent=following&&a?`◎ Following ${a.name||a.id}`:'◎ Follow character';
 const activity=activityFor(a,{content:catalog});$('status').innerHTML=a?`<b>${esc(activity.label)}</b><small>${esc(activity.detail)}${view.stale?' · Last observation':''}</small>`:'No character connected.';
 const gains=Object.entries(a?.skills??{}).map(([id,s])=>({id,gain:s.xp-(baseline[id]?.xp??s.xp)})).filter(s=>s.gain>0);
 $('xp-tracker-body').innerHTML=gains.length?gains.map(g=>`<button class="xp-track-row" data-xp-skill="${esc(g.id)}"><span class="xp-track-name">${esc(title(g.id))}</span><b>+${g.gain.toLocaleString()} <span>XP</span></b></button>`).join(''):`<p class="xp-track-empty">${a?'No XP gained since opening this character.':'Connect a character to begin tracking.'}</p>`;
 if(!$('tabs').children.length)$('tabs').innerHTML=tabs.map(n=>`<button role="tab" id="tab-${n}" aria-controls="panel"><span aria-hidden="true">${menuIcon(n)}</span>${n}</button>`).join('');
 for(const n of tabs){const b=$('tab-'+n);b.setAttribute('aria-selected',String(n===tab));b.tabIndex=n===tab?0:-1;b.onclick=()=>{tab=n;lastHTML='';render();b.focus();};}
 $('panel').setAttribute('aria-labelledby','tab-'+tab);
 let html=tab==='Connection'?connectionPanel(view):!a?'<h2>Connect your character</h2><p>Use Connection to load your own observed inventory and stats.</p>':tab==='Inventory'?inventoryPanel(a,catalog.items,icon):tab==='Skills'?skillsPanel(a,catalog.skillIds):tab==='Contracts'?contractsPanel(api.snapshot.contracts,contracts,{esc,icon,name:id=>names.get(id)??title(id)},{busy,live:true}):tab==='Goals'?'<small>NEXT MILESTONE</small><h2>Your goals</h2><p>Browse Contracts, recipes and skill unlocks in the Field guide to explore what to work toward.</p><div class="empty-state"><h3>Live missions aren’t connected yet</h3><p>This first portable client verifies your character and control connection. Planning and action execution will be connected separately.</p></div>':'<small>THIS CONNECTION</small><h2>Journal</h2><p>No gameplay actions have been sent by this client.</p><p class="sub">Your character may still progress under another controller. Observed session XP appears in the floating tracker.</p>';
 if(tab==='Contracts'&&guide.canResume)html='<button id="return-to-guide" class="text-button">← Return to field guide</button>'+html;
 if(!session)html='<h2>Open your local connection</h2><p>Reload to synchronize this tab with the local server.</p><button id="reload-session" class="primary wide">Reload connection</button>';
 if(html!==lastHTML){$('panel').innerHTML=html;lastHTML=html;
  $('reload-session')?.addEventListener('click',()=>location.reload());
  $('key-form')?.addEventListener('submit',e=>{e.preventDefault();const key=$('agent-key').value;$('agent-key').value='';void request('discover',{key});});
  $('agent-form')?.addEventListener('submit',e=>{e.preventDefault();void request('select',{id:$('agent-choice').value});});
  $('connect-control')?.addEventListener('click',()=>void request('control'));
  $('disconnect')?.addEventListener('click',()=>void request('disconnect'));
  if(tab==='Contracts')bindContracts($('panel'),contracts,api,render);
  $('return-to-guide')?.addEventListener('click',()=>{guide.resume();render();});
  for(const b of $('panel').querySelectorAll('[data-item]'))b.onclick=()=>guide.open({kind:'item',id:b.dataset.item});
  for(const b of $('panel').querySelectorAll('[data-skill]'))b.onclick=()=>guide.open({kind:'skill',id:b.dataset.skill});
  for(const b of $('panel').querySelectorAll('[data-guide]'))b.onclick=()=>guide.open({kind:b.dataset.guide,id:b.dataset.id});
  if(active)$(active)?.focus({preventScroll:true});$('panel').scrollTop=scroll;
 }
 for(const b of $('panel').querySelectorAll('form button,#connect-control,#disconnect'))b.disabled=busy;
 for(const b of $('xp-tracker-body').querySelectorAll('[data-xp-skill]'))b.onclick=()=>{tab='Skills';render();guide.open({kind:'skill',id:b.dataset.xpSkill});};
 guide.render();
}
function draggable(id,handle){const w=$(id),h=$(handle);let drag;const place=(x,y)=>{w.style.left=Math.max(0,Math.min(innerWidth-w.offsetWidth,x))+'px';w.style.top=Math.max(48,Math.min(innerHeight-w.offsetHeight-30,y))+'px';w.style.bottom='auto';};h.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,left:w.offsetLeft,top:w.offsetTop};h.setPointerCapture(e.pointerId);};h.onpointermove=e=>{if(drag)place(drag.left+e.clientX-drag.x,drag.top+e.clientY-drag.y);};h.onpointerup=h.onpointercancel=()=>drag=null;h.onkeydown=e=>{if(!e.key.startsWith('Arrow'))return;e.preventDefault();place(w.offsetLeft+(e.key==='ArrowRight'?10:e.key==='ArrowLeft'?-10:0),w.offsetTop+(e.key==='ArrowDown'?10:e.key==='ArrowUp'?-10:0));};}
$('explore').onclick=()=>guide.open({kind:'recipes'});$('follow').onclick=()=>world.follow();$('refresh').onclick=()=>void request('refresh');
$('xp-collapse').onclick=()=>{const hidden=!$('xp-tracker-body').hidden;$('xp-tracker-body').hidden=hidden;$('xp-collapse').textContent=hidden?'+':'−';$('xp-collapse').setAttribute('aria-expanded',String(!hidden));$('xp-collapse').setAttribute('aria-label',hidden?'Expand XP tracker':'Collapse XP tracker');};
$('tabs').onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const i=tabs.indexOf(tab);tab=tabs[e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];render();$('tab-'+tab).focus();};
document.addEventListener('keydown',e=>{if(e.key==='Escape')guide.close();});
draggable('activity','drag');draggable('xp-tracker','xp-drag');render();
connection.open().then(s=>{session=s;view=s.view;characterId=view.agent?.id??null;baseline=structuredClone(view.agent?.skills??{});if(characterId)tab='Inventory';world.set(view);render();}).catch(()=>{error='Local service unavailable. Start the server and reload.';render();});
const timer=setInterval(()=>{if(view.agent&&!document.hidden)void request('refresh',{},true);},5000);
window.addEventListener('pagehide',()=>{clearInterval(timer);world.clear();});
