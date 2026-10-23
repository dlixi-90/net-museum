import {loadEnvFile} from 'node:process';
import {fileURLToPath} from 'node:url';
import {connectDatabase,initializeDatabase} from '../server/db.mjs';
import {indexImages} from '../server/image-index.mjs';
try{loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
const {db,client}=await connectDatabase();try{await initializeDatabase(db);console.log(JSON.stringify(await indexImages(db,{publicDir:fileURLToPath(new URL('../dist/',import.meta.url)),uploadDir:fileURLToPath(new URL('../uploads/',import.meta.url))})));}finally{await client.close();}
