import {loadEnvFile} from 'node:process';
import {connectDatabase,initializeDatabase} from './db.mjs';
import {createApp} from './app.mjs';
try{loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}
const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT)||3000;
const local=['127.0.0.1','localhost','::1'].includes(host),production=process.env.NODE_ENV==='production';
let client,server;
try{
  const connection=await connectDatabase();client=connection.client;await initializeDatabase(connection.db);
  server=createApp({db:connection.db,allowSetup:local&&!production&&process.env.ALLOW_ADMIN_SETUP!=='false',publicOrigin:process.env.PUBLIC_ORIGIN||'',secureCookies:production,onError:e=>console.error('Request failed:',e.name)});
  server.listen(port,host,()=>console.log(`Nét + MongoDB is ready at http://${host}:${port}\nQuản lý tác phẩm: mở nút “Quản lý tác phẩm” trên website.`));
}catch(e){console.error('Không khởi động được backend. Hãy chạy npm run db:start hoặc kiểm tra MONGODB_URI trong .env.');await client?.close();process.exitCode=1;}
let stopping=false;
async function stop(){if(stopping)return;stopping=true;if(server)await new Promise(r=>server.close(r));await client?.close();}
process.on('SIGINT',()=>stop().then(()=>process.exit()));process.on('SIGTERM',()=>stop().then(()=>process.exit()));
