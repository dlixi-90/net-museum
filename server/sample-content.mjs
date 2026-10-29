import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const revision='sample_content_v3';
const removedPhrase='\u1ea3nh g\u1ed1c';

// Refresh existing bundled resources once, including byte counts and durations.
// IDs, attachments, user uploads and resources deleted by a curator are retained.
export async function refreshSampleContent(db) {
  return db.transaction(async tx=>{
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`net_schema:${db.schema}`]);
    if((await tx.query('SELECT 1 FROM app_settings WHERE key=$1',[revision])).rowCount)return false;
    const manifest=JSON.parse(await readFile(new URL('../dist/assets/samples/manifest.json',import.meta.url),'utf8'));
    for(const sample of manifest.resources){
      const current=(await tx.query('SELECT seed,storage_key FROM resources WHERE id=$1 FOR UPDATE',[sample.id])).rows[0];
      if(!current?.seed||current.storage_key!==sample.url)continue;
      if(!/^\/assets\/samples\/[a-z0-9-]+\.(jpg|mp3|mp4|pdf|txt|docx)$/.test(sample.url))throw new Error('Invalid bundled resource path.');
      const file=await readFile(new URL('../dist'+sample.url,import.meta.url));
      const digest=createHash('sha256').update(file).digest('hex');
      if(file.length!==sample.sizeBytes||digest!==sample.sha256)throw new Error('Bundled resource metadata does not match its file: '+sample.id);
      await tx.query(`UPDATE resources SET size_bytes=$1,sha256=$2,updated_at=now(),
        description=CASE WHEN strpos(lower(description),$3)>0 THEN $4 ELSE description END,
        license=CASE WHEN strpos(lower(license),$3)>0 THEN $5 ELSE license END WHERE id=$6`,
        [sample.sizeBytes,digest,removedPhrase,sample.description,sample.license,sample.id]);
      if(sample.kind==='audio')await tx.query(`UPDATE audio SET duration_seconds=$1,
        transcript=CASE WHEN strpos(lower(transcript),$2)>0 THEN $3 ELSE transcript END WHERE resource_id=$4`,
        [sample.duration,removedPhrase,sample.transcript,sample.id]);
      if(sample.kind==='video')await tx.query('UPDATE videos SET duration_seconds=$1 WHERE resource_id=$2',[sample.duration,sample.id]);
      if(sample.kind==='document')await tx.query(`UPDATE documents SET page_count=$1,
        extracted_text=CASE WHEN strpos(lower(extracted_text),$2)>0 THEN $3 ELSE extracted_text END WHERE resource_id=$4`,
        [sample.pageCount||null,removedPhrase,sample.content,sample.id]);
      if(sample.kind==='text')await tx.query(`UPDATE texts SET
        content=CASE WHEN strpos(lower(content),$1)>0 THEN $2 ELSE content END WHERE resource_id=$3`,
        [removedPhrase,sample.content,sample.id]);
    }
    await tx.query('INSERT INTO app_settings(key,value) VALUES($1,$2)',[revision,'complete']);
    return true;
  });
}
