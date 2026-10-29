import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
for(const directory of ['server','web','scripts','database','dist']){
  for(const file of await readdir(directory)){
    if(!/\.(mjs|js)$/.test(file))continue;
    const result=spawnSync(process.execPath,['--check',path.join(directory,file)],{stdio:'inherit',windowsHide:true});
    if(result.status!==0)process.exit(result.status||1);
  }
}
