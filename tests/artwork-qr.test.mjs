import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import jsQR from 'jsqr';
import {artworkShareURL,createArtworkQR} from '../server/artwork-qr.mjs';

test('Artwork QR uses the configured site origin and a clean permanent detail URL',()=>{
  const url=artworkShareURL('37557',{publicOrigin:'https://museum.example.test/old-path?ref=old#section',requestHost:'untrusted.example'});
  assert.equal(url,'https://museum.example.test/tac-pham/?id=37557');
  assert.equal(artworkShareURL('new-work',{requestHost:'127.0.0.1:3000'}),'http://127.0.0.1:3000/tac-pham/?id=new-work');
});

test('Artwork QR PNG independently decodes to the exact URL for legacy and newly generated IDs',async()=>{
  for(const id of ['37557',randomUUID()]){
    const result=await createArtworkQR(id,{publicOrigin:'https://museum.example.test'});
    const {data,info}=await sharp(Buffer.from(result.image.split(',')[1],'base64')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const decoded=jsQR(new Uint8ClampedArray(data),info.width,info.height);
    assert.equal(decoded?.data,result.url);
    assert.equal(new URL(decoded.data).searchParams.get('id'),id);
    assert.equal(info.width,768);assert.equal(info.height,768);
    assert.deepEqual([...data.subarray(0,4)],[255,255,255,255]);
    assert.equal(result.filename,`net-${id}-qr.png`);
  }
});

test('Artwork QR rejects malformed IDs, unsafe origins and unconfigured public Host headers',()=>{
  for(const id of ['',null,'../admin','work&id=other','x'.repeat(65)])assert.throws(()=>artworkShareURL(id,{publicOrigin:'https://museum.example.test'}));
  for(const publicOrigin of ['javascript:alert(1)','file:///tmp','https://user:password@museum.example.test'])assert.throws(()=>artworkShareURL('37557',{publicOrigin}));
  assert.throws(()=>artworkShareURL('37557',{requestHost:'untrusted.example'}));
});
