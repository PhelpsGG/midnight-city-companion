import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const directory=path.resolve(fileURLToPath(new URL('../../',import.meta.url)),'.local/sandbox');
export const publicAsset=route=>!route.includes('..')&&!/%(?:2e|2f|5c)/i.test(route)&&(/^\/(?:assets|characters|tilesets)\/[a-zA-Z0-9_./% -]+\.(?:png|webp|jpg|jpeg|svg|json|tsj|woff2)$/.test(route)||/^\/models\/city-neon\/(?:yard-[a-z-]+\.glb|modern-buildings-night\.hdr)$/.test(route));
export function validateModelAsset(route,data){
  if(route.endsWith('.glb')){
    if(data.length<20||data.toString('ascii',0,4)!=='glTF'||data.readUInt32LE(4)!==2||data.readUInt32LE(8)!==data.length||data.readUInt32LE(16)!==0x4e4f534a||20+data.readUInt32LE(12)>data.length)throw Error('Invalid GLB asset.');
    const json=JSON.parse(data.toString('utf8',20,20+data.readUInt32LE(12)));
    if([...(json.buffers??[]),...(json.images??[])].some(row=>row.uri&&!row.uri.startsWith('data:')))throw Error('GLB has external dependencies; cache them explicitly before enabling this model.');
  }
  if(route.endsWith('.hdr')&&!/^#\?(?:RADIANCE|RGBE)/.test(data.toString('ascii',0,20)))throw Error('Invalid HDR asset.');
}
export const cacheKey=route=>createHash('sha256').update(route).digest('hex');
export async function cachedAsset(route){
  if(!publicAsset(route))return null;
  try{const manifest=JSON.parse(await readFile(path.join(directory,'assets-index.json'),'utf8'));const row=manifest[route];if(!row)return null;return {data:await readFile(path.join(directory,'assets',cacheKey(route))),type:row.type};}catch{return null;}
}
