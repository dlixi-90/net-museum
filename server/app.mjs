import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import sharp from 'sharp';
import {HttpError,validateArtwork} from './validation.mjs';
import {getSession,newSession,sessionCookie,passwordHash,passwordMatches,validateCredentials,parseAdminEmails,accountRole} from './auth.mjs';
import {createCloudinaryStorage,IMAGE_LIMIT,VIDEO_LIMIT,imageTypes,videoTypes,validateVideo} from './media-storage.mjs';
const publicDir=fileURLToPath(new URL('../dist/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
export function createApp({db,uploadDir=fileURLToPath(new URL('../uploads/',import.meta.url)),mediaStorage=createCloudinaryStorage(),allowSetup=false,adminEmails=parseAdminEmails(),publicOrigin='',secureCookies=false,onError=()=>{}}){
  const administrators=parseAdminEmails(adminEmails);
  const attempts=new Map();
  const json=(res,status,body,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(body));};
  async function bodyBuffer(req,limit){
    if(Number(req.headers['content-length'])>limit){req.resume();throw new HttpError(413,'Tệp hoặc dữ liệu vượt quá dung lượng cho phép.');}
    let size=0;const chunks=[];
    for await(const chunk of req.iterator({destroyOnReturn:false})){size+=chunk.length;if(size>limit){req.resume();throw new HttpError(413,'Tệp hoặc dữ liệu vượt quá dung lượng cho phép.');}chunks.push(chunk);}
    return Buffer.concat(chunks);
  }
  async function jsonBody(req){if(!req.headers['content-type']?.startsWith('application/json'))throw new HttpError(415,'Yêu cầu dữ liệu JSON.');try{return JSON.parse((await bodyBuffer(req,64*1024)).toString());}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(400,'Dữ liệu JSON không hợp lệ.');}}
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
  async function audit(user,action,artwork){try{await db.collection('audit_logs').insertOne({userId:user.id,action,artworkId:artwork.id,revision:artwork.revision,createdAt:new Date()});}catch(e){onError(e);}}
  async function route(req,res,url){
    const pathname=url.pathname;
    if(req.method!=='GET'&&req.method!=='HEAD')checkOrigin(req);
    if(pathname==='/api/health'&&req.method==='GET'){await db.command({ping:1});return json(res,200,{database:'mongodb',connected:true});}
    if(pathname==='/api/session'&&req.method==='GET'){
      const user=await getSession(req,db,administrators),setupAvailable=allowSetup&&administrators.size>0;
      return json(res,200,{user:user?{name:user.name,email:user.email,role:user.role}:null,setupAvailable,setupRequired:setupAvailable&&!await db.collection('users').findOne({email:{$in:[...administrators]}})});
    }
    if(pathname==='/api/auth/setup'&&req.method==='POST'){
      if(!allowSetup)throw new HttpError(403,'Thiết lập quản trị ban đầu chỉ được mở trong môi trường cục bộ.');
      const body=validateCredentials(await jsonBody(req),{setup:true});
      if(accountRole(body.email,administrators)!=='admin')throw new HttpError(403,'Email này không được phép thiết lập tài khoản quản trị.');
      const user={_id:randomUUID(),name:body.name,email:body.email,role:'admin',passwordHash:await passwordHash(body.password),createdAt:new Date()};
      try{await db.collection('users').insertOne(user);}catch(e){if(e.code===11000)throw new HttpError(409,'Tài khoản quản trị đã được thiết lập. Vui lòng đăng nhập.');throw e;}
      const token=await newSession(db,user);return json(res,201,{user:{name:user.name,email:user.email,role:'admin'}},{'Set-Cookie':sessionCookie(token,{secure:secureCookies})});
    }
    if(pathname==='/api/auth/login'&&req.method==='POST'){
      const ip=req.socket.remoteAddress;const record=attempts.get(ip);if(record&&record.until>Date.now()&&record.count>=8)throw new HttpError(429,'Đã thử đăng nhập quá nhiều lần. Hãy thử lại sau 15 phút.');
      const body=validateCredentials(await jsonBody(req));const user=await db.collection('users').findOne({email:body.email});
      if(!user||!await passwordMatches(body.password,user.passwordHash)){
        const current=record?.until>Date.now()?record:{count:0,until:Date.now()+900000};current.count++;attempts.set(ip,current);throw new HttpError(401,'Email hoặc mật khẩu chưa đúng.');
      }
      attempts.delete(ip);const token=await newSession(db,user);return json(res,200,{user:{name:user.name,email:user.email,role:accountRole(user.email,administrators)}},{'Set-Cookie':sessionCookie(token,{secure:secureCookies})});
    }
    if(pathname==='/api/auth/logout'&&req.method==='POST'){
      const user=await getSession(req,db,administrators);if(user)await db.collection('sessions').deleteOne({_id:user.sessionId});return json(res,200,{ok:true},{'Set-Cookie':sessionCookie('',{secure:secureCookies,clear:true})});
    }
    if(pathname==='/api/artworks'&&req.method==='GET'){
      const items=await db.collection('artworks').find({},{projection:{_id:0}}).sort({createdAt:1,id:1}).toArray();return json(res,200,{items,database:'mongodb'});
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
      try{await db.collection('media').insertOne(media);}catch(e){await mediaStorage.remove(asset).catch(onError);throw e;}
      return json(res,201,{media});
    }
    const match=pathname.match(/^\/api\/artworks\/([a-zA-Z0-9-]{1,64})$/);
    if(match&&req.method==='GET'){const item=await db.collection('artworks').findOne({id:match[1]});if(!item)throw new HttpError(404,'Không tìm thấy tác phẩm.');return json(res,200,{item:clean(item)});}
    if((pathname==='/api/artworks'&&req.method==='POST')||(match&&req.method==='PUT')){
      const user=await admin(req),raw=await jsonBody(req),data=validateArtwork(raw);
      const media=await db.collection('media').findOne({id:data.imageId});if(!media||!media.mimeType?.startsWith('image/'))throw new HttpError(422,'Ảnh đại diện chưa được tải lên hoặc không còn tồn tại.',{imageId:'Hãy chọn và tải lại ảnh.'});
      const video=data.videoId?await db.collection('media').findOne({id:data.videoId}):null;
      if(data.videoId&&(!video||!video.mimeType?.startsWith('video/')))throw new HttpError(422,'Video chưa được tải lên hoặc không hợp lệ.',{videoId:'Hãy chọn và tải lại video.'});
      Object.assign(data,{video:video?.url||'',videoMimeType:video?.mimeType||'',videoSizeBytes:video?.sizeBytes||0,videoDuration:video?.duration||0});
      Object.assign(data,{image:media.url,sizeBytes:media.sizeBytes,format:media.format,originalMedium:data.material,updatedAt:new Date()});
      let artwork;
      if(req.method==='POST'){
        artwork={...data,id:randomUUID(),revision:1,createdAt:new Date()};await db.collection('artworks').insertOne(artwork);
      }else{
        if(!Number.isInteger(raw.revision)||raw.revision<1)throw new HttpError(422,'Phiên bản tác phẩm không hợp lệ. Hãy tải lại danh sách.');
        artwork=await db.collection('artworks').findOneAndUpdate({id:match[1],revision:raw.revision},{$set:data,$inc:{revision:1}},{returnDocument:'after'});
        if(!artwork){if(!await db.collection('artworks').findOne({id:match[1]}))throw new HttpError(404,'Không tìm thấy tác phẩm.');throw new HttpError(409,'Tác phẩm đã được sửa ở cửa sổ khác. Tải lại danh sách rồi mở lại tác phẩm để tránh ghi đè.');}
      }
      for(const name of data.tags)await db.collection('keywords').updateOne({name},{$setOnInsert:{name}},{upsert:true});
      await audit(user,req.method==='POST'?'create':'update',artwork);return json(res,req.method==='POST'?201:200,{item:clean(artwork)});
    }
    if(pathname.startsWith('/api/'))throw new HttpError(404,'Không tìm thấy API.');
    if(!['GET','HEAD'].includes(req.method))throw new HttpError(405,'Phương thức không được hỗ trợ.');
    let root=publicDir,relative=decodeURIComponent(pathname).slice(1);
    if(pathname.startsWith('/uploads/')){root=uploadDir;relative=pathname.slice(9);if(!/^[a-f0-9-]{36}\.webp$/.test(relative))throw new HttpError(404,'Không tìm thấy ảnh.');}
    let file=path.resolve(root,relative||'index.html');const rel=path.relative(root,file);
    if(rel.startsWith('..')||path.isAbsolute(rel)||rel.split(path.sep).some(p=>p.startsWith('.')))throw new HttpError(404,'Không tìm thấy tệp.');
    try{if((await stat(file)).isDirectory())file=path.join(file,'index.html');const buffer=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:buffer);}catch{throw new HttpError(404,'Không tìm thấy trang.');}
  }
  return createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
    try{await route(req,res,new URL(req.url,'http://localhost'));}catch(e){if(res.headersSent){res.end();return;}if(e instanceof HttpError)return json(res,e.status,{error:e.message,...(e.fields?{fields:e.fields}:{})});onError(e);json(res,503,{error:'Chưa kết nối được cơ sở dữ liệu. Vui lòng thử lại sau.'});}
  });
}
