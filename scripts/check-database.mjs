import {loadEnvFile} from 'node:process';
import {connectDatabase} from '../server/db.mjs';
import {connectionHelp} from '../server/pg-config.mjs';
try{loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}
let client;
try{
  const connection=await connectDatabase();client=connection.client;await connection.db.ping();
  console.log('Kết nối PostgreSQL thành công. Lệnh kiểm tra chỉ SELECT 1, chưa tạo hoặc thay đổi dữ liệu.');
}catch(error){console.error(connectionHelp(error));process.exitCode=1;}
finally{await client?.close();}
