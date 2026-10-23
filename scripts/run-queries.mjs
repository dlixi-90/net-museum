import {loadEnvFile} from 'node:process';
import {readFile} from 'node:fs/promises';
import {connectDatabase} from '../server/db.mjs';
import {connectionHelp} from '../server/pg-config.mjs';
try{loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
let client;
try{
  const connection=await connectDatabase();client=connection.client;
  const results=await connection.db.query(await readFile(new URL('../database/queries.sql',import.meta.url),'utf8'));
  for(const [index,result] of results.entries())console.log(`SQL ${String(index+1).padStart(2,'0')}: ${result.rowCount} dòng`);
  if(results.length!==15)throw new Error('Expected 15 statements');
}catch(error){console.error(connectionHelp(error));process.exitCode=1;}finally{await client?.close();}
