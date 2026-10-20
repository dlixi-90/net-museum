export class HttpError extends Error {
  constructor(status, message, fields) { super(message); this.status = status; this.fields = fields; }
}
export const categories = {blue:'Gốm men lam',brown:'Gốm men nâu',white:'Gốm men trắng',painting:'Hội họa',sculpture:'Điêu khắc',graphic:'Đồ họa',other:'Nghệ thuật khác'};
export function validateArtwork(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new HttpError(400,'Dữ liệu tác phẩm không hợp lệ.');
  const result = {}, fields = {};
  const text = (key, label, max, required = false, fallback = '') => {
    const value = input[key] ?? fallback;
    if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) fields[key] = `${label}${required?' là bắt buộc và':''} tối đa ${max} ký tự.`;
    else result[key] = value.trim();
  };
  text('title','Tên tác phẩm',200,true);text('description','Mô tả',5000,true);
  text('author','Tác giả',200,false,'Chưa xác định');text('period','Niên đại',100,true);
  text('material','Chất liệu',300,true);text('origin','Xuất xứ',150,false,'Việt Nam');
  text('originalTitle','Tên gốc',250);text('license','Nguồn/quyền sử dụng',500);
  text('imageId','Ảnh đại diện',80,true);
  if (!Object.hasOwn(categories,input.category)) fields.category = 'Chọn một nhóm nghệ thuật hợp lệ.';
  else {result.category = input.category;result.categoryLabel=categories[input.category];}
  if (!Number.isInteger(input.year) || input.year < -5000 || input.year > 2100) fields.year = 'Năm bắt đầu cần là số nguyên từ -5000 đến 2100.';
  else result.year = input.year;
  if (!Array.isArray(input.tags) || input.tags.length>20 || input.tags.some(t=>typeof t!=='string'||t.trim().length>60)) fields.tags='Tối đa 20 từ khóa, mỗi từ khóa tối đa 60 ký tự.';
  else result.tags=[...new Set(input.tags.map(t=>t.trim()).filter(Boolean))];
  text('source','Đường dẫn nguồn',1500);
  if(result.source)try{if(!['https:','http:'].includes(new URL(result.source).protocol))throw new Error();}catch{fields.source='Nguồn cần là URL http hoặc https hợp lệ.';}
  if(Object.keys(fields).length)throw new HttpError(422,'Kiểm tra lại các trường thông tin.',fields);
  result.author ||= 'Chưa xác định';result.origin ||= 'Việt Nam';
  return result;
}
