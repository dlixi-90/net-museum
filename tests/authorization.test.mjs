import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {connectDatabase,initializeDatabase} from '../server/db.mjs';
import {createApp} from '../server/app.mjs';
import {passwordHash,newSession,hashToken} from '../server/auth.mjs';

test('HTTP permissions: guests/readers denied, two allowed admins admitted, revocation and setup restrictions',async()=>{
  const name='net_test_authorization_'+randomUUID().replaceAll('-','');
  const {client,db}=await connectDatabase({name});let server,base;
  const emails=['first@example.test','second@example.test'],password=randomUUID()+'!Aa';
  const start=async(adminEmails=emails,allowSetup=true)=>{
    server=createApp({db,adminEmails,allowSetup});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
  };
  const stop=()=>new Promise(resolve=>server.close(resolve));
  const call=async(route,{method='GET',body,cookie='',headers={}}={})=>{
    const response=await fetch(base+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...headers},body:body?JSON.stringify(body):undefined});
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  const deniedWrites=async(cookie,status)=>{
    for(const [route,method] of [['/api/artworks','POST'],['/api/artworks/37557','PUT'],['/api/uploads','POST'],['/api/uploads/sign','POST'],['/api/uploads/complete','POST']]){
      assert.equal((await call(route,{method,body:{role:'admin',email:emails[0]},cookie,headers:{'X-User-Role':'admin'}})).status,status,route);
    }
  };
  try{
    await initializeDatabase(db,{seed:false});await start();
    assert.equal((await call('/api/session')).body.user,null);
    await deniedWrites('',401);await deniedWrites('net_session='+'a'.repeat(64),401);
    assert.equal((await call('/api/auth/setup',{method:'POST',body:{email:'intruder@example.test',name:'Intruder',password}})).status,403);
    const cookies=[];
    for(const email of emails){
      const setup=await call('/api/auth/setup',{method:'POST',body:{email:email.toUpperCase(),name:'Curator',password,role:'user'}});
      assert.equal(setup.status,201);assert.equal(setup.body.user.role,'admin');cookies.push(setup.cookie);
      assert.equal((await call('/api/session',{cookie:setup.cookie})).body.user.role,'admin');
    }
    assert.equal(await db.collection('users').countDocuments({}),2);
    assert.equal((await call('/api/auth/setup',{method:'POST',body:{email:emails[0],name:'Duplicate',password}})).status,409);
    const reader={_id:'old-admin',name:'Reader',email:'reader@example.test',role:'admin',passwordHash:await passwordHash(password)};
    await db.collection('users').insertOne(reader);
    const login=await call('/api/auth/login',{method:'POST',body:{email:reader.email,password,role:'admin'}});
    assert.equal(login.status,200);assert.equal(login.body.user.role,'user');await deniedWrites(login.cookie,403);
    assert.equal((await call('/api/session',{cookie:login.cookie})).body.user.role,'user');
    assert.equal((await call('/api/artworks',{cookie:login.cookie})).status,200);
    assert.equal((await call('/api/auth/login',{method:'POST',body:{email:emails[0],password:'incorrect'}})).status,401);
    await db.collection('media').insertOne({id:'test-image',url:'/assets/37557.jpg',mimeType:'image/jpeg',sizeBytes:100,format:'JPG'});
    const data={title:'Permission test',period:'2020',year:2020,material:'Sơn dầu',description:'Isolated authorization fixture',category:'painting',tags:[],imageId:'test-image'};
    const created=await call('/api/artworks',{method:'POST',body:data,cookie:cookies[0]});assert.equal(created.status,201);
    assert.equal((await call('/api/artworks/'+created.body.item.id,{method:'PUT',body:{...data,title:'Second admin edited',revision:1},cookie:cookies[1]})).status,200);
    assert.equal((await call('/api/auth/logout',{method:'POST',cookie:cookies[1]})).status,200);await deniedWrites(cookies[1],401);
    await stop();await start([emails[1]],false);
    assert.equal((await call('/api/session',{cookie:cookies[0]})).body.user.role,'user');await deniedWrites(cookies[0],403);
    assert.equal((await call('/api/auth/setup',{method:'POST',body:{email:emails[1],name:'Blocked remotely',password}})).status,403);
    assert.equal((await call('/api/session')).body.setupAvailable,false);
    const token=await newSession(db,reader);
    await db.collection('sessions').updateOne({_id:hashToken(token)},{$set:{expiresAt:new Date(Date.now()-1000)}});
    assert.equal((await call('/api/session',{cookie:'net_session='+token})).body.user,null);
    await stop();await start([],false);await deniedWrites(cookies[0],403);
  }finally{
    if(server?.listening)await stop();assert.ok(name.startsWith('net_test_authorization_'));await db.dropDatabase();await client.close();
  }
});
