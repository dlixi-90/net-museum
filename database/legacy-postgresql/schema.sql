-- PostgreSQL. Run against an empty project database with psql -v ON_ERROR_STOP=1.
BEGIN;
CREATE TABLE users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name varchar(150) NOT NULL,
  email varchar(254) UNIQUE NOT NULL,
  username varchar(80) UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role varchar(10) NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE artists (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(200) NOT NULL,
  biography text,
  birth_year integer,
  death_year integer,
  CHECK (death_year IS NULL OR birth_year IS NULL OR death_year >= birth_year)
);
CREATE TABLE periods (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(100) UNIQUE NOT NULL,
  start_year integer NOT NULL,
  end_year integer NOT NULL,
  CHECK (end_year >= start_year)
);
CREATE TABLE collections (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug varchar(100) UNIQUE NOT NULL,
  name varchar(150) NOT NULL,
  description text
);
CREATE TABLE topics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(100) UNIQUE NOT NULL
);
CREATE TABLE artifacts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  accession_number varchar(80) UNIQUE NOT NULL,
  title varchar(200) NOT NULL,
  original_title varchar(250),
  description text NOT NULL,
  material text,
  origin varchar(150),
  artist_id bigint REFERENCES artists(id) ON DELETE SET NULL,
  period_id bigint REFERENCES periods(id) ON DELETE RESTRICT,
  topic_id bigint REFERENCES topics(id) ON DELETE SET NULL,
  status varchar(12) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE artifact_collections (
  artifact_id bigint REFERENCES artifacts(id) ON DELETE CASCADE,
  collection_id bigint REFERENCES collections(id) ON DELETE CASCADE,
  PRIMARY KEY (artifact_id,collection_id)
);
CREATE TABLE keywords (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(100) UNIQUE NOT NULL
);
CREATE TABLE artifact_keywords (
  artifact_id bigint REFERENCES artifacts(id) ON DELETE CASCADE,
  keyword_id bigint REFERENCES keywords(id) ON DELETE CASCADE,
  PRIMARY KEY (artifact_id,keyword_id)
);
CREATE TABLE resources (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  artifact_id bigint NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  uploaded_by bigint REFERENCES users(id) ON DELETE SET NULL,
  title varchar(200) NOT NULL,
  kind varchar(10) NOT NULL CHECK (kind IN ('image','audio','video','document','text')),
  storage_key text UNIQUE NOT NULL,
  mime_type varchar(100) NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  format varchar(20) NOT NULL,
  author_name varchar(200),
  description text,
  license varchar(200),
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,kind)
);
-- Composite foreign keys enforce that each subtype has the correct media kind.
CREATE TABLE images (
  resource_id bigint PRIMARY KEY,
  kind varchar(10) NOT NULL DEFAULT 'image' CHECK (kind = 'image'),
  width integer CHECK (width > 0),
  height integer CHECK (height > 0),
  alt_text text NOT NULL,
  color_vector double precision[],
  feature_version varchar(50) DEFAULT 'rgb4x4x4-v1',
  FOREIGN KEY (resource_id,kind) REFERENCES resources(id,kind) ON DELETE CASCADE,
  CHECK (color_vector IS NULL OR (array_ndims(color_vector)=1 AND cardinality(color_vector)=64 AND array_position(color_vector,NULL) IS NULL AND 0 <= ALL(color_vector)))
);
CREATE TABLE audio (
  resource_id bigint PRIMARY KEY,
  kind varchar(10) NOT NULL DEFAULT 'audio' CHECK (kind = 'audio'),
  duration_seconds numeric(12,3) CHECK (duration_seconds >= 0),
  language varchar(20),
  transcript text,
  FOREIGN KEY (resource_id,kind) REFERENCES resources(id,kind) ON DELETE CASCADE
);
CREATE TABLE videos (
  resource_id bigint PRIMARY KEY,
  kind varchar(10) NOT NULL DEFAULT 'video' CHECK (kind = 'video'),
  duration_seconds numeric(12,3) CHECK (duration_seconds >= 0),
  width integer CHECK (width > 0),
  height integer CHECK (height > 0),
  hls_key text,
  subtitle_key text,
  FOREIGN KEY (resource_id,kind) REFERENCES resources(id,kind) ON DELETE CASCADE
);
CREATE TABLE documents (
  resource_id bigint PRIMARY KEY,
  kind varchar(10) NOT NULL DEFAULT 'document' CHECK (kind = 'document'),
  page_count integer CHECK (page_count > 0),
  extracted_text text,
  FOREIGN KEY (resource_id,kind) REFERENCES resources(id,kind) ON DELETE CASCADE
);
CREATE TABLE texts (
  resource_id bigint PRIMARY KEY,
  kind varchar(10) NOT NULL DEFAULT 'text' CHECK (kind = 'text'),
  content text NOT NULL,
  FOREIGN KEY (resource_id,kind) REFERENCES resources(id,kind) ON DELETE CASCADE
);
CREATE TABLE favorites (
  user_id bigint REFERENCES users(id) ON DELETE CASCADE,
  artifact_id bigint REFERENCES artifacts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,artifact_id)
);
CREATE TABLE comments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artifact_id bigint NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(trim(content)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE resource_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  resource_id bigint NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  action varchar(10) NOT NULL CHECK (action IN ('view','download')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX resources_artifact_idx ON resources(artifact_id);
CREATE INDEX resources_search_idx ON resources(kind,created_at,size_bytes);
CREATE INDEX artifacts_period_idx ON artifacts(period_id);
CREATE INDEX artifacts_artist_idx ON artifacts(artist_id);
CREATE INDEX artifacts_topic_idx ON artifacts(topic_id);
CREATE INDEX artifact_collections_collection_idx ON artifact_collections(collection_id);
CREATE INDEX artifact_keywords_keyword_idx ON artifact_keywords(keyword_id);
CREATE INDEX events_resource_action_idx ON resource_events(resource_id,action);
CREATE INDEX comments_artifact_idx ON comments(artifact_id);
COMMIT;
