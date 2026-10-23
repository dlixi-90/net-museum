import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateConnectionUri,validateSchema,connectionHelp} from '../server/pg-config.mjs';
test('PostgreSQL configuration rejects placeholders, wrong protocols and unsafe schema names',()=>{
  for(const uri of [undefined,'https://localhost/db','postgresql://user:CHANGE_ME@localhost/db','postgresql://<USER>:<PASS>@localhost/db','postgres://localhost'])assert.throws(()=>validateConnectionUri(uri),{code:'PG_CONFIG_MISSING'});
  assert.equal(validateConnectionUri('postgresql://user:secret@localhost:5433/net_museum'),'postgresql://user:secret@localhost:5433/net_museum');
  for(const schema of ['public','pg_catalog','information_schema','x; DROP TABLE users','a-b','a'.repeat(64)])assert.throws(()=>validateSchema(schema));
  assert.equal(validateSchema('net_test_123'),'net_test_123');
  assert.throws(()=>validateConnectionUri('postgresql://u:p@ep-test-pooler.region.neon.tech/db?sslmode=require'),{code:'PG_CONFIG_POOLER'});
  assert.throws(()=>validateConnectionUri('postgresql://u:p@ep-test.region.neon.tech/db?sslmode=disable'),{code:'PG_CONFIG_TLS'});
  assert.equal(validateConnectionUri('postgresql://u:p@ep-test.region.neon.tech/db?sslmode=verify-full'),'postgresql://u:p@ep-test.region.neon.tech/db?sslmode=verify-full');
});
test('PostgreSQL diagnostics never include connection credentials or driver messages',()=>{
  for(const code of ['28P01','3D000','42501','ECONNREFUSED','other']){
    const result=connectionHelp({code,message:'postgresql://private-user:private-password@host/db'});
    assert.ok(!result.includes('private-user'));assert.ok(!result.includes('private-password'));
  }
});
