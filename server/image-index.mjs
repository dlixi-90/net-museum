import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {localMediaPath,imageFeatures,FEATURE_VERSION} from './files.mjs';
export async function indexImages(db,roots){
  let indexed=0,failed=0;
  for(const media of await db.listMedia())if(media.resourceType==='image'){
    try{
      let buffer;
      if(media.url.startsWith('/'))buffer=await readFile(localMediaPath(media.url,roots));
      else{
        const url=new URL(media.url);if(url.hostname!=='res.cloudinary.com'||url.protocol!=='https:'||url.username||url.password||url.port)throw new Error('Unsupported image storage');
        const response=await fetch(url,{signal:AbortSignal.timeout(15000),redirect:'error'});if(!response.ok)throw new Error('Image unavailable');
        const chunks=[];let bytes=0;for await(const part of response.body){bytes+=part.length;if(bytes>8*1024*1024)throw new Error('Image too large');chunks.push(part);}buffer=Buffer.concat(chunks);
      }
      await db.setImageVector(media.id,await imageFeatures(buffer),FEATURE_VERSION,createHash('sha256').update(buffer).digest('hex'));indexed++;
    }catch{failed++;}
  }
  return {indexed,failed,featureVersion:FEATURE_VERSION};
}
