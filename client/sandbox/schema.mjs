import { readFileSync } from 'node:fs';
import { fail } from '../play/domain.mjs';
import { traversable } from './locations.mjs';
import { syntheticItems, initialMerchantStock } from './mechanics.mjs';
export const catalog=JSON.parse(readFileSync(new URL('./catalog.json',import.meta.url),'utf8'));
export const content=catalog.staticWorld.gameContent;
export const allItems=[...content.items,...syntheticItems];
export const limits={characters:8,nodes:32,commands:2000,ticksPerStep:1000,totalTicks:100000,jsonBytes:1000000,maxXp:Number.MAX_SAFE_INTEGER};
export const level=xp=>content.xpThresholds.filter(x=>x<=xp).length;
export const skillRecord=xp=>({xp,level:level(xp),nextLevelXp:content.xpThresholds[level(xp)]??null});
export const invalid=label=>fail('INVALID_SCENARIO',`Invalid sandbox ${label}.`,400);
export function object(v,keys,label){if(!v||Array.isArray(v)||typeof v!=='object'||Object.keys(v).some(k=>!keys.includes(k)))invalid(label);return v;}
export function number(v,min,max,label){if(!Number.isSafeInteger(v)||v<min||v>max)invalid(label);return v;}
export function id(v,label='identifier'){if(typeof v!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/.test(v))invalid(label);return v;}
export function string(v,max,label){if(typeof v!=='string'||!v.trim()||v.length>max||/[\x00-\x1f]/.test(v))invalid(label);return v;}
export function array(v,max,label){if(!Array.isArray(v)||v.length>max)invalid(label);return v;}
function unique(rows,label){if(new Set(rows.map(x=>x.id)).size!==rows.length)invalid(`duplicate ${label}`);}
export function position(v){object(v,['spaceId','x','y'],'position');if(!traversable(v))invalid('position (supported walkable sandbox cells only)');return v;}
export function validateFaults(f){object(f,['response','connection','forceToolBreak'],'faults');if(!['normal','rejected','uncertain','lost-control'].includes(f.response)||!['online','interrupted'].includes(f.connection)||typeof f.forceToolBreak!=='boolean')invalid('fault settings');return f;}
export function validateCharacter(c){
  object(c,['id','name','xp','inventory','equipment','health','hunger','position','completedContractIds'],'character');id(c.id);string(c.name,60,'character name');position(c.position);number(c.health,0,100,'health');number(c.hunger,0,100,'hunger');
  object(c.xp,content.skillIds,'skills');for(const skill of content.skillIds)number(c.xp[skill],0,limits.maxXp,'XP');
  object(c.inventory,allItems.map(i=>i.id),'inventory');for(const [key,n]of Object.entries(c.inventory))number(n,0,allItems.find(i=>i.id===key).maxQuantity??100000,'item quantity');
  object(c.equipment,['tool'],'equipment');if(c.equipment.tool!==undefined){const item=content.items.find(i=>i.id===c.equipment.tool);if(!item?.tool||level(c.xp[item.tool.skill])<item.tool.requiredLevel||(c.inventory[item.id]??0)>0)invalid('equipped tool (level and separate ownership required)');}
  array(c.completedContractIds,content.contracts.length,'completed contracts');if(new Set(c.completedContractIds).size!==c.completedContractIds.length||c.completedContractIds.some(x=>!content.contracts.some(y=>y.id===x)))invalid('completed contract');
  return c;
}
export function validateScenario(input){
  if(JSON.stringify(input).length>64000)invalid('scenario size');
  const s=structuredClone(input);object(s,['format','catalogVersion','name','seed','tick','characters','nodes','contracts','competitors','faults','simulation','merchantStock'],'scenario fields');
  if(s.simulation!==undefined){object(s.simulation,['needsEnabled'],'simulation');if(typeof s.simulation.needsEnabled!=='boolean')invalid('needs enabled');}
  if(s.merchantStock!==undefined){const defaults=initialMerchantStock();object(s.merchantStock,Object.keys(defaults),'merchant stock');for(const key of Object.keys(defaults))number(s.merchantStock[key],0,100000,'merchant stock quantity');}
  if(s.format!=='sandbox-scenario-v1'||s.catalogVersion!==content.version)invalid('format or catalog version');string(s.name,80,'scenario name');number(s.seed,1,4294967295,'seed');number(s.tick,0,limits.totalTicks,'tick');
  array(s.characters,limits.characters,'characters');if(!s.characters.length)invalid('empty characters');s.characters.forEach(validateCharacter);unique(s.characters,'character');
  array(s.nodes,limits.nodes,'nodes');unique(s.nodes,'node');for(const n of s.nodes){object(n,['id','sourceId','position','remainingUses','availableAtTick'],'resource');id(n.id);const source=content.sources.find(x=>x.id===n.sourceId);if(!source)invalid('source');position(n.position);number(n.remainingUses,0,source.uses,'remaining uses');number(n.availableAtTick,0,limits.totalTicks+100,'regeneration tick');}
  object(s.contracts,content.contracts.map(x=>x.id),'contracts');for(const c of content.contracts)if(typeof s.contracts[c.id]!=='boolean')invalid('contract availability');
  array(s.competitors,limits.characters,'competitors');const used=new Set();for(const c of s.competitors){object(c,['agentId','nodeId','everyTicks','nextTick'],'competitor');if(!s.characters.some(a=>a.id===c.agentId)||!s.nodes.some(n=>n.id===c.nodeId)||used.has(c.agentId))invalid('competitor reference');used.add(c.agentId);number(c.everyTicks,1,1000,'competition interval');number(c.nextTick,s.tick,limits.totalTicks+1000,'competitor tick');}
  validateFaults(s.faults);return s;
}
