import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import {registerAdminPasswordRecoveryRoutes} from '../services/adminPasswordRecovery.js';

const uri=String(process.env.MONGODB_URI||'');
if(process.env.NODE_ENV!=='development'||!/\/(?:ips_ci)(?:\?|$)/.test(uri)||
   !/(?:localhost|127\.0\.0\.1)/.test(uri))
  throw Error('Employee recovery tests are forbidden outside disposable MongoDB CI.');
const id=crypto.randomBytes(5).toString('hex');
const emails={
  manager:'ips-manager-recovery-'+id+'@example.org',
  staff:'ips-staff-recovery-'+id+'@example.org',
  suspended:'ips-suspended-recovery-'+id+'@example.org',
  root:String(process.env.ADMIN_EMAIL||'').toLowerCase()
};
const memberId={manager:'ADM-CI-MAN-'+id,staff:'ADM-CI-STAFF-'+id,
  suspended:'ADM-CI-SUSP-'+id};
const oldPassword='InitialEmployeePassword23!';
const newPassword='RecoveredCompanyPassword25!';
const hash=password=>{
  const salt=crypto.randomBytes(16).toString('hex');
  return 'scrypt$'+salt+'$'+crypto.scryptSync(password,salt,64).toString('hex');
};
const matches=(plain,stored)=>{
  if(!stored?.startsWith('scrypt$'))return false;
  const parts=stored.split('$');
  return crypto.scryptSync(plain,parts[1],64).toString('hex')===parts[2];
};
const env={
  NODE_ENV:'development',ADMIN_EMAIL:emails.root,
  PUBLIC_APP_URL:'http://127.0.0.1:8080',CONTACT_RESEND_API_KEY:'ci-provider-stub',
  CONTACT_FROM_EMAIL:'support@ipsglobalservice.com',
  CONTACT_REPLY_TO_EMAIL:'contact@ipsglobalservice.com',
  EMAIL_VERIFICATION_SECRET:'ci-company-admin-recovery-hmac-secret-0123456789'
};
const sent=[],granted=[];
await mongoose.connect(uri);
let server=null;
try{
  await Admin.insertMany([
    {id:memberId.manager,name:'Recovery Manager',email:emails.manager,
      password:hash(oldPassword),role:'admin',company_role:'manager',
      department:'client_relations',status:'Active',session_version:1,
      email_verified_at:new Date(),must_change_password:true},
    {id:memberId.staff,name:'Recovery Staff',email:emails.staff,
      password:hash(oldPassword),role:'admin',company_role:'staff',
      department:'client_relations',manager_id:memberId.manager,
      status:'Active',session_version:1,email_verified_at:new Date(),must_change_password:true},
    {id:memberId.suspended,name:'Inactive employee',email:emails.suspended,
      password:hash(oldPassword),role:'admin',company_role:'staff',
      department:'client_relations',status:'Suspended',
      email_verified_at:new Date(),session_version:1}
  ]);
  const app=express();app.use(express.json());
  registerAdminPasswordRecoveryRoutes(app,{
    env,model:Admin,hashPassword,
    send:async message=>{sent.push(message);return 'ci-accepted';},
    grantSession:async(res,account)=>{
      granted.push(account.id);
      res.setHeader('Set-Cookie','ips_ci_role=admin; HttpOnly; SameSite=Strict; Path=/');
    }
  });
  server=await new Promise((resolve,reject)=>{
    const s=app.listen(0,'127.0.0.1',()=>resolve(s));s.once('error',reject);
  });
  const base='http://127.0.0.1:'+server.address().port;
  async function post(action,body){
    const result=await fetch(base+'/api/admin/password-recovery/'+action,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body),signal:AbortSignal.timeout(11000)});
    return {status:result.status,data:await result.json(),
      cookie:result.headers.get('set-cookie')||''};
  }
  const request=await post('request',{email:emails.manager});
  assert.equal(request.status,202);
  assert.ok(!JSON.stringify(request.data).includes('token='));
  assert.equal(sent.length,1);
  assert.equal(sent[0].to,emails.manager);
  const managerToken=sent[0].body.match(/\/admin\/reset-password#token=([A-Za-z0-9_-]{43})/)?.[1];
  assert.ok(managerToken,'Manager must receive their own secure link without a phone call.');
  const root=await post('request',{email:emails.root});
  assert.equal(root.status,202);
  assert.equal(sent.length,1,'Root environment-managed principal cannot use employee recovery.');
  const suspended=await post('request',{email:emails.suspended});
  assert.equal(suspended.status,202);
  assert.equal(sent.length,1,'Suspended employee must never receive an account access link.');
  const weak=await post('complete',{token:managerToken,password:'weak'});
  assert.equal(weak.status,400);
  const complete=await post('complete',{token:managerToken,password:newPassword});
  assert.equal(complete.status,200,JSON.stringify(complete.data));
  assert.equal(complete.data.session_opened,true);
  assert.equal(complete.data.redirect,'/admin/dashboard');
  assert.ok(complete.cookie.includes('ips_ci_role=admin'));
  assert.deepEqual(granted,[memberId.manager]);
  const member=await Admin.findOne({id:memberId.manager});
  assert.equal(member.must_change_password,false);
  assert.equal(member.session_version,2,'All former signed employee sessions must be revoked.');
  assert.ok(matches(newPassword,member.password));
  assert.equal(matches(oldPassword,member.password),false);
  const replay=await post('complete',{token:managerToken,password:newPassword});
  assert.equal(replay.status,400,'Email reset links must work exactly once.');
  const staffRequest=await post('request',{email:emails.staff});
  assert.equal(staffRequest.status,202);
  assert.equal(sent.length,2);
  const staffToken=sent[1].body.match(/\/admin\/reset-password#token=([A-Za-z0-9_-]{43})/)?.[1];
  assert.ok(staffToken&&staffToken!==managerToken,'Each employee must receive independent proof.');
  const staffComplete=await post('complete',{token:staffToken,password:newPassword});
  assert.equal(staffComplete.status,200);
  assert.deepEqual(granted,[memberId.manager,memberId.staff]);
  const staff=await Admin.findOne({id:memberId.staff});
  assert.equal(staff.session_version,2);
  assert.ok(matches(newPassword,staff.password));
  const throttled=await post('request',{email:'unknown@example.org'});
  assert.equal(throttled.status,429,'Repeated public reset attempts must be throttled.');
  console.log('IPS_EMPLOYEE_EMAIL_RECOVERY_E2E_GREEN genuine MongoDB, manager and employee one-use link, root and suspended exclusion, new signed workspace session, session revocation, replay and IP throttle');
}finally{
  if(server)await new Promise(done=>server.close(done));
  await Admin.deleteMany({id:{$in:Object.values(memberId)}}).catch(()=>{});
  await mongoose.disconnect();
}
