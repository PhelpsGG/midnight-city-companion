import {readFileSync} from 'node:fs';
export const contractCatalog=JSON.parse(readFileSync(new URL('../game-catalog.json',import.meta.url),'utf8')).content;
export const contractIds=new Set(contractCatalog.contracts.map(c=>c.id));
