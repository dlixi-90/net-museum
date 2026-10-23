import {loadEnvFile} from 'node:process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import {connectDatabase} from '../server/db.mjs';
import {createCloudinaryStorage} from '../server/media-storage.mjs';
import {HttpError} from '../server/validation.mjs';
try{loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}
const apply=process.argv.includes('--apply'),storage=createCloudinaryStorage();
const root=fileURLToPath(new URL('../',import.meta.url));
let client;
try{
  if(apply)storage.assertConfigured();
  const connection=await connectDatabase();client=connection.client;const db=connection.db;
  const media=await db.listMedia();let pending=0,synced=0;
  for(const entry of media){
    let asset=entry;
    if(entry.storage!=='cloudinary'){
      const uploaded=/^\/uploads\/[a-f0-9-]{36}\.webp$/.test(entry.url);
      const sample=/^\/assets\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(entry.url);
      if(!uploaded&&!sample)continue;
      pending++;
      if(!apply)continue;
      if(!/^[a-zA-Z0-9-]{1,80}$/.test(entry.id))throw new Error('Invalid media identifier');
      const file=path.resolve(root,sample?'dist'+entry.url:entry.url.slice(1));
      const buffer=await readFile(file);
      const output=await sharp(buffer,{limitInputPixels:40000000}).rotate().resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
      asset=await storage.upload(output,{id:entry.id,resourceType:'image'});
      asset.sha256=createHash('sha256').update(output).digest('hex');
      try{synced+=await db.migrateMediaAsset(entry.id,entry.url,asset);}
      catch(error){await storage.remove(asset).catch(()=>{});throw error;}
    }
  }
  console.log(apply?`Đã chuyển ${pending} ảnh sang Cloudinary và cập nhật ${synced} hồ sơ. Tệp gốc trên máy được giữ lại.`:`Có ${pending} ảnh trên máy có thể chuyển sang Cloudinary. Chưa thay đổi dữ liệu. Chạy npm.cmd run media:migrate -- --apply để thực hiện.`);
}catch(error){console.error(error instanceof HttpError?error.message:'Chưa hoàn tất chuyển ảnh. Kiểm tra kết nối PostgreSQL/Cloudinary và tệp gốc. Có thể chạy lại; ảnh đã chuyển được bỏ qua và tệp trên máy được giữ lại.');process.exitCode=1;}
finally{await client?.close();}
