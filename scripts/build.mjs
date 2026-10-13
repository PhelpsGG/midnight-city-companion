import {build} from 'esbuild';
import {mkdir,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),source=fileURLToPath(new URL('.local/renderer/src',root));
try{await access(new URL('.local/renderer/provenance.json',root));}catch{throw Error('Native renderer is not prepared. Run npm run setup first.');}
for(const [entry,name] of [['client/live/main.js','client'],['client/hybrid/mission/main.js','sandbox']]){
 await mkdir(new URL('.local/build/',root),{recursive:true});
 await build({entryPoints:[fileURLToPath(new URL(entry,root))],outfile:fileURLToPath(new URL(`.local/build/${name}.js`,root)),bundle:true,format:'esm',platform:'browser',target:'es2022',alias:{'@':source},define:{'import.meta.env':JSON.stringify({DEV:false,MODE:'production'})},plugins:[{name:'companion-boundary',setup(b){
  b.onResolve({filter:/^@\/game\/(bankAtm|workstationOverlay)$/},a=>({path:a.path,namespace:'omit'}));b.onLoad({filter:/.*/,namespace:'omit'},()=>({contents:'export const attachBankAtm=()=>null;export const attachWorkstations=async()=>({isOpen:()=>false,dispose(){}});'}));
  b.onResolve({filter:/^@\/i18n$/},()=>({path:'labels',namespace:'labels'}));b.onLoad({filter:/.*/,namespace:'labels'},()=>({contents:'export const t=x=>x;'}));
 }}]});
}
console.log('Built local client and isolated mission sandbox.');
