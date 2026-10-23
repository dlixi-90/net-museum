import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {loadEnvFile} from 'node:process';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {connectDatabase,initializeDatabase} from '../server/db.mjs';
import {createApp} from '../server/app.mjs';
import {passwordHash,passwordMatches,newSession,hashToken} from '../server/auth.mjs';
import {HttpError} from '../server/validation.mjs';

try{loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
async function fixture(t,{seed=false}={}) {
  const schema='net_test_'+randomUUID().replaceAll('-','');
  const connection=await connectDatabase({schema});
  const {db,client}=connection;const servers=[];
  t.after(async()=>{
    for(const server of servers)if(server.listening)await new Promise(resolve=>server.close(resolve));
    assert.match(schema,/^net_test_[a-f0-9]{32}$/);
    try{await db.query(`DROP SCHEMA "${schema}" CASCADE`);}finally{await client.close();}
  });
  await initializeDatabase(db,{seed});
  const start=async options=>{
    const server=createApp({db,...options});servers.push(server);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base=`http://127.0.0.1:${server.address().port}`;
    return {server,async call(route,{method='GET',body,cookie='',headers={}}={}){
      const binary=Buffer.isBuffer(body);
      const response=await fetch(base+route,{method,headers:{...(body&&!binary?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...headers},body:body?(binary?body:JSON.stringify(body)):undefined});
      return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],setCookie:response.headers.get('set-cookie')};
    }};
  };
  return {db,start,schema};
}
const credentials={name:'Demo curator',email:'curator@example.test',password:'a long test password'};
const artwork={title:'Sen thử nghiệm',author:'Nghệ sĩ thử',period:'Năm 2020',year:2020,category:'painting',material:'Sơn dầu',origin:'Việt Nam',description:'Isolated PostgreSQL fixture',tags:['sen'],source:'',license:'Fixture'};
async function setup(call,email=credentials.email) {
  const result=await call('/api/auth/setup',{method:'POST',body:{...credentials,email}});
  assert.equal(result.status,201);return result.cookie;
}

test('PostgreSQL: normalized schema, FK/CHECK, rollback, shared media, seed persistence and 15 SQL queries',async t=>{
  const {db}=await fixture(t,{seed:true});
  assert.equal((await db.listArtworks()).length,7);
  assert.equal((await db.getArtwork('37557')).imageId,'met-37557');
  const tables=(await db.query('SELECT tablename FROM pg_tables WHERE schemaname=$1',[db.schema])).rows;
  assert.equal(tables.length,27);
  await assert.rejects(db.query("INSERT INTO artifact_resources(artifact_id,resource_id,kind,purpose) VALUES('37557','missing','image','gallery')"),{code:'23503'});
  await assert.rejects(db.query("INSERT INTO videos(resource_id) VALUES('met-37557')"),{code:'23503'});
  await assert.rejects(db.query("UPDATE resources SET size_bytes=-1 WHERE id='met-37557'"),{code:'23514'});
  await assert.rejects(db.query("UPDATE images SET color_vector=ARRAY[1.0,0.0] WHERE resource_id='met-37557'"),{code:'23514'});
  await assert.rejects(db.transaction(async tx=>{await tx.query("INSERT INTO keywords(name) VALUES('rollback fixture')");throw new Error('rollback');}),/rollback/);
  assert.equal((await db.query("SELECT 1 FROM keywords WHERE name='rollback fixture'")).rowCount,0);
  const injection="'; DROP TABLE users;--";
  const item=await db.saveArtwork({...artwork,title:injection,imageId:'met-37557'});
  assert.equal(item.title,injection);await db.query('SELECT COUNT(*) FROM users');
  assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM artifact_resources WHERE resource_id='met-37557'")).rows[0].n,2);
  const before=await db.getArtwork('37557');
  await db.saveArtwork({...before,title:'Edited seed survives'},{id:before.id,revision:before.revision});
  await initializeDatabase(db);
  assert.equal((await db.getArtwork('37557')).title,'Edited seed survives');
  const vector=Array(64).fill(0);vector[0]=1;
  await db.query('UPDATE images SET color_vector=NULL');
  await db.query("UPDATE images SET color_vector=$1 WHERE resource_id IN ('met-37557','met-37450')",[vector]);
  const results=await db.query(await readFile(new URL('../database/queries.sql',import.meta.url),'utf8'));
  assert.equal(results.length,15);assert.equal(results[14].rows.length,1);assert.equal(Number(results[14].rows[0].similarity),1);
});

