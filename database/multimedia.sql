-- Additive migration; existing records and public IDs are retained.
CREATE TABLE IF NOT EXISTS app_settings(key text PRIMARY KEY,value text NOT NULL);
ALTER TABLE resources ADD COLUMN IF NOT EXISTS original_name varchar(255) NOT NULL DEFAULT '';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE resource_events ADD COLUMN IF NOT EXISTS event_key text;
CREATE UNIQUE INDEX IF NOT EXISTS resource_events_dedupe_idx ON resource_events(resource_id,action,event_key);
ALTER TABLE upload_intents DROP CONSTRAINT IF EXISTS upload_intents_resource_type_check;
ALTER TABLE upload_intents ADD CONSTRAINT upload_intents_resource_type_check CHECK(resource_type IN ('image','video','audio','document','text'));
ALTER TABLE upload_intents ADD COLUMN IF NOT EXISTS storage varchar(20) NOT NULL DEFAULT 'cloudinary';
ALTER TABLE upload_intents ADD COLUMN IF NOT EXISTS mime_type varchar(100);
ALTER TABLE upload_intents ADD COLUMN IF NOT EXISTS size_bytes bigint;
ALTER TABLE upload_intents ADD COLUMN IF NOT EXISTS original_name varchar(255) NOT NULL DEFAULT '';
ALTER TABLE upload_intents ADD COLUMN IF NOT EXISTS fingerprint varchar(64);
ALTER TABLE upload_intents ADD COLUMN IF NOT EXISTS offset_bytes bigint NOT NULL DEFAULT 0;
ALTER TABLE upload_intents ADD COLUMN IF NOT EXISTS completed_resource_id text REFERENCES resources(id) ON DELETE SET NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_type varchar(20) NOT NULL DEFAULT 'artifact';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_id text;
CREATE TABLE IF NOT EXISTS resource_keywords (
  resource_id text REFERENCES resources(id) ON DELETE CASCADE,
  keyword_id bigint REFERENCES keywords(id) ON DELETE CASCADE,
  PRIMARY KEY(resource_id,keyword_id)
);
CREATE TABLE IF NOT EXISTS resource_topics (
  resource_id text REFERENCES resources(id) ON DELETE CASCADE,
  topic_id bigint REFERENCES topics(id) ON DELETE CASCADE,
  PRIMARY KEY(resource_id,topic_id)
);
CREATE TABLE IF NOT EXISTS media_deletions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  storage varchar(20) NOT NULL,storage_key text NOT NULL,public_id text,resource_type varchar(10) NOT NULL,
  attempts integer NOT NULL DEFAULT 0,completed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resource_keywords_keyword_idx ON resource_keywords(keyword_id);
CREATE INDEX IF NOT EXISTS resource_topics_topic_idx ON resource_topics(topic_id);
-- Repair the initial sample manifest's TXT classification without losing links.
DO $$ DECLARE item record; links jsonb; link jsonb; BEGIN
  FOR item IN SELECT r.id,d.extracted_text FROM resources r JOIN documents d ON d.resource_id=r.id
    WHERE r.seed AND r.kind='document' AND r.mime_type='text/plain' LOOP
    SELECT jsonb_agg(to_jsonb(ar)) INTO links FROM artifact_resources ar WHERE ar.resource_id=item.id;
    DELETE FROM artifact_resources WHERE resource_id=item.id;
    DELETE FROM documents WHERE resource_id=item.id;
    UPDATE resources SET kind='text' WHERE id=item.id;
    INSERT INTO texts(resource_id,content) VALUES(item.id,coalesce(item.extracted_text,''));
    FOR link IN SELECT value FROM jsonb_array_elements(coalesce(links,'[]'::jsonb)) LOOP
      INSERT INTO artifact_resources(artifact_id,resource_id,kind,purpose) VALUES(link->>'artifact_id',item.id,'text',link->>'purpose');
    END LOOP;
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION museum_fold(value text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
SELECT translate(lower(coalesce(value,'')),
 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd');
$$;

CREATE OR REPLACE VIEW media_catalog AS
SELECT r.id,r.storage_key AS url,r.storage,r.public_id AS "publicId",r.kind AS "resourceType",
  r.mime_type AS "mimeType",r.size_bytes::double precision AS "sizeBytes",r.format,
  COALESCE(i.width,v.width) AS width,COALESCE(i.height,v.height) AS height,
  COALESCE(v.duration_seconds,au.duration_seconds)::double precision AS duration,
  r.sha256,r.storage_version AS version,r.uploaded_by AS "uploadedBy",r.seed,r.created_at AS "createdAt",
  r.title,COALESCE(r.author_name,'') AS author,COALESCE(r.description,'') AS description,
  COALESCE(r.license,'') AS license,COALESCE(r.source_url,'') AS source,
  r.original_name AS "originalName",r.updated_at AS "updatedAt",COALESCE(au.language,'') AS language,
  COALESCE(au.transcript,'') AS transcript,d.page_count AS "pageCount",COALESCE(t.content,d.extracted_text,'') AS content,
  COALESCE(kw.tags,ARRAY[]::text[]) AS tags,COALESCE(tp.topics,ARRAY[]::text[]) AS topics,
  COALESCE(links.artworks,'[]'::jsonb) AS artworks
FROM resources r LEFT JOIN images i ON i.resource_id=r.id LEFT JOIN videos v ON v.resource_id=r.id
LEFT JOIN audio au ON au.resource_id=r.id LEFT JOIN documents d ON d.resource_id=r.id LEFT JOIN texts t ON t.resource_id=r.id
LEFT JOIN LATERAL(SELECT array_agg(k.name ORDER BY k.name) AS tags FROM resource_keywords rk JOIN keywords k ON k.id=rk.keyword_id WHERE rk.resource_id=r.id) kw ON true
LEFT JOIN LATERAL(SELECT array_agg(p.name ORDER BY p.name) AS topics FROM resource_topics rt JOIN topics p ON p.id=rt.topic_id WHERE rt.resource_id=r.id) tp ON true
LEFT JOIN LATERAL(SELECT jsonb_agg(DISTINCT jsonb_build_object('id',a.id,'title',a.title)) AS artworks FROM artifact_resources ar JOIN artifacts a ON a.id=ar.artifact_id WHERE ar.resource_id=r.id) links ON true;
