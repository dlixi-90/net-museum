import {loadEnvFile} from 'node:process';
import {fileURLToPath} from 'node:url';
import {stat} from 'node:fs/promises';
import {connectDatabase} from '../server/db.mjs';
import {createCloudMedia,cloudUploadSpec} from '../server/cloud-media.mjs';
import {localMediaPath} from '../server/files.mjs';
try{loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
const apply=process.argv.includes('--apply'),{db,client}=await connectDatabase();
try{
  const rows=(await db.listMedia()).filter(r=>r.url.startsWith('/uploads/'));
  const roots={publicDir:fileURLToPath(new URL('../dist/',import.meta.url)),uploadDir:process.env.UPLOAD_DIR||fileURLToPath(new URL('../uploads/',import.meta.url))};
  const cloud=createCloudMedia();let published=0;
  for(const media of rows){
    const filename=localMediaPath(media.url,roots),info=await stat(filename),spec=cloudUploadSpec(media.mimeType);if(info.size>spec.limit)throw new Error('Một tệp vượt giới hạn cloud. Điều chỉnh CLOUD_UPLOAD_MAX_MIB theo hạn mức tài khoản trước khi chuyển.');
    if(!apply)continue;
    const asset=await cloud.publishFile(filename,{id:media.id,mimeType:media.mimeType});
    await db.transaction(async tx=>{await tx.migrateMediaAsset(media.id,media.url,asset);if(asset.colorVector)await tx.setImageVector(media.id,asset.colorVector,asset.featureVersion,asset.sha256);});published++;
  }
  console.log(JSON.stringify({localFiles:rows.length,published,applied:apply,originalFilesPreserved:true,next:apply?'npm run db:neon:migrate':'npm run media:publish -- --apply'}));
}catch(error){console.error(error.code?'Chưa chuyển được tệp. Kiểm tra cấu hình, file nguồn và kết nối; file gốc được giữ.':error.message);process.exitCode=1;}
finally{await client.close();}
