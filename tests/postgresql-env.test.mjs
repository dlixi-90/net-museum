import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseEnv} from 'node:util';
import {configurePostgresql} from '../scripts/setup-postgresql-docker.mjs';

test('Unified environment: fresh setup fills blank fields and preserves application settings',()=>{
  const source='DATABASE_URL=\nPOSTGRES_PASSWORD=\nPOSTGRES_PORT=5435\nPG_SCHEMA=custom_schema\nUPLOAD_STORAGE=local\n';
  const content=configurePostgresql(source),values=parseEnv(content),uri=new URL(values.DATABASE_URL);
  assert.equal(decodeURIComponent(uri.password),values.POSTGRES_PASSWORD);
  assert.equal(uri.port,'5435');
  assert.equal(values.PG_SCHEMA,'custom_schema');
  assert.equal(values.UPLOAD_STORAGE,'local');
  assert.equal((content.match(/^DATABASE_URL=/gm)||[]).length,1);
  assert.equal(configurePostgresql(content),content);
});

test('Unified environment: reuse local Docker credentials and preserve cloud connection separately',()=>{
  const password='local$#secret',uri=`postgresql://net_museum:${encodeURIComponent(password)}@127.0.0.1:5433/net_museum`;
  const source=`DATABASE_URL=${uri}\nNEON_DATABASE_URL=postgresql://user:example@db.example.test/museum\nPG_SCHEMA=existing_schema\n`;
  const content=configurePostgresql(source),values=parseEnv(content);
  assert.equal(values.DATABASE_URL,uri);
  assert.equal(values.POSTGRES_PASSWORD,password);
  assert.equal(values.NEON_DATABASE_URL,parseEnv(source).NEON_DATABASE_URL);
  assert.equal(values.PG_SCHEMA,'existing_schema');
  assert.equal(configurePostgresql(content),content);
  const cloud=configurePostgresql('DATABASE_URL=postgresql://user:example@db.example.test/museum\n');
  assert.equal(parseEnv(cloud).DATABASE_URL,'postgresql://user:example@db.example.test/museum');
});

test('Unified environment: refuse invalid ports or conflicting local passwords',()=>{
  for(const port of ['0','65536','invalid'])assert.throws(()=>configurePostgresql(`POSTGRES_PORT=${port}\n`),/POSTGRES_PORT/);
  assert.throws(()=>configurePostgresql('DATABASE_URL=postgresql://net_museum:example@127.0.0.1:5433/net_museum\nPOSTGRES_PASSWORD=other\n'),/chưa khớp/);
});
