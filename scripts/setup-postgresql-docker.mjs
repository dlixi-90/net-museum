import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {parseEnv} from 'node:util';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export function configurePostgresql(source=''){
  const values=parseEnv(source);
  let localConnection;
  try{
    const uri=new URL(values.DATABASE_URL);
    if(['postgresql:','postgres:'].includes(uri.protocol)&&['127.0.0.1','localhost'].includes(uri.hostname)&&decodeURIComponent(uri.username)==='net_museum'&&uri.pathname==='/net_museum')localConnection=uri;
  }catch{}
  const port=values.POSTGRES_PORT||(localConnection?(localConnection.port||'5432'):'5433');
  if(!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535)throw new Error('POSTGRES_PORT phải nằm trong khoảng 1–65535.');
  const password=values.POSTGRES_PASSWORD||(localConnection&&decodeURIComponent(localConnection.password))||randomBytes(32).toString('base64url');
  if(localConnection&&(localConnection.port||'5432')===port&&decodeURIComponent(localConnection.password)!==password)throw new Error('Mật khẩu Docker và DATABASE_URL cục bộ chưa khớp; giữ nguyên .env để kiểm tra.');
  const updates={POSTGRES_PASSWORD:password,POSTGRES_PORT:port};
  if(!values.DATABASE_URL)updates.DATABASE_URL=`postgresql://net_museum:${encodeURIComponent(password)}@127.0.0.1:${port}/net_museum`;
  if(!values.PG_SCHEMA)updates.PG_SCHEMA='net_museum';
  let content=source;
  for(const [key,value] of Object.entries(updates)){
    if(values[key]===value)continue;
    // Single quotes preserve literal $ and # in both Node.js and Docker Compose.
    if(/[\r\n']/.test(value))throw new Error('Cấu hình Docker không hỗ trợ dấu nháy đơn hoặc xuống dòng trong giá trị.');
    const line=`${key}='${value}'`,pattern=new RegExp(`^(?:export\\s+)?${key}\\s*=.*$`,'m');
    content=pattern.test(content)?content.replace(pattern,()=>line):content.trimEnd()+'\n'+line+'\n';
  }
  return content;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const file=new URL('../.env',import.meta.url);
    let source='';
    try{source=await readFile(file,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
    const content=configurePostgresql(source);
    if(content!==source)await writeFile(file,content,{mode:0o600});
    console.log('Cấu hình Docker và ứng dụng dùng chung .env. Giữ DATABASE_URL và cấu hình khác đã có; không in mật khẩu.');
  }catch(error){console.error(error.code?'Không cập nhật được .env. Kiểm tra quyền truy cập tệp.':error.message);process.exitCode=1;}
}
