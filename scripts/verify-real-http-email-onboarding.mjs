import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,mkdir,rm} from 'node:fs/promises';
import {MongoClient} from 'mongodb';

// Real application registration / verification / reset HTTP, real isolated
// MongoDB, fake mail-provider receipt ONLY to synthetic @example.org addresses.
// Every credential, email and URL token is disposable and never leaves CI.
const parent=String(process.env.MONGODB_URI||'');
const u=new URL(parent);
if(process.env.NODE_ENV!=='development'||u.protocol!=='mongodb:'||
  !['localhost','127.0.0.1'].includes(u.hostname)||u.port!=='27017'||
  u.pathname!=='/ips_ci')throw Error('Refusing email tests outside loopback MongoDB CI.');
const mailUri=parent.replace('/ips_ci?','/ips_ci_mail?');
assert.ok(mailUri!==parent&&mailUri.includes('/ips_ci_mail?'));
const root=await mkdtemp(path.join(os.tmpdir(),'ips-ci-mail-'));
const journal=path.join(root,'messages.jsonl');
const assets=path.join(root,'uploads');
const secret='ci-unique-mail-account-verification-0123456789abcdef';
const base='http://127.0.0.1:8092';
const testId=crypto.randomBytes(6).toString('hex');
const clientAddress='client-verify-'+testId+'@example.org';
const writerAddress='specialist-verify-'+testId+'@example.org';
const failedAddress='fail-provider-'+testId+'@example.org';
const password='IPSPrivateAccount2026!';
const newPassword='IPSRecoveredAccount2027!';
const writerNewPassword='IPSSpecialistRecovered2027!';
const providerEnv={
  ...process.env,NODE_ENV:'development',PORT:'8092',MONGODB_URI:mailUri,
  STORAGE_PROVIDER:'local',UPLOADS_DIR:assets,PUBLIC_APP_URL:base,
  CONTACT_RESEND_API_KEY:'ci-only-mail-provider-stub',
  CONTACT_FROM_EMAIL:'support@ipsglobalservice.com',
  CONTACT_REPLY_TO_EMAIL:'contact@ipsglobalservice.com',
  EMAIL_VERIFICATION_SECRET:secret,
  SESSION_SECRET:'ci-local-mail-session-secret-never-used-for-production-2026',
  IPS_PUBLICATION_STRICT:'false',IPS_PAYMENTS_ENABLED:'false',
  IPS_STAGING_MODE:'false',CONTACT_EMAIL_NOTIFICATIONS_ENABLED:'false',
  TELEGRAM_BOT_TOKEN:'',WHATSAPP_ACCESS_TOKEN:'',R2_ENDPOINT:'',
  IPS_CI_MAIL_JOURNAL:journal,
  ADMIN_EMAIL:'owner-ci@example.invalid',
  ADMIN_PASSWORD:'LocalOnlyAdminPassword123!'
};
await mkdir(assets,{recursive:true});
const preload=fileURLToPath(new URL('./ci-local-mail-provider-stub.mjs',import.meta.url));
const child=spawn(process.execPath,['--import',preload,'server.js'],{
  cwd:process.cwd(),env:providerEnv,stdio:['ignore','pipe','pipe']});
