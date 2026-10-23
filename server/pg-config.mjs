export function validateConnectionUri(uri) {
  let parsed;
  try { parsed = new URL(uri); } catch {}
  if (!parsed || !['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname || !parsed.pathname.slice(1) || /<[^>]+>|CHANGE_ME/.test(uri)) {
    const error = new Error('Điền DATABASE_URL của PostgreSQL trong .env.');
    error.code = 'PG_CONFIG_MISSING';
    throw error;
  }
  if(parsed.hostname.endsWith('.neon.tech')){
    if(parsed.hostname.includes('-pooler.'))throw Object.assign(new Error('Dùng Neon Direct connection cho search_path của ứng dụng.'),{code:'PG_CONFIG_POOLER'});
    if(!['require','verify-full','verify-ca'].includes(parsed.searchParams.get('sslmode')))throw Object.assign(new Error('Neon cần kết nối TLS.'),{code:'PG_CONFIG_TLS'});
  }
  return uri;
}

export function validateSchema(schema) {
  if (typeof schema !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/.test(schema) || ['public', 'information_schema'].includes(schema) || schema.startsWith('pg_')) {
    throw Object.assign(new Error('PG_SCHEMA cần là tên schema riêng của ứng dụng.'), {code: 'PG_SCHEMA_INVALID'});
  }
  return schema;
}

// Never echo a driver message or connection URI: they can contain credentials.
export function connectionHelp(error) {
  if (error.code === 'PG_CONFIG_MISSING') return 'Chưa cấu hình PostgreSQL. Điền DATABASE_URL trong di-san-viet/.env, gồm tài khoản, máy chủ, cổng và database.';
  if (error.code === 'PG_SCHEMA_INVALID') return 'PG_SCHEMA không hợp lệ. Dùng tên schema riêng như net_museum.';
  if (error.code === 'PG_CONFIG_POOLER') return 'Dùng chuỗi kết nối Direct của Neon: tắt Connection pooling trong hộp Connect. Ứng dụng hiện dùng search_path theo phiên.';
  if (error.code === 'PG_CONFIG_TLS') return 'Giữ sslmode=require hoặc verify-full trong chuỗi kết nối Neon; không tắt kiểm tra TLS.';
  if (error.code === '28P01' || error.code === '28000') return 'PostgreSQL từ chối xác thực. Kiểm tra tài khoản và mật khẩu trong DATABASE_URL.';
  if (error.code === '3D000') return 'Database PostgreSQL chưa tồn tại. Tạo database UTF-8 đã đặt trong DATABASE_URL trước khi chạy seed.';
  if (error.code === '42501') return 'Tài khoản PostgreSQL chưa có quyền tạo schema/bảng của ứng dụng trong database đã chọn.';
  if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ETIMEOUT'].includes(error.code) || error instanceof AggregateError) return 'Chưa kết nối được PostgreSQL. Kiểm tra dịch vụ, địa chỉ, cổng và DATABASE_URL.';
  return 'Không hoàn tất thao tác PostgreSQL. Kiểm tra cấu hình, quyền database và kết nối; không công khai chuỗi kết nối.';
}
