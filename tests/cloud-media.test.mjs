import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {createCloudMedia,cloudUploadSpec,cloudPublicId} from '../server/cloud-media.mjs';
const env={CLOUDINARY_CLOUD_NAME:'fixture-cloud',CLOUDINARY_API_KEY:'fixture-key',CLOUDINARY_API_SECRET:'fixture-secret'};
test('Cloud media: fixed signed IDs, raw extensions, upload caps and no exposed secret',()=>{
  const sdk={utils:{api_sign_request(fields,secret){assert.equal(secret,env.CLOUDINARY_API_SECRET);return 'signature';}}},storage=createCloudMedia({env,sdk});
  for(const mimeType of ['image/png','audio/mpeg','video/mp4','application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document']){
    const result=storage.sign({id:'fixture',mimeType}),spec=cloudUploadSpec(mimeType,env);assert.equal(result.fields.public_id,cloudPublicId('fixture',mimeType));assert.equal(result.fields.overwrite,false);assert.equal(result.fields.api_secret,undefined);assert.equal(result.fields.signature,'signature');assert.ok(result.url.includes('/'+spec.cloudType+'/upload'));assert.ok(!JSON.stringify(result).includes(env.CLOUDINARY_API_SECRET));
  }
  assert.equal(cloudUploadSpec('video/mp4',env).limit,100*1048576);assert.equal(cloudUploadSpec('text/plain',env).limit,5*1048576);assert.throws(()=>cloudUploadSpec('text/html',env),{status:415});
});
test('Cloud media: provider metadata and downloaded bytes verified for all five resource types',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../dist/assets/samples/manifest.json',import.meta.url),'utf8'));
  for(const ext of ['jpg','mp3','mp4','pdf','docx','txt']){
    const item=manifest.resources.find(r=>r.url.endsWith('.'+ext)),id='fixture-'+ext;let buffer=await readFile(new URL('../dist'+item.url,import.meta.url));if(ext==='jpg')buffer=await sharp(buffer).webp().toBuffer();
    const spec=cloudUploadSpec(item.mimeType,env),publicId=cloudPublicId(id,item.mimeType);
    const sdk={api:{resource:async()=>({public_id:publicId,resource_type:spec.cloudType,format:ext==='jpg'?'webp':ext,bytes:buffer.length,secure_url:'https://res.cloudinary.com/fixture/asset',version:1})}};
    const storage=createCloudMedia({env,sdk,fetchImpl:async()=>new Response(buffer)}),result=await storage.resolve({id,mimeType:item.mimeType});
    assert.equal(result.resourceType,spec.kind);assert.equal(result.sizeBytes,buffer.length);assert.match(result.sha256,/^[a-f0-9]{64}$/);assert.equal(result.storage,'cloudinary');
    if(ext==='jpg')assert.equal(result.colorVector.length,64);if(ext==='mp3')assert.ok(result.duration>30&&result.language==='vi-VN');if(ext==='pdf')assert.ok(result.pageCount>0);if(['txt','docx'].includes(ext))assert.ok(result.content.length>50);
  }
});
test('Cloud media: rejects forged provider URLs, sizes and invalid content',async()=>{
  let resource={public_id:cloudPublicId('fixture','text/plain'),resource_type:'raw',bytes:3,secure_url:'https://evil.example/private'},fetched=0;
  const storage=createCloudMedia({env,sdk:{api:{resource:async()=>resource}},fetchImpl:async()=>{fetched++;return new Response(Buffer.from([0xff,0xfe,0xff]));}});
  await assert.rejects(storage.resolve({id:'fixture',mimeType:'text/plain'}),{status:422});assert.equal(fetched,0);
  resource={...resource,secure_url:'https://res.cloudinary.com/fixture/asset'};await assert.rejects(storage.resolve({id:'fixture',mimeType:'text/plain'}),{status:422});
  resource.bytes=7*1048576;await assert.rejects(storage.resolve({id:'fixture',mimeType:'text/plain'}),{status:422});
});
