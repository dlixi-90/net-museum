import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {connectDatabase,initializeDatabase} from '../server/db.mjs';
import {createApp} from '../server/app.mjs';
import {passwordMatches} from '../server/auth.mjs';

test('public registration persists hashed credentials, creates a user session, protects admins and rejects duplicate/invalid requests',async()=>{
 const name='net_test_registration_'+randomUUID().replaceAll('-','');
 const {client,db}=await connectDatabase({name});let server,second;
 const password=randomUUID()+'!Aa',payload={name:'Người xem nghệ thuật',email:'NEW@example.test',password,confirmPassword:password,role:'admin',isAdmin:true};
 const start=async()=>{const app=createApp({db,adminEmails:'admin@example.test',secureCookies:true});await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));return app;};
 const call=async(path,{body,method=body?'POST':'GET',cookie='',origin,app=server}={})=>{
  const response=await fetch(`http://127.0.0.1:${app.address().port}`+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})},body:body?JSON.stringify(body):undefined});
  return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')};
 };
 try{
  await initializeDatabase(db,{seed:false});server=await start();
  const registered=await call('/api/auth/register',{body:payload});
  assert.equal(registered.status,201);assert.equal(registered.body.user.role,'user');assert.equal(registered.body.user.email,'new@example.test');
  assert.match(registered.cookie,/HttpOnly/);assert.match(registered.cookie,/SameSite=Strict/);assert.match(registered.cookie,/Secure/);
  assert.equal(registered.body.user.passwordHash,undefined);
  const cookie=registered.cookie.split(';')[0],stored=await db.collection('users').findOne({email:'new@example.test'});
  assert.equal(stored.role,'user');assert.equal(stored.isAdmin,undefined);assert.equal(stored.password,undefined);assert.notEqual(stored.passwordHash,password);assert.equal(await passwordMatches(password,stored.passwordHash),true);
  assert.equal((await call('/api/session',{cookie})).body.user.role,'user');
  for(const path of ['/api/artworks','/api/uploads','/api/uploads/sign','/api/uploads/complete'])assert.equal((await call(path,{body:{},cookie})).status,403,path);
  const duplicate=await call('/api/auth/register',{body:{...payload,password:'different password',confirmPassword:'different password'}});
  assert.equal(duplicate.status,409);assert.equal(duplicate.body.fields.email,'Email đã có tài khoản.');
  assert.equal((await db.collection('users').findOne({email:'new@example.test'})).passwordHash,stored.passwordHash);
  assert.equal((await call('/api/auth/register',{body:{...payload,email:'ADMIN@EXAMPLE.TEST'}})).status,403);
  assert.equal(await db.collection('users').countDocuments({email:'admin@example.test'}),0);
  assert.equal((await call('/api/auth/register',{body:{...payload,confirmPassword:'mismatch'}})).status,422);
  for(const invalid of [{...payload,name:''},{...payload,email:'bad'},{...payload,password:'short',confirmPassword:'short'},[]])assert.equal((await call('/api/auth/register',{body:invalid})).status,422);
  assert.equal((await call('/api/auth/register',{body:payload,origin:'https://untrusted.example'})).status,403);
  assert.equal((await call('/api/auth/setup',{body:payload})).status,403);
  await call('/api/auth/logout',{body:{},cookie});assert.equal((await call('/api/session',{cookie})).body.user,null);
  assert.equal((await call('/api/auth/login',{body:{email:'new@example.test',password}})).body.user.role,'user');
  const race=await Promise.all([1,2].map(()=>call('/api/auth/register',{body:{...payload,email:'race@example.test'}})));
  assert.deepEqual(race.map(r=>r.status).sort(),[201,409]);assert.equal(await db.collection('users').countDocuments({email:'race@example.test'}),1);
  await db.collection('auth_limits').updateMany({},{$set:{count:10}});second=await start();
  assert.equal((await call('/api/auth/register',{body:{...payload,email:'limited@example.test'},app:second})).status,429);
  assert.equal(await db.collection('users').countDocuments({email:'limited@example.test'}),0);
 }finally{
  for(const app of [server,second])if(app?.listening)await new Promise(resolve=>app.close(resolve));
  assert.ok(name.startsWith('net_test_registration_'));await db.dropDatabase();await client.close();
 }
});
