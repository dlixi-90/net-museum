import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {loadEnvFile} from 'node:process';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {connectDatabase,initializeDatabase} from '../server/db.mjs';
import {createApp} from '../server/app.mjs';
import {newSession,passwordHash} from '../server/auth.mjs';
import {createCloudMedia,cloudUploadSpec,cloudPublicId} from '../server/cloud-media.mjs';
try{loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
test('Render cloud uploads: browser chunks, five kinds, ownership, validation, idempotence and restart persistence',async t=>{
  const schema='net_test_'+randomUUID().replaceAll('-',''),{db,client}=await connectDatabase({schema});await initializeDatabase(db,{seed:false});
  const assets=new Map(),errors=[],env={CLOUDINARY_CLOUD_NAME:'fixture',CLOUDINARY_API_KEY:'key',CLOUDINARY_API_SECRET:'secret'};
  const sdk={utils:{api_sign_request:()=> 'signed'},api:{resource:async id=>{const asset=assets.get(id);if(!asset||asset.done===false)throw new Error('not uploaded');return asset.metadata;}}};
  const cloudMedia=createCloudMedia({env,sdk,fetchImpl:async url=>{const asset=[...assets.values()].find(a=>a.metadata.secure_url===String(url));return new Response(asset.bytes,{status:asset?200:404});}});
  const server=createApp({db,cloudMedia,uploadStorage:'cloudinary',onError:e=>errors.push(e)});
  const user=await db.createUser({name:'Admin',username:'admin-fixture',email:'admin@example.test',role:'admin',passwordHash:await passwordHash('fixture password')}),reader=await db.createUser({name:'Reader',email:'reader@example.test',role:'user',passwordHash:await passwordHash('reader password')});
  const cookie='net_session='+await newSession(db,user),readerCookie='net_session='+await newSession(db,reader);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port,originalFetch=globalThis.fetch,originalStorage=globalThis.localStorage;
  const saved=new Map();globalThis.localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
  let chunkCalls=0,interruptChunk=false,loseAcknowledgement=false;
  globalThis.fetch=async(url,options={})=>{
    if(String(url).startsWith('https://api.cloudinary.com/')){
      const form=options.body,publicId=form.get('public_id'),file=form.get('file'),content=Buffer.from(await file.arrayBuffer()),range=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(options.headers['Content-Range']);assert.ok(range);assert.ok(options.headers['X-Unique-Upload-Id']);chunkCalls++;
      if(interruptChunk&&Number(range[1])>0){interruptChunk=false;throw new Error('network interrupted');}
      const existing=assets.get(publicId),start=Number(range[1]);assert.equal(start,existing?.bytes.length||0);
      let bytes=Buffer.concat([existing?.bytes||Buffer.alloc(0),content]);const isImage=String(url).includes('/image/'),done=Number(range[2])+1===Number(range[3]);if(isImage&&done)bytes=await sharp(bytes).webp().toBuffer();
      const cloudType=isImage?'image':String(url).includes('/video/')?'video':'raw';assets.set(publicId,{bytes,done,metadata:{public_id:publicId,resource_type:cloudType,format:isImage?'webp':'mp4',bytes:bytes.length,secure_url:'https://res.cloudinary.com/fixture/'+encodeURIComponent(publicId),version:1}});
      return Response.json({done});
    }
    if(String(url).startsWith('/api')){if(loseAcknowledgement&&String(url).endsWith('/progress')){loseAcknowledgement=false;throw new Error('acknowledgement lost');}return originalFetch(base+url,{...options,headers:{...options.headers,Cookie:cookie}});}
    return originalFetch(url,options);
  };
  t.after(async()=>{globalThis.fetch=originalFetch;globalThis.localStorage=originalStorage;server.closeAllConnections();await new Promise(r=>server.close(r));assert.match(schema,/^net_test_[a-f0-9]{32}$/);await db.query(`DROP SCHEMA "${schema}" CASCADE`);await client.close();});
  async function call(route,{method='GET',body,token=cookie}={}){const response=await originalFetch(base+'/api'+route,{method,headers:{Cookie:token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,body:await response.json()};}
  assert.equal((await call('/session')).body.uploadStorage,'cloudinary');assert.equal((await call('/uploads/init',{method:'POST',body:{}})).status,503);
  assert.equal((await call('/cloud-uploads/init',{method:'POST',body:{},token:readerCookie})).status,403);
  assert.equal((await call('/cloud-uploads/init',{method:'POST',body:{mimeType:'video/mp4',sizeBytes:101*1048576}})).status,413);
  const {uploadFile}=await import('../dist/upload.js'),manifest=JSON.parse(await readFile(new URL('../dist/assets/samples/manifest.json',import.meta.url),'utf8'));
  for(const ext of ['jpg','mp3','mp4','pdf','docx','txt']){
    const item=manifest.resources.find(r=>r.url.endsWith('.'+ext));let buffer=await readFile(new URL('../dist'+item.url,import.meta.url));if(ext==='mp4')buffer=Buffer.concat([buffer,Buffer.alloc(7*1048576)]);
    const file=new File([buffer],'fixture.'+ext,{type:item.mimeType,lastModified:1}),progress=[],result=await uploadFile(file,{onProgress:p=>progress.push(p)});
    assert.equal(result.media.storage,'cloudinary');assert.ok(progress.at(-1).validating);assert.ok(await db.getMedia(result.media.id));
    const repeated=await call('/cloud-uploads/'+result.media.id+'/complete',{method:'POST'});assert.equal(repeated.body.media.id,result.media.id);
    assert.equal((await call('/cloud-uploads/'+result.media.id+'/status',{token:readerCookie})).status,403);
  }
  assert.ok(chunkCalls>=7);assert.equal((await db.listMedia()).length,6);assert.equal(saved.size,0);
  const video=manifest.resources.find(r=>r.kind==='video'),large=Buffer.concat([await readFile(new URL('../dist'+video.url,import.meta.url)),Buffer.alloc(7*1048576)]),resumeFile=new File([large],'resume.mp4',{type:'video/mp4',lastModified:2});
  interruptChunk=true;await assert.rejects(uploadFile(resumeFile),/Chọn lại cùng tệp/);assert.equal(saved.size,1);
  const resumed=await uploadFile(resumeFile);assert.equal(resumed.media.sizeBytes,large.length);assert.equal(saved.size,0);
  const acknowledged=new File(['Văn bản tiếng Việt'],'lost-ack.txt',{type:'text/plain',lastModified:3});loseAcknowledgement=true;await assert.rejects(uploadFile(acknowledged),/acknowledgement lost/);
  const beforeRetry=chunkCalls;await uploadFile(acknowledged);assert.equal(chunkCalls,beforeRetry);assert.equal(saved.size,0);
  const other=await db.createUser({name:'Other admin',email:'other@example.test',role:'admin',passwordHash:await passwordHash('other password')}),otherCookie='net_session='+await newSession(db,other);
  const id=(await db.listMedia())[0].id;assert.equal((await call('/cloud-uploads/'+id+'/status',{token:otherCookie})).status,422);
  const fresh=await connectDatabase({schema});try{assert.equal((await fresh.db.listMedia()).length,8);}finally{await fresh.client.close();}
  const invalid=await call('/cloud-uploads/init',{method:'POST',body:{mimeType:'application/pdf',sizeBytes:10,originalName:'fake.pdf',fingerprint:'a'.repeat(64)}});const invalidId=invalid.body.upload.id;
  assets.set(cloudPublicId(invalidId,'application/pdf'),{bytes:Buffer.from('not a pdf!'),metadata:{public_id:cloudPublicId(invalidId,'application/pdf'),resource_type:'raw',bytes:10,secure_url:'https://res.cloudinary.com/fixture/fake'}});
  assert.equal((await call('/cloud-uploads/'+invalidId+'/complete',{method:'POST'})).status,422);assert.equal(await db.getMedia(invalidId),null);
  assert.deepEqual(errors,[]);
});
