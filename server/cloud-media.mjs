import {createWriteStream,createReadStream} from 'node:fs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {Readable,Transform} from 'node:stream';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {v2 as cloudinary} from 'cloudinary';
import {cloudinaryConfig} from './media-storage.mjs';
import {uploadTypes,inspectFile,imageFeatures,FEATURE_VERSION} from './files.mjs';
import {HttpError} from './validation.mjs';
export function cloudUploadSpec(mimeType,env=process.env){
  const spec=uploadTypes[mimeType];if(!spec)throw new HttpError(415,'Định dạng chưa được hỗ trợ.');
  const cloudMax=Number(env.CLOUD_UPLOAD_MAX_MIB||100);if(!Number.isFinite(cloudMax)||cloudMax<1||cloudMax>1024)throw new HttpError(503,'CLOUD_UPLOAD_MAX_MIB cần nằm trong khoảng 1–1024.');
  return {...spec,limit:Math.min(spec.limit,Math.floor(cloudMax*1048576)),cloudType:spec.kind==='image'?'image':['audio','video'].includes(spec.kind)?'video':'raw'};
}
export function cloudPublicId(id,mimeType){const spec=cloudUploadSpec(mimeType);return `net-museum/direct/${spec.kind}/${id}`+(spec.cloudType==='raw'?'.'+spec.ext:'');}
export function createCloudMedia({env=process.env,sdk=cloudinary,fetchImpl=fetch}={}){
  const options=()=>({...cloudinaryConfig(env),secure:true});
  return {
    async publishFile(filename,{id,mimeType}){
      const spec=cloudUploadSpec(mimeType,env),publicId=cloudPublicId(id,mimeType);
      await new Promise((resolve,reject)=>{
        const stream=sdk.uploader.upload_large(filename,{...options(),resource_type:spec.cloudType,public_id:publicId,overwrite:false,chunk_size:6*1048576,...(spec.kind==='image'?{transformation:'c_limit,w_2000,h_2000/q_85',format:'webp'}:{}),timeout:180000},(error,result)=>error?reject(new HttpError(502,'Không chuyển được tệp sang Cloudinary. Kiểm tra cấu hình, định dạng và hạn mức.')):result.done===false?null:resolve(result));
        stream?.on?.('error',()=>reject(new HttpError(502,'Kết nối upload Cloudinary bị gián đoạn.')));
      });
      return this.resolve({id,mimeType});
    },
    sign({id,mimeType}){
      const spec=cloudUploadSpec(mimeType,env),config=options();
      const fields={timestamp:Math.floor(Date.now()/1000),public_id:cloudPublicId(id,mimeType),overwrite:false,
        ...(spec.kind==='image'?{allowed_formats:'jpg,jpeg,png,webp'}:{})};
      return {url:`https://api.cloudinary.com/v1_1/${config.cloud_name}/${spec.cloudType}/upload`,fields:{...fields,api_key:config.api_key,signature:sdk.utils.api_sign_request(fields,config.api_secret)}};
    },
    async resolve({id,mimeType}){
      const spec=cloudUploadSpec(mimeType,env),publicId=cloudPublicId(id,mimeType);let result;
      try{result=await sdk.api.resource(publicId,{...options(),resource_type:spec.cloudType,type:'upload'});}catch{throw new HttpError(502,'Chưa xác nhận được tệp trên Cloudinary. Hãy thử hoàn tất lại sau.');}
      let url;try{url=new URL(result.secure_url);}catch{}
      if(result.public_id!==publicId||result.resource_type!==spec.cloudType||spec.kind==='image'&&!['jpg','jpeg','png','webp'].includes(result.format)||!Number.isSafeInteger(result.bytes)||result.bytes<1||result.bytes>spec.limit||!url||url.protocol!=='https:'||url.hostname!=='res.cloudinary.com'||url.port||url.username||url.password)throw new HttpError(422,'Tệp trên Cloudinary không khớp phiên tải hoặc vượt giới hạn dung lượng.');
      const actualFormat=spec.kind==='image'?result.format:spec.ext,actualMime=spec.kind==='image'?({'jpg':'image/jpeg','jpeg':'image/jpeg','png':'image/png','webp':'image/webp'}[actualFormat]):mimeType;
      const directory=await mkdtemp(path.join(os.tmpdir(),'net-cloud-')),filename=path.join(directory,'asset.'+actualFormat);
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),180000);timer.unref();
      try{
        const response=await fetchImpl(url,{signal:controller.signal,redirect:'error'});if(!response.ok)throw new HttpError(502,'Không đọc được tệp từ Cloudinary. Với PDF, kiểm tra quyền phân phối PDF trong tài khoản Cloudinary.');
        let received=0;const cap=new Transform({transform(chunk,encoding,callback){received+=chunk.length;if(received>spec.limit)return callback(new HttpError(413,'Nội dung vượt giới hạn dung lượng.'));callback(null,chunk);}});
        await pipeline(Readable.fromWeb(response.body),cap,createWriteStream(filename,{flags:'wx',mode:0o600}));
        if(received!==result.bytes)throw new HttpError(422,'Dung lượng tệp thực tế không khớp metadata đã xác minh.');
        const parsed=await inspectFile(filename,actualMime);
        if(parsed.resourceType!==spec.kind)throw new HttpError(422,'Nội dung tệp không đúng loại.');
        const hash=createHash('sha256');for await(const chunk of createReadStream(filename))hash.update(chunk);
        const {buffer,...details}=parsed;
        if(spec.kind==='image'){
          const original=await readFile(filename),meta=await sharp(original,{limitInputPixels:40000000}).metadata();
          if(meta.format!==(actualFormat==='jpg'?'jpeg':actualFormat))throw new HttpError(422,'Định dạng ảnh thật không khớp kho lưu trữ.');
          Object.assign(details,{width:meta.width,height:meta.height,colorVector:await imageFeatures(original),featureVersion:FEATURE_VERSION});
        }
        return {...details,format:actualFormat.toUpperCase(),mimeType:actualMime,sizeBytes:received,storage:'cloudinary',url:url.href,publicId,version:result.version,sha256:hash.digest('hex')};
      }finally{clearTimeout(timer);controller.abort();if(path.dirname(directory)===path.resolve(os.tmpdir())&&path.basename(directory).startsWith('net-cloud-'))await rm(directory,{recursive:true,force:true});}
    }
  };
}