let childOutput='';
for(const io of [child.stdout,child.stderr])io.on('data',buf=>{
  // Do not print emails, passwords, tokens, or full provider responses.
  const line=String(buf);
  childOutput=(childOutput+line.replace(/(?:[A-Za-z0-9_-]{43}|[0-9]{8})/g,'[REDACTED]')).slice(-2000);
});
async function call(route,{method='GET',body,cookie}={}){
  const res=await fetch(base+route,{method,
    headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{cookie}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
    signal:AbortSignal.timeout(12000)});
  const json=await res.json().catch(()=>({}));
  return {code:res.status,body:json,cookie:(res.headers.get('set-cookie')||'').split(';')[0]};
}
async function findMail(address,contains){
  const lines=(await readFile(journal,'utf8').catch(()=>'')).split('\n').filter(Boolean);
  return lines.map(x=>JSON.parse(x)).filter(x=>x.to===address&&x.subject.includes(contains));
}
async function ready(){
  for(let i=0;i<100;i++){
    if(child.exitCode!==null)throw Error('Isolated HTTP server terminated before readiness: '+childOutput.slice(-300));
    try{const r=await call('/api/health');if(r.code===200&&r.body.database==='connected')return;}
    catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw Error('Real IPS test server did not become available: '+childOutput.slice(-250));
}
function extractVerify(mail,role,address){
  assert.ok(mail&&mail.text.includes('/verify-email#'),'Real company verification link missing');
  const match=mail.text.match(/http:\/\/127\.0\.0\.1:8092\/verify-email#([^\s]+)/);
  assert.ok(match);
  const params=new URLSearchParams(match[1]);
  assert.equal(params.get('role'),role);
  assert.equal(params.get('email'),address);
  assert.match(params.get('code')||'',/^\d{8}$/);
  return params.get('code');
}
function extractReset(mail,route){
  assert.ok(mail&&mail.text.includes(route+'#token='),'One-use private reset link is missing');
  const token=mail.text.match(/#token=([A-Za-z0-9_-]{43})/)?.[1];
  assert.ok(token);return token;
}
let client=null;
let completed=false;
try{
  await ready();
  const created=await call('/api/clients',{method:'POST',body:{
    username:'Private'+testId,email:clientAddress,password}});
  assert.equal(created.code,202,JSON.stringify(created.body));
  assert.ok(created.body.verification_required);
  assert.equal(created.cookie,'','Unverified users cannot get an authenticated cookie');
  assert.ok(!JSON.stringify(created.body).includes('code='));
  const pending=await call('/api/client/login',{method:'POST',body:{email:clientAddress,password}});
  assert.equal(pending.code,403);
  const links=await findMail(clientAddress,'Verify your IPS email address');
  assert.equal(links.length,1,'One actual new signup sends precisely one verification email');
  const code=extractVerify(links[0],'client',clientAddress);
  const bad=await call('/api/client/verify-email',{method:'POST',
    body:{email:clientAddress,code:code==='00000000'?'00000001':'00000000'}});
  assert.equal(bad.code,400);
  const verified=await call('/api/client/verify-email',{method:'POST',
    body:{email:clientAddress,code}});
  assert.equal(verified.code,200,JSON.stringify(verified.body));
  assert.ok(verified.cookie.startsWith('ips_session='));
  assert.equal(verified.body.client.full_name,'','IPS privacy requires no legal client name');
  assert.ok(!JSON.stringify(verified.body).includes('verification_hash'));
  const replay=await call('/api/client/verify-email',{method:'POST',
    body:{email:clientAddress,code}});
  assert.equal(replay.code,400,'Email verification proof must be single-use');
  client=verified.cookie;
  const own=await call('/api/client/me',{cookie:client});
  assert.equal(own.code,200);
  assert.equal(own.body.client?.email,clientAddress);
  const unknown=await call('/api/client/password-recovery/request',{method:'POST',
    body:{email:'nobody-'+testId+'@example.org'}});
  assert.equal(unknown.code,202);
  const forgot=await call('/api/client/password-recovery/request',{method:'POST',
    body:{email:clientAddress}});
  assert.equal(forgot.code,202);
  const resets=await findMail(clientAddress,'Reset your IPS account password');
  assert.equal(resets.length,1);
  const resetToken=extractReset(resets[0],'/reset-password');
  const changed=await call('/api/client/password-recovery/complete',{method:'POST',
    body:{token:resetToken,password:newPassword}});
  assert.equal(changed.code,200,JSON.stringify(changed.body));
  assert.equal(changed.body.session_opened,true);
  assert.ok(changed.cookie.startsWith('ips_session='));
  assert.equal((await call('/api/client/me',{cookie:client})).code,401,
    'Reset must revoke all previous customer sessions');
  assert.equal((await call('/api/client/password-recovery/complete',{
    method:'POST',body:{token:resetToken,password:newPassword}})).code,400,
    'One-use customer reset proof must reject replay');
  assert.equal((await call('/api/client/login',{method:'POST',
    body:{email:clientAddress,password}})).code,401);
  assert.equal((await call('/api/client/login',{method:'POST',
    body:{email:clientAddress,password:newPassword}})).code,200);
  console.log('IPS_REAL_HTTP_CLIENT_EMAIL_GREEN registration, exactly one fake-provider email, verification, private session, revoked old password, one-use recovered login');

  const specialist=await call('/api/provider/register',{method:'POST',body:{
    full_name:'CI Qualified Test Specialist',email:writerAddress,password,country:'Poland',
    motivation:'To support professional research methods consultation and documentation.',
    services:['research-methods'],primary_expertise:'Research methodologies',
    experience_level:'experienced',academic_level:'Master'
  }});
  assert.equal(specialist.code,202,JSON.stringify(specialist.body));
  assert.equal(specialist.body.application?.application_status,'pending');
  assert.equal(specialist.cookie,'','Unverified and unapproved specialist must not be signed in');
  const writerCode=extractVerify((await findMail(writerAddress,'Verify your IPS email address'))[0],
    'writer',writerAddress);
  assert.equal((await call('/api/writer/login',{method:'POST',
    body:{email:writerAddress,password}})).code,403);
  const writerVerified=await call('/api/writer/verify-email',{method:'POST',
    body:{email:writerAddress,code:writerCode}});
  assert.equal(writerVerified.code,200);
  assert.equal((await call('/api/writer/login',{method:'POST',
    body:{email:writerAddress,password}})).code,403,'Verification does not replace human specialist qualification review');
  const admin=await call('/api/admin/login',{method:'POST',body:{
    email:providerEnv.ADMIN_EMAIL,password:providerEnv.ADMIN_PASSWORD
  }});
  assert.equal(admin.code,200);
  const approve=await call('/api/provider/applications/'+specialist.body.application.writer_id,{
    method:'PATCH',cookie:admin.cookie,body:{decision:'approved',admin_notes:'Disposable CI evidence-only qualification'}
  });
  assert.equal(approve.code,200,JSON.stringify(approve.body));
  const writerLogin=await call('/api/writer/login',{method:'POST',
    body:{email:writerAddress,password}});
  assert.equal(writerLogin.code,200);
  assert.ok(writerLogin.cookie.startsWith('ips_session='));
  const writerReset=await call('/api/writer/password-recovery/request',{method:'POST',
    body:{email:writerAddress}});
  assert.equal(writerReset.code,202);
  const writerToken=extractReset(
    (await findMail(writerAddress,'Reset your IPS specialist password'))[0],
    '/writer/reset-password');
  const writerComplete=await call('/api/writer/password-recovery/complete',{method:'POST',
    body:{token:writerToken,password:writerNewPassword}});
  assert.equal(writerComplete.code,200);
  assert.equal(writerComplete.body.session_opened,true);
  assert.equal((await call('/api/writer/me',{cookie:writerLogin.cookie})).code,401);
  assert.equal((await call('/api/writer/password-recovery/complete',{method:'POST',
    body:{token:writerToken,password:writerNewPassword}})).code,400);
  assert.equal((await call('/api/writer/login',{method:'POST',
    body:{email:writerAddress,password:writerNewPassword}})).code,200);
  console.log('IPS_REAL_HTTP_SPECIALIST_EMAIL_GREEN independent verification, human approval, signed access, recovery and stale-cookie rejection');

  const failure=await call('/api/clients',{method:'POST',body:{
    username:'FailProvider'+testId,email:failedAddress,password}});
  assert.equal(failure.code,503,'Email provider refusal must not create an active account');
  assert.equal(failure.body.verification_required,true);
  const pendingFailed=await call('/api/client/login',{method:'POST',
    body:{email:failedAddress,password}});
  assert.equal(pendingFailed.code,403,'Failed email delivery must not allow unverified sign-in');
  assert.equal((await findMail(failedAddress,'Verify')).length,0);
  const config=await call('/api/student-payments/config');
  assert.equal(config.code,200);
  assert.equal(config.body.enabled,false);
  console.log('IPS_REAL_HTTP_FAILED_MAIL_GREEN rejected upstream delivery fails closed, no fake verified customer or payment checkout');
  completed=true;
}finally{
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve=>child.once('close',resolve)),
    new Promise(resolve=>setTimeout(resolve,4000))]);
  if(child.exitCode===null)child.kill('SIGKILL');
  const cleaner=new MongoClient(mailUri,{serverSelectionTimeoutMS:8000});
  try{
    await cleaner.connect();
    const db=cleaner.db('ips_ci_mail');
    const collections=await db.listCollections().toArray();
    if(collections.length)await db.dropDatabase();
  }finally{
    await cleaner.close().catch(()=>{});
    await rm(root,{recursive:true,force:true});
  }
}
if(completed)console.log('IPS_TRUE_EMAIL_VERIFICATION_RECOVERY_E2E_GREEN all real HTTP routes against disposable MongoDB; fake provider only; no real email messages sent');
