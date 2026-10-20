import {loadEnvFile} from 'node:process';
import {connectDatabase} from '../server/db.mjs';
import {connectionHelp} from '../server/mongo-config.mjs';
try{loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}
let client;
try{
  const connection=await connectDatabase();client=connection.client;await connection.db.command({ping:1});
  console.log('Kết nối MongoDB thành công. Lệnh kiểm tra chỉ ping, chưa tạo hoặc thay đổi dữ liệu.');
}catch(error){console.error(connectionHelp(error,{atlas:process.env.MONGODB_URI?.startsWith('mongodb+srv://')}));process.exitCode=1;}
finally{await client?.close();}
