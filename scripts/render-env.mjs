import {readFile,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {validateConnectionUri,validateSchema} from '../server/pg-config.mjs';
import {cloudinaryConfig} from '../server/media-storage.mjs';
try{
  const local=parseEnv(await readFile(new URL('../.env',import.meta.url),'utf8')),neon=parseEnv(await readFile(new URL('../.env.neon',import.meta.url),'utf8'));
  const uri=neon.NEON_DATABASE_URL;validateConnectionUri(uri);if(!new URL(uri).hostname.endsWith('.neon.tech'))throw new Error('Dùng Direct URL của Neon.');
  const schema=neon.PG_SCHEMA||'net_museum_import';validateSchema(schema);cloudinaryConfig(local);
  const secure=new URL(uri);secure.searchParams.set('sslmode','verify-full');
  const values={DATABASE_URL:secure.href,PG_SCHEMA:schema,PG_POOL_MAX:'3',PG_CONNECT_TIMEOUT_MS:'15000',NODE_ENV:'production',HOST:'0.0.0.0',UPLOAD_STORAGE:'cloudinary',CLOUD_UPLOAD_MAX_MIB:'100',ALLOW_ADMIN_SETUP:'false',CLOUDINARY_CLOUD_NAME:local.CLOUDINARY_CLOUD_NAME,CLOUDINARY_API_KEY:local.CLOUDINARY_API_KEY,CLOUDINARY_API_SECRET:local.CLOUDINARY_API_SECRET};
  await writeFile(new URL('../.env.render',import.meta.url),'# Private: import into Render Environment, never commit or share.\n'+Object.entries(values).map(([key,value])=>key+'='+JSON.stringify(value)).join('\n')+'\n',{mode:0o600,flag:process.argv.includes('--overwrite')?'w':'wx'});
  console.log('Đã tạo .env.render chứa cấu hình Neon + Cloudinary. File được Git bỏ qua; không in giá trị bí mật.');
}catch(error){console.error(error.code==='EEXIST'?'.env.render đã có; giữ nguyên. Nếu cần tạo lại, chạy npm run render:env -- --overwrite.':'Chưa tạo cấu hình Render. Kiểm tra .env, .env.neon và Direct URL có TLS.');process.exitCode=1;}
