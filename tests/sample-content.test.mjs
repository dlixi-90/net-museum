import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadEnvFile} from 'node:process';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {unzipSync,strFromU8} from 'fflate';
import {PDFDocument} from 'pdf-lib';
import {connectDatabase,initializeDatabase} from '../server/db.mjs';
import {refreshSampleContent,SAMPLE_CONTENT_REVISION} from '../server/sample-content.mjs';
import {fileURL} from '../dist/multimedia.js';

try{loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
const removedPhrase='\u1ea3nh g\u1ed1c';
const manifest=JSON.parse(await readFile(new URL('../dist/assets/samples/manifest.json',import.meta.url),'utf8'));

test('Bundled documents and manifests contain the revised content and exact file metadata',async()=>{
  assert.equal(manifest.narration.voice,'Minh Đức');
  assert.equal(manifest.narration.language,'vi-VN');
  assert.ok(!JSON.stringify(manifest).toLocaleLowerCase('vi').includes(removedPhrase));
  for(const resource of manifest.resources){
    const file=await readFile(new URL('../dist'+resource.url,import.meta.url));
    assert.equal(file.length,resource.sizeBytes,resource.id);
    assert.equal(createHash('sha256').update(file).digest('hex'),resource.sha256,resource.id);
    if(resource.url.endsWith('.docx')){
      const xml=strFromU8(unzipSync(file)['word/document.xml']);
      assert.ok(!xml.toLocaleLowerCase('vi').includes(removedPhrase));
      assert.ok(xml.includes('Nguồn ảnh và thông tin hiện vật'));
    }
    if(resource.url.endsWith('.txt'))assert.ok(!file.toString().toLocaleLowerCase('vi').includes(removedPhrase));
    if(resource.url.endsWith('.pdf'))assert.equal((await PDFDocument.load(file)).getPageCount(),resource.pageCount);
    if(resource.kind==='audio'){
      const transcript=await readFile(new URL('../dist/assets/samples/'+resource.artifactId+'-transcript.txt',import.meta.url),'utf8');
      assert.equal(transcript.trim(),resource.transcript);
    }
  }
});

test('Media URLs change when narration is replaced and retain download tracking',()=>{
  const sample=manifest.resources.find(r=>r.kind==='audio');
  const first=new URL(fileURL(sample),'https://museum.example');
  const replaced=new URL(fileURL({...sample,sha256:'0'.repeat(64)}),'https://museum.example');
  assert.notEqual(first.searchParams.get('v'),replaced.searchParams.get('v'));
  assert.equal(first.searchParams.get('v'),sample.sha256.slice(0,16));
  const download=new URL(fileURL(sample,true),'https://museum.example');
  assert.equal(download.searchParams.get('download'),'1');
  assert.ok(download.searchParams.get('visitor'));
  assert.equal(download.searchParams.get('v'),first.searchParams.get('v'));
});

test('Bundled content migration repairs existing metadata once, preserves links, uploads and curator edits',async t=>{
  const schema='net_test_'+randomUUID().replaceAll('-','');
  const {db,client}=await connectDatabase({schema});
  t.after(async()=>{try{assert.match(schema,/^net_test_[a-f0-9]{32}$/);await db.query(`DROP SCHEMA "${schema}" CASCADE`);}finally{await client.close();}});
  await initializeDatabase(db);
  await db.query('DELETE FROM app_settings WHERE key=$1',[SAMPLE_CONTENT_REVISION]);
  const audio=manifest.resources.find(r=>r.kind==='audio');
  const image=manifest.resources.find(r=>r.kind==='image');
  const document=manifest.resources.find(r=>r.kind==='document');
  const text=manifest.resources.find(r=>r.kind==='text');
  await db.query('UPDATE resources SET size_bytes=1,sha256=NULL,license=$1,title=$2,description=$4 WHERE id=$3',[removedPhrase,'Tên do quản trị viên sửa',audio.id,'Giọng tổng hợp eSpeak NG (vi).']);
  await db.query('UPDATE audio SET duration_seconds=99,transcript=$1 WHERE resource_id=$2',[removedPhrase,audio.id]);
  await db.query('UPDATE resources SET description=$1 WHERE id=$2',[removedPhrase,image.id]);
  await db.query('UPDATE documents SET extracted_text=$1 WHERE resource_id=$2',['Giọng đọc được tổng hợp bằng eSpeak NG.',document.id]);
  await db.query('UPDATE texts SET content=$1 WHERE resource_id=$2',[removedPhrase,text.id]);
  const untouched=manifest.resources.find(r=>r.kind==='image'&&r.id!==image.id);
  await db.query('UPDATE resources SET description=$1,license=$2 WHERE id=$3',['Mô tả riêng','Giấy phép riêng',untouched.id]);
  const deleted=manifest.resources.at(-1);
  await db.query('DELETE FROM artifact_resources WHERE resource_id=$1',[deleted.id]);
  await db.query('DELETE FROM resources WHERE id=$1',[deleted.id]);
  const custom={id:'custom-content',url:'/uploads/custom.txt',resourceType:'text',mimeType:'text/plain',format:'TXT',sizeBytes:10,content:'Tư liệu riêng',description:removedPhrase};
  await db.insertMedia(custom);
  const linksBefore=(await db.query('SELECT * FROM artifact_resources ORDER BY artifact_id,resource_id,purpose')).rows;
  assert.equal(await refreshSampleContent(db),true);
  const updated=await db.getMedia(audio.id);
  assert.equal(updated.title,'Tên do quản trị viên sửa');
  assert.equal(updated.license,'');
  assert.equal(updated.description,audio.description);
  assert.equal(updated.sizeBytes,audio.sizeBytes);
  assert.equal(updated.sha256,audio.sha256);
  assert.ok(Math.abs(updated.duration-audio.duration)<.001);
  assert.equal(updated.transcript,audio.transcript);
  assert.equal((await db.getMedia(image.id)).description,'');
  assert.equal((await db.getMedia(document.id)).content,document.content);
  assert.equal((await db.getMedia(text.id)).content,text.content);
  assert.equal((await db.getMedia(untouched.id)).description,'Mô tả riêng');
  assert.equal((await db.getMedia(untouched.id)).license,'Giấy phép riêng');
  assert.equal((await db.getMedia(custom.id)).description,removedPhrase);
  assert.equal(await db.getMedia(deleted.id),null);
  assert.deepEqual((await db.query('SELECT * FROM artifact_resources ORDER BY artifact_id,resource_id,purpose')).rows,linksBefore);
  assert.deepEqual(await Promise.all([refreshSampleContent(db),refreshSampleContent(db)]),[false,false]);
  await initializeDatabase(db);
  assert.equal(await db.getMedia(deleted.id),null);
});
