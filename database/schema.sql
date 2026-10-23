-- PostgreSQL runtime schema; initialized atomically in a dedicated PG_SCHEMA.
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY, full_name varchar(150) NOT NULL,
  email varchar(254) UNIQUE NOT NULL CHECK(email=lower(email)),
  username varchar(254) UNIQUE NOT NULL, password_hash text NOT NULL,
  role varchar(10) NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS artists (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name varchar(200) UNIQUE NOT NULL,
  biography text, birth_year integer, death_year integer,
  CHECK(death_year IS NULL OR birth_year IS NULL OR death_year>=birth_year)
);
CREATE TABLE IF NOT EXISTS periods (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name varchar(100) NOT NULL,
  start_year integer NOT NULL CHECK(start_year BETWEEN -5000 AND 2100), end_year integer,
  UNIQUE(name,start_year), CHECK(end_year IS NULL OR end_year>=start_year)
);
CREATE TABLE IF NOT EXISTS collections (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, slug varchar(100) UNIQUE NOT NULL,
  name varchar(150) NOT NULL, description text
);
CREATE TABLE IF NOT EXISTS topics (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,name varchar(100) UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS artifacts (
  id text PRIMARY KEY, accession_number varchar(100) UNIQUE NOT NULL, title varchar(200) NOT NULL,
  original_title varchar(250) NOT NULL DEFAULT '', description text NOT NULL,
  material varchar(300) NOT NULL DEFAULT '', origin varchar(150) NOT NULL DEFAULT '',
  artist_id bigint REFERENCES artists(id) ON DELETE SET NULL,
  period_id bigint REFERENCES periods(id) ON DELETE RESTRICT,
  topic_id bigint REFERENCES topics(id) ON DELETE SET NULL,
  status varchar(12) NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','archived')),
  source_url text NOT NULL DEFAULT '', license varchar(500) NOT NULL DEFAULT '',
  revision integer NOT NULL DEFAULT 1 CHECK(revision>=1),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS artifact_collections (
  artifact_id text REFERENCES artifacts(id) ON DELETE CASCADE,
  collection_id bigint REFERENCES collections(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false, PRIMARY KEY(artifact_id,collection_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS artifact_primary_collection_idx ON artifact_collections(artifact_id) WHERE is_primary;
CREATE TABLE IF NOT EXISTS keywords (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,name varchar(100) UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS artifact_keywords (
  artifact_id text REFERENCES artifacts(id) ON DELETE CASCADE,
  keyword_id bigint REFERENCES keywords(id) ON DELETE CASCADE,PRIMARY KEY(artifact_id,keyword_id)
);
CREATE TABLE IF NOT EXISTS resources (
  id text PRIMARY KEY,title varchar(200) NOT NULL DEFAULT '',
  kind varchar(10) NOT NULL CHECK(kind IN ('image','audio','video','document','text')),
  storage_key text UNIQUE NOT NULL,storage varchar(20) NOT NULL DEFAULT 'local',public_id text,
  mime_type varchar(100) NOT NULL,size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 0 AND 9007199254740991),
  format varchar(20) NOT NULL,author_name varchar(200),description text,license varchar(500),source_url text,
  sha256 char(64),storage_version bigint,uploaded_by text REFERENCES users(id) ON DELETE SET NULL,
  seed boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,kind)
);
-- Staged uploads exist independently; a resource can be shared by artifacts.
CREATE TABLE IF NOT EXISTS artifact_resources (
  artifact_id text REFERENCES artifacts(id) ON DELETE CASCADE,resource_id text NOT NULL,
  kind varchar(10) NOT NULL,purpose varchar(20) NOT NULL CHECK(purpose IN ('cover','video','gallery','attachment')),
  PRIMARY KEY(artifact_id,resource_id,purpose),
  FOREIGN KEY(resource_id,kind) REFERENCES resources(id,kind) ON DELETE RESTRICT,
  CHECK((purpose<>'cover' OR kind='image') AND (purpose<>'video' OR kind='video'))
);
CREATE UNIQUE INDEX IF NOT EXISTS artifact_cover_idx ON artifact_resources(artifact_id) WHERE purpose='cover';
CREATE UNIQUE INDEX IF NOT EXISTS artifact_video_idx ON artifact_resources(artifact_id) WHERE purpose='video';
CREATE TABLE IF NOT EXISTS images (
  resource_id text PRIMARY KEY,kind varchar(10) NOT NULL DEFAULT 'image' CHECK(kind='image'),
  width integer CHECK(width>0),height integer CHECK(height>0),alt_text text NOT NULL DEFAULT '',
  color_vector double precision[],feature_version varchar(50) NOT NULL DEFAULT 'rgb4x4x4-v1',
  FOREIGN KEY(resource_id,kind) REFERENCES resources(id,kind) ON DELETE CASCADE,
  CHECK(color_vector IS NULL OR (array_ndims(color_vector)=1 AND array_lower(color_vector,1)=1
    AND cardinality(color_vector)=64 AND array_position(color_vector,NULL) IS NULL
    AND 0<=ALL(color_vector) AND 1>=ALL(color_vector)))
);
CREATE TABLE IF NOT EXISTS audio (
  resource_id text PRIMARY KEY,kind varchar(10) NOT NULL DEFAULT 'audio' CHECK(kind='audio'),
  duration_seconds numeric(12,3) CHECK(duration_seconds>=0),language varchar(20),transcript text,
  FOREIGN KEY(resource_id,kind) REFERENCES resources(id,kind) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS videos (
  resource_id text PRIMARY KEY,kind varchar(10) NOT NULL DEFAULT 'video' CHECK(kind='video'),
  duration_seconds numeric(12,3) CHECK(duration_seconds>=0),width integer CHECK(width>0),height integer CHECK(height>0),
  hls_key text,subtitle_key text,FOREIGN KEY(resource_id,kind) REFERENCES resources(id,kind) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS documents (
  resource_id text PRIMARY KEY,kind varchar(10) NOT NULL DEFAULT 'document' CHECK(kind='document'),
  page_count integer CHECK(page_count>0),extracted_text text,
  FOREIGN KEY(resource_id,kind) REFERENCES resources(id,kind) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS texts (
  resource_id text PRIMARY KEY,kind varchar(10) NOT NULL DEFAULT 'text' CHECK(kind='text'),content text NOT NULL,
  FOREIGN KEY(resource_id,kind) REFERENCES resources(id,kind) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS favorites (
  user_id text REFERENCES users(id) ON DELETE CASCADE,artifact_id text REFERENCES artifacts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,artifact_id)
);
CREATE TABLE IF NOT EXISTS comments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artifact_id text NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  content text NOT NULL CHECK(length(trim(content))>0),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS resource_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,resource_id text NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE SET NULL,action varchar(10) NOT NULL CHECK(action IN ('view','download')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash char(64) PRIMARY KEY,user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id text REFERENCES users(id) ON DELETE SET NULL,
  artifact_id text REFERENCES artifacts(id) ON DELETE SET NULL,
  action varchar(20) NOT NULL CHECK(action IN ('create','update','delete')),
  revision integer NOT NULL CHECK(revision>=1),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS upload_intents (
  id text PRIMARY KEY,resource_type varchar(10) NOT NULL CHECK(resource_type IN ('image','video')),
  uploaded_by text NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_limits (id char(64) PRIMARY KEY,count integer NOT NULL CHECK(count>0),expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS resources_search_idx ON resources(kind,created_at,size_bytes);
CREATE INDEX IF NOT EXISTS artifacts_period_idx ON artifacts(period_id);
CREATE INDEX IF NOT EXISTS artifacts_artist_idx ON artifacts(artist_id);
CREATE INDEX IF NOT EXISTS artifacts_topic_idx ON artifacts(topic_id);
CREATE INDEX IF NOT EXISTS artifact_collections_collection_idx ON artifact_collections(collection_id);
CREATE INDEX IF NOT EXISTS artifact_keywords_keyword_idx ON artifact_keywords(keyword_id);
CREATE INDEX IF NOT EXISTS artifact_resources_resource_idx ON artifact_resources(resource_id);
CREATE INDEX IF NOT EXISTS events_resource_action_idx ON resource_events(resource_id,action);
CREATE INDEX IF NOT EXISTS comments_artifact_idx ON comments(artifact_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS upload_expiry_idx ON upload_intents(expires_at);
CREATE INDEX IF NOT EXISTS limits_expiry_idx ON auth_limits(expires_at);
CREATE INDEX IF NOT EXISTS audit_artifact_time_idx ON audit_logs(artifact_id,created_at DESC);
CREATE OR REPLACE VIEW media_catalog AS
SELECT r.id,r.storage_key AS url,r.storage,r.public_id AS "publicId",r.kind AS "resourceType",
  r.mime_type AS "mimeType",r.size_bytes::double precision AS "sizeBytes",r.format,
  COALESCE(i.width,v.width) AS width,COALESCE(i.height,v.height) AS height,
  v.duration_seconds::double precision AS duration,r.sha256,r.storage_version AS version,
  r.uploaded_by AS "uploadedBy",r.seed,r.created_at AS "createdAt"
FROM resources r LEFT JOIN images i ON i.resource_id=r.id LEFT JOIN videos v ON v.resource_id=r.id;
CREATE OR REPLACE VIEW artwork_catalog AS
SELECT a.id,a.title,COALESCE(ar.name,'Chưa xác định') AS author,COALESCE(p.name,'') AS period,
  COALESCE(p.start_year,0) AS year,COALESCE(c.slug,'other') AS category,COALESCE(c.name,'Nghệ thuật khác') AS "categoryLabel",
  a.material,a.material AS "originalMedium",a.origin,a.description,COALESCE(kw.tags,ARRAY[]::text[]) AS tags,
  COALESCE(im.id,'') AS "imageId",COALESCE(im.url,'') AS image,COALESCE(im."sizeBytes",0) AS "sizeBytes",COALESCE(im.format,'') AS format,
  COALESCE(vi.id,'') AS "videoId",COALESCE(vi.url,'') AS video,COALESCE(vi."mimeType",'') AS "videoMimeType",
  COALESCE(vi."sizeBytes",0) AS "videoSizeBytes",COALESCE(vi.duration,0) AS "videoDuration",
  a.original_title AS "originalTitle",a.source_url AS source,a.license,a.revision,a.created_at AS "createdAt",a.updated_at AS "updatedAt",
  (SELECT name FROM topics WHERE id=a.topic_id) AS topic
FROM artifacts a LEFT JOIN artists ar ON ar.id=a.artist_id LEFT JOIN periods p ON p.id=a.period_id
LEFT JOIN artifact_collections ac ON ac.artifact_id=a.id AND ac.is_primary LEFT JOIN collections c ON c.id=ac.collection_id
LEFT JOIN LATERAL(SELECT array_agg(k.name ORDER BY k.name) AS tags FROM artifact_keywords ak JOIN keywords k ON k.id=ak.keyword_id WHERE ak.artifact_id=a.id) kw ON true
LEFT JOIN artifact_resources ai ON ai.artifact_id=a.id AND ai.purpose='cover' LEFT JOIN media_catalog im ON im.id=ai.resource_id
LEFT JOIN artifact_resources av ON av.artifact_id=a.id AND av.purpose='video' LEFT JOIN media_catalog vi ON vi.id=av.resource_id;
