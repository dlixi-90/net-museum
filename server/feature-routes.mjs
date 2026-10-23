import {indexImages} from './image-index.mjs';
import {cloudUploadRoutes} from './cloud-uploads.mjs';
import {clientAddress} from './request-client.mjs';
import {unlink,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {imageFeatures,localMediaPath,serveMedia,FEATURE_VERSION} from './files.mjs';
import {localUploadRoutes,cleanupExpiredUploads} from './local-uploads.mjs';
import {resourceMetadata,searchFilters,userMetadata} from './feature-validation.mjs';
import {HttpError} from './validation.mjs';
import {getSession,passwordHash,validateCredentials} from './auth.mjs';

export function featureRoutes(options){
  const {db,admin,json,jsonBody,bodyBuffer,publicDir,uploadDir,mediaStorage}=options;
  const uploads=localUploadRoutes(options),cloudUploads=cloudUploadRoutes(options),current=req=>getSession(req,db),identifier='([a-zA-Z0-9-]{1,80})',queryLimits=new Map();
  async function user(req){const result=await current(req);if(!result)throw new HttpError(401,'Vui lòng đăng nhập.');return result;}
  async function readable(req,id){const resource=await db.getMedia(id);if(!resource)throw new HttpError(404,'Không tìm thấy tài nguyên.');if(!await db.canReadResource(id)&&(await current(req))?.role!=='admin')throw new HttpError(404,'Không tìm thấy tài nguyên.');return resource;}
  const eventKey=(req,url,id,action)=>createHash('sha256').update(`${id}:${action}:${url.searchParams.get('visitor')||req.headers['user-agent']+'|'+clientAddress(req)}:${Math.floor(Date.now()/3600000)}`).digest('hex');
  return async(req,res,url)=>{
    if(await cloudUploads(req,res,url)||await uploads(req,res,url))return true;
    const route=url.pathname;
    if(route==='/api/search'&&req.method==='GET'){json(res,200,await db.searchResources(searchFilters(url.searchParams)));return true;}
    if(route==='/api/stats'&&req.method==='GET'){json(res,200,await db.statistics());return true;}
    if((route==='/api/search/image'&&req.method==='POST')||(route==='/api/search/similar'&&req.method==='GET')){
      const key=clientAddress(req),now=Date.now(),limit=queryLimits.get(key)||{count:0,until:now+600000};if(limit.until<now){limit.count=0;limit.until=now+600000;}limit.count++;queryLimits.set(key,limit);if(limit.count>60)throw new HttpError(429,'Bạn đã tìm ảnh nhiều lần. Vui lòng thử lại sau.');
      const started=performance.now();let vector,sha='',excludeId='';
      if(req.method==='POST'){
        const mime=req.headers['content-type']?.split(';')[0];if(!['image/jpeg','image/png','image/webp'].includes(mime))throw new HttpError(415,'Chọn ảnh JPG, PNG hoặc WebP.');
        const buffer=await bodyBuffer(req,8*1024*1024);try{vector=await imageFeatures(buffer);}catch{throw new HttpError(422,'Ảnh truy vấn không hợp lệ.');}sha=createHash('sha256').update(buffer).digest('hex');
      }else{excludeId=url.searchParams.get('id')||'';await readable(req,excludeId);const indexed=await db.getImageVector(excludeId);if(!indexed?.vector||indexed.version!==FEATURE_VERSION)throw new HttpError(409,'Ảnh chưa được lập chỉ mục. Quản trị viên cần cập nhật chỉ mục ảnh.');vector=indexed.vector;}
      const items=await db.similarImages(vector,{excludeId,sha256:sha});
      json(res,200,{items,featureVersion:FEATURE_VERSION,elapsedMs:Math.round(performance.now()-started),indexedImages:(await db.query('SELECT COUNT(*)::int AS n FROM images WHERE color_vector IS NOT NULL AND feature_version=$1',[FEATURE_VERSION])).rows[0].n});return true;
    }
    if(route==='/api/favorites'&&req.method==='GET'){const account=await user(req);json(res,200,{ids:await db.favoriteIds(account.id)});return true;}
    let match=route.match(new RegExp('^/api/favorites/'+identifier+'$'));
    if(match&&['PUT','DELETE'].includes(req.method)){const account=await user(req);if(!await db.getArtwork(match[1]))throw new HttpError(404,'Tác phẩm không tồn tại.');await db.setFavorite(account.id,match[1],req.method==='PUT');json(res,200,{saved:req.method==='PUT'});return true;}
    if(route==='/api/users'&&req.method==='GET'){await admin(req);json(res,200,{items:await db.listUsers()});return true;}
    if(route==='/api/users'&&req.method==='POST'){
      await admin(req);const raw=await jsonBody(req),credentials=validateCredentials(raw,{setup:true});if(!['admin','user'].includes(raw.role))throw new HttpError(422,'Chọn quyền người dùng.');
      try{const created=await db.createUser({...credentials,passwordHash:await passwordHash(credentials.password),role:raw.role});json(res,201,{user:(await db.listUsers()).find(u=>u.id===created._id)});}catch(error){if(error.code==='23505')throw new HttpError(409,'Email hoặc tài khoản đã được sử dụng.');throw error;}return true;
    }
    match=route.match(new RegExp('^/api/users/'+identifier+'$'));
    if(match&&['PUT','DELETE'].includes(req.method)){
      const actor=await admin(req);
      if(req.method==='DELETE'){if(!await db.deleteUser(match[1],actor.id))throw new HttpError(404,'Người dùng không tồn tại.');json(res,200,{ok:true});return true;}
      const account=await db.getUser(match[1]);if(!account)throw new HttpError(404,'Người dùng không tồn tại.');const values=userMetadata(await jsonBody(req),account);if(values.password)values.passwordHash=await passwordHash(values.password);
      try{json(res,200,{user:await db.updateUser(match[1],values,actor.id)});}catch(error){if(error.code==='23505')throw new HttpError(409,'Tên tài khoản đã được sử dụng.');throw error;}return true;
    }
    match=route.match(new RegExp('^/api/artworks/'+identifier+'/resources$'));
    if(match&&req.method==='GET'){if(!await db.getArtwork(match[1]))throw new HttpError(404,'Tác phẩm không tồn tại.');json(res,200,{items:await db.artworkResources(match[1])});return true;}
    if(match&&req.method==='POST'){const actor=await admin(req);if(!await db.getArtwork(match[1]))throw new HttpError(404,'Tác phẩm không tồn tại.');const body=await jsonBody(req);if(typeof body.resourceId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(body.resourceId))throw new HttpError(422,'Mã tư liệu chưa hợp lệ.');await db.attachResource(match[1],body.resourceId,null,actor.id);json(res,200,{items:await db.artworkResources(match[1])});return true;}
    match=route.match(new RegExp('^/api/artworks/'+identifier+'$'));
    if(match&&req.method==='DELETE'){const actor=await admin(req);if(!await db.deleteArtwork(match[1],actor.id))throw new HttpError(404,'Tác phẩm không tồn tại.');json(res,200,{ok:true});return true;}
    if(route==='/api/resources'&&req.method==='GET'){await admin(req);json(res,200,await db.searchResources(searchFilters(url.searchParams),{all:true}));return true;}
    match=route.match(new RegExp('^/api/resources/'+identifier+'$'));
    if(match){
      if(req.method==='GET'){json(res,200,{resource:await readable(req,match[1])});return true;}
      if(req.method==='PUT'){const actor=await admin(req);const resource=await db.updateResource(match[1],resourceMetadata(await jsonBody(req)),actor.id);if(!resource)throw new HttpError(404,'Tài nguyên không tồn tại.');json(res,200,{resource});return true;}
      if(req.method==='DELETE'){const actor=await admin(req);if(!await db.deleteResource(match[1],actor.id))throw new HttpError(404,'Tài nguyên không tồn tại.');json(res,200,{ok:true});return true;}
    }
    match=route.match(new RegExp('^/api/resources/'+identifier+'/events$'));
    if(match&&req.method==='POST'){await readable(req,match[1]);const body=await jsonBody(req);if(body.action!=='view')throw new HttpError(422,'Loại sự kiện chưa hợp lệ.');await db.recordEvent(match[1],'view',eventKey(req,url,match[1],'view'),(await current(req))?.id);json(res,200,{ok:true});return true;}
    match=route.match(new RegExp('^/api/resources/'+identifier+'/file$'));
    if(match&&['GET','HEAD'].includes(req.method)){
      const resource=await readable(req,match[1]),download=url.searchParams.get('download')==='1';
      if(download&&req.method==='GET')await db.recordEvent(resource.id,'download',eventKey(req,url,resource.id,'download'),(await current(req))?.id);
      await serveMedia(req,res,resource,{publicDir,uploadDir},{download});return true;
    }
    if(/^\/uploads\/[a-f0-9-]{36}\.[a-z0-9]+$/.test(route)&&['GET','HEAD'].includes(req.method)){
      const row=(await db.query('SELECT id FROM resources WHERE storage_key=$1',[route])).rows[0];if(!row)throw new HttpError(404,'Không tìm thấy tệp.');await serveMedia(req,res,await readable(req,row.id),{publicDir,uploadDir});return true;
    }
    if(route==='/api/admin/index-images'&&req.method==='POST'){
      await admin(req);json(res,200,await indexImages(db,{publicDir,uploadDir}));return true;
    }
    if(route==='/api/admin/cleanup'&&req.method==='POST'){
      await admin(req);let removed=0,failed=0;const jobs=(await db.query('SELECT * FROM media_deletions WHERE completed_at IS NULL AND attempts<10 ORDER BY id LIMIT 100')).rows;
      for(const job of jobs){try{
        if(job.storage==='cloudinary'&&job.public_id)await mediaStorage.remove({publicId:job.public_id,resourceType:['audio','video'].includes(job.resource_type)?'video':['document','text'].includes(job.resource_type)?'raw':'image'});
        else if(job.storage_key.startsWith('/uploads/'))await unlink(localMediaPath(job.storage_key,{publicDir,uploadDir})).catch(error=>{if(error.code!=='ENOENT')throw error;});
        await db.query('UPDATE media_deletions SET completed_at=now(),attempts=attempts+1 WHERE id=$1',[job.id]);removed++;
      }catch{await db.query('UPDATE media_deletions SET attempts=attempts+1 WHERE id=$1',[job.id]);failed++;}}
      const expiredUploads=await cleanupExpiredUploads(db,uploadDir);json(res,200,{removed,failed,expiredUploads});return true;
    }
    return false;
  };
}