test('PostgreSQL HTTP: registration, hashing, sessions, admin permissions, revocation and shared rate limit',async t=>{
  const {db,start}=await fixture(t);
  const first=await start({allowSetup:true,adminEmails:credentials.email,secureCookies:true});
  assert.deepEqual((await first.call('/api/health')).body,{database:'postgresql',connected:true});
  assert.equal((await first.call('/api/artworks',{method:'POST',body:{}})).status,401);
  const payload={name:'Người xem',email:'NEW@example.test',password:'user account password',confirmPassword:'user account password',role:'admin'};
  const registered=await first.call('/api/auth/register',{method:'POST',body:payload});
  assert.equal(registered.status,201);assert.equal(registered.body.user.role,'user');assert.match(registered.setCookie,/HttpOnly/);assert.match(registered.setCookie,/Secure/);
  const stored=await db.getUserByEmail('new@example.test');
  assert.notEqual(stored.passwordHash,payload.password);assert.equal(await passwordMatches(payload.password,stored.passwordHash),true);
  assert.equal(registered.body.user.passwordHash,undefined);
  for(const path of ['/api/artworks','/api/uploads','/api/uploads/sign','/api/uploads/complete'])assert.equal((await first.call(path,{method:'POST',body:{},cookie:registered.cookie})).status,403);
  assert.equal((await first.call('/api/auth/register',{method:'POST',body:payload})).status,409);
  assert.equal((await first.call('/api/auth/register',{method:'POST',body:{...payload,email:credentials.email}})).status,403);
  assert.equal((await first.call('/api/auth/register',{method:'POST',body:{...payload,confirmPassword:'wrong'}})).status,422);
  const race=await Promise.all([1,2].map(()=>first.call('/api/auth/register',{method:'POST',body:{...payload,email:'race@example.test'}})));
  assert.deepEqual(race.map(r=>r.status).sort(),[201,409]);
  const adminCookie=await setup(first.call);
  assert.equal((await first.call('/api/session',{cookie:adminCookie})).body.user.role,'admin');
  assert.equal((await first.call('/api/auth/setup',{method:'POST',body:credentials})).status,409);
  const revoked=await start({adminEmails:[],allowSetup:false});
  await db.query("UPDATE users SET role='user' WHERE email=$1",[credentials.email]);
  assert.equal((await revoked.call('/api/session',{cookie:adminCookie})).body.user.role,'user');
  assert.equal((await revoked.call('/api/artworks',{method:'POST',body:{},cookie:adminCookie})).status,403);
  assert.equal((await revoked.call('/api/auth/setup',{method:'POST',body:credentials})).status,403);
  const expired=await newSession(db,stored);
  await db.query('UPDATE sessions SET expires_at=now()-interval \'1 second\' WHERE token_hash=$1',[hashToken(expired)]);
  assert.equal((await first.call('/api/session',{cookie:'net_session='+expired})).body.user,null);
  await first.call('/api/auth/logout',{method:'POST',cookie:registered.cookie});
  assert.equal((await first.call('/api/session',{cookie:registered.cookie})).body.user,null);
  assert.equal((await first.call('/api/auth/login',{method:'POST',body:{email:stored.email,password:payload.password}})).status,200);
  await db.query('UPDATE users SET active=false WHERE id=$1',[stored._id]);
  assert.equal((await first.call('/api/auth/login',{method:'POST',body:{email:stored.email,password:payload.password}})).status,401);
  await db.query('UPDATE auth_limits SET count=10');
  const second=await start({adminEmails:credentials.email});
  assert.equal((await second.call('/api/auth/register',{method:'POST',body:{...payload,email:'limited@example.test'}})).status,429);
});

