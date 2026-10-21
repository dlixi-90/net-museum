import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAdminEmails,accountRole,getSession,passwordHash,passwordMatches} from '../server/auth.mjs';

test('admin allowlist normalizes spaces/case and grants no access when empty',()=>{
  const emails=parseAdminEmails(' first@example.test, SECOND@example.test, ,first@example.test');
  assert.equal(emails.size,2);
  assert.equal(accountRole(' FIRST@EXAMPLE.TEST ',emails),'admin');
  assert.equal(accountRole('second@example.test',emails),'admin');
  for(const email of ['',null,'other@example.test','first@example.test.evil'])assert.equal(accountRole(email,emails),'user');
  assert.equal(accountRole('first@example.test',parseAdminEmails('')),'user');
});

test('sessions derive admin access from current email policy, never a stored admin role',async()=>{
  let query;const account={_id:'existing',name:'Reader',email:'old@example.test',role:'admin'};
  const db={collection(name){return {async findOne(filter){if(name==='sessions')return {userId:account._id,_id:'session'};query=filter;return account;}};}};
  const req={headers:{cookie:'net_session='+'a'.repeat(64)}};
  const emails=parseAdminEmails('new@example.test');
  assert.equal((await getSession(req,db,emails)).role,'user');
  assert.deepEqual(query,{_id:'existing'});
  account.email='new@example.test';account.role='user';
  assert.equal((await getSession(req,db,emails)).role,'admin');
  assert.equal((await getSession(req,db,parseAdminEmails(''))).role,'user');
  assert.equal(await getSession({headers:{}},db,emails),null);
  assert.equal(await getSession({headers:{cookie:'net_session=forged'}},db,emails),null);
});

test('password verification rejects wrong passwords and malformed account hashes',async()=>{
  const hash=await passwordHash('correct account password');
  assert.equal(await passwordMatches('correct account password',hash),true);
  assert.equal(await passwordMatches('wrong password',hash),false);
  for(const stored of [null,undefined,'','plaintext','salt:broken'])assert.equal(await passwordMatches('anything',stored),false);
});
