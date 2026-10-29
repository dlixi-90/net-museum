import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {categories} from './validation.mjs';
import {validateConnectionUri,validateSchema} from './pg-config.mjs';
import {MuseumRepository} from './repository.mjs';
import {imageFeatures,FEATURE_VERSION} from './files.mjs';
import {createHash} from 'node:crypto';
import {refreshSampleContent} from './sample-content.mjs';
export async function connectDatabase({uri=process.env.DATABASE_URL,schema=process.env.PG_SCHEMA||'net_museum',max=Number(process.env.PG_POOL_MAX)||5}={}) {
  validateConnectionUri(uri);validateSchema(schema);
  const parsedUri=new URL(uri);if(parsedUri.hostname.endsWith('.neon.tech')){parsedUri.searchParams.set('sslmode','verify-full');uri=parsedUri.href;}
  const pool=new pg.Pool({connectionString:uri,max,connectionTimeoutMillis:Number(process.env.PG_CONNECT_TIMEOUT_MS)||15000,idleTimeoutMillis:30000,options:`-c search_path=${schema},public`,application_name:'NetMuseum',enableChannelBinding:true});
  pool.on('error',()=>{});
  const db=new MuseumRepository(pool,schema,pool);
  try{await db.ping();return {client:{close:()=>pool.end()},pool,db};}catch(error){await pool.end();throw error;}
}
export async function initializeDatabase(db,{seed=true}={}) {
  const sql=await readFile(new URL('../database/schema.sql',import.meta.url),'utf8');
  const multimedia=await readFile(new URL('../database/multimedia.sql',import.meta.url),'utf8');
  await db.transaction(async tx=>{
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`net_schema:${db.schema}`]);
    await tx.query(`CREATE SCHEMA IF NOT EXISTS "${db.schema}"`);
    await tx.query(sql.slice(0,sql.indexOf('CREATE OR REPLACE VIEW media_catalog')));
    await tx.query(multimedia);
    await tx.query(sql.slice(sql.indexOf('CREATE OR REPLACE VIEW artwork_catalog')));
    for(const [key,name] of Object.entries(categories))await tx.upsertCategory(key,name);
    if(!seed)return;
    if((await tx.query("SELECT 1 FROM app_settings WHERE key='sample_seed_v2'")).rowCount)return;
    const data=JSON.parse(await readFile(new URL('../dist/assets/artworks.json',import.meta.url),'utf8'));
    for(const artwork of data){
      let meta={};
      if(/^\/assets\/[a-zA-Z0-9_-]+\.jpg$/.test(artwork.image))meta=await sharp(fileURLToPath(new URL('../dist'+artwork.image,import.meta.url))).metadata();
      await tx.insertMedia({id:artwork.imageId,url:artwork.image,mimeType:'image/jpeg',resourceType:'image',sizeBytes:artwork.sizeBytes,format:'JPG',title:artwork.title,width:meta.width,height:meta.height,seed:true},{ignoreExisting:true});
      await tx.saveArtwork({...artwork,material:artwork.material||artwork.originalMedium||''},{id:String(artwork.id),seed:true});
      const stored=await tx.getMedia(artwork.imageId),indexed=await tx.getImageVector(artwork.imageId);
      if(stored?.url===artwork.image&&(!indexed?.vector||indexed.version!==FEATURE_VERSION)){
        const buffer=await readFile(new URL('../dist'+artwork.image,import.meta.url));
        await tx.setImageVector(artwork.imageId,await imageFeatures(buffer),FEATURE_VERSION,createHash('sha256').update(buffer).digest('hex'));
      }
    }
    let samples;try{samples=JSON.parse(await readFile(new URL('../dist/assets/samples/manifest.json',import.meta.url),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
    for(const sample of samples?.resources||[]){
      if(sample.mimeType==='text/plain')sample.kind='text';
      if(!await tx.getArtwork(sample.artifactId))continue;
      let colorVector;
      if(sample.kind==='image')colorVector=await imageFeatures(await readFile(new URL('../dist'+sample.url,import.meta.url)));
      await tx.insertMedia({...sample,format:sample.format||sample.url.split('.').at(-1).toUpperCase(),resourceType:sample.kind,seed:true,colorVector,featureVersion:FEATURE_VERSION},{ignoreExisting:true});
      const purpose=sample.kind==='video'&&!(await tx.artworkResources(sample.artifactId)).some(r=>r.purpose==='video')?'video':sample.kind==='image'?'gallery':'attachment';
      if(!(await tx.query('SELECT 1 FROM artifact_resources WHERE artifact_id=$1 AND resource_id=$2',[sample.artifactId,sample.id])).rowCount)await tx.attachResource(sample.artifactId,sample.id,purpose);
    }
    await tx.query("UPDATE resources r SET title=a.title FROM artifact_resources ar JOIN artifacts a ON a.id=ar.artifact_id WHERE ar.resource_id=r.id AND r.title=''");
    await tx.query("INSERT INTO app_settings(key,value) VALUES('sample_seed_v2','complete') ON CONFLICT(key) DO NOTHING");
  });
  if(seed)await refreshSampleContent(db);
  await db.cleanupExpired();
}
