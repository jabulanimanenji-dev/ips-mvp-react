import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryOrigin,recoveryReady,tokenDigest,sessionFilter,sessionVersion,
  requestPasswordRecovery,completePasswordRecovery} from '../services/passwordRecovery.js';

const env={NODE_ENV:'development',PUBLIC_APP_URL:'http://127.0.0.1:8080',
  CONTACT_RESEND_API_KEY:'ci-fake-provider-do-not-send',
  CONTACT_FROM_EMAIL:'support@ipsglobalservice.com',
  CONTACT_REPLY_TO_EMAIL:'contact@ipsglobalservice.com',
  EMAIL_VERIFICATION_SECRET:'ci-secret-long-enough-for-strong-recovery-tests'};
const token='A'.repeat(43);
const account=()=>({
  _id:'mock-client',email:'quiet@example.org',session_version:1,
  password_reset_sent_at:undefined,password_reset_expires_at:undefined,
  password_reset_hash:undefined,
  async save(){this.saves=(this.saves||0)+1;}
});
test('password recovery fails closed without a verified backend sender and secure origin',()=>{
  assert.equal(recoveryReady({}),false);
  assert.equal(recoveryOrigin({...env,JOINT:'x',PUBLIC_APP_URL:'https://login.example.org/path'}),null);
  assert.equal(recoveryOrigin({...env,NODE_ENV:'production',PUBLIC_APP_URL:'http://127.0.0.1:8080'}),null);
  assert.equal(recoveryOrigin({...env,PUBLIC_APP_URL:'https://example.org?token=bad'}),null);
  assert.equal(recoveryOrigin({...env,PUBLIC_APP_URL:'https://example.org/'}),'https://example.org');
  assert.equal(recoveryReady(env),true);
});
test('account recovery email is one-time, secret-hashed, expiring and never returns membership',async()=>{
  const alice=account(),sent=[],now=new Date('2026-11-19T12:00:00Z');
  const model={
    findOne:()=>({select:async()=>alice}),
    updateOne:async()=>({modifiedCount:1})
  };
  const send=async value=>{sent.push(value);return 'ci-provider-accepted';};
  const issue=()=>requestPasswordRecovery('quiet@example.org',{env,model,send,now:()=>now,random:()=>token});
  assert.equal((await issue()).accepted,true);
  assert.equal(sent.length,1);
  assert.equal(alice.password_reset_hash,tokenDigest(token,env.EMAIL_VERIFICATION_SECRET));
  assert.ok(!JSON.stringify(alice).includes(token));
  assert.ok(sent[0].body.includes('http://127.0.0.1:8080/reset-password#token='+token));
  assert.ok(!sent[0].body.includes('https://'));
  assert.equal((await issue()).accepted,true);
  assert.equal(sent.length,1,'60-second throttle must not resend');
  const missing={findOne:()=>({select:async()=>null})};
  assert.equal((await requestPasswordRecovery('nobody@example.org',{env,model:missing,send})).accepted,true);
  assert.equal(sent.length,1);
});
test('recovery rejects invalid tokens, weak passwords and expired or reused proof',async()=>{
  let lookups=0,updates=0;
  const client=account();
  const model={
    findOne:()=>({select:async()=>{lookups++;return client;}}),
    findOneAndUpdate:async(match,update)=>{
      updates++;
      assert.equal(match.password_reset_hash,tokenDigest(token,env.EMAIL_VERIFICATION_SECRET));
      assert.equal(update.$set.session_version,2);
      assert.ok(update.$set.password.startsWith('scrypt$'));
      assert.equal(update.$unset.password_reset_hash,'');
      return {...client,session_version:2};
    }
  };
  const hashPassword=()=> 'scrypt$test$verified';
  assert.equal((await completePasswordRecovery('invalid','LongStrongPassword9!',{env,model,hashPassword})).status,400);
  assert.equal((await completePasswordRecovery(token,'weak',{env,model,hashPassword})).status,400);
  assert.equal(lookups,0);
  assert.equal((await completePasswordRecovery(token,'LongStrongPassword9!',{env,model,hashPassword})).success,true);
  assert.equal(updates,1);
  assert.equal(sessionVersion({session_version:0}),1);
  assert.deepEqual(sessionFilter({session_version:2}),{session_version:2});
  assert.deepEqual(sessionFilter({}),{$or:[{session_version:1},{session_version:{$exists:false}}]});
  const missing={findOne:()=>({select:async()=>null})};
  assert.equal((await completePasswordRecovery(token,'LongStrongPassword9!',{env,model:missing,hashPassword})).status,400);
});
test('failed email sending invalidates the undelivered recovery token',async()=>{
  const client=account(),calls=[];
  const model={
    findOne:()=>({select:async()=>client}),
    updateOne:async(filter,update)=>{calls.push({filter,update});return {modifiedCount:1};}
  };
  const result=await requestPasswordRecovery('quiet@example.org',{env,model,random:()=>token,
    send:async()=>{throw Error('provider down');}});
  assert.equal(result.accepted,true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].filter.password_reset_hash,client.password_reset_hash);
  assert.equal(calls[0].update.$unset.password_reset_hash,'');
});
