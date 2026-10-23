import {loadEnvFile} from 'node:process';
import {connectDatabase,initializeDatabase} from './db.mjs';
import {createApp} from './app.mjs';
import {connectionHelp} from './pg-config.mjs';
try{loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}
const host=process.env.HOST||(process.env.RENDER?'0.0.0.0':'127.0.0.1'),port=Number(process.env.PORT)||3000;
const local=['127.0.0.1','localhost','::1'].includes(host),production=process.env.NODE_ENV==='production';
let client,server;
try{
  const connection=await connectDatabase();client=connection.client;await initializeDatabase(connection.db);
  server=createApp({db:connection.db,allowSetup:local&&!production&&process.env.ALLOW_ADMIN_SETUP!=='false',publicOrigin:process.env.PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL||'',secureCookies:production,onError:e=>console.error('Request failed:',e.name)});
  server.listen(port,host,()=>console.log(`Nét + PostgreSQL is ready at http://${host}:${port}\nMở “Đăng nhập”; tài khoản có quyền admin sẽ thấy nút “Quản lý”.`));
}catch(e){console.error('Không khởi động được backend. '+connectionHelp(e));await client?.close();process.exitCode=1;}
let stopping=false;
async function stop(){if(stopping)return;stopping=true;if(server)await new Promise(r=>server.close(r));await client?.close();}
process.on('SIGINT',()=>stop().then(()=>process.exit()));process.on('SIGTERM',()=>stop().then(()=>process.exit()));
