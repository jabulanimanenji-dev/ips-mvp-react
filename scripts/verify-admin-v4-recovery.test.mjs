import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {tokenDigest,requestPasswordRecovery,completePasswordRecovery} from '../services/passwordRecovery.js';
const env={NODE_ENV:'development',PUBLIC_APP_URL:'http://127.0.0.1:8080',
 CONTACT_RESEND_API_KEY:'fake-no-network',
 CONTACT_FROM_EMAIL:'support@ipsglobalservice.com',
 CONTACT_REPLY_TO_EMAIL:'contact@ipsglobalservice.com',
 EMAIL_VERIFICATION_SECRET:'a-long-secret-for-the-isolated-ips-verification-fixture'};
const tok='B'.repeat(43);
function account(overrides={}){return {_id:'id',writer_id:'WID-REAL1234',email:'specialist@university.edu',email_verified_at:new Date('2026-11-01'),
 status:'Active',application_status:'approved',session_version:1,...overrides,
 async save(){this.saves=(this.saves||0)+1;}};}
test('client and specialist reset proofs are HMAC-scope-separated and cannot authenticate across roles',()=>{
 assert.notEqual(tokenDigest(tok,env.EMAIL_VERIFICATION_SECRET,'writer'),
 tokenDigest(tok,env.EMAIL_VERIFICATION_SECRET,'client'));
});
test('a specialist manager request sends only a private email link, does not disclose token and throttles resend',async()=>{
 const writer=account(),mail=[],lookups=[];
 const model={findOne:(query)=>{lookups.push(query);return {select:async()=>writer}},updateOne:async()=>({})};
 const send=async msg=>{mail.push(msg);};
 const issue=()=>requestPasswordRecovery(writer.email,{env,model,send,scope:'writer',random:()=>tok,
 now:()=>new Date('2026-11-20T09:00:00Z')});
 const result=await issue();assert.equal(result.delivered,true);
 assert.equal(mail.length,1);
 assert.ok(mail[0].body.includes('/writer/reset-password#token='+tok));
 assert.ok(!JSON.stringify(result).includes(tok));
 assert.equal(writer.password_reset_hash,tokenDigest(tok,env.EMAIL_VERIFICATION_SECRET,'writer'));
 assert.ok(!mail[0].body.includes('http://evil'));
 assert.equal((await issue()).alreadySent,true);
 assert.equal(mail.length,1);
});
test('verified specialist one-use email reset rotates password and invalidates previous cookies',async()=>{
 const writer=account({password_reset_hash:tokenDigest(tok,env.EMAIL_VERIFICATION_SECRET,'writer')});
 const called=[];const model={
  findOne:()=>({select:async()=>writer}),
  findOneAndUpdate:async(match,patch)=>{
   called.push({match,patch});assert.equal(match.password_reset_hash,writer.password_reset_hash);
   assert.equal(patch.$set.session_version,2);
   assert.ok(patch.$set.password.startsWith('scrypt$'));
   return account({session_version:2});
  }
 };
 const result=await completePasswordRecovery(tok,'ValidNewPassword123!',{env,model,scope:'writer',
 hashPassword:()=>'scrypt$unit$safepassword'});
 assert.equal(result.success,true);assert.equal(result.account.session_version,2);
 assert.equal(called.length,1);
 assert.equal(called[0].patch.$unset.password_reset_hash,'');
});
test('invalid, weak and replayed specialist reset links remain unusable',async()=>{
 const model={findOne:()=>({select:async()=>null})};
 for(const [t,p] of [['invalid','ValidNewPassword123!'],[tok,'short']]){
  const result=await completePasswordRecovery(t,p,{env,model,scope:'writer',hashPassword:()=>''});
  assert.equal(result.status,400);
 }
 const replay=await completePasswordRecovery(tok,'ValidNewPassword123!',{env,model,scope:'writer',hashPassword:()=>''});
 assert.equal(replay.status,400);
});
test('automatic verification is account-holder proof, not an administrator-set field',async()=>{
 const [verification,form,server,company,people]=await Promise.all([
  readFile(new URL('../services/accountVerification.js',import.meta.url),'utf8'),
  readFile(new URL('../src/pages/EmailConfirmationPage.jsx',import.meta.url),'utf8'),
  readFile(new URL('../server.js',import.meta.url),'utf8'),
  readFile(new URL('../services/companyOperatingSystem.js',import.meta.url),'utf8'),
  readFile(new URL('../src/administration/PeopleHub.jsx',import.meta.url),'utf8')
 ]);
 assert.match(verification,/verificationLink/);assert.match(verification,/verify-email#/);
 assert.match(form,/\/api\/writer\/verify-email/);assert.match(form,/verifyClientEmail/);
 assert.match(form,/history\.replaceState/);assert.match(form,/resend-verification/);
 assert.match(server,/issueEmailChallenge\(pending\)/);
 assert.match(company,/\/api\/admin\/specialists\/:id\/password-recovery/);
 assert.match(company,/hasAdminPermission\(access,'providers.manage'\)/);
 assert.match(people,/Send private password reset link/);
 assert.doesNotMatch(people,/forceVerify|markVerified|manualApproveEmail/);
});
test('client/specialist hard deletion and staff-created credential are retired rather than hidden from UI',async()=>{
 const server=await readFile(new URL('../server.js',import.meta.url),'utf8');
 assert.match(server,/Permanent client deletion is prohibited/);
 assert.match(server,/Administrator-created specialist credentials are retired/);
 assert.match(server,/Permanent specialist deletion is prohibited/);
});
