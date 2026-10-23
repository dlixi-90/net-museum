import {HttpError} from './validation.mjs';
import {normalize} from '../dist/core.js';
import {FEATURE_VERSION} from './files.mjs';
const publicUser=`id,full_name AS name,email,username,role,active,created_at AS "createdAt"`;
const literal=value=>normalize(value).replace(/[\\%_]/g,c=>'\\'+c);
export class MultimediaRepository {
  async setResourceLabels(id,tags,topics){
    await this.query('DELETE FROM resource_keywords WHERE resource_id=$1',[id]);
    await this.query('DELETE FROM resource_topics WHERE resource_id=$1',[id]);
    for(const name of new Set(tags)){const row=(await this.query('INSERT INTO keywords(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id',[name])).rows[0];await this.query('INSERT INTO resource_keywords VALUES($1,$2)',[id,row.id]);}
    for(const name of new Set(topics)){const row=(await this.query('INSERT INTO topics(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id',[name])).rows[0];await this.query('INSERT INTO resource_topics VALUES($1,$2)',[id,row.id]);}
  }
  async setImageVector(id,vector,version=FEATURE_VERSION,sha256=null){await this.query('UPDATE images SET color_vector=$1,feature_version=$2 WHERE resource_id=$3',[vector,version,id]);if(sha256)await this.query('UPDATE resources SET sha256=$1 WHERE id=$2',[sha256,id]);}
  async getImageVector(id){return (await this.query('SELECT color_vector AS vector,feature_version AS version FROM images WHERE resource_id=$1',[id])).rows[0];}
  async canReadResource(id){return !!(await this.query("SELECT 1 FROM artifact_resources ar JOIN artifacts a ON a.id=ar.artifact_id WHERE ar.resource_id=$1 AND a.status='published' LIMIT 1",[id])).rowCount;}
  async artworkResources(id){return (await this.query('SELECT m.*,ar.purpose FROM artifact_resources ar JOIN media_catalog m ON m.id=ar.resource_id WHERE ar.artifact_id=$1 ORDER BY CASE ar.purpose WHEN \'cover\' THEN 0 WHEN \'gallery\' THEN 1 ELSE 2 END,m."createdAt",m.id',[id])).rows;}
  async attachResource(artifactId,resourceId,purpose,actorId=null){
    return this.transaction(async tx=>{
      const artifact=await tx.query('SELECT id FROM artifacts WHERE id=$1 FOR UPDATE',[artifactId]);if(!artifact.rowCount)throw new HttpError(404,'Tác phẩm không tồn tại.');
      const resource=await tx.getMedia(resourceId);if(!resource)throw new HttpError(404,'Không tìm thấy tài nguyên.');
      if((await tx.query('SELECT 1 FROM artifact_resources WHERE artifact_id=$1 AND resource_id=$2',[artifactId,resourceId])).rowCount)return;
      await tx.query('INSERT INTO artifact_resources(artifact_id,resource_id,kind,purpose) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[artifactId,resourceId,resource.resourceType,purpose||(resource.resourceType==='image'?'gallery':'attachment')]);
      if(actorId){await tx.query('UPDATE artifacts SET revision=revision+1,updated_at=now() WHERE id=$1',[artifactId]);await tx.query("INSERT INTO audit_logs(user_id,artifact_id,action,revision) SELECT $1,id,'update',revision FROM artifacts WHERE id=$2",[actorId,artifactId]);}
    });
  }
  async updateResource(id,data,userId){
    return this.transaction(async tx=>{
      const result=await tx.query('UPDATE resources SET title=$1,author_name=$2,description=$3,license=$4,source_url=$5,updated_at=now() WHERE id=$6 RETURNING id',[data.title,data.author,data.description,data.license,data.source,id]);
      if(!result.rowCount)return null;
      await tx.setResourceLabels(id,data.tags,data.topics);
      await tx.query("UPDATE audio SET language='vi-VN',transcript=$1 WHERE resource_id=$2",[data.transcript,id]);
      await tx.query("INSERT INTO audit_logs(user_id,action,revision,target_type,target_id) VALUES($1,'update',1,'resource',$2)",[userId,id]);
      return tx.getMedia(id);
    });
  }
  async deleteArtwork(id,userId){
    return this.transaction(async tx=>{
      const current=(await tx.query('SELECT revision FROM artifacts WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!current)return false;
      await tx.query("INSERT INTO audit_logs(user_id,artifact_id,action,revision,target_type,target_id) VALUES($1,$2,'delete',$3,'artifact',$2)",[userId,id,current.revision]);
      await tx.query('DELETE FROM artifacts WHERE id=$1',[id]);return true;
    });
  }
  async deleteResource(id,userId){
    return this.transaction(async tx=>{
      const resource=(await tx.query('SELECT * FROM resources WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!resource)return false;
      if((await tx.query('SELECT 1 FROM artifact_resources WHERE resource_id=$1 LIMIT 1',[id])).rowCount)throw new HttpError(409,'Tài nguyên đang được dùng. Gỡ khỏi hồ sơ tác phẩm trước khi xóa khỏi kho.');
      if(resource.storage==='cloudinary'||resource.storage_key.startsWith('/uploads/'))await tx.query('INSERT INTO media_deletions(storage,storage_key,public_id,resource_type) VALUES($1,$2,$3,$4)',[resource.storage,resource.storage_key,resource.public_id,resource.kind]);
      await tx.query("INSERT INTO audit_logs(user_id,action,revision,target_type,target_id) VALUES($1,'delete',1,'resource',$2)",[userId,id]);
      await tx.query('DELETE FROM resources WHERE id=$1',[id]);return true;
    });
  }
  async listUsers(){return (await this.query(`SELECT ${publicUser} FROM users ORDER BY created_at,id`)).rows;}
  async updateUser(id,data,actorId){
    return this.transaction(async tx=>{
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[this.schema+':admins']);
      const current=await tx.getUser(id);if(!current)return null;
      if(current.role==='admin'&&current.active&&(data.role!=='admin'||!data.active)){
        const admins=(await tx.query("SELECT COUNT(*)::int AS count FROM users WHERE role='admin' AND active")).rows[0].count;
        if(admins<=1)throw new HttpError(409,'Cần giữ ít nhất một quản trị viên đang hoạt động.');
      }
      await tx.query('UPDATE users SET full_name=$1,username=$2,role=$3,active=$4 WHERE id=$5',[data.name,data.username,data.role,data.active,id]);
      if(data.passwordHash)await tx.query('UPDATE users SET password_hash=$1 WHERE id=$2',[data.passwordHash,id]);
      if(current.role!==data.role||current.active!==data.active||data.passwordHash)await tx.query('DELETE FROM sessions WHERE user_id=$1',[id]);
      await tx.query("INSERT INTO audit_logs(user_id,action,revision,target_type,target_id) VALUES($1,'update',1,'user',$2)",[actorId,id]);
      return (await tx.query(`SELECT ${publicUser} FROM users WHERE id=$1`,[id])).rows[0];
    });
  }
  async deleteUser(id,actorId){
    return this.transaction(async tx=>{
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[this.schema+':admins']);
      const current=await tx.getUser(id);if(!current)return false;
      if(current.role==='admin'&&current.active&&(await tx.query("SELECT COUNT(*)::int AS count FROM users WHERE role='admin' AND active")).rows[0].count<=1)throw new HttpError(409,'Không thể xóa quản trị viên hoạt động cuối cùng.');
      await tx.query("INSERT INTO audit_logs(user_id,action,revision,target_type,target_id) VALUES($1,'delete',1,'user',$2)",[actorId,id]);
      await tx.query('DELETE FROM users WHERE id=$1',[id]);return true;
    });
  }
  async favoriteIds(userId){return (await this.query('SELECT artifact_id AS id FROM favorites WHERE user_id=$1 ORDER BY created_at DESC',[userId])).rows.map(r=>r.id);}
  async setFavorite(userId,id,saved){if(saved)await this.query('INSERT INTO favorites(user_id,artifact_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[userId,id]);else await this.query('DELETE FROM favorites WHERE user_id=$1 AND artifact_id=$2',[userId,id]);}
  async recordEvent(id,action,eventKey,userId=null){await this.query('INSERT INTO resource_events(resource_id,user_id,action,event_key) VALUES($1,$2,$3,$4) ON CONFLICT(resource_id,action,event_key) DO NOTHING',[id,userId,action,eventKey]);}
  async searchResources(filters,{all=false}={}){
    const values=[],where=[];const bind=value=>{values.push(value);return '$'+values.length;};
    if(!all)where.push("EXISTS(SELECT 1 FROM artifact_resources pr JOIN artifacts pa ON pa.id=pr.artifact_id WHERE pr.resource_id=r.id AND pa.status='published')");
    for(const token of (filters.q||'').trim().split(/\s+/).filter(Boolean).slice(0,12)){
      const p=bind('%'+literal(token)+'%');
      where.push(`(museum_fold(r.title||' '||coalesce(r.author_name,'')||' '||coalesce(r.description,'')||' '||m.content||' '||m.transcript) LIKE ${p} OR EXISTS(SELECT 1 FROM artifact_resources ar JOIN artwork_catalog a ON a.id=ar.artifact_id WHERE ar.resource_id=r.id AND museum_fold(a.title||' '||a.author) LIKE ${p}))`);
    }
    if(filters.kind)where.push('r.kind='+bind(filters.kind));
    if(filters.author){const p=bind('%'+literal(filters.author)+'%');where.push(`(museum_fold(r.author_name) LIKE ${p} OR EXISTS(SELECT 1 FROM artifact_resources ar JOIN artwork_catalog a ON a.id=ar.artifact_id WHERE ar.resource_id=r.id AND museum_fold(a.author) LIKE ${p}))`);}
    if(filters.topic){const p=bind('%'+literal(filters.topic)+'%');where.push(`(EXISTS(SELECT 1 FROM resource_topics rt JOIN topics t ON t.id=rt.topic_id WHERE rt.resource_id=r.id AND museum_fold(t.name) LIKE ${p}) OR EXISTS(SELECT 1 FROM artifact_resources ar JOIN artifacts a ON a.id=ar.artifact_id JOIN topics t ON t.id=a.topic_id WHERE ar.resource_id=r.id AND museum_fold(t.name) LIKE ${p}))`);}
    if(filters.tag){const p=bind('%'+literal(filters.tag)+'%');where.push(`(EXISTS(SELECT 1 FROM resource_keywords rk JOIN keywords k ON k.id=rk.keyword_id WHERE rk.resource_id=r.id AND museum_fold(k.name) LIKE ${p}) OR EXISTS(SELECT 1 FROM artifact_resources ar JOIN artifact_keywords ak ON ak.artifact_id=ar.artifact_id JOIN keywords k ON k.id=ak.keyword_id WHERE ar.resource_id=r.id AND museum_fold(k.name) LIKE ${p}))`);}
    if(filters.category)where.push(`EXISTS(SELECT 1 FROM artifact_resources ar JOIN artifact_collections ac ON ac.artifact_id=ar.artifact_id JOIN collections c ON c.id=ac.collection_id WHERE ar.resource_id=r.id AND c.slug=${bind(filters.category)})`);
    if(filters.period)where.push(`EXISTS(SELECT 1 FROM artifact_resources ar JOIN artifacts a ON a.id=ar.artifact_id JOIN periods p ON p.id=a.period_id WHERE ar.resource_id=r.id AND museum_fold(p.name) LIKE ${bind('%'+literal(filters.period)+'%')})`);
    if(filters.maxBytes!==undefined)where.push('r.size_bytes<='+bind(filters.maxBytes));
    if(filters.from)where.push('r.created_at>='+bind(filters.from)+'::date');
    if(filters.to)where.push('r.created_at<('+bind(filters.to)+"::date+interval '1 day')");
    const conditions=where.length?' WHERE '+where.join(' AND '):'';
    const from=' FROM resources r JOIN media_catalog m ON m.id=r.id';
    const total=(await this.query('SELECT COUNT(*)::int AS total'+from+conditions,values)).rows[0].total;
    const order={newest:'r.created_at DESC,r.id',oldest:'r.created_at,r.id',name:'r.title,r.id',size:'r.size_bytes,r.id'}[filters.sort]||'r.created_at DESC,r.id';
    const page=filters.page||1,limit=24;
    const items=(await this.query('SELECT m.*'+from+conditions+' ORDER BY '+order+` LIMIT ${bind(limit)} OFFSET ${bind((page-1)*limit)}`,values)).rows;
    return {items,total,page,pageSize:limit,hasMore:page*limit<total};
  }
  async similarImages(vector,{excludeId='',sha256='',limit=5,onlyIds=null}={}){
    const result=await this.query(`SELECT m.*,scores.similarity FROM (
      SELECT i.resource_id,SUM(v.x*q.x)/NULLIF(sqrt(SUM(v.x*v.x))*sqrt(SUM(q.x*q.x)),0) AS similarity
      FROM images i CROSS JOIN LATERAL unnest(i.color_vector) WITH ORDINALITY v(x,n)
      JOIN LATERAL unnest($1::double precision[]) WITH ORDINALITY q(x,n) ON q.n=v.n
      JOIN resources r ON r.id=i.resource_id
      WHERE i.feature_version=$2 AND i.color_vector IS NOT NULL AND i.resource_id<>$3
      AND ($4='' OR r.sha256 IS DISTINCT FROM $4)
      AND ($5::text[] IS NULL OR i.resource_id=ANY($5))
      AND EXISTS(SELECT 1 FROM artifact_resources ar JOIN artifacts a ON a.id=ar.artifact_id WHERE ar.resource_id=i.resource_id AND a.status='published')
      GROUP BY i.resource_id
    ) scores JOIN media_catalog m ON m.id=scores.resource_id WHERE scores.similarity IS NOT NULL
    ORDER BY scores.similarity DESC,m.id LIMIT $6`,[vector,FEATURE_VERSION,excludeId,sha256,onlyIds,limit]);
    return result.rows.map(row=>({...row,similarity:Math.max(0,Math.min(1,Number(row.similarity)))}));
  }
  async statistics(){
    const totals=(await this.query('SELECT (SELECT COUNT(*)::int FROM artifacts) AS artworks,COUNT(*)::int AS resources,COALESCE(SUM(size_bytes),0)::double precision AS bytes FROM resources')).rows[0];
    const byKind=(await this.query("SELECT kinds.kind,COUNT(r.id)::int AS count,COALESCE(SUM(r.size_bytes),0)::double precision AS bytes FROM (VALUES('image'),('video'),('audio'),('document'),('text')) kinds(kind) LEFT JOIN resources r ON r.kind=kinds.kind GROUP BY kinds.kind")).rows;
    const byTopic=(await this.query(`WITH links AS (
      SELECT topic_id,resource_id FROM resource_topics UNION SELECT a.topic_id,ar.resource_id FROM artifacts a JOIN artifact_resources ar ON ar.artifact_id=a.id WHERE a.topic_id IS NOT NULL
    ),events AS(SELECT resource_id,COUNT(*) FILTER(WHERE action='view')::int AS views,COUNT(*) FILTER(WHERE action='download')::int AS downloads FROM resource_events GROUP BY resource_id)
    SELECT t.name,COUNT(DISTINCT l.resource_id)::int AS resources,COALESCE(SUM(e.views),0)::int AS views,COALESCE(SUM(e.downloads),0)::int AS downloads FROM topics t LEFT JOIN links l ON l.topic_id=t.id LEFT JOIN events e ON e.resource_id=l.resource_id GROUP BY t.id,t.name ORDER BY resources DESC,t.name`)).rows;
    const top=async action=>(await this.query('SELECT m.*,e.count FROM media_catalog m JOIN (SELECT resource_id,COUNT(*)::int AS count FROM resource_events WHERE action=$1 GROUP BY resource_id) e ON e.resource_id=m.id ORDER BY e.count DESC,m.id LIMIT 10',[action])).rows;
    const topArtworks=(await this.query("SELECT a.id,a.title,COUNT(e.id)::int AS count FROM artifacts a JOIN artifact_resources ar ON ar.artifact_id=a.id JOIN resource_events e ON e.resource_id=ar.resource_id WHERE e.action='view' GROUP BY a.id,a.title ORDER BY count DESC,a.id LIMIT 10")).rows;
    return {totals,byKind,byTopic,topArtworks,topViewed:await top('view'),topDownloaded:await top('download')};
  }
}
