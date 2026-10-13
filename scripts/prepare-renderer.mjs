import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {rendererSources} from './renderer-source.mjs';
const root=new URL('../.local/renderer/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('./renderer-manifest.json',import.meta.url),'utf8'));
await mkdir(root,{recursive:true});
let count=0;
try{
 for(const row of manifest.resources){
  if(!/^https:\/\/midnight\.city\/assets\/[A-Za-z0-9_.-]+\.js\.map$/.test(row.url))throw Error('Invalid renderer manifest URL.');
  const response=await fetch(row.url,{redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`Pinned renderer resource is unavailable (${response.status}).`);
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>16*1024*1024)throw Error('Renderer map exceeds the size limit.');
  if(createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw Error('Pinned renderer content changed. Review/update the manifest before building.');
  for(const entry of rendererSources(JSON.parse(bytes.toString('utf8')))){
   const dest=new URL(entry.path,root);if(!dest.href.startsWith(root.href))throw Error('Unsafe source path.');
   await mkdir(new URL('.',dest),{recursive:true});await writeFile(dest,entry.content);count++;
  }
 }
 const readPublic=async route=>{const res=await fetch('https://midnight.city/observer'+route,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!res.ok)throw Error('Public world definitions unavailable.');return res.json();};
 const bootstrap=await readPublic('/api/spectator/bootstrap');
 const definitions=await readPublic('/api/static-world/'+encodeURIComponent(bootstrap.staticVersion));
 if(definitions.staticVersion!==bootstrap.staticVersion||!Array.isArray(definitions.staticWorld?.spaces))throw Error('Public world definitions changed. Retry setup.');
 // Store authored geometry only, never observed players or their histories.
 const {spaces,areas,interactables,workstations}=definitions.staticWorld;
 await writeFile(new URL('geometry.json',root),JSON.stringify({spaces,areas,interactables,workstations}));
 await writeFile(new URL('provenance.json',root),JSON.stringify({preparedAt:new Date().toISOString(),...manifest},null,2));
 console.log(`Prepared ${count} published modules in ignored .local/renderer. Upstream code/art belongs to Midnight City.`);
}catch(e){console.error(`Renderer setup stopped: ${e.message} No agent was connected. Public upstream artifacts are required; see README.`);process.exitCode=1;}
