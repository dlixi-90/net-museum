import {v2 as cloudinary} from 'cloudinary';
import {HttpError} from './validation.mjs';

export const IMAGE_LIMIT=8*1024*1024,VIDEO_LIMIT=50*1024*1024;
export const imageTypes=['image/jpeg','image/png','image/webp'];
export const videoTypes=['video/mp4','video/webm','video/quicktime'];

export function cloudinaryConfig(env=process.env){
  const config={cloud_name:env.CLOUDINARY_CLOUD_NAME?.trim(),api_key:env.CLOUDINARY_API_KEY?.trim(),api_secret:env.CLOUDINARY_API_SECRET?.trim()};
  if(!config.cloud_name||!config.api_key||!config.api_secret||Object.values(config).some(v=>v.startsWith('your_')))
    throw new HttpError(503,'Chưa cấu hình Cloudinary. Điền CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY và CLOUDINARY_API_SECRET trong .env rồi khởi động lại máy chủ.');
  return config;
}

// Reject mislabeled containers before sending data. Cloudinary validates the codec/content.
export function validateVideo(buffer,mimeType){
  const webm=buffer.length>=4&&buffer.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
  const iso=buffer.length>=12&&buffer.toString('ascii',4,8)==='ftyp';
  if(!videoTypes.includes(mimeType)||(mimeType==='video/webm'?!webm:!iso))
    throw new HttpError(422,'Không đọc được video. Hãy chọn tệp MP4, WebM hoặc MOV hợp lệ.');
}

export function createCloudinaryStorage({env=process.env,sdk=cloudinary}={}){
  const options=()=>({...cloudinaryConfig(env),secure:true});
  return {
    assertConfigured(){options();},
    signUpload({id,resourceType}){
      const config=options(),fields={timestamp:Math.floor(Date.now()/1000),public_id:`net-museum/${resourceType}/${id}`,overwrite:false,allowed_formats:resourceType==='image'?'jpg,jpeg,png,webp':'mp4,webm,mov',...(resourceType==='image'?{transformation:'c_limit,w_2000,h_2000/q_85',format:'webp'}:{format:'mp4'})};
      return {url:`https://api.cloudinary.com/v1_1/${config.cloud_name}/${resourceType}/upload`,fields:{...fields,api_key:config.api_key,signature:sdk.utils.api_sign_request(fields,config.api_secret)}};
    },
    async resolveUpload({id,resourceType}){
      const publicId=`net-museum/${resourceType}/${id}`;
      let result;
      try{result=await sdk.api.resource(publicId,{...options(),resource_type:resourceType,type:'upload'});}
      catch{throw new HttpError(502,'Chưa xác nhận được tệp trên Cloudinary. Vui lòng thử lưu lại.');}
      const valid=result.public_id===publicId&&result.resource_type===resourceType&&result.width>0&&result.height>0&&result.bytes>0&&result.bytes<=(resourceType==='video'?VIDEO_LIMIT:IMAGE_LIMIT)&&result.secure_url?.startsWith('https://')&&result.format===(resourceType==='image'?'webp':'mp4');
      if(!valid){await this.remove({publicId,resourceType}).catch(()=>{});throw new HttpError(422,'Tệp tải lên không phải ảnh hoặc video hợp lệ, hoặc vượt quá dung lượng cho phép.');}
      return {storage:'cloudinary',publicId,resourceType,url:result.secure_url,format:result.format.toUpperCase(),mimeType:resourceType==='image'?'image/webp':'video/mp4',sizeBytes:result.bytes,width:result.width,height:result.height,...(resourceType==='video'?{duration:result.duration||0}:{}),version:result.version};
    },
    async upload(buffer,{id,resourceType}){
      try{
        const result=await new Promise((resolve,reject)=>{
          const stream=sdk.uploader.upload_stream({...options(),resource_type:resourceType,public_id:`net-museum/${resourceType}/${id}`,overwrite:false,allowed_formats:resourceType==='image'?['webp']:['mp4','webm','mov'],...(resourceType==='video'?{format:'mp4'}:{}),timeout:120000},(error,result)=>error?reject(error):resolve(result));
          stream.on('error',reject);stream.end(buffer);
        });
        if(result.resource_type!==resourceType||!result.width||!result.height||!result.secure_url?.startsWith('https://')){
          if(result.public_id)await this.remove({publicId:result.public_id,resourceType}).catch(()=>{});
          throw new HttpError(422,'Tệp tải lên không phải ảnh hoặc video hợp lệ.');
        }
        return {storage:'cloudinary',publicId:result.public_id,resourceType:result.resource_type,url:result.secure_url,format:result.format.toUpperCase(),mimeType:resourceType==='image'?'image/webp':'video/mp4',sizeBytes:result.bytes,width:result.width,height:result.height,...(resourceType==='video'?{duration:result.duration}:{}),version:result.version};
      }catch(error){
        if(error instanceof HttpError)throw error;
        throw new HttpError(error.http_code===400?422:502,error.http_code===400?'Cloudinary không đọc được tệp này. Hãy kiểm tra định dạng.':'Không tải được tệp lên Cloudinary. Kiểm tra cấu hình, kết nối và hạn mức rồi thử lại.');
      }
    },
    async remove({publicId,resourceType}){await sdk.uploader.destroy(publicId,{...options(),resource_type:resourceType,invalidate:true});},
    async ping(){await sdk.api.ping({...options(),timeout:15000});}
  };
}
