import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAdminEmails,accountRole,getSession,passwordHash,passwordMatches} from '../server/auth.mjs';
import {clientAddress} from '../server/request-client.mjs';

test('Forwarded client addresses are used only behind a trusted platform proxy',()=>{
  const req={headers:{'x-forwarded-for':'198.51.100.1, 203.0.113.7'},socket:{remoteAddress:'127.0.0.1'}};
  assert.equal(clientAddress(req,{trustedProxy:false}),'127.0.0.1');assert.equal(clientAddress(req,{trustedProxy:true}),'203.0.113.7');
  req.headers['x-forwarded-for']='forged';assert.equal(clientAddress(req,{trustedProxy:true}),'127.0.0.1');
});

test('admin allowlist normalizes spaces/case and grants no access when empty',()=>{
  const emails=parseAdminEmails(' first@example.test, SECOND@example.test, ,first@example.test');
  assert.equal(emails.size,2);
  assert.equal(accountRole(' FIRST@EXAMPLE.TEST ',emails),'admin');
  assert.equal(accountRole('second@example.test',emails),'admin');
  for(const email of ['',null,'other@example.test','first@example.test.evil'])assert.equal(accountRole(email,emails),'user');
  assert.equal(accountRole('first@example.test',parseAdminEmails('')),'user');
});

test('sessions use current database roles and reject inactive accounts',async()=>{
  let query;const account={_id:'existing',name:'Reader',email:'old@example.test',role:'admin'};
  const db={async getSession(){return {userId:account._id,_id:'session'};},async getUser(id){query={_id:id};return account;}};
  const req={headers:{cookie:'net_session='+'a'.repeat(64)}};
  const emails=parseAdminEmails('new@example.test');
  assert.equal((await getSession(req,db,emails)).role,'admin');
  assert.deepEqual(query,{_id:'existing'});
  account.email='new@example.test';account.role='user';
  assert.equal((await getSession(req,db,emails)).role,'user');
  assert.equal((await getSession(req,db,parseAdminEmails(''))).role,'user');
  account.active=false;
  assert.equal(await getSession(req,db,emails),null);
  assert.equal(await getSession({headers:{}},db,emails),null);
  assert.equal(await getSession({headers:{cookie:'net_session=forged'}},db,emails),null);
});

test('password verification rejects wrong passwords and malformed account hashes',async()=>{
  const hash=await passwordHash('correct account password');
  assert.equal(await passwordMatches('correct account password',hash),true);
  assert.equal(await passwordMatches('wrong password',hash),false);
  for(const stored of [null,undefined,'','plaintext','salt:broken'])assert.equal(await passwordMatches('anything',stored),false);
});
