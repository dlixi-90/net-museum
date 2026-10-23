import {randomUUID} from 'node:crypto';
import {createCloudMedia,cloudUploadSpec} from './cloud-media.mjs';
import {HttpError} from './validation.mjs';
export function cloudUploadRoutes({db,admin,json,jsonBody,cloudMedia=createCloudMedia()}){
  const response=async row=>({id:row.id,offset:Number(row.offset_bytes||0),sizeBytes:Number(row.size_bytes),chunkSize:6*1024*1024,expiresAt:row.expires_at,completedResourceId:row.completed_resource_id,...(row.completed_resource_id?{}:cloudMedia.sign({id:row.id,mimeType:row.mime_type}))});
  return async(req,res,url)=>{
    if(url.pathname==='/api/cloud-uploads/init'&&req.method==='POST'){
      const user=await admin(req),body=await jsonBody(req),spec=cloudUploadSpec(body.mimeType);
      if(!Number.isSafeInteger(body.sizeBytes)||body.sizeBytes<1||body.sizeBytes>spec.limit)throw new HttpError(413,`Tệp vượt giới hạn ${Math.floor(spec.limit/1048576)} MiB của luồng tải cloud. Hạn mức Cloudinary có thể thấp hơn.`);
      if(typeof body.originalName!=='string'||!body.originalName.trim()||body.originalName.length>255||typeof body.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(body.fingerprint))throw new HttpError(422,'Thông tin tệp chưa hợp lệ.');
      const id=randomUUID(),signed=cloudMedia.sign({id,mimeType:body.mimeType});
      const row=(await db.query("INSERT INTO upload_intents(id,resource_type,uploaded_by,expires_at,storage,mime_type,size_bytes,original_name,fingerprint) VALUES($1,$2,$3,now()+interval '1 hour','cloudinary',$4,$5,$6,$7) RETURNING *",[id,spec.kind,user.id,body.mimeType,body.sizeBytes,body.originalName,body.fingerprint])).rows[0];
      json(res,201,{upload:{...await response(row),...signed}});return true;
    }
    const match=url.pathname.match(/^\/api\/cloud-uploads\/([a-f0-9-]{36})\/(status|progress|complete)$/);if(!match)return false;
    const user=await admin(req),id=match[1],op=match[2];
    const row=(await db.query("SELECT * FROM upload_intents WHERE id=$1 AND uploaded_by=$2 AND expires_at>now() AND storage='cloudinary' AND mime_type IS NOT NULL",[id,user.id])).rows[0];
    if(!row)throw new HttpError(422,'Phiên tải cloud không tồn tại hoặc hết hạn. Chọn lại tệp để bắt đầu mới.');
    if(op==='status'&&req.method==='GET'){json(res,200,{upload:await response(row)});return true;}
    if(op==='progress'&&req.method==='PUT'){
      const {offset}=await jsonBody(req);if(!Number.isSafeInteger(offset)||offset<0||offset>Number(row.size_bytes))throw new HttpError(422,'Vị trí tải chưa hợp lệ.');
      // A browser acknowledgement is only a resume hint; complete verifies the provider and actual file.
      await db.query('UPDATE upload_intents SET offset_bytes=GREATEST(offset_bytes,$1) WHERE id=$2',[offset,id]);json(res,200,{offset});return true;
    }
    if(op==='complete'&&req.method==='POST'){
      const media=await db.transaction(async tx=>{
        const locked=(await tx.query('SELECT * FROM upload_intents WHERE id=$1 FOR UPDATE',[id])).rows[0];
        if(locked.completed_resource_id)return tx.getMedia(locked.completed_resource_id);
        const asset=await cloudMedia.resolve({id,mimeType:locked.mime_type});
        if(locked.resource_type!=='image'&&asset.sizeBytes!==Number(locked.size_bytes))throw new HttpError(422,'Dung lượng tệp không khớp lượt tải đã khai báo.');
        const saved=await tx.insertMedia({id,...asset,uploadedBy:user.id,originalName:locked.original_name,title:locked.original_name.replace(/\.[^.]+$/,'').slice(0,200)});
        await tx.query('UPDATE upload_intents SET completed_resource_id=$1,offset_bytes=size_bytes WHERE id=$1',[id]);return saved;
      });json(res,201,{media});return true;
    }
    throw new HttpError(405,'Phương thức tải cloud chưa được hỗ trợ.');
  };
}
