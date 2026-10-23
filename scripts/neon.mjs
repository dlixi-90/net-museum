import {readFile,mkdir,stat} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {spawn} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
import {parseEnv} from 'node:util';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {connectDatabase} from '../server/db.mjs';
import {validateConnectionUri,validateSchema,connectionHelp} from '../server/pg-config.mjs';

async function config(name){try{return parseEnv(await readFile(new URL('../'+name,import.meta.url),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;return {};}}
function execute(args,{input,output,env=process.env}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn('docker',args,{env,windowsHide:true,stdio:[input?'pipe':'ignore',output?'pipe':'ignore','pipe']});let diagnostic='';
    child.stderr.on('data',chunk=>{if(diagnostic.length<16000)diagnostic+=chunk.toString();});child.on('error',()=>reject(new Error('Không chạy được Docker. Mở Docker Desktop và kiểm tra Engine.')));
    const transfers=[];if(input)transfers.push(pipeline(createReadStream(input),child.stdin));if(output)transfers.push(pipeline(child.stdout,createWriteStream(output,{flags:'wx',mode:0o600})));
    child.on('close',async code=>{try{await Promise.all(transfers);if(code!==0){
      const reason=/transaction_timeout|unrecognized configuration|server version/i.test(diagnostic)?'version':/certificate|SSL|TLS|channel.binding/i.test(diagnostic)?'tls':/could not translate|could not connect|connection.*failed|Network|resolve/i.test(diagnostic)?'connection':/permission denied|must be owner|superuser/i.test(diagnostic)?'permission':'restore';
      throw new Error('Công cụ PostgreSQL chưa hoàn tất ('+reason+'). Kiểm tra Docker, quyền CSDL, phiên bản PostgreSQL 17+ và kết nối đích; thông tin kết nối được giữ kín.');}resolve();}catch(error){reject(error);}});
    // Register rejection handlers immediately, including when Docker exits early.
    transfers.forEach(p=>p.catch(()=>{}));
  });
}
const command=process.argv[2]||'check',apply=process.argv.includes('--apply');let source,target;
try{
  const local=await config('.env'),neon=await config('.env.neon');
  const schema=neon.PG_SCHEMA||local.PG_SCHEMA||'net_museum_import';validateSchema(schema);
  const sourceUri=process.env.SOURCE_DATABASE_URL||local.DATABASE_URL,container=process.env.SOURCE_DOCKER_CONTAINER||'net-museum-postgres';
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$/.test(container))throw new Error('Tên container nguồn chưa hợp lệ.');
  const uri=process.env.NEON_DATABASE_URL||neon.NEON_DATABASE_URL;
  if(command==='check'||command==='migrate'){
    validateConnectionUri(uri);if(!new URL(uri).hostname.endsWith('.neon.tech'))throw new Error('NEON_DATABASE_URL cần là Direct URL của Neon.');
    target=await connectDatabase({uri,schema,max:1});
    const exists=!!(await target.db.query('SELECT 1 FROM pg_namespace WHERE nspname=$1',[schema])).rowCount;
    if(command==='check'){
      const counts=exists?(await target.db.query("SELECT (SELECT COUNT(*)::int FROM users) AS users,(SELECT COUNT(*)::int FROM artifacts) AS artworks,(SELECT COUNT(*)::int FROM resources) AS resources")).rows[0]:null;
      console.log(JSON.stringify({connected:true,provider:'neon',schema,schemaExists:exists,counts}));
      process.exitCode=0;
    }else{
      if(exists)throw new Error('Schema đích đã tồn tại. Dùng Neon database/branch mới hoặc kiểm tra dữ liệu đích; công cụ không ghi đè.');
      validateConnectionUri(sourceUri);source=await connectDatabase({uri:sourceUri,schema:local.PG_SCHEMA||schema,max:1});
      if(source.db.schema!==schema)throw new Error('PG_SCHEMA nguồn và đích cần giống nhau để giữ nguyên FK/view.');
      if(new URL(sourceUri).hostname.endsWith('.neon.tech'))throw new Error('Nguồn phải là PostgreSQL cục bộ; không dùng Neon làm nguồn cho lệnh chuyển lần đầu.');
      const rows=(await source.db.query('SELECT id,storage_key FROM resources WHERE storage_key LIKE $1',["/uploads/%"])).rows;
      if(rows.length)throw new Error('Còn '+rows.length+' tệp uploads chỉ nằm trên máy. Chạy npm run media:publish -- --apply trước rồi chuyển database.');
      const expected=(await source.db.query('SELECT (SELECT COUNT(*)::int FROM users) AS users,(SELECT COUNT(*)::int FROM artifacts) AS artworks,(SELECT COUNT(*)::int FROM resources) AS resources')).rows[0];
      if(!apply){console.log(JSON.stringify({source:expected,target:'empty Neon schema',schema,applied:false,next:'npm run db:neon:migrate -- --apply'}));}
      else{
        const dump=await exportDump(sourceUri,schema,container);
        // Use the same verified Node TLS connection as the runtime. Docker only reads
        // the local database; it does not need credentials or outbound access to Neon.
        const plain=await exportDump(sourceUri,schema,container,{plain:true});
        const sql=(await readFile(plain,'utf8')).replace(/^\\(?:un)?restrict [a-zA-Z0-9]+\r?$/gm,'');
        await target.db.transaction(async tx=>{
          await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',['net_restore:'+schema]);
          if((await tx.query('SELECT 1 FROM pg_namespace WHERE nspname=$1',[schema])).rowCount)throw new Error('Schema đích đã xuất hiện; dừng để tránh ghi đè.');
          await tx.query(sql);
          await tx.query("SELECT set_config('search_path',$1,false)",[schema+',public']);
        });
        const actual=(await target.db.query('SELECT (SELECT COUNT(*)::int FROM users) AS users,(SELECT COUNT(*)::int FROM artifacts) AS artworks,(SELECT COUNT(*)::int FROM resources) AS resources')).rows[0];
        if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('Số lượng sau phục hồi chưa khớp nguồn. Kiểm tra dữ liệu đích trước khi triển khai.');
        console.log(JSON.stringify({migrated:true,schema,counts:actual,backup:path.relative(process.cwd(),dump),sourcePreserved:true,sessionsCopied:false}));
      }
    }
  }else if(command==='export'){await exportDump(sourceUri,local.PG_SCHEMA||schema,container);}
  else throw new Error('Lệnh hợp lệ: check, export, migrate [--apply].');
}catch(error){console.error(['PG_CONFIG_MISSING','PG_CONFIG_POOLER','PG_CONFIG_TLS','PG_SCHEMA_INVALID','28P01','ECONNREFUSED'].includes(error.code)?connectionHelp(error):error.code?'Không hoàn tất kết nối/copy dữ liệu. Kiểm tra .env.neon, Docker và Neon; không công khai URL.':error.message);process.exitCode=1;}
finally{await source?.client.close();await target?.client.close();}

async function exportDump(uri,schema,container,{plain=false}={}){
  validateConnectionUri(uri);validateSchema(schema);const url=new URL(uri);
  if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw new Error('Export Docker cần DATABASE_URL nguồn cục bộ.');
  const directory=fileURLToPath(new URL('../.local/neon-backups/',import.meta.url));await mkdir(directory,{recursive:true});
  const filename=path.join(directory,schema+'-'+new Date().toISOString().replace(/[:.]/g,'-')+(plain?'.sql':'.dump'));
  await execute(['exec',container,'pg_dump','--username',decodeURIComponent(url.username),'--dbname',decodeURIComponent(url.pathname.slice(1)),'--schema',schema,'--format='+(plain?'plain':'custom'),...(plain?['--inserts']:[]),'--no-owner','--no-privileges','--exclude-table-data=*.sessions','--exclude-table-data=*.upload_intents','--exclude-table-data=*.auth_limits'],{output:filename});
  if((await stat(filename)).size<100)throw new Error('Bản xuất chưa hợp lệ.');
  console.log('Đã xuất PostgreSQL vào '+path.relative(process.cwd(),filename)+'; giữ riêng vì có dữ liệu tài khoản.');return filename;
}
