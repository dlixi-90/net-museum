import {mkdir,open,stat,rename,writeFile,unlink,readdir} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {uploadTypes,inspectFile} from './files.mjs';
import {HttpError} from './validation.mjs';

export async function cleanupExpiredUploads(db,uploadDir){
  const staging=path.join(uploadDir,'.staging');let removed=0;
  const expired=(await db.query("SELECT id FROM upload_intents WHERE storage='local' AND expires_at<=now() LIMIT 100")).rows;
  for(const {id} of expired){if(!/^[a-f0-9-]{36}$/.test(id))continue;await unlink(path.join(staging,id+'.part')).catch(error=>{if(error.code!=='ENOENT')throw error;});await db.query("DELETE FROM upload_intents WHERE id=$1 AND expires_at<=now()",[id]);removed++;}
  let files=[];try{files=await readdir(staging);}catch(error){if(error.code!=='ENOENT')throw error;}
  for(const file of files.filter(f=>/^[a-f0-9-]{36}\.part$/.test(f)).slice(0,100)){
    const filename=path.join(staging,file),info=await stat(filename).catch(()=>null);if(!info||info.mtimeMs>Date.now()-86400000)continue;
    if(!(await db.query('SELECT 1 FROM upload_intents WHERE id=$1',[file.slice(0,-5)])).rowCount){await unlink(filename).catch(()=>{});removed++;}
  }
  return removed;
}

