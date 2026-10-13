import {mkdir,open,readFile,rename,unlink,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const digest=s=>createHash('sha256').update(s).digest('hex');
const encode=state=>{const payload=JSON.stringify(state);return JSON.stringify({format:'companion-mission-save-v1',sha256:digest(payload),payload});};
function decode(raw){const envelope=JSON.parse(raw);if(envelope.format!=='companion-mission-save-v1')throw Error('Unsupported save format; preserve this save for migration.');if(digest(envelope.payload)!==envelope.sha256)throw Error('Save checksum mismatch');return JSON.parse(envelope.payload);}
async function atomic(path,raw){const temp=path+'.'+randomUUID()+'.tmp';const file=await open(temp,'wx');try{await file.writeFile(raw);await file.sync();}finally{await file.close();}try{await rename(temp,path);}catch(e){await unlink(temp).catch(()=>{});throw e;}}

export class MissionStore {
 static async open(directory,validate){
  await mkdir(directory,{recursive:true});const store=new MissionStore(directory);const lock=join(directory,'writer.lock');
  for(let attempt=0;attempt<2;attempt++){
   try{const handle=await open(lock,'wx');store.lockToken=JSON.stringify({pid:process.pid,id:randomUUID()});await handle.writeFile(store.lockToken);await handle.close();break;}
   catch(e){if(e.code!=='EEXIST')throw e;let raw,owner;try{raw=await readFile(lock,'utf8');owner=JSON.parse(raw);}catch{throw Error('Save writer lock is unreadable; inspect it before recovery.');}
    let dead=false;try{process.kill(owner.pid,0);}catch(error){if(error.code==='ESRCH')dead=true;}
    if(!dead||attempt)throw Error('This sandbox save is already running in another service.');
    if(await readFile(lock,'utf8')===raw)await unlink(lock);
   }
  }
  try{
   let found=false;
   for(const [index,name] of ['state.json','state.backup.json'].entries()){
    try{const raw=await readFile(join(directory,name),'utf8');found=true;const state=decode(raw);validate(state);store.state=state;store.lastGood=raw;store.recovered=index===1;return store;}
    catch(e){if(e.message.startsWith('Unsupported'))throw e;if(e.code!=='ENOENT'){found=true;store.loadError=e.message;}}
   }
   if(found)throw Error('No valid sandbox save or backup. Existing files have been preserved.');return store;
  }catch(e){await store.close();throw e;}
 }
 constructor(directory){this.directory=directory;this.lastGood=null;this.state=null;this.recovered=false;}
 async save(state){
  if(await readFile(join(this.directory,'writer.lock'),'utf8')!==this.lockToken)throw Error('Save ownership changed; execution stopped.');
  if(this.recovered){await copyFile(join(this.directory,'state.json'),join(this.directory,'state.corrupt-'+randomUUID()+'.json')).catch(e=>{if(e.code!=='ENOENT')throw e;});this.recovered=false;}
  const raw=encode(state);if(this.lastGood)await atomic(join(this.directory,'state.backup.json'),this.lastGood);
  await atomic(join(this.directory,'state.json'),raw);this.lastGood=raw;
 }
 async close(){if(!this.lockToken)return;const lock=join(this.directory,'writer.lock');try{if(await readFile(lock,'utf8')===this.lockToken)await unlink(lock);}catch(e){if(e.code!=='ENOENT')throw e;}this.lockToken=null;}
}