test('PostgreSQL HTTP: real image decoding, video references, atomic writes, revision conflicts and restart',async t=>{
  const {db,start,schema}=await fixture(t,{seed:true});
  let uploadFailure=false,insertFailure=false;const removed=[];
  const storage={assertConfigured(){},async upload(buffer,{id,resourceType}){
    if(uploadFailure)throw new HttpError(502,'Fixture storage unavailable');
    return {url:`https://res.cloudinary.com/test/${id}`,storage:'cloudinary',publicId:`net-museum/${id}`,resourceType,mimeType:resourceType==='image'?'image/webp':'video/mp4',format:resourceType==='image'?'WEBP':'MP4',sizeBytes:buffer.length,width:24,height:20,...(resourceType==='video'?{duration:1.5}:{})};
  },async remove(asset){removed.push(asset);}};
  const proxied=new Proxy(db,{get(target,key){if(key==='insertMedia'&&insertFailure)return async()=>{throw new Error('Simulated media database failure');};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
  const {call}=await start({db:proxied,allowSetup:true,adminEmails:credentials.email,mediaStorage:storage});
  const cookie=await setup(call);
  assert.equal((await call('/api/uploads',{method:'POST',cookie,body:Buffer.from('<svg/>'),headers:{'Content-Type':'image/png'}})).status,422);
  const image=await sharp({create:{width:24,height:20,channels:3,background:'#b36549'}}).png().toBuffer();
  const upload=await call('/api/uploads',{method:'POST',cookie,body:image,headers:{'Content-Type':'image/png'}});
  assert.equal(upload.status,201);assert.equal(upload.body.media.format,'WEBP');
  assert.equal((await call('/api/uploads',{method:'POST',cookie,body:Buffer.alloc(9*1024*1024),headers:{'Content-Type':'image/png'}})).status,413);
  assert.equal((await call('/api/uploads',{method:'POST',cookie,body:Buffer.from('fake'),headers:{'Content-Type':'video/mp4'}})).status,422);
  assert.equal((await call('/api/uploads',{method:'POST',cookie,body:Buffer.alloc(51*1024*1024),headers:{'Content-Type':'video/mp4'}})).status,413);
  const video=await call('/api/uploads',{method:'POST',cookie,body:Buffer.from('000000186674797069736f6d','hex'),headers:{'Content-Type':'video/mp4'}});
  assert.equal(video.status,201);
  uploadFailure=true;assert.equal((await call('/api/uploads',{method:'POST',cookie,body:image,headers:{'Content-Type':'image/png'}})).status,502);uploadFailure=false;
  insertFailure=true;assert.equal((await call('/api/uploads',{method:'POST',cookie,body:image,headers:{'Content-Type':'image/png'}})).status,503);insertFailure=false;assert.equal(removed.length,1);
  const data={...artwork,imageId:upload.body.media.id,videoId:video.body.media.id};
  assert.equal((await call('/api/artworks',{method:'POST',cookie,body:{...data,imageId:data.videoId}})).status,422);
  assert.equal((await call('/api/artworks',{method:'POST',cookie,body:data,headers:{Origin:'https://untrusted.example'}})).status,403);
  const created=await call('/api/artworks',{method:'POST',cookie,body:data});assert.equal(created.status,201);
  const id=created.body.item.id;assert.equal(created.body.item.videoDuration,1.5);
  const updates=await Promise.all(['First edit','Second edit'].map(title=>call('/api/artworks/'+id,{method:'PUT',cookie,body:{...data,title,revision:1}})));
  assert.deepEqual(updates.map(r=>r.status).sort(),[200,409]);
  assert.equal((await db.query('SELECT COUNT(*)::int AS total FROM audit_logs WHERE artifact_id=$1',[id])).rows[0].total,2);
  const fresh=await connectDatabase({schema});
  try{assert.equal((await fresh.db.getArtwork(id)).revision,2);}finally{await fresh.client.close();}
  const removedVideo=await call('/api/artworks/'+id,{method:'PUT',cookie,body:{...data,videoId:'',revision:2}});
  assert.equal(removedVideo.status,200);assert.equal(removedVideo.body.item.video,'');assert.ok(await db.getMedia(data.videoId));
});

test('PostgreSQL signed uploads: ownership, expiry, verified metadata and idempotent completion',async t=>{
  const {db,start}=await fixture(t);const emails=['one@example.test','two@example.test'];
  const cookies=[];for(const email of emails){const user=await db.createUser({_id:randomUUID(),name:'Curator',email,passwordHash:await passwordHash('fixture password'),role:'admin'});cookies.push('net_session='+await newSession(db,user));}
  let verified=0;
  const storage={signUpload({id,resourceType}){return {url:`https://api.cloudinary.com/v1_1/test/${resourceType}/upload`,fields:{public_id:`net-museum/${resourceType}/${id}`,signature:'fixture'}};},async resolveUpload({id,resourceType}){verified++;return {url:`https://res.cloudinary.com/test/${id}`,resourceType,mimeType:resourceType==='image'?'image/webp':'video/mp4',sizeBytes:100,format:resourceType==='image'?'WEBP':'MP4',width:20,height:20};}};
  const {call}=await start({adminEmails:emails,mediaStorage:storage,directUploads:true});
  assert.equal((await call('/api/uploads/sign',{method:'POST',body:{mimeType:'image/png',sizeBytes:100}})).status,401);
  const signed=await call('/api/uploads/sign',{method:'POST',cookie:cookies[0],body:{mimeType:'image/png',sizeBytes:100,public_id:'forged'}});
  assert.equal(signed.status,201);const {id}=signed.body.upload;
  assert.equal(signed.body.upload.fields.public_id,`net-museum/image/${id}`);
  assert.equal((await call('/api/uploads/complete',{method:'POST',cookie:cookies[1],body:{id}})).status,422);assert.equal(verified,0);
  const completed=await call('/api/uploads/complete',{method:'POST',cookie:cookies[0],body:{id,url:'https://evil.example',sizeBytes:1}});
  assert.equal(completed.status,201);assert.match(completed.body.media.url,/^https:\/\/res.cloudinary.com\//);assert.equal(completed.body.media.sizeBytes,100);
  assert.equal((await call('/api/uploads/complete',{method:'POST',cookie:cookies[0],body:{id}})).status,200);assert.equal(verified,1);
  const next=await call('/api/uploads/sign',{method:'POST',cookie:cookies[0],body:{mimeType:'video/mp4',sizeBytes:100}});
  await db.query('UPDATE upload_intents SET expires_at=now()-interval \'1 second\' WHERE id=$1',[next.body.upload.id]);
  assert.equal((await call('/api/uploads/complete',{method:'POST',cookie:cookies[0],body:{id:next.body.upload.id}})).status,422);
});