export function localUploadRoutes({db,admin,json,jsonBody,bodyBuffer,uploadDir,uploadStorage='local'}){
  const staging=path.join(uploadDir,'.staging');
  return async(req,res,url)=>{
    if(url.pathname==='/api/uploads/init'&&req.method==='POST'){
      const actor=await admin(req);if(process.env.VERCEL==='1'||uploadStorage!=='local')throw new HttpError(503,'Máy chủ đang dùng kho cloud. Sử dụng luồng tải trực tiếp lên kho tệp.');
      await cleanupExpiredUploads(db,uploadDir);
      const body=await jsonBody(req),spec=uploadTypes[body.mimeType];
      if(!spec)throw new HttpError(415,'Định dạng chưa được hỗ trợ.');
      if(!Number.isSafeInteger(body.sizeBytes)||body.sizeBytes<1||body.sizeBytes>spec.limit)throw new HttpError(413,'Tệp vượt giới hạn: ảnh 8 MiB, audio 64 MiB, video 1 GiB, PDF/DOCX 20 MiB, TXT 5 MiB.');
      if(typeof body.originalName!=='string'||!body.originalName.trim()||body.originalName.length>255||typeof body.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(body.fingerprint))throw new HttpError(422,'Thông tin tệp tải lên chưa hợp lệ.');
      await mkdir(staging,{recursive:true});const id=randomUUID();const handle=await open(path.join(staging,id+'.part'),'wx');await handle.close();
      try{await db.query("INSERT INTO upload_intents(id,resource_type,uploaded_by,expires_at,storage,mime_type,size_bytes,original_name,fingerprint) VALUES($1,$2,$3,now()+interval '24 hours','local',$4,$5,$6,$7)",[id,spec.kind,actor.id,body.mimeType,body.sizeBytes,body.originalName,body.fingerprint]);}
      catch(error){await unlink(path.join(staging,id+'.part')).catch(()=>{});throw error;}
      json(res,201,{upload:{id,offset:0,sizeBytes:body.sizeBytes,chunkSize:6*1024*1024}});return true;
    }
    const match=url.pathname.match(/^\/api\/uploads\/([a-f0-9-]{36})\/(status|chunk|complete)$/);if(!match)return false;
    const actor=await admin(req),id=match[1],operation=match[2];
    const intent=(await db.query("SELECT * FROM upload_intents WHERE id=$1 AND uploaded_by=$2 AND expires_at>now() AND storage='local'",[id,actor.id])).rows[0];
    if(!intent)throw new HttpError(422,'Phiên tải lên không tồn tại hoặc đã hết hạn.');
    if(operation==='status'&&req.method==='GET'){
      if(!intent.completed_resource_id){let bytes=0;try{bytes=(await stat(path.join(staging,id+'.part'))).size;}catch{}if(bytes<Number(intent.offset_bytes))throw new HttpError(409,'Tệp tải dở không còn. Hãy bắt đầu lượt tải mới.');}
      json(res,200,{upload:{id,offset:Number(intent.offset_bytes),sizeBytes:Number(intent.size_bytes),completedResourceId:intent.completed_resource_id}});return true;
    }
    if(operation==='chunk'&&req.method==='PUT'){
      const offset=Number(req.headers['upload-offset']);if(!Number.isSafeInteger(offset)||offset<0)throw new HttpError(422,'Vị trí khối dữ liệu chưa hợp lệ.');
      const buffer=await bodyBuffer(req,6*1024*1024);if(!buffer.length)throw new HttpError(422,'Khối dữ liệu rỗng.');
      const uploaded=await db.transaction(async tx=>{
        const row=(await tx.query('SELECT * FROM upload_intents WHERE id=$1 FOR UPDATE',[id])).rows[0];
        if(row.completed_resource_id||Number(row.offset_bytes)!==offset)throw new HttpError(409,'Vị trí tải đã thay đổi. Lấy trạng thái và tiếp tục.');
        if(offset+buffer.length>Number(row.size_bytes))throw new HttpError(413,'Tổng dữ liệu vượt dung lượng đã khai báo.');
        const handle=await open(path.join(staging,id+'.part'),'r+');
        try{
          if((await handle.stat()).size<offset)throw new HttpError(409,'Tệp tải dở đã mất. Hãy bắt đầu lượt tải mới.');
          await handle.truncate(offset);let written=0;
          while(written<buffer.length){const result=await handle.write(buffer,written,buffer.length-written,offset+written);if(!result.bytesWritten)throw new Error('No bytes written');written+=result.bytesWritten;}
          await handle.sync();
        }finally{await handle.close();}
        await tx.query('UPDATE upload_intents SET offset_bytes=$1 WHERE id=$2',[offset+buffer.length,id]);return offset+buffer.length;
      });
      json(res,200,{offset:uploaded});return true;
    }
    if(operation==='complete'&&req.method==='POST'){
      let moved=null,converted=false,source=path.join(staging,id+'.part');
      try{
        const media=await db.transaction(async tx=>{
          const row=(await tx.query('SELECT * FROM upload_intents WHERE id=$1 FOR UPDATE',[id])).rows[0];
          if(row.completed_resource_id)return tx.getMedia(row.completed_resource_id);
          if(Number(row.offset_bytes)!==Number(row.size_bytes))throw new HttpError(409,'Tệp chưa tải đủ dữ liệu.');
          const metadata=await inspectFile(source,row.mime_type),destination=path.join(uploadDir,id+'.'+metadata.extension);
          if(metadata.buffer){await writeFile(destination,metadata.buffer,{flag:'wx'});converted=true;}else await rename(source,destination);
          moved=destination;
          const hash=createHash('sha256');for await(const chunk of createReadStream(destination))hash.update(chunk);
          const {buffer,...details}=metadata;
          const result=await tx.insertMedia({id,...details,storage:'local',url:'/uploads/'+path.basename(destination),title:row.original_name.replace(/\.[^.]+$/,'').slice(0,200),originalName:row.original_name,uploadedBy:actor.id,sha256:hash.digest('hex')});
          await tx.query('UPDATE upload_intents SET completed_resource_id=$1 WHERE id=$1',[id]);return result;
        });
        if(converted)await unlink(source).catch(()=>{});json(res,201,{media});return true;
      }catch(error){if(moved){if(converted)await unlink(moved).catch(()=>{});else await rename(moved,source).catch(()=>{});}throw error;}
    }
    throw new HttpError(405,'Phương thức tải tệp không được hỗ trợ.');
  };
}
