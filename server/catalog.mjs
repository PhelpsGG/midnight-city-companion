import {readFile} from 'node:fs/promises';
import {ConnectionError} from './connection.mjs';
let saved;
export async function lookupCatalog({kind,query=''}){
 if(!['items','recipes','sources','contracts','stations'].includes(kind)||typeof query!=='string'||query.length>120)throw new ConnectionError('Choose a supported catalog collection and short search.',400);
 saved??=JSON.parse(await readFile(new URL('../client/hybrid/game-catalog.json',import.meta.url),'utf8'));
 const rows=(saved.content[kind]??[]).filter(r=>JSON.stringify([r.id,r.name]).toLowerCase().includes(query.toLowerCase()));
 return {provenance:'Saved public catalog; may differ from current game. Validate current capabilities before acting. Synthetic sandbox actions have separate authored rules.',kind,total:rows.length,results:rows.slice(0,20)};
}
