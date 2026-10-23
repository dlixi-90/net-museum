import {randomUUID} from 'node:crypto';
import {HttpError} from './validation.mjs';
import {MultimediaRepository} from './multimedia-repository.mjs';

const userColumns='id AS "_id",full_name AS name,email,username,password_hash AS "passwordHash",role,active,created_at AS "createdAt"';
export class MuseumRepository extends MultimediaRepository {
  constructor(executor,schema,pool=null) { super();this.executor=executor;this.schema=schema;this.pool=pool; }
  query(sql,values) { return this.executor.query(sql,values); }
  async transaction(work) {
    if(!this.pool)return work(this);
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result=await work(new MuseumRepository(client,this.schema));
      await client.query('COMMIT');return result;
    } catch(error) { await client.query('ROLLBACK');throw error; }
    finally { client.release(); }
  }
  async ping() { await this.query('SELECT 1'); }
  async getUserByEmail(email) { return (await this.query(`SELECT ${userColumns} FROM users WHERE email=$1`,[email])).rows[0]||null; }
  async getUserByLogin(identifier) { return (await this.query(`SELECT ${userColumns} FROM users WHERE email=$1 OR username=$1`,[identifier])).rows[0]||null; }
  async getUser(id) { return (await this.query(`SELECT ${userColumns} FROM users WHERE id=$1`,[id])).rows[0]||null; }
  async hasAdmin() { return !!(await this.query("SELECT 1 FROM users WHERE role='admin' AND active LIMIT 1")).rowCount; }
  async createUser(user) {
    return (await this.query(`INSERT INTO users(id,full_name,email,username,password_hash,role,active,created_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${userColumns}`,
      [String(user._id||user.id||randomUUID()),user.name,user.email,user.username||user.email,user.passwordHash,user.role||'user',user.active!==false,user.createdAt||new Date()])).rows[0];
  }
  async createSession({hash,userId,expiresAt}) { await this.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',[hash,String(userId),expiresAt]); }
  async getSession(hash) { return (await this.query('SELECT token_hash AS "_id",user_id AS "userId",expires_at AS "expiresAt" FROM sessions WHERE token_hash=$1 AND expires_at>now()',[hash])).rows[0]||null; }
  async deleteSession(hash) { await this.query('DELETE FROM sessions WHERE token_hash=$1',[hash]); }
  async registrationAttempt(id,expiresAt) {
    return (await this.query(`INSERT INTO auth_limits(id,count,expires_at) VALUES($1,1,$2)
      ON CONFLICT(id) DO UPDATE SET count=auth_limits.count+1 RETURNING count`,[id,expiresAt])).rows[0].count;
  }
  async createUploadIntent(intent) { await this.query('INSERT INTO upload_intents(id,resource_type,uploaded_by,expires_at) VALUES($1,$2,$3,$4)',[intent.id,intent.resourceType,intent.uploadedBy,intent.expiresAt]); }
  async getUploadIntent(id,userId) { return (await this.query('SELECT resource_type AS "resourceType" FROM upload_intents WHERE id=$1 AND uploaded_by=$2 AND expires_at>now()',[id,userId])).rows[0]||null; }
  async getMedia(id,userId) { return (await this.query(`SELECT * FROM media_catalog WHERE id=$1${userId?' AND "uploadedBy"=$2':''}`,userId?[id,userId]:[id])).rows[0]||null; }
  async listMedia() { return (await this.query('SELECT * FROM media_catalog ORDER BY id')).rows; }
  async insertMedia(media,{ignoreExisting=false}={}) {
    return this.transaction(async tx=>{
      const kind=media.resourceType||media.mimeType?.split('/')[0];
      if(!['image','video','audio','document','text'].includes(kind))throw new HttpError(422,'Loại tài nguyên chưa được hỗ trợ.');
      const result=await tx.query(`INSERT INTO resources(id,title,kind,storage_key,storage,public_id,mime_type,size_bytes,format,sha256,storage_version,uploaded_by,seed,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ${ignoreExisting?'ON CONFLICT(id) DO NOTHING':''} RETURNING id`,
        [media.id,media.title||'',kind,media.url,media.storage||'local',media.publicId||null,media.mimeType,media.sizeBytes,media.format,media.sha256||null,media.version||null,media.uploadedBy||null,!!media.seed,media.createdAt||new Date()]);
      if(result.rowCount) {
        if(kind==='image')await tx.query('INSERT INTO images(resource_id,width,height,alt_text) VALUES($1,$2,$3,$4)',[media.id,media.width||null,media.height||null,media.title||'']);
        else if(kind==='video')await tx.query('INSERT INTO videos(resource_id,width,height,duration_seconds) VALUES($1,$2,$3,$4)',[media.id,media.width||null,media.height||null,media.duration||0]);
        else if(kind==='audio')await tx.query('INSERT INTO audio(resource_id,duration_seconds,language,transcript) VALUES($1,$2,$3,$4)',[media.id,media.duration||0,'vi-VN',media.transcript||'']);
        else if(kind==='document')await tx.query('INSERT INTO documents(resource_id,page_count,extracted_text) VALUES($1,$2,$3)',[media.id,media.pageCount||null,media.content||null]);
        else await tx.query('INSERT INTO texts(resource_id,content) VALUES($1,$2)',[media.id,media.content||'']);
        await tx.query('UPDATE resources SET original_name=$1,author_name=$2,description=$3,license=$4,source_url=$5 WHERE id=$6',[media.originalName||'',media.author||'',media.description||'',media.license||'',media.source||'',media.id]);
        if(kind==='image'&&media.colorVector)await tx.setImageVector(media.id,media.colorVector,media.featureVersion,media.sha256);
        await tx.setResourceLabels(media.id,media.tags||[],media.topics||[media.topic].filter(Boolean));
      }
      return tx.getMedia(media.id);
    });
  }
  async listArtworks() { return (await this.query('SELECT * FROM artwork_catalog ORDER BY "createdAt",id')).rows; }
  async getArtwork(id) { return (await this.query('SELECT * FROM artwork_catalog WHERE id=$1',[id])).rows[0]||null; }
  async upsertCategory(key,name) { await this.query('INSERT INTO collections(slug,name) VALUES($1,$2) ON CONFLICT(slug) DO NOTHING',[key,name]); }
  async saveArtwork(data,{id=randomUUID(),revision,userId=null,seed=false}={}) {
    return this.transaction(async tx=>{
      const existing=(await tx.query('SELECT revision FROM artifacts WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if(seed&&existing)return tx.getArtwork(id);
      if(revision!==undefined&&(!existing||existing.revision!==revision))return null;
      const expected=[[data.imageId,'image']];if(data.videoId)expected.push([data.videoId,'video']);
      for(const [resourceId,kind] of expected) {
        const resource=(await tx.query('SELECT kind FROM resources WHERE id=$1 FOR KEY SHARE',[resourceId])).rows[0];
        if(!resource||resource.kind!==kind)throw new HttpError(422,'Tài nguyên không tồn tại hoặc sai loại.');
      }
      let artistId=null;
      if(data.author&&data.author!=='Chưa xác định')artistId=(await tx.query('INSERT INTO artists(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id',[data.author])).rows[0].id;
      const periodId=(await tx.query('INSERT INTO periods(name,start_year) VALUES($1,$2) ON CONFLICT(name,start_year) DO UPDATE SET name=EXCLUDED.name RETURNING id',[data.period,data.year])).rows[0].id;
      const topicId=(await tx.query('INSERT INTO topics(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id',[data.topic||'Nghệ thuật'])).rows[0].id;
      if(!existing)await tx.query(`INSERT INTO artifacts(id,accession_number,title,original_title,description,material,origin,artist_id,period_id,topic_id,source_url,license,revision,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [id,data.accessionNumber||(/^\d+$/.test(id)?`MET-${id}`:`NET-${id}`),data.title,data.originalTitle||'',data.description,data.material||data.originalMedium||'',data.origin||'Việt Nam',artistId,periodId,topicId,data.source||'',data.license||'',seed?(data.revision||1):1,data.createdAt||new Date(),data.updatedAt||new Date()]);
      else await tx.query(`UPDATE artifacts SET title=$1,original_title=$2,description=$3,material=$4,origin=$5,artist_id=$6,period_id=$7,topic_id=$8,source_url=$9,license=$10,revision=revision+1,updated_at=now() WHERE id=$11`,
        [data.title,data.originalTitle||'',data.description,data.material||'',data.origin||'Việt Nam',artistId,periodId,topicId,data.source||'',data.license||'',id]);
      const category=(await tx.query('SELECT id FROM collections WHERE slug=$1',[data.category])).rows[0];
      if(!category)throw new HttpError(422,'Nhóm nghệ thuật không tồn tại.');
      await tx.query('DELETE FROM artifact_collections WHERE artifact_id=$1 AND is_primary',[id]);
      await tx.query('INSERT INTO artifact_collections(artifact_id,collection_id,is_primary) VALUES($1,$2,true) ON CONFLICT(artifact_id,collection_id) DO UPDATE SET is_primary=true',[id,category.id]);
      await tx.query('DELETE FROM artifact_keywords WHERE artifact_id=$1',[id]);
      for(const name of [...new Set(data.tags||[])]) {
        const keyword=(await tx.query('INSERT INTO keywords(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id',[name])).rows[0];
        await tx.query('INSERT INTO artifact_keywords(artifact_id,keyword_id) VALUES($1,$2)',[id,keyword.id]);
      }
      await tx.query("DELETE FROM artifact_resources WHERE artifact_id=$1 AND purpose IN ('cover','video')",[id]);
      for(const [resourceId,kind] of expected)await tx.query('INSERT INTO artifact_resources(artifact_id,resource_id,kind,purpose) VALUES($1,$2,$3,$4)',[id,resourceId,kind,kind==='image'?'cover':'video']);
      if(data.resourceIds!==undefined){
        await tx.query("DELETE FROM artifact_resources WHERE artifact_id=$1 AND purpose IN ('gallery','attachment')",[id]);
        for(const resourceId of new Set(data.resourceIds)){
          if(expected.some(([current])=>current===resourceId))continue;
          const resource=(await tx.query('SELECT kind FROM resources WHERE id=$1 FOR KEY SHARE',[resourceId])).rows[0];
          if(!resource)throw new HttpError(422,'Tài nguyên đính kèm không còn tồn tại.');
          await tx.query('INSERT INTO artifact_resources(artifact_id,resource_id,kind,purpose) VALUES($1,$2,$3,$4)',[id,resourceId,resource.kind,resource.kind==='image'?'gallery':'attachment']);
        }
      }
      if(!seed)await tx.query('INSERT INTO audit_logs(user_id,artifact_id,action,revision) SELECT $1,id,$2,revision FROM artifacts WHERE id=$3',[userId,existing?'update':'create',id]);
      return tx.getArtwork(id);
    });
  }
  async migrateMediaAsset(id,oldUrl,asset) {
    return this.transaction(async tx=>{
      const result=await tx.query(`UPDATE resources SET storage_key=$1,storage=$2,public_id=$3,mime_type=$4,size_bytes=$5,format=$6,sha256=$7,storage_version=$8
        WHERE id=$9 AND storage_key=$10 RETURNING id`,[asset.url,asset.storage,asset.publicId,asset.mimeType,asset.sizeBytes,asset.format,asset.sha256||null,asset.version||null,id,oldUrl]);
      if(!result.rowCount)throw new Error('Media changed during migration');
      await tx.query('UPDATE images SET width=$1,height=$2 WHERE resource_id=$3',[asset.width||null,asset.height||null,id]);
      return (await tx.query('UPDATE artifacts SET updated_at=now(),revision=revision+1 WHERE id IN (SELECT artifact_id FROM artifact_resources WHERE resource_id=$1)',[id])).rowCount;
    });
  }
  async cleanupExpired() { return this.transaction(async tx=>{for(const table of ['sessions','auth_limits'])await tx.query(`DELETE FROM ${table} WHERE expires_at<=now()`);await tx.query("DELETE FROM upload_intents WHERE expires_at<=now() AND storage<>'local'");}); }
}
