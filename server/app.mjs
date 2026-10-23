import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import sharp from 'sharp';
import {HttpError,validateArtwork} from './validation.mjs';
import {getSession,newSession,sessionCookie,passwordHash,passwordMatches,validateCredentials,parseAdminEmails,accountRole} from './auth.mjs';
import {createCloudinaryStorage,IMAGE_LIMIT,VIDEO_LIMIT,imageTypes,videoTypes,validateVideo} from './media-storage.mjs';
import {featureRoutes} from './feature-routes.mjs';
import {clientAddress} from './request-client.mjs';
const publicDir=fileURLToPath(new URL('../dist/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
export function createRequestHandler({db,uploadDir=process.env.UPLOAD_DIR||fileURLToPath(new URL('../uploads/',import.meta.url)),mediaStorage=createCloudinaryStorage(),cloudMedia,uploadStorage=process.env.UPLOAD_STORAGE||'local',allowSetup=false,adminEmails=parseAdminEmails(),publicOrigin='',secureCookies=false,directUploads=false,onError=()=>{}}){
  if(!['local','cloudinary'].includes(uploadStorage))throw new Error('UPLOAD_STORAGE must be local or cloudinary');
  const administrators=parseAdminEmails(adminEmails);
  const attempts=new Map();
  const json=(res,status,body,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(body));};
  async function bodyBuffer(req,limit){
    if(Number(req.headers['content-length'])>limit){req.resume();throw new HttpError(413,'Tệp hoặc dữ liệu vượt quá dung lượng cho phép.');}
    let size=0;const chunks=[];
    for await(const chunk of req.iterator({destroyOnReturn:false})){size+=chunk.length;if(size>limit){req.resume();throw new HttpError(413,'Tệp hoặc dữ liệu vượt quá dung lượng cho phép.');}chunks.push(chunk);}
    return Buffer.concat(chunks);
  }
  async function jsonBody(req){if(!req.headers['content-type']?.startsWith('application/json'))throw new HttpError(415,'Yêu cầu dữ liệu JSON.');try{return JSON.parse((await bodyBuffer(req,256*1024)).toString());}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(400,'Dữ liệu JSON không hợp lệ.');}}
  function checkOrigin(req){
    const host=req.headers.host||'';const parsed=new URL(`http://${host}`);
    const local=['localhost','127.0.0.1','[::1]'].includes(parsed.hostname);
    const allowed=publicOrigin?new Set([publicOrigin]):new Set();
    if(local)for(const h of ['localhost','127.0.0.1','[::1]'])allowed.add(`http://${h}${parsed.port?':'+parsed.port:''}`);
    if(!local&&(!publicOrigin||new URL(publicOrigin).host!==host))throw new HttpError(403,'Máy chủ truy cập không hợp lệ.');
    if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&!allowed.has(req.headers.origin)))throw new HttpError(403,'Nguồn gửi yêu cầu không được phép.');
  }
  async function admin(req){const user=await getSession(req,db,administrators);if(!user)throw new HttpError(401,'Vui lòng đăng nhập để quản lý tác phẩm.');if(user.role!=='admin')throw new HttpError(403,'Tài khoản không có quyền quản trị.');return user;}
  const clean=a=>{const {_id,...result}=a;return result;};
  const features=featureRoutes({db,admin,json,jsonBody,bodyBuffer,publicDir,uploadDir,mediaStorage,cloudMedia,uploadStorage,onError});
  async function route(req,res,url){
    const pathname=url.pathname;
    if(req.method!=='GET'&&req.method!=='HEAD')checkOrigin(req);
    if(await features(req,res,url))return;
    if(pathname==='/api/health'&&req.method==='GET'){await db.ping();return json(res,200,{database:'postgresql',connected:true});}
    if(pathname==='/api/session'&&req.method==='GET'){
      const user=await getSession(req,db,administrators),setupAvailable=allowSetup&&administrators.size>0;
      return json(res,200,{user:user?{id:user.id,name:user.name,email:user.email,username:user.username,role:user.role}:null,directUploads,uploadStorage,cloudMaxMiB:Number(process.env.CLOUD_UPLOAD_MAX_MIB||100),resumableUploads:uploadStorage==='cloudinary'||process.env.VERCEL!=='1',setupAvailable,setupRequired:setupAvailable&&!await db.hasAdmin()});
    }
    if(pathname==='/api/auth/register'&&req.method==='POST'){
      const raw=await jsonBody(req),body=validateCredentials(raw,{setup:true});
      if(raw.confirmPassword!==body.password)throw new HttpError(422,'Mật khẩu nhập lại chưa khớp.',{confirmPassword:'Nhập lại đúng mật khẩu đã chọn.'});
      if(accountRole(body.email,administrators)==='admin')throw new HttpError(403,'Email này dành cho tài khoản quản trị. Vui lòng đăng nhập bằng tài khoản đã được cấp.',{email:'Dùng email khác để tạo tài khoản cá nhân.'});
      const address=clientAddress(req);
      const windowMs=15*60*1000,windowStart=Math.floor(Date.now()/windowMs)*windowMs;
      const limitId=createHash('sha256').update(`register:${address}:${windowStart}`).digest('hex');
      const attempt=await db.registrationAttempt(limitId,new Date(windowStart+windowMs));
      if(attempt>10)throw new HttpError(429,'Bạn đã thử đăng ký nhiều lần. Vui lòng thử lại sau 15 phút.');
      const user={_id:randomUUID(),name:body.name,email:body.email,username:body.username,role:'user',passwordHash:await passwordHash(body.password),createdAt:new Date()};
      try{await db.createUser(user);}catch(error){if(error.code==='23505')throw new HttpError(409,'Email đã được sử dụng. Bạn có thể đăng nhập bằng tài khoản này.',{email:'Email đã có tài khoản.'});throw error;}
      const token=await newSession(db,user);
      return json(res,201,{user:{id:user._id,name:user.name,email:user.email,username:body.username||user.email,role:'user'}},{'Set-Cookie':sessionCookie(token,{secure:secureCookies})});
    }
    if(pathname==='/api/auth/setup'&&req.method==='POST'){
      if(!allowSetup)throw new HttpError(403,'Thiết lập quản trị ban đầu chỉ được mở trong môi trường cục bộ.');
      if(await db.hasAdmin())throw new HttpError(409,'Quản trị viên đã được thiết lập. Vui lòng đăng nhập.');
      const body=validateCredentials(await jsonBody(req),{setup:true});
      if(accountRole(body.email,administrators)!=='admin')throw new HttpError(403,'Email này không được phép thiết lập tài khoản quản trị.');
      const user={_id:randomUUID(),name:body.name,email:body.email,role:'admin',passwordHash:await passwordHash(body.password),createdAt:new Date()};
      try{await db.createUser(user);}catch(e){if(e.code==='23505')throw new HttpError(409,'Tài khoản quản trị đã được thiết lập. Vui lòng đăng nhập.');throw e;}
      const token=await newSession(db,user);return json(res,201,{user:{name:user.name,email:user.email,role:'admin'}},{'Set-Cookie':sessionCookie(token,{secure:secureCookies})});
    }
    if(pathname==='/api/auth/login'&&req.method==='POST'){
      const ip=clientAddress(req);const record=attempts.get(ip);if(record&&record.until>Date.now()&&record.count>=8)throw new HttpError(429,'Đã thử đăng nhập quá nhiều lần. Hãy thử lại sau 15 phút.');
      const body=validateCredentials(await jsonBody(req));const user=await db.getUserByLogin(body.email);
      if(!user||user.active===false||!await passwordMatches(body.password,user.passwordHash)){
        const current=record?.until>Date.now()?record:{count:0,until:Date.now()+900000};current.count++;attempts.set(ip,current);throw new HttpError(401,'Email hoặc mật khẩu chưa đúng.');
      }
      attempts.delete(ip);const token=await newSession(db,user);return json(res,200,{user:{id:user._id,name:user.name,email:user.email,username:user.username,role:user.role}},{'Set-Cookie':sessionCookie(token,{secure:secureCookies})});
    }
    if(pathname==='/api/auth/logout'&&req.method==='POST'){
      const user=await getSession(req,db,administrators);if(user)await db.deleteSession(user.sessionId);return json(res,200,{ok:true},{'Set-Cookie':sessionCookie('',{secure:secureCookies,clear:true})});
    }
    if(pathname==='/api/artworks'&&req.method==='GET'){
      const items=await db.listArtworks();return json(res,200,{items,database:'postgresql'});
    }
    if(pathname==='/api/uploads/sign'&&req.method==='POST'){
      const user=await admin(req),body=await jsonBody(req);
      if(!body||![...imageTypes,...videoTypes].includes(body.mimeType))throw new HttpError(415,'Chỉ nhận ảnh JPG, PNG, WebP hoặc video MP4, WebM, MOV.');
      const resourceType=videoTypes.includes(body.mimeType)?'video':'image',limit=resourceType==='video'?VIDEO_LIMIT:IMAGE_LIMIT;
      if(!Number.isInteger(body.sizeBytes)||body.sizeBytes<1||body.sizeBytes>limit)throw new HttpError(413,'Tệp vượt quá dung lượng cho phép.');
      const id=randomUUID(),upload=mediaStorage.signUpload({id,resourceType});
      await db.createUploadIntent({id,resourceType,uploadedBy:user.id,expiresAt:new Date(Date.now()+3600000)});
      return json(res,201,{upload:{id,...upload}});
    }
    if(pathname==='/api/uploads/complete'&&req.method==='POST'){
      const user=await admin(req),body=await jsonBody(req);
      if(!body||typeof body.id!=='string'||!/^[a-f0-9-]{36}$/.test(body.id))throw new HttpError(422,'Mã tải lên không hợp lệ.');
      const existing=await db.getMedia(body.id,user.id);
      if(existing)return json(res,200,{media:clean(existing)});
      const intent=await db.getUploadIntent(body.id,user.id);
      if(!intent)throw new HttpError(422,'Phiên tải lên đã hết hạn. Hãy chọn lại tệp.');
      const asset=await mediaStorage.resolveUpload({id:body.id,resourceType:intent.resourceType});
      const media={id:body.id,...asset,uploadedBy:user.id,createdAt:new Date()};
      const saved=await db.insertMedia(media,{ignoreExisting:true});
      return json(res,201,{media:saved});
    }
    if(pathname==='/api/uploads'&&req.method==='POST'){
      const user=await admin(req),mimeType=req.headers['content-type']?.split(';')[0];
      if(![...imageTypes,...videoTypes].includes(mimeType))throw new HttpError(415,'Chỉ nhận ảnh JPG, PNG, WebP hoặc video MP4, WebM, MOV.');
      const resourceType=videoTypes.includes(mimeType)?'video':'image';
      mediaStorage.assertConfigured();
      const buffer=await bodyBuffer(req,resourceType==='video'?VIDEO_LIMIT:IMAGE_LIMIT);let output;
      if(resourceType==='image'){
      try{const meta=await sharp(buffer,{limitInputPixels:40000000,animated:false}).metadata();if(!['jpeg','png','webp'].includes(meta.format))throw new Error();output=await sharp(buffer,{limitInputPixels:40000000}).rotate().resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();}catch{throw new HttpError(422,'Không đọc được ảnh. Hãy chọn một tệp JPG, PNG hoặc WebP hợp lệ.');}
      }else{validateVideo(buffer,mimeType);output=buffer;}
      const id=randomUUID(),asset=await mediaStorage.upload(output,{id,resourceType});
      const media={id,...asset,sha256:createHash('sha256').update(output).digest('hex'),uploadedBy:user.id,createdAt:new Date()};
      try{await db.insertMedia(media);}catch(e){await mediaStorage.remove(asset).catch(onError);throw e;}
      return json(res,201,{media});
    }
    const match=pathname.match(/^\/api\/artworks\/([a-zA-Z0-9-]{1,64})$/);
    if(match&&req.method==='GET'){const item=await db.getArtwork(match[1]);if(!item)throw new HttpError(404,'Không tìm thấy tác phẩm.');return json(res,200,{item:clean(item)});}
    if((pathname==='/api/artworks'&&req.method==='POST')||(match&&req.method==='PUT')){
      const user=await admin(req),raw=await jsonBody(req),data=validateArtwork(raw);
      const media=await db.getMedia(data.imageId);if(!media||!media.mimeType?.startsWith('image/'))throw new HttpError(422,'Ảnh đại diện chưa được tải lên hoặc không còn tồn tại.',{imageId:'Hãy chọn và tải lại ảnh.'});
      const video=data.videoId?await db.getMedia(data.videoId):null;
      if(data.videoId&&(!video||!video.mimeType?.startsWith('video/')))throw new HttpError(422,'Video chưa được tải lên hoặc không hợp lệ.',{videoId:'Hãy chọn và tải lại video.'});
      Object.assign(data,{video:video?.url||'',videoMimeType:video?.mimeType||'',videoSizeBytes:video?.sizeBytes||0,videoDuration:video?.duration||0});
      Object.assign(data,{image:media.url,sizeBytes:media.sizeBytes,format:media.format,originalMedium:data.material,updatedAt:new Date()});
      let artwork;
      if(req.method==='POST'){
        artwork=await db.saveArtwork(data,{userId:user.id});
      }else{
        if(!Number.isInteger(raw.revision)||raw.revision<1)throw new HttpError(422,'Phiên bản tác phẩm không hợp lệ. Hãy tải lại danh sách.');
        artwork=await db.saveArtwork(data,{id:match[1],revision:raw.revision,userId:user.id});
        if(!artwork){if(!await db.getArtwork(match[1]))throw new HttpError(404,'Không tìm thấy tác phẩm.');throw new HttpError(409,'Tác phẩm đã được sửa ở cửa sổ khác. Tải lại danh sách rồi mở lại tác phẩm để tránh ghi đè.');}
      }
      return json(res,req.method==='POST'?201:200,{item:clean(artwork)});
    }
    if(pathname.startsWith('/api/'))throw new HttpError(404,'Không tìm thấy API.');
    if(!['GET','HEAD'].includes(req.method))throw new HttpError(405,'Phương thức không được hỗ trợ.');
    let root=publicDir,relative=decodeURIComponent(pathname).slice(1);
    if(pathname.startsWith('/uploads/')){root=uploadDir;relative=pathname.slice(9);if(!/^[a-f0-9-]{36}\.webp$/.test(relative))throw new HttpError(404,'Không tìm thấy ảnh.');}
    let file=path.resolve(root,relative||'index.html');const rel=path.relative(root,file);
    if(rel.startsWith('..')||path.isAbsolute(rel)||rel.split(path.sep).some(p=>p.startsWith('.')))throw new HttpError(404,'Không tìm thấy tệp.');
    try{if((await stat(file)).isDirectory())file=path.join(file,'index.html');const buffer=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:buffer);}catch{throw new HttpError(404,'Không tìm thấy trang.');}
  }
  return async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
    try{await route(req,res,new URL(req.url,'http://localhost'));}catch(e){if(res.headersSent){res.end();return;}if(e instanceof HttpError)return json(res,e.status,{error:e.message,...(e.fields?{fields:e.fields}:{})});onError(e);json(res,503,{error:'Chưa kết nối được cơ sở dữ liệu. Vui lòng thử lại sau.'});}
  };
}
export const createApp=options=>createServer(createRequestHandler(options));
