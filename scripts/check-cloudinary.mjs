import {loadEnvFile} from 'node:process';
import {createCloudinaryStorage} from '../server/media-storage.mjs';
import {HttpError} from '../server/validation.mjs';
try{loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}
try{
  await createCloudinaryStorage().ping();
  console.log('Kết nối Cloudinary thành công. Chỉ ping, không tải lên hoặc xóa tệp.');
}catch(error){
  console.error(error instanceof HttpError?error.message:'Không kết nối được Cloudinary. Kiểm tra cloud name, API key, API secret, trạng thái khóa và kết nối mạng.');
  process.exitCode=1;
}
