import {fail} from '../play/domain.mjs';

// Dimensions come from the published static spaces snapshot (2026-10-10).
// Entries, portal topology and blocked cells below are deliberately synthetic;
// they exercise renderer transitions, not a reconstruction of server pathfinding.
export const locations=[
  {id:'central',name:'Central',width:144,height:114,entry:{spaceId:'central',x:68,y:59},blocked:[{x:0,y:0},{x:1,y:0},{x:0,y:1}]},
  {id:'construction-yard',name:'Construction Yard',width:160,height:96,entry:{spaceId:'construction-yard',x:79,y:91},blocked:[{x:0,y:0},{x:1,y:0}]},
  {id:'goodtimes-interior',name:'Good Times Bar',width:46,height:36,entry:{spaceId:'goodtimes-interior',x:23,y:30},blocked:[{x:0,y:0},{x:1,y:0}]},
];
export const landmarks=[
  {id:'central-start',name:'Central meeting point',kind:'arrival',position:locations[0].entry},
  {id:'practice-trader',name:'Practice trader · synthetic',kind:'merchant',position:{spaceId:'central',x:69,y:59}},
  {id:'workshop',name:'Practice construction workstation',kind:'workstation',position:{spaceId:'central',x:76,y:62}},
  {id:'contract-desk',name:'Practice contract desk',kind:'contract',position:{spaceId:'central',x:72,y:59}},
  {id:'yard-entry',name:'Construction Yard',kind:'district',position:locations[1].entry},
  {id:'bar-entry',name:'Good Times interior',kind:'interior',position:locations[2].entry},
];
export const portals=[
  {from:{spaceId:'central',x:78,y:62},to:locations[1].entry},
  {from:{spaceId:'central',x:65,y:59},to:locations[2].entry},
];
export function locationFor(position){return locations.find(x=>x.id===position?.spaceId);}
export function traversable(position){const l=locationFor(position);return Boolean(l&&Number.isSafeInteger(position.x)&&Number.isSafeInteger(position.y)&&position.x>=0&&position.x<l.width&&position.y>=0&&position.y<l.height&&!l.blocked.some(b=>b.x===position.x&&b.y===position.y));}
function localPath(from,to){
  if(!traversable(from)||!traversable(to)||from.spaceId!==to.spaceId)fail('ROUTE_UNAVAILABLE','This position has no sandbox route.');
  const l=locationFor(from),encode=p=>p.y*l.width+p.x,start=encode(from),goal=encode(to),visited=new Map([[start,null]]),queue=[start];
  for(let i=0;i<queue.length&&!visited.has(goal);i++){
    const n=queue[i],x=n%l.width,y=Math.floor(n/l.width);
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const p={spaceId:l.id,x:x+dx,y:y+dy},k=encode(p);if(traversable(p)&&!visited.has(k)){visited.set(k,n);queue.push(k);}}
  }
  if(!visited.has(goal))fail('ROUTE_UNAVAILABLE','No local route exists.');
  const result=[];for(let n=goal;n!==start;n=visited.get(n))result.push({spaceId:l.id,x:n%l.width,y:Math.floor(n/l.width)});return result.reverse();
}
export function route(from,to){
  if(!traversable(from)||!traversable(to))fail('ROUTE_UNAVAILABLE','Destination is outside supported walkable sandbox cells.');
  if(from.spaceId===to.spaceId)return localPath(from,to);
  const edges=portals.flatMap(p=>[p,{from:p.to,to:p.from}]);
  const queue=[{spaceId:from.spaceId,path:[]}],seen=new Set([from.spaceId]);let links;
  for(let i=0;i<queue.length;i++){const current=queue[i];if(current.spaceId===to.spaceId){links=current.path;break;}for(const p of edges.filter(p=>p.from.spaceId===current.spaceId))if(!seen.has(p.to.spaceId)){seen.add(p.to.spaceId);queue.push({spaceId:p.to.spaceId,path:[...current.path,p]});}}
  if(!links)fail('ROUTE_UNAVAILABLE','No portal connects these sandbox spaces.');
  let position=from;const result=[];for(const p of links){result.push(...localPath(position,p.from),structuredClone(p.to));position=p.to;}return [...result,...localPath(position,to)];
}
