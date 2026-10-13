import {readdir} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
const roots=['client','server','ai','scripts','tests'];let files=0;
async function check(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())await check(p);else if(/\.(mjs|js)$/.test(e.name)){const result=spawnSync(process.execPath,['--check',p],{encoding:'utf8',windowsHide:true});if(result.status!==0){process.stderr.write(result.stderr);process.exitCode=1;}files++;}}}
for(const root of roots)await check(root);console.log(`Syntax checked ${files} JavaScript modules.`);
