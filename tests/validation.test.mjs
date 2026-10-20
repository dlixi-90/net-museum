import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateArtwork,HttpError} from '../server/validation.mjs';
const valid={title:'Sen',category:'painting',description:'Sơn dầu chủ đề hoa sen.',period:'Năm 2020',year:2020,material:'Sơn dầu',imageId:'image-1',tags:['hoa sen']};
test('artwork validation allows only explicit fields and normalizes metadata',()=>{
  const item=validateArtwork({...valid,title:'  Sen  ',tags:['hoa sen','hoa sen',' '],role:'admin',$set:{title:'bad'},author:''});
  assert.equal(item.title,'Sen');assert.deepEqual(item.tags,['hoa sen']);assert.equal(item.author,'Chưa xác định');assert.equal(item.role,undefined);assert.equal(item.$set,undefined);
});
test('invalid fields and unsafe source schemes are rejected',()=>{
  assert.throws(()=>validateArtwork({...valid,title:{$ne:null}}),HttpError);
  assert.throws(()=>validateArtwork({...valid,source:'javascript:alert(1)'}),HttpError);
  assert.throws(()=>validateArtwork({...valid,year:2.5}),HttpError);
  assert.throws(()=>validateArtwork({...valid,tags:['x'.repeat(61)]}),HttpError);
});
