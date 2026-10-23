import {loadEnvFile} from 'node:process';
import {connectDatabase,initializeDatabase} from '../server/db.mjs';
import {connectionHelp} from '../server/pg-config.mjs';
try{loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}
let client;
try{
  const connection=await connectDatabase();client=connection.client;
  await initializeDatabase(connection.db);
  const {rows}=await connection.db.query('SELECT COUNT(*)::int AS total FROM artifacts');
  console.log(`Đã khởi tạo PostgreSQL: ${rows[0].total} tác phẩm. Seed không ghi đè tác phẩm đã chỉnh sửa.`);
}catch(error){console.error(connectionHelp(error));process.exitCode=1;}
finally{await client?.close();}
