import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalize,filterArtworks,colorHistogram,cosineSimilarity} from '../dist/core.js';
test('Vietnamese name search combines title words, category, era and file size',()=>{
  const data=[{title:'Đĩa hoa mẫu đơn',author:'Chưa xác định',category:'blue',categoryLabel:'Gốm men lam',year:1400,sizeBytes:100,period:'XV',tags:[]},{title:'Bình men nâu',category:'brown',year:1300,sizeBytes:2000,tags:[]}];
  assert.equal(normalize('ĐỎ và trắng'),'do va trang');
  assert.equal(filterArtworks(data,{query:'dia mau',category:'blue',era:'late',maxSize:'0.001'}).length,1);
  assert.equal(filterArtworks(data,{query:'dia',era:'early'}).length,0);
  assert.equal(filterArtworks(data,{maxSize:'0'}).length,0);
});
test('name search ignores author, description, category, original title and tags',()=>{
  const data=[{title:'Bình hoa điểu',author:'Nguyễn Sen',description:'Phong cảnh',material:'Sơn dầu',originalTitle:'Lotus vase',category:'blue',categoryLabel:'Gốm men lam',tags:['trừu tượng'],year:1400}];
  for(const query of ['Nguyễn','phong cảnh','sơn dầu','lotus','men lam','trừu tượng'])assert.equal(filterArtworks(data,{query}).length,0,query);
  assert.equal(filterArtworks(data,{query:'  BINH  dieu  '}).length,1);
  assert.equal(filterArtworks(data,{query:'BÌNH HOA ĐIỂU'}).length,1);
  assert.equal(filterArtworks(data,{query:''}).length,1);
});
test('CBIR extracts normalized RGB features and ranks identical colors first',()=>{
  const red=colorHistogram(new Uint8ClampedArray([255,0,0,255,250,0,0,255]));
  const blue=colorHistogram(new Uint8ClampedArray([0,0,255,255]));
  assert.equal(red.length,64);assert.equal(red.reduce((s,v)=>s+v,0),1);
  assert.equal(cosineSimilarity(red,red),1);assert.equal(cosineSimilarity(red,blue),0);
  assert.equal(cosineSimilarity(colorHistogram(new Uint8ClampedArray([0,0,0,0])),red),0);
  assert.throws(()=>cosineSimilarity([1],[1,0]));
});
