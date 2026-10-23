import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
try{
  const config=parseEnv(await readFile(new URL('../.env.render',import.meta.url),'utf8'));Object.assign(process.env,config);
  process.env.HOST='127.0.0.1';process.env.NODE_ENV='development';process.env.ALLOW_ADMIN_SETUP='false';process.env.PUBLIC_ORIGIN='http://localhost:'+(process.env.PORT||3000);
  await import('../server/index.mjs');
}catch{console.error('Chưa mở được bản Neon. Chạy npm run render:env rồi kiểm tra kết nối.');process.exitCode=1;}
