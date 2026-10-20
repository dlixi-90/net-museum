import {MongoClient} from 'mongodb';
import {readFile} from 'node:fs/promises';
import {categories} from './validation.mjs';
import {validateConnectionUri} from './mongo-config.mjs';
export async function connectDatabase({uri=process.env.MONGODB_URI||'mongodb://127.0.0.1:27017',name=process.env.MONGODB_DB||'net_museum'}={}) {
  validateConnectionUri(uri);
  const client=new MongoClient(uri,{serverSelectionTimeoutMS:uri.startsWith('mongodb+srv://')?15000:5000,appName:'NetMuseum'});
  try{await client.connect();return {client,db:client.db(name)};}catch(e){await client.close();throw e;}
}
export async function initializeDatabase(db,{seed=true}={}) {
  await Promise.all([
    db.collection('artworks').createIndex({id:1},{unique:true}),
    db.collection('artworks').createIndex({category:1,year:1}),
    db.collection('artworks').createIndex({title:'text',author:'text',description:'text',tags:'text'},{default_language:'none'}),
    db.collection('media').createIndex({id:1},{unique:true}),
    db.collection('sessions').createIndex({expiresAt:1},{expireAfterSeconds:0}),
    db.collection('users').createIndex({email:1},{unique:true}),
    db.collection('collections').createIndex({key:1},{unique:true}),
    db.collection('keywords').createIndex({name:1},{unique:true}),
    db.collection('audit_logs').createIndex({artworkId:1,createdAt:-1})
  ]);
  for(const [key,name] of Object.entries(categories))await db.collection('collections').updateOne({key},{$setOnInsert:{key,name}},{upsert:true});
  if(!seed)return;
  const data=JSON.parse(await readFile(new URL('../dist/assets/artworks.json',import.meta.url),'utf8'));
  for(const artwork of data){
    const now=new Date();
    await db.collection('media').updateOne({id:artwork.imageId},{$setOnInsert:{id:artwork.imageId,url:artwork.image,mimeType:'image/jpeg',sizeBytes:artwork.sizeBytes,format:'JPG',createdAt:now,seed:true}},{upsert:true});
    await db.collection('artworks').updateOne({id:artwork.id},{$setOnInsert:{...artwork,createdAt:now,updatedAt:now}},{upsert:true});
    for(const name of artwork.tags)await db.collection('keywords').updateOne({name},{$setOnInsert:{name}},{upsert:true});
  }
}
