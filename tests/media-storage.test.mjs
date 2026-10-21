import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Writable} from 'node:stream';
import {cloudinaryConfig,createCloudinaryStorage,validateVideo} from '../server/media-storage.mjs';
const env={CLOUDINARY_CLOUD_NAME:'test-cloud',CLOUDINARY_API_KEY:'test-key',CLOUDINARY_API_SECRET:'test-secret'};
test('missing Cloudinary configuration produces an actionable error without secrets',()=>{
  assert.throws(()=>cloudinaryConfig({}),e=>e.status===503&&e.message.includes('CLOUDINARY_API_SECRET'));
  assert.deepEqual(cloudinaryConfig(env),{cloud_name:'test-cloud',api_key:'test-key',api_secret:'test-secret'});
});
test('Cloudinary uploads use server credentials and separate resource types; persist HTTPS delivery metadata',async()=>{
  let options,received;const deleted=[];
  const sdk={uploader:{upload_stream(o,callback){options=o;return new Writable({write(chunk,encoding,done){received=chunk;done();},final(done){callback(null,{public_id:o.public_id,resource_type:o.resource_type,secure_url:'https://res.cloudinary.com/test/video.mp4',format:o.format||'webp',bytes:12,width:24,height:20,duration:1.5,version:1});done();}});},async destroy(id,options){deleted.push({id,options});}}};
  const storage=createCloudinaryStorage({env,sdk});
  const media=await storage.upload(Buffer.from('test'),{id:'video-id',resourceType:'video'});
  assert.equal(received.toString(),'test');assert.equal(options.resource_type,'video');assert.equal(options.format,'mp4');assert.equal(options.api_secret,env.CLOUDINARY_API_SECRET);assert.equal(options.overwrite,false);
  assert.equal(media.url,'https://res.cloudinary.com/test/video.mp4');assert.equal(media.duration,1.5);assert.equal(media.mimeType,'video/mp4');assert.equal(media.api_secret,undefined);
  await storage.remove(media);assert.equal(deleted[0].id,'net-museum/video/video-id');assert.equal(deleted[0].options.resource_type,'video');
  const image=await storage.upload(Buffer.from('test'),{id:'image-id',resourceType:'image'});assert.equal(image.mimeType,'image/webp');assert.equal(options.resource_type,'image');
});
test('Cloudinary failures are redacted and audio-only results are rejected and removed',async()=>{
  const bad=createCloudinaryStorage({env,sdk:{uploader:{upload_stream(o,callback){callback({message:'secret '+env.CLOUDINARY_API_SECRET,http_code:401});return new Writable({write(c,e,done){done();}});}}}});
  await assert.rejects(bad.upload(Buffer.from('x'),{id:'x',resourceType:'image'}),e=>e.status===502&&!e.message.includes(env.CLOUDINARY_API_SECRET));
  let removed=false;
  const audio=createCloudinaryStorage({env,sdk:{uploader:{upload_stream(o,callback){callback(null,{public_id:'audio',resource_type:'video',secure_url:'https://example.test/audio.mp4',width:0,height:0});return new Writable({write(c,e,done){done();}});},async destroy(){removed=true;}}}});
  await assert.rejects(audio.upload(Buffer.from('x'),{id:'x',resourceType:'video'}),e=>e.status===422);assert.equal(removed,true);
});
test('video container checks reject renamed text and mismatched WebM/MP4 files',()=>{
  const mp4=Buffer.from('000000186674797069736f6d','hex'),webm=Buffer.from('1a45dfa301020304','hex');
  validateVideo(mp4,'video/mp4');validateVideo(mp4,'video/quicktime');validateVideo(webm,'video/webm');
  assert.throws(()=>validateVideo(Buffer.from('text'),'video/mp4'));
  assert.throws(()=>validateVideo(mp4,'video/webm'));
});

test('direct Cloudinary uploads sign fixed fields and verify metadata without trusting the browser',async()=>{
  let signed,lookedUp,removed=false;
  const sdk={utils:{api_sign_request(fields,secret){signed={fields,secret};return 'signed';}},api:{async resource(publicId,options){lookedUp={publicId,options};return {public_id:publicId,resource_type:options.resource_type,width:20,height:24,bytes:100,secure_url:'https://res.cloudinary.com/test/file.webp',format:'webp',version:1};}},uploader:{async destroy(){removed=true;}}};
  const storage=createCloudinaryStorage({env,sdk});
  const upload=storage.signUpload({id:'known-id',resourceType:'image'});
  assert.equal(signed.secret,env.CLOUDINARY_API_SECRET);assert.equal(signed.fields.overwrite,false);assert.equal(signed.fields.format,'webp');
  assert.equal(upload.fields.signature,'signed');assert.equal(upload.fields.api_secret,undefined);assert.equal(upload.fields.public_id,'net-museum/image/known-id');
  const media=await storage.resolveUpload({id:'known-id',resourceType:'image'});
  assert.equal(lookedUp.publicId,'net-museum/image/known-id');assert.equal(lookedUp.options.api_secret,env.CLOUDINARY_API_SECRET);assert.equal(media.sizeBytes,100);assert.equal(media.api_secret,undefined);
  await assert.rejects(storage.resolveUpload({id:'known-id',resourceType:'video'}),e=>e.status===422);assert.equal(removed,true);
  sdk.api.resource=async()=>{throw Error('secret '+env.CLOUDINARY_API_SECRET);};
  await assert.rejects(storage.resolveUpload({id:'known-id',resourceType:'image'}),e=>e.status===502&&!e.message.includes(env.CLOUDINARY_API_SECRET));
});
