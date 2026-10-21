import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {connectDatabase,initializeDatabase} from '../server/db.mjs';
import {createRequestHandler} from '../server/app.mjs';
import {newSession} from '../server/auth.mjs';
import {HttpError} from '../server/validation.mjs';

test('direct uploads require admin ownership, verify assets server-side, expire and complete idempotently',async()=>{
 const name='net_test_direct_'+randomUUID().replaceAll('-','');
 const {client,db}=await connectDatabase({name});let server,failed=false,verified=0;
 const storage={
  signUpload({id,resourceType}){return {url:`https://api.cloudinary.com/v1_1/test/${resourceType}/upload`,fields:{public_id:`net-museum/${resourceType}/${id}`,signature:'test-signature',api_key:'public-key'}};},
  async resolveUpload({id,resourceType}){
   verified++;if(failed)throw new HttpError(502,'Cloudinary unavailable');
   return {storage:'cloudinary',publicId:`net-museum/${resourceType}/${id}`,resourceType,url:`https://res.cloudinary.com/test/${id}`,mimeType:resourceType==='image'?'image/webp':'video/mp4',sizeBytes:100,format:resourceType==='image'?'WEBP':'MP4'};
  }
 };
 try{
  await initializeDatabase(db,{seed:false});
  const users=[{_id:'first',email:'first@example.test'},{_id:'second',email:'second@example.test'},{_id:'reader',email:'reader@example.test',role:'admin'}];
  await db.collection('users').insertMany(users);
  const cookies=[];for(const user of users)cookies.push('net_session='+await newSession(db,user));
  server=createServer(createRequestHandler({db,mediaStorage:storage,adminEmails:users.slice(0,2).map(u=>u.email),directUploads:true}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  const call=async(route,body,cookie=cookies[0])=>{
   const response=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
   return {status:response.status,body:await response.json()};
  };
  for(const route of ['/api/uploads/sign','/api/uploads/complete']){
   assert.equal((await call(route,{},'')).status,401);
   assert.equal((await call(route,{},cookies[2])).status,403);
  }
  assert.equal(await db.collection('upload_intents').countDocuments(),0);
  assert.equal((await call('/api/uploads/sign',{mimeType:'text/html',sizeBytes:1})).status,415);
  assert.equal((await call('/api/uploads/sign',{mimeType:'image/png',sizeBytes:9*1024*1024})).status,413);
  assert.equal((await call('/api/uploads/sign',{mimeType:'video/mp4',sizeBytes:51*1024*1024})).status,413);
  const signed=await call('/api/uploads/sign',{mimeType:'image/png',sizeBytes:100,public_id:'forged'});
  assert.equal(signed.status,201);const {id}=signed.body.upload;
  assert.equal(signed.body.upload.fields.public_id,`net-museum/image/${id}`);
  assert.equal((await call('/api/uploads/complete',{id},cookies[1])).status,422);
  assert.equal(verified,0);
  const completed=await call('/api/uploads/complete',{id,url:'https://attacker.test/file',sizeBytes:1});
  assert.equal(completed.status,201);assert.match(completed.body.media.url,/^https:\/\/res.cloudinary.com\//);assert.equal(completed.body.media.sizeBytes,100);
  assert.equal((await call('/api/uploads/complete',{id})).status,200);assert.equal(verified,1);assert.equal(await db.collection('media').countDocuments({id}),1);
  const video=await call('/api/uploads/sign',{mimeType:'video/webm',sizeBytes:8*1024*1024});
  assert.equal(video.status,201);assert.match(video.body.upload.url,/\/video\/upload$/);
  failed=true;assert.equal((await call('/api/uploads/complete',{id:video.body.upload.id})).status,502);
  assert.equal(await db.collection('media').countDocuments({id:video.body.upload.id}),0);
  failed=false;assert.equal((await call('/api/uploads/complete',{id:video.body.upload.id})).body.media.mimeType,'video/mp4');
  const expired=await call('/api/uploads/sign',{mimeType:'image/jpeg',sizeBytes:100});
  await db.collection('upload_intents').updateOne({_id:expired.body.upload.id},{$set:{expiresAt:new Date(Date.now()-1000)}});
  assert.equal((await call('/api/uploads/complete',{id:expired.body.upload.id})).status,422);
  assert.equal((await call('/api/uploads/complete',{id:randomUUID()})).status,422);
  assert.equal((await fetch(base+'/api/session')).status,200);
  assert.equal((await(await fetch(base+'/api/session')).json()).directUploads,true);
 }finally{
  if(server?.listening)await new Promise(resolve=>server.close(resolve));
  assert.ok(name.startsWith('net_test_direct_'));await db.dropDatabase();await client.close();
 }
});
