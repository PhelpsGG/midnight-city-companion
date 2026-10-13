import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicResource} from '../../../server/public-world.mjs';
import {createMissionServer} from './server.mjs';
const files={'/':['../index.html','text/html'],'/style.css':['../style.css','text/css'],'/mission.css':['./style.css','text/css'],'/contracts.css':['../contracts/style.css','text/css'],'/discovery.css':['../discovery/style.css','text/css'],'/client.js':['../../../.local/build/sandbox.js','text/javascript']};
const service=await createMissionServer({port:62762,directory:fileURLToPath(new URL('../../../.local/sandbox-save/',import.meta.url)),staticWorld:JSON.parse(await readFile(new URL('../../../.local/renderer/geometry.json',import.meta.url),'utf8')),async assetHandler(route,res){
 if(files[route]){const [path,type]=files[route];let data=await readFile(new URL(path,import.meta.url));if(route==='/')data=data.toString().replace('</title>','</title><link rel="stylesheet" href="/mission.css"><link rel="stylesheet" href="/contracts.css"><link rel="stylesheet" href="/discovery.css">');res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'}).end(data);return true;}
 const asset=await publicResource(route);if(!asset)return false;res.writeHead(200,{'Content-Type':asset.type}).end(asset.data);return true;
}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{void service.close().then(()=>process.exit(0));});
console.log('Durable mission sandbox http://127.0.0.1:62762/ — synthetic character; public artwork only');
