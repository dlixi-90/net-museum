export function validateConnectionUri(uri){
  if(typeof uri!=='string'||!/^mongodb(?:\+srv)?:\/\//.test(uri)||/<[^>]+>/.test(uri)){
    const error=new Error('Điền MONGODB_URI thật từ Atlas → Connect → Drivers trong file .env; thay đầy đủ các phần giữ chỗ.');error.code='MONGO_CONFIG_MISSING';throw error;
  }
  return uri;
}
// Only return fixed messages. Driver messages may contain deployment credentials.
export function connectionHelp(error,{atlas=false}={}){
  if(error.code==='MONGO_CONFIG_MISSING')return 'Chưa điền URI kết nối thật. Mở file .env và thay MONGODB_URI bằng URI của cluster Atlas.';
  if(error.code===18||error.codeName==='AuthenticationFailed')return 'Xác thực thất bại. Kiểm tra database user và mật khẩu trong URI; mã hóa URL các ký tự đặc biệt trong mật khẩu.';
  if(['ENOTFOUND','ECONNREFUSED','ETIMEOUT'].includes(error.code)||['MongoServerSelectionError','MongoNetworkError'].includes(error.name))return atlas?'Chưa kết nối được Atlas. Kiểm tra hostname, IP Access List, trạng thái cluster và kết nối mạng.':'Chưa kết nối được MongoDB. Khởi động MongoDB cục bộ hoặc kiểm tra URI trong .env.';
  return atlas?'Không hoàn tất được kết nối Atlas. Kiểm tra URI, database user và IP Access List.':'Không hoàn tất được kết nối MongoDB. Kiểm tra cấu hình trong .env.';
}
