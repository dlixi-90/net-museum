import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {loadEnvFile} from 'node:process';
import {mkdtemp,rm,readFile,writeFile,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {connectDatabase,initializeDatabase} from '../server/db.mjs';
import {createApp} from '../server/app.mjs';
import {passwordHash,newSession} from '../server/auth.mjs';
import {inspectFile,FEATURE_VERSION} from '../server/files.mjs';
try{loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
async function fixture(t){
  const schema='net_test_'+randomUUID().replaceAll('-',''),connection=await connectDatabase({schema}),{db,client}=connection;
  const uploadDir=await mkdtemp(path.join(os.tmpdir(),'net-multimedia-'));
  const errors=[],server=createApp({db,uploadDir,onError:e=>errors.push(e)});
  t.after(async()=>{if(server.listening)await new Promise(resolve=>server.close(resolve));assert.match(schema,/^net_test_[a-f0-9]{32}$/);await db.query(`DROP SCHEMA "${schema}" CASCADE`);await client.close();assert.ok(path.resolve(uploadDir).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(uploadDir,{recursive:true,force:true});});
  await initializeDatabase(db,{seed:true});
  const admin=await db.createUser({name:'Quản trị thử',username:'curator',email:'curator@example.test',passwordHash:await passwordHash('fixture password'),role:'admin'});
  const reader=await db.createUser({name:'Người xem',username:'reader',email:'reader@example.test',passwordHash:await passwordHash('reader password'),role:'user'});
  const cookie='net_session='+await newSession(db,admin),readerCookie='net_session='+await newSession(db,reader);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  async function request(route,{method='GET',body,cookie:token=cookie,headers={}}={}){
    const binary=Buffer.isBuffer(body);const response=await fetch(base+route,{method,headers:{...(token?{Cookie:token}:{}),...(body&&!binary?{'Content-Type':'application/json'}:{}),...headers},body:body?(binary?body:JSON.stringify(body)):undefined});
    const buffer=Buffer.from(await response.arrayBuffer());let data;try{data=JSON.parse(buffer);}catch{}
    return {status:response.status,data,buffer,headers:response.headers};
  }
  async function init(buffer,mimeType,originalName='fixture.txt'){
    const result=await request('/api/uploads/init',{method:'POST',body:{mimeType,originalName,sizeBytes:buffer.length,fingerprint:createHash('sha256').update(buffer).digest('hex')}});
    assert.equal(result.status,201,JSON.stringify(result.data));return result.data.upload.id;
  }
  async function upload(buffer,mimeType,originalName){const id=await init(buffer,mimeType,originalName);for(let offset=0;offset<buffer.length;offset+=6*1024*1024){const result=await request('/api/uploads/'+id+'/chunk',{method:'PUT',headers:{'Content-Type':'application/octet-stream','Upload-Offset':String(offset)},body:buffer.subarray(offset,offset+6*1024*1024)});assert.equal(result.status,200,JSON.stringify(result.data));}const result=await request('/api/uploads/'+id+'/complete',{method:'POST'});assert.equal(result.status,201,JSON.stringify(result.data));return result.data.media;}
  return {db,request,upload,init,uploadDir,errors,admin,reader,cookie,readerCookie};
}
test('Multimedia: Vietnamese assets, five kinds, metadata search, real CBIR and persistent deletion',async t=>{
  const {db,request,errors,admin}=await fixture(t);
  const all=await db.listMedia();assert.equal(all.length,49);
  for(const kind of ['image','video','audio','document','text'])assert.ok(all.some(r=>r.resourceType===kind),kind);
  const audio=all.find(r=>r.resourceType==='audio'),pdf=all.find(r=>r.format==='PDF'),docx=all.find(r=>r.format==='DOCX');
  assert.equal(audio.language,'vi-VN');assert.ok(audio.transcript.includes('Việt'));assert.ok(audio.duration>30);
  const audioFile=await request('/api/resources/'+audio.id+'/file',{cookie:''});assert.equal(audioFile.status,200);assert.equal(audioFile.headers.get('content-type'),'audio/mpeg');assert.ok(audioFile.buffer.length>50000);
  const document=await request('/api/resources/'+pdf.id+'/file',{cookie:''});assert.equal(document.buffer.subarray(0,5).toString(),'%PDF-');assert.equal(document.headers.get('x-frame-options'),'SAMEORIGIN');assert.ok(docx.content.length>100);
  const first=(await db.listArtworks())[0];
  for(const query of ['kind=audio','q='+encodeURIComponent(first.title),'topic='+encodeURIComponent(first.topic),'category='+first.category,'period='+encodeURIComponent(first.period),'author='+encodeURIComponent(first.author)]){
    const result=await request('/api/search?'+query,{cookie:''});assert.equal(result.status,200,JSON.stringify(result.data));assert.ok(result.data.total>0,query);
  }
  const folded=first.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('đ','d').replaceAll('Đ','D');assert.ok((await request('/api/search?q='+encodeURIComponent(folded))).data.total>0);
  const combined=await request('/api/search?kind=audio&maxSize=10&from=2025-01-01&to=2027-01-01&topic='+encodeURIComponent(audio.topics[0]));assert.equal(combined.status,200);assert.ok(combined.data.items.every(r=>r.resourceType==='audio'&&r.sizeBytes<10485760));assert.ok(combined.data.total>0);
  assert.equal((await request('/api/search?from=2026-02-30')).status,422);assert.equal((await request('/api/search?sort=DROP')).status,422);
  assert.equal((await request('/api/search?q='+encodeURIComponent("'; DROP TABLE users;--"))).status,200);assert.equal((await db.listUsers()).length,2);
  const image=all.find(r=>r.resourceType==='image'),similar=await request('/api/search/similar?id='+image.id,{cookie:''});assert.equal(similar.status,200,JSON.stringify(similar.data));assert.equal(similar.data.items.length,5);assert.ok(similar.data.items.every(r=>r.id!==image.id&&r.similarity>=0&&r.similarity<=1));assert.equal(similar.data.featureVersion,FEATURE_VERSION);
  const input=await readFile(new URL('../dist'+image.url,import.meta.url));const search=await request('/api/search/image',{method:'POST',cookie:'',headers:{'Content-Type':'image/jpeg'},body:input});assert.equal(search.status,200);assert.ok(search.data.items.every(r=>r.id!==image.id));
  assert.equal((await request('/api/search/image',{method:'POST',headers:{'Content-Type':'image/png'},body:Buffer.from('fake')})).status,422);
  assert.equal((await request('/api/resources/'+image.id,{method:'DELETE'})).status,409);
  const deleted='37557';await db.deleteArtwork(deleted,admin._id);await initializeDatabase(db);assert.equal(await db.getArtwork(deleted),null);assert.equal((await db.listArtworks()).length,6);assert.ok(await db.getMedia('met-'+deleted));
  assert.deepEqual(errors,[]);
});
test('Multimedia: resumable chunks, restart state, offsets, real parsers, range streaming and cleanup',async t=>{
  const {db,request,upload,init,uploadDir,errors,readerCookie}=await fixture(t);
  assert.equal((await request('/api/uploads/init',{method:'POST',cookie:readerCookie,body:{}})).status,403);
  assert.equal((await request('/api/uploads/init',{method:'POST',body:{mimeType:'video/mp4',sizeBytes:1073741825}})).status,413);
  const txt=await upload(Buffer.from('Thuyết minh tiếng Việt\nGốm men lam và hoa sen.'),'text/plain','thuyet-minh.txt');assert.equal(txt.content,'Thuyết minh tiếng Việt\nGốm men lam và hoa sen.');
  assert.equal((await request('/api/resources/'+txt.id,{cookie:''})).status,404);
  await request('/api/artworks/37557/resources',{method:'POST',body:{resourceId:txt.id}});
  assert.equal((await request('/api/resources/'+txt.id,{cookie:''})).status,200);
  const range=await request('/api/resources/'+txt.id+'/file',{cookie:'',headers:{Range:'bytes=0-9'}});assert.equal(range.status,206);assert.equal(range.buffer.length,10);assert.match(range.headers.get('content-range'),/^bytes 0-9\//);
  assert.equal((await request('/api/resources/'+txt.id+'/file',{headers:{Range:'bytes=999999-'}})).status,416);
  const image=await upload(await sharp({create:{width:20,height:30,channels:3,background:'red'}}).png().toBuffer(),'image/png','ảnh.png');assert.equal(image.mimeType,'image/webp');assert.equal(image.width,20);assert.equal((await db.getImageVector(image.id)).vector.length,64);
  const wav=Buffer.alloc(44+16000);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(16000,40);
  const wave=await upload(wav,'audio/wav','ban-thu.wav');assert.equal(wave.duration,1);assert.equal(wave.language,'vi-VN');
  const manifest=JSON.parse(await readFile(new URL('../dist/assets/samples/manifest.json',import.meta.url),'utf8'));
  for(const format of ['pdf','docx','mp3']){const sample=manifest.resources.find(r=>r.url.endsWith('.'+format));const media=await upload(await readFile(new URL('../dist'+sample.url,import.meta.url)),sample.mimeType,'mau.'+format);if(format==='pdf')assert.ok(media.pageCount>0);if(format==='docx')assert.ok(media.content.includes('Việt'));if(format==='mp3')assert.ok(media.duration>30&&media.language==='vi-VN');}
  const sampleVideo=manifest.resources.find(r=>r.kind==='video'),video=await readFile(new URL('../dist'+sampleVideo.url,import.meta.url));
  const largeVideo=Buffer.concat([video,Buffer.alloc(51*1024*1024)]),id=await init(largeVideo,'video/mp4','video-lon.mp4');
  let part=await request('/api/uploads/'+id+'/chunk',{method:'PUT',headers:{'Content-Type':'application/octet-stream','Upload-Offset':'0'},body:largeVideo.subarray(0,6*1024*1024)});assert.equal(part.data.offset,6*1024*1024);
  assert.equal((await request('/api/uploads/'+id+'/status',{cookie:readerCookie})).status,403);
  assert.equal((await request('/api/uploads/'+id+'/chunk',{method:'PUT',headers:{'Upload-Offset':'0'},body:Buffer.from('x')})).status,409);
  assert.equal((await request('/api/uploads/'+id+'/complete',{method:'POST'})).status,409);
  const resumed=(await request('/api/uploads/'+id+'/status')).data.upload;assert.equal(resumed.offset,6*1024*1024);
  const fresh=await connectDatabase({schema:db.schema});try{assert.equal(Number((await fresh.db.query('SELECT offset_bytes FROM upload_intents WHERE id=$1',[id])).rows[0].offset_bytes),resumed.offset);}finally{await fresh.client.close();}
  for(let offset=resumed.offset;offset<largeVideo.length;offset+=6*1024*1024){part=await request('/api/uploads/'+id+'/chunk',{method:'PUT',headers:{'Upload-Offset':String(offset)},body:largeVideo.subarray(offset,offset+6*1024*1024)});assert.equal(part.status,200);}
  const complete=await request('/api/uploads/'+id+'/complete',{method:'POST'});assert.equal(complete.status,201,JSON.stringify(complete.data));assert.ok(complete.data.media.duration>30);assert.ok(complete.data.media.sizeBytes>50*1024*1024);
  const repeat=await request('/api/uploads/'+id+'/complete',{method:'POST'});assert.equal(repeat.data.media.id,id);assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM videos WHERE resource_id=$1',[id])).rows[0].n,1);
  const invalid=await init(Buffer.from('%PDF-fake'),'application/pdf','gia.pdf');await request('/api/uploads/'+invalid+'/chunk',{method:'PUT',headers:{'Upload-Offset':'0'},body:Buffer.from('%PDF-fake')});assert.equal((await request('/api/uploads/'+invalid+'/complete',{method:'POST'})).status,422);assert.equal(await db.getMedia(invalid),null);
  const expired=await init(Buffer.from('a'),'text/plain');await db.query("UPDATE upload_intents SET expires_at=now()-interval '1 second' WHERE id=$1",[expired]);assert.equal((await request('/api/uploads/'+expired+'/status')).status,422);
  await request('/api/resources/'+image.id,{method:'DELETE'});assert.ok(await stat(path.join(uploadDir,image.url.split('/').pop())));const cleanup=await request('/api/admin/cleanup',{method:'POST'});assert.equal(cleanup.data.removed,1);await assert.rejects(stat(path.join(uploadDir,image.url.split('/').pop())),{code:'ENOENT'});
  assert.deepEqual(errors,[]);
});
test('Multimedia: user CRUD, last administrator guard, session revocation and private favorites',async t=>{
  const {db,request,reader,admin,readerCookie,errors}=await fixture(t);
  assert.equal((await request('/api/users',{cookie:readerCookie})).status,403);
  const accounts=await request('/api/users');assert.equal(accounts.status,200);assert.ok(accounts.data.items.every(u=>!u.passwordHash&&!u.password_hash));
  assert.equal((await request('/api/users/'+admin._id,{method:'DELETE'})).status,409);
  assert.equal((await request('/api/users/'+admin._id,{method:'PUT',body:{role:'user'}})).status,409);
  const created=await request('/api/users',{method:'POST',body:{name:'Người dùng mới',email:'new@example.test',username:'new-reader',password:'new reader password',role:'user'}});assert.equal(created.status,201,JSON.stringify(created.data));const id=created.data.user.id;
  const login=await request('/api/auth/login',{method:'POST',cookie:'',body:{email:'new-reader',password:'new reader password'}});assert.equal(login.status,200);const token=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/api/favorites/37557',{method:'PUT',cookie:token})).status,200);assert.deepEqual((await request('/api/favorites',{cookie:token})).data.ids,['37557']);assert.deepEqual((await request('/api/favorites',{cookie:readerCookie})).data.ids,[]);
  assert.equal((await request('/api/favorites/37557',{method:'DELETE',cookie:token})).status,200);assert.deepEqual((await request('/api/favorites',{cookie:token})).data.ids,[]);
  const locked=await request('/api/users/'+id,{method:'PUT',body:{active:false}});assert.equal(locked.status,200);assert.equal((await request('/api/session',{cookie:token})).data.user,null);assert.equal((await request('/api/auth/login',{method:'POST',body:{email:'new-reader',password:'new reader password'}})).status,401);
  assert.equal((await request('/api/users/'+id,{method:'DELETE'})).status,200);assert.equal(await db.getUser(id),null);
  await request('/api/users/'+reader._id,{method:'PUT',body:{role:'admin'}});assert.equal((await request('/api/session',{cookie:readerCookie})).data.user,null);
  const race=await Promise.all([admin._id,reader._id].map(userId=>db.updateUser(userId,{name:'Changed',username:userId===admin._id?'curator':'reader',role:'user',active:true},null).then(()=>200,e=>e.status)));assert.deepEqual(race.sort(),[200,409]);
  assert.deepEqual(errors,[]);
});
test('Multimedia: metadata edits, shared attachments, central event deduplication and statistics',async t=>{
  const {db,request,readerCookie,errors}=await fixture(t);const all=await db.listMedia(),audio=all.find(r=>r.resourceType==='audio');
  const metadata={title:'Lời kể gốm Việt',author:'Nét Việt',topics:['Gốm thử nghiệm'],tags:['hoa sen'],description:'Bản mô tả cập nhật',license:'Tư liệu học tập',source:'https://example.org/source',transcript:'Nội dung tiếng Việt mới.'};
  assert.equal((await request('/api/resources/'+audio.id,{method:'PUT',cookie:readerCookie,body:metadata})).status,403);
  assert.equal((await request('/api/resources/'+audio.id,{method:'PUT',body:{...metadata,source:'javascript:alert(1)'}})).status,422);
  assert.equal((await request('/api/resources/'+audio.id,{method:'PUT',body:metadata})).status,200);
  const search=await request('/api/search?kind=audio&author=net%20viet&topic=gom%20thu%20nghiem&tag=hoa%20sen');assert.equal(search.data.total,1);assert.equal(search.data.items[0].id,audio.id);
  for(let n=0;n<2;n++){await request('/api/resources/'+audio.id+'/events?visitor=one',{method:'POST',cookie:'',body:{action:'view'}});await request('/api/resources/'+audio.id+'/file?download=1&visitor=one',{cookie:''});}
  await request('/api/resources/'+audio.id+'/events?visitor=two',{method:'POST',cookie:'',body:{action:'view'}});
  const stats=await request('/api/stats',{cookie:''});assert.equal(stats.status,200,JSON.stringify(stats.data));assert.equal(stats.data.totals.resources,49);assert.equal(stats.data.byKind.length,5);assert.equal(stats.data.topViewed[0].id,audio.id);assert.equal(stats.data.topViewed[0].count,2);assert.equal(stats.data.topDownloaded[0].count,1);assert.ok(stats.data.topArtworks.length>0);assert.ok(stats.data.byTopic.find(t=>t.name==='Gốm thử nghiệm').views===2);
  const artifact=await db.getArtwork('37557'),resources=await db.artworkResources('37557'),extra=all.find(r=>r.resourceType==='audio'&&!resources.some(x=>x.id===r.id));
  const attached=await request('/api/artworks/37557/resources',{method:'POST',body:{resourceId:extra.id}});assert.equal(attached.status,200);assert.equal((await db.getArtwork('37557')).revision,artifact.revision+1);
  const updated=await db.getArtwork('37557');const data={...updated,resourceIds:[],revision:updated.revision};const saved=await request('/api/artworks/37557',{method:'PUT',body:data});assert.equal(saved.status,200,JSON.stringify(saved.data));assert.ok(!(await db.artworkResources('37557')).some(r=>r.id===extra.id));assert.ok(await db.getMedia(extra.id));
  assert.deepEqual(errors,[]);
});
