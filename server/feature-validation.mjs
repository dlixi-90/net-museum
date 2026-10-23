import {HttpError} from './validation.mjs';
export function resourceMetadata(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new HttpError(422,'Thông tin tài nguyên chưa hợp lệ.');
  const result={};
  for(const [key,max,required] of [['title',200,true],['author',200],['description',5000],['source',1500],['license',500],['transcript',20000]]){
    const value=input[key]??'';if(typeof value!=='string'||value.trim().length>max||required&&!value.trim())throw new HttpError(422,`Trường ${key} chưa hợp lệ.`);result[key]=value.trim();
  }
  if(result.source)try{if(!['http:','https:'].includes(new URL(result.source).protocol))throw new Error();}catch{throw new HttpError(422,'Nguồn tư liệu cần là URL HTTP hoặc HTTPS.');}
  for(const key of ['tags','topics']){const values=input[key]??[];if(!Array.isArray(values)||values.length>20||values.some(value=>typeof value!=='string'||!value.trim()||value.length>60))throw new HttpError(422,'Từ khóa/chủ đề tối đa 20 mục, mỗi mục 60 ký tự.');result[key]=[...new Set(values.map(value=>value.trim()))];}
  if(input.language&&input.language!=='vi-VN')throw new HttpError(422,'Thuyết minh của bảo tàng sử dụng tiếng Việt.');
  return result;
}
export function searchFilters(params){
  const result={};for(const key of ['q','author','topic','tag','category','period']){const value=params.get(key)||'';if(value.length>200)throw new HttpError(422,'Điều kiện tìm kiếm quá dài.');if(value)result[key]=value;}
  const kind=params.get('kind');if(kind){if(!['image','audio','video','document','text'].includes(kind))throw new HttpError(422,'Loại tài nguyên không hợp lệ.');result.kind=kind;}
  if(params.has('maxSize')&&params.get('maxSize')!==''){const value=Number(params.get('maxSize'));if(!Number.isFinite(value)||value<0||value>1048576)throw new HttpError(422,'Dung lượng cần là số MiB không âm.');result.maxBytes=Math.floor(value*1024*1024);}
  for(const key of ['from','to']){const value=params.get(key);if(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw new HttpError(422,'Ngày cần theo định dạng năm-tháng-ngày.');result[key]=value;}}
  if(result.from&&result.to&&result.from>result.to)throw new HttpError(422,'Ngày bắt đầu không được sau ngày kết thúc.');
  result.sort=params.get('sort')||'newest';if(!['newest','oldest','name','size'].includes(result.sort))throw new HttpError(422,'Thứ tự sắp xếp chưa hợp lệ.');
  result.page=Number(params.get('page')||1);if(!Number.isInteger(result.page)||result.page<1||result.page>10000)throw new HttpError(422,'Số trang chưa hợp lệ.');return result;
}
export function userMetadata(input,current){
  if(!input||Array.isArray(input)||typeof input!=='object')throw new HttpError(422,'Thông tin người dùng chưa hợp lệ.');
  const name=input.name??current.name,rawUsername=input.username??current.username;
  if(typeof name!=='string'||!name.trim()||name.length>150||typeof rawUsername!=='string')throw new HttpError(422,'Họ tên hoặc tên tài khoản chưa hợp lệ.');
  const username=rawUsername.trim().toLowerCase();if(!(/^[a-z0-9._-]{3,80}$/.test(username)||username===current.email))throw new HttpError(422,'Tên tài khoản chưa hợp lệ.');
  const role=input.role??current.role,active=input.active??current.active;
  if(!['admin','user'].includes(role)||typeof active!=='boolean')throw new HttpError(422,'Quyền hoặc trạng thái người dùng chưa hợp lệ.');
  if(input.password!==undefined&&input.password!==''&&(typeof input.password!=='string'||input.password.length<10||input.password.length>200))throw new HttpError(422,'Mật khẩu mới cần 10–200 ký tự.');
  return {name:name.trim(),username,role,active,password:input.password||''};
}
