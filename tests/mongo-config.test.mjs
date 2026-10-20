import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateConnectionUri,connectionHelp} from '../server/mongo-config.mjs';
test('Atlas placeholders fail locally before attempting a network connection',()=>{
  assert.throws(()=>validateConnectionUri('mongodb+srv://<USER>:<PASS>@<HOST>/net_museum'),{code:'MONGO_CONFIG_MISSING'});
  assert.equal(validateConnectionUri('mongodb://127.0.0.1:27017'),'mongodb://127.0.0.1:27017');
  assert.equal(validateConnectionUri('mongodb+srv://example.mongodb.net/net_museum'),'mongodb+srv://example.mongodb.net/net_museum');
});
test('connection diagnostics never include a driver error message',()=>{
  const diagnostic=connectionHelp({code:18,message:'mongodb+srv://private-user:private-password@example.mongodb.net'},{atlas:true});
  assert.ok(!diagnostic.includes('private-password'));assert.ok(!diagnostic.includes('private-user'));
});
