import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import {connectDatabase,initializeDatabase} from '../server/db.mjs';
import {createApp} from '../server/app.mjs';

test('MongoDB integration: authentication, image upload, create/edit, conflicts and restart persistence',async()=>{
  const dbName='net_test_'+randomUUID().replaceAll('-','');
  const {client,db}=await connectDatabase({name:dbName});
  const uploadDir=await mkdtemp(path.join(os.tmpdir(),'net-test-'));
  let server,cookie='',base;
  const start=async()=>{server=createApp({db,uploadDir,allowSetup:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;};
  const stop=()=>new Promise(r=>server.close(r));
  const call=async(route,{method='GET',body,headers={},authenticated=true}={})=>{
    const response=await fetch(base+route,{method,headers:{...(authenticated&&cookie?{Cookie:cookie}:{}),...(body&&typeof body==='object'&&!Buffer.isBuffer(body)?{'Content-Type':'application/json'}:{}),...headers},body:body?(Buffer.isBuffer(body)?body:JSON.stringify(body)):undefined});
    const result=await response.json();return {status:response.status,result,response};
  };
  try{
    await initializeDatabase(db);await start();
    assert.equal((await call('/api/artworks')).result.items.length,7);
    assert.equal((await call('/api/artworks',{method:'POST',body:{},authenticated:false})).status,401);
    const password=randomUUID()+'A!';
    const setup=await call('/api/auth/setup',{method:'POST',body:{name:'Test curator',email:'curator@example.test',password}});
    assert.equal(setup.status,201);cookie=setup.response.headers.get('set-cookie').split(';')[0];assert.match(setup.response.headers.get('set-cookie'),/HttpOnly/);
    const persistedUser=await db.collection('users').findOne({_id:'admin'});assert.notEqual(persistedUser.passwordHash,password);assert.equal(persistedUser.password,undefined);
    assert.equal((await call('/api/auth/setup',{method:'POST',body:{name:'Second',email:'second@example.test',password}})).status,409);
    assert.equal((await call('/api/uploads',{method:'POST',body:Buffer.from('<svg></svg>'),headers:{'Content-Type':'image/png'}})).status,422);
    assert.equal((await call('/api/uploads',{method:'POST',body:Buffer.alloc(9*1024*1024),headers:{'Content-Type':'image/png'}})).status,413);
    const image=await sharp({create:{width:24,height:20,channels:3,background:'#b36549'}}).png().toBuffer();
    const uploaded=await call('/api/uploads',{method:'POST',body:image,headers:{'Content-Type':'image/png'}});assert.equal(uploaded.status,201);assert.equal(uploaded.result.media.format,'WEBP');
    const payload={title:'Sen thử nghiệm',author:'Nghệ sĩ thử',period:'Năm 2020',year:2020,category:'painting',material:'Sơn dầu',origin:'Việt Nam',description:'Bản ghi kiểm thử sẽ được xóa cùng cơ sở dữ liệu thử nghiệm.',tags:['sen'],source:'',license:'Ảnh kiểm thử',imageId:uploaded.result.media.id};
    const created=await call('/api/artworks',{method:'POST',body:payload});assert.equal(created.status,201);const item=created.result.item;
    assert.equal((await db.collection('artworks').findOne({id:item.id})).title,payload.title);
    assert.equal((await fetch(base+item.image)).headers.get('content-type'),'image/webp');
    assert.equal((await call('/api/artworks',{method:'POST',body:{...payload,source:'javascript:alert(1)'}})).status,422);
    assert.equal((await call('/api/artworks',{method:'POST',body:payload,headers:{Origin:'https://untrusted.example'}})).status,403);
    const edited=await call('/api/artworks/'+item.id,{method:'PUT',body:{...payload,title:'Sen đã sửa',revision:1}});assert.equal(edited.status,200);assert.equal(edited.result.item.revision,2);
    assert.equal((await call('/api/artworks/'+item.id,{method:'PUT',body:{...payload,revision:1}})).status,409);
    await stop();await start();const reloaded=await call('/api/artworks/'+item.id);assert.equal(reloaded.result.item.title,'Sen đã sửa');
    await initializeDatabase(db);assert.equal((await db.collection('artworks').findOne({id:item.id})).title,'Sen đã sửa');
    assert.equal(await db.collection('audit_logs').countDocuments({artworkId:item.id}),2);
    assert.equal((await call('/api/auth/logout',{method:'POST'})).status,200);
    assert.equal((await call('/api/artworks/'+item.id,{method:'PUT',body:{...payload,revision:2}})).status,401);
    const login=await call('/api/auth/login',{method:'POST',body:{email:'curator@example.test',password}});assert.equal(login.status,200);
  }finally{
    if(server?.listening)await stop();
    // A unique per-run database and an OS-created temporary directory only.
    assert.ok(dbName.startsWith('net_test_'));await db.dropDatabase();await client.close();
    assert.ok(path.basename(uploadDir).startsWith('net-test-'));await rm(uploadDir,{recursive:true,force:true});
  }
});
