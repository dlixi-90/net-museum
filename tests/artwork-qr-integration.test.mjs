import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadEnvFile} from 'node:process';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import jsQR from 'jsqr';
import {connectDatabase,initializeDatabase} from '../server/db.mjs';
import {createApp} from '../server/app.mjs';
import {newSession,passwordHash} from '../server/auth.mjs';
try{loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('Artwork QR API covers every seeded artwork and immediately supports newly created, edited and deleted artwork',async t=>{
  const schema='net_test_'+randomUUID().replaceAll('-','');
  const {db,client}=await connectDatabase({schema});
  let server;
  t.after(async()=>{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}try{assert.match(schema,/^net_test_[a-f0-9]{32}$/);await db.query(`DROP SCHEMA "${schema}" CASCADE`);}finally{await client.close();}});
  await initializeDatabase(db);
  const admin=await db.createUser({name:'QR test curator',email:'qr-curator@example.test',role:'admin',passwordHash:await passwordHash('isolated qr test password')});
  const cookie='net_session='+await newSession(db,admin);
  server=createApp({db,publicOrigin:'https://museum.example.test'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  async function request(route,{method='GET',body}={}){
    const response=await fetch(base+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
    return {status:response.status,body:await response.json()};
  }
  const items=(await request('/api/artworks')).body.items;
  assert.equal(items.length,7);
  async function verify(id){
    const response=await request('/api/artworks/'+id+'/qr');assert.equal(response.status,200);
    const {data,info}=await sharp(Buffer.from(response.body.image.split(',')[1],'base64')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const decoded=jsQR(new Uint8ClampedArray(data),info.width,info.height);
    assert.equal(decoded?.data,'https://museum.example.test/tac-pham/?id='+id);
    const target=new URL(decoded.data);
    assert.equal((await fetch(base+target.pathname+target.search)).status,200);
    assert.equal((await request('/api/artworks/'+target.searchParams.get('id'))).body.item.id,id);
    return decoded.data;
  }
  for(const item of items)await verify(item.id);
  const body={title:'Tác phẩm mới có QR',description:'Hồ sơ kiểm tra mã QR tự động.',category:'blue',period:'Thế kỷ XV',year:1450,material:'Gốm',imageId:items[0].imageId,tags:[]};
  const created=await request('/api/artworks',{method:'POST',body});assert.equal(created.status,201,JSON.stringify(created.body));
  const id=created.body.item.id,link=await verify(id);
  const edited=await request('/api/artworks/'+id,{method:'PUT',body:{...body,title:'Tên tác phẩm sau chỉnh sửa',revision:created.body.item.revision}});assert.equal(edited.status,200);
  assert.equal(await verify(id),link);
  assert.equal((await request('/api/artworks/'+id,{method:'DELETE'})).status,200);
  assert.equal((await request('/api/artworks/'+id+'/qr')).status,404);
  assert.equal((await request('/api/artworks/missing-artwork/qr')).status,404);
});
