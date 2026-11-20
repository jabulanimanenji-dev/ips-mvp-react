import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import Client from '../models/Client.js';
import CompanyCaseAction from '../models/CompanyCaseAction.js';
import {registerCompanyOperatingSystem} from '../services/companyOperatingSystem.js';
import {completePasswordRecovery} from '../services/passwordRecovery.js';
import {permittedCompanyPermissions} from '../shared/companyGovernance.js';

const hashPassword=password=>{
  const salt=crypto.randomBytes(16).toString('hex');
  return 'scrypt$'+salt+'$'+crypto.scryptSync(String(password),salt,64).toString('hex');
};
const env={
  NODE_ENV:'development',PUBLIC_APP_URL:'http://127.0.0.1:8080',
  EMAIL_VERIFICATION_SECRET:'ci-only-long-secret-0000000000000000000000000001',
  CONTACT_RESEND_API_KEY:'mock-provider-no-real-network',
  CONTACT_FROM_EMAIL:'support@ipsglobalservice.com',
  CONTACT_REPLY_TO_EMAIL:'contact@ipsglobalservice.com'
};
const sent=[];
const send=async message=>{sent.push(message);return 'ci-provider-accepted-'+sent.length;};
const pass=(label)=>console.log('COMPANY_OS_PASS '+label);
const password='TestCompanyPassword2026!';
let server;
try{
  await mongoose.connect(process.env.MONGODB_URI);
  let ids={};
  const app=express();app.use(express.json());
  app.use(async(req,res,next)=>{
    const role=String(req.headers['x-ci-company-actor']||'');
    if(role==='root'){
      req.adminAccess={adminId:'owner-ci@example.invalid',email:'owner-ci@example.invalid',
        isRoot:true,isSuperAdmin:true,companyRole:'root',permissions:['*']};
    }else if(ids[role]){
      const person=await Admin.findOne({id:ids[role]}).lean();
      if(person&&person.status==='Active')req.adminAccess={
        adminId:person.id,email:person.email,name:person.name,
        isRoot:false,isSuperAdmin:false,companyRole:person.company_role,
        department:person.department,managerId:person.manager_id,
        permissions:permittedCompanyPermissions(person.department,person.company_role,person.permissions)
      };
    }
    next();
  });
  const requireSession=(req,res)=>{
    if(!req.adminAccess){res.status(403).json({success:false,error:'Not authorized'});return null;}
    return {role:'admin',id:req.adminAccess.adminId};
  };
  registerCompanyOperatingSystem(app,{requireSession,hashPassword,
    validAdminPassword:p=>typeof p==='string'&&p.length>=10&&/[A-Za-z]/.test(p)&&/[0-9]/.test(p),
    env,send});
  server=await new Promise(resolve=>{
    const srv=app.listen(0,'127.0.0.1',()=>resolve(srv));
  });
  const base='http://127.0.0.1:'+server.address().port;
  async function call(path,{actor='',method='GET',json}={}){
    const response=await fetch(base+path,{method,headers:{
      ...(actor?{'x-ci-company-actor':actor}:{}),...(json?{'Content-Type':'application/json'}:{})
    },body:json?JSON.stringify(json):undefined});
    const data=await response.json().catch(()=>({}));
    return {status:response.status,data};
  }
  async function issueInvite(actor,name,email,department,role){
    const r=await call('/api/admin/company-team/invite',{actor,method:'POST',
      json:{name,email,department,company_role:role}});
    assert.equal(r.status,201,JSON.stringify(r.data));
    assert.ok(!JSON.stringify(r.data).includes('token='));
    const mail=sent[sent.length-1];
    assert.equal(mail.to,email.toLowerCase());
    const match=mail.body.match(/#id=(ADM-[A-F0-9]{18})&token=([A-Za-z0-9_-]{43})/);
    assert.ok(match,'A private invitation with a secret fragment was delivered.');
    const weak=await call('/api/admin/company-team/accept',{method:'POST',
      json:{id:match[1],token:match[2],password:'weak'}});
    assert.equal(weak.status,400);
    const accepted=await call('/api/admin/company-team/accept',{method:'POST',
      json:{id:match[1],token:match[2],password}});
    assert.equal(accepted.status,200,JSON.stringify(accepted.data));
    const replay=await call('/api/admin/company-team/accept',{method:'POST',
      json:{id:match[1],token:match[2],password}});
    assert.equal(replay.status,400,'Invites must be one-time only.');
    return match[1];
  }
  ids['manager-client']=await issueInvite('root','Client Relations Manager',
    'manager-client-ci@example.org','client_relations','manager');
  ids['manager-academic']=await issueInvite('root','Academic Delivery Manager',
    'manager-academic-ci@example.org','academic_delivery','manager');
  for(const name of ['manager-client','manager-academic']){
    const record=await Admin.findOne({id:ids[name]}).select('+invite_token_hash');
    assert.equal(record.status,'Active');
    assert.equal(record.company_role,'manager');
    assert.equal(record.manager_id,'');
    assert.equal(record.invite_token_hash,undefined);
    assert.ok(record.email_verified_at);
    assert.ok(record.permissions.includes('team.manage'));
    assert.ok(!record.permissions.includes('administrators.manage'));
  }
  pass('Root invited and activated two separate real managers with no manager above them');

  const rootStaff=await call('/api/admin/company-team/invite',{actor:'root',method:'POST',
    json:{name:'Unauthorized Staff',email:'root-staff-ci@example.org',department:'client_relations',company_role:'staff'}});
  assert.equal(rootStaff.status,403);
  const managerialEscalation=await call('/api/admin/company-team/invite',{actor:'manager-client',method:'POST',
    json:{name:'Illegal Manager',email:'manager-escalation-ci@example.org',department:'client_relations',company_role:'manager'}});
  assert.equal(managerialEscalation.status,403);
  const crossDepartment=await call('/api/admin/company-team/invite',{actor:'manager-client',method:'POST',
    json:{name:'Outside Department',email:'cross-department-ci@example.org',department:'academic_delivery',company_role:'staff'}});
  assert.equal(crossDepartment.status,403);
  const permissionsExcess=await call('/api/admin/company-team/invite',{actor:'manager-client',method:'POST',
    json:{name:'Overpowered Staff',email:'overpowered-ci@example.org',company_role:'staff',permissions:['platform.access','dashboard.view','team.manage','payments.manage']}});
  assert.equal(permissionsExcess.status,400);
  pass('Root cannot create direct staff; managers cannot create managers, cross departments or escalate privileges');

  ids['staff-a']=await issueInvite('manager-client','Client Care Officer A',
    'staff-a-ci@example.org','client_relations','staff');
  ids['staff-b']=await issueInvite('manager-client','Client Care Officer B',
    'staff-b-ci@example.org','client_relations','staff');
  ids['staff-academic']=await issueInvite('manager-academic','Academic Reviewer',
    'staff-academic-ci@example.org','academic_delivery','staff');

  const clientRoster=await call('/api/admin/company-team/roster',{actor:'manager-client'});
  assert.equal(clientRoster.status,200);
  assert.equal(clientRoster.data.self.role,'manager');
  assert.equal(clientRoster.data.members.length,2);
  assert.ok(clientRoster.data.members.every(m=>m.manager_id===ids['manager-client']));
  const academicRoster=await call('/api/admin/company-team/roster',{actor:'manager-academic'});
  assert.equal(academicRoster.data.members.length,1);
  const rootRoster=await call('/api/admin/company-team/roster',{actor:'root'});
  assert.equal(rootRoster.data.self.manager_id,null);
  assert.equal(rootRoster.data.members.filter(m=>m.company_role==='manager').length,2);
  const staffDenied=await call('/api/admin/company-team/roster',{actor:'staff-a'});
  assert.equal(staffDenied.status,403);
  pass('Manager rosters are isolated to direct reports; root sees the full structure; staff cannot manage people');

  const crossStaff=await call('/api/admin/company-team/members/'+ids['staff-academic'],{
    actor:'manager-client',method:'PATCH',json:{status:'Suspended'}});
  assert.equal(crossStaff.status,403);
  const selfSuspend=await call('/api/admin/company-team/members/'+ids['manager-client'],{
    actor:'manager-client',method:'PATCH',json:{status:'Suspended'}});
  assert.equal(selfSuspend.status,409);
  const rootStaffPatch=await call('/api/admin/company-team/members/'+ids['staff-a'],{
    actor:'root',method:'PATCH',json:{status:'Suspended'}});
  assert.equal(rootStaffPatch.status,403);
  const suspend=await call('/api/admin/company-team/members/'+ids['staff-a'],{
    actor:'manager-client',method:'PATCH',json:{status:'Suspended',reason:'Temporary approved leave'}});
  assert.equal(suspend.status,200);
  assert.equal((await Admin.findOne({id:ids['staff-a']})).status,'Suspended');
  const restore=await call('/api/admin/company-team/members/'+ids['staff-a'],{
    actor:'manager-client',method:'PATCH',json:{status:'Active'}});
  assert.equal(restore.status,200);
  pass('Company managers cannot self-suspend, control another team or give the owner direct staff management');

  const clientId='CID-'+crypto.randomBytes(9).toString('hex').toUpperCase();
  await Client.create({client_id:clientId,username:'PrivateRecoverySubject',username_key:'privaterecoverysubject',
    email:'client-recovery-ci@example.org',password:hashPassword('OldPassword2026!'),
    status:'Active',email_verified_at:new Date(),session_version:1});
  const recovery=await call('/api/admin/clients/'+clientId+'/password-recovery',{
    actor:'manager-client',method:'POST',json:{reason:'Customer identity was confirmed in the verified IPS support case.'}});
  assert.equal(recovery.status,202,JSON.stringify(recovery.data));
  assert.equal(sent[sent.length-1].to,'client-recovery-ci@example.org');
  assert.ok(!JSON.stringify(recovery.data).includes('#token='));
  const resetToken=sent[sent.length-1].body.match(/reset-password#token=([A-Za-z0-9_-]{43})/)?.[1];
  assert.ok(resetToken);
  const completed=await completePasswordRecovery(resetToken,'RenewedSecurePassword2026!',{
    env,model:Client,hashPassword});
  assert.equal(completed.success,true);
  const client=await Client.findOne({client_id:clientId});
  assert.equal(client.session_version,2);
  const reused=await completePasswordRecovery(resetToken,'RenewedSecurePassword2026!',{
    env,model:Client,hashPassword});
  assert.equal(reused.status,400);
  const otherRecovery=await call('/api/admin/clients/'+clientId+'/password-recovery',{
    actor:'manager-academic',method:'POST',json:{reason:'Should never be allowed outside client relations'}});
  assert.equal(otherRecovery.status,403);
  const unverifiedId='CID-'+crypto.randomBytes(9).toString('hex').toUpperCase();
  await Client.create({client_id:unverifiedId,username:'NoRecoveryBeforeVerify',username_key:'norecoverybeforeverify',
    email:'unverified-recovery-ci@example.org',password:hashPassword(password),status:'Pending Verification'});
  const unverified=await call('/api/admin/clients/'+unverifiedId+'/password-recovery',{
    actor:'manager-client',method:'POST',json:{reason:'Pending verification should not allow password reset'}});
  assert.equal(unverified.status,409);
  pass('Client manager delivers a real one-use recovery link only to the verified mailbox; old sessions invalidated and other departments blocked');

  await CompanyCaseAction.create({case_kind:'enquiry',case_ref:'IPS-Q-TEST-TEAM-001',entry_kind:'task',
    body:'Follow up on a customer response',created_by:ids['manager-client'],assigned_to:ids['staff-a'],
    task_status:'open',priority:'standard'});
  const firstOffboard=await call('/api/admin/company-team/members/'+ids['staff-a']+'/offboard',{
    actor:'manager-client',method:'POST',json:{reason:'Documented management transfer without replacement'}});
  assert.equal(firstOffboard.status,409);
  assert.equal(firstOffboard.data.outstanding.tasks,1);
  const offboard=await call('/api/admin/company-team/members/'+ids['staff-a']+'/offboard',{
    actor:'manager-client',method:'POST',
    json:{replacement_id:ids['staff-b'],reason:'Documented staff departure; transfer active follow-up.'}});
  assert.equal(offboard.status,200,JSON.stringify(offboard.data));
  assert.equal((await Admin.findOne({id:ids['staff-a']})).status,'Archived');
  assert.equal((await CompanyCaseAction.findOne({case_ref:'IPS-Q-TEST-TEAM-001'})).assigned_to,ids['staff-b']);
  const archivedRoster=await call('/api/admin/company-team/roster',{actor:'manager-client'});
  assert.equal(archivedRoster.data.members.find(x=>x.id===ids['staff-b']).workload.tasks,1);
  pass('Offboarding refuses orphaned tasks and transfers open work before archive and session invalidation');

  const liveBase=process.env.IPS_TEST_BASE_URL||'http://127.0.0.1:8080';
  const rootLogin=await fetch(liveBase+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})});
  assert.equal(rootLogin.status,200);
  const cookie=rootLogin.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  const legacyCreation=await fetch(liveBase+'/api/admins',{method:'POST',headers:{
    'Content-Type':'application/json',cookie},body:JSON.stringify({name:'Forbidden Legacy Staff',email:'legacy-ci@example.org',password})});
  assert.equal(legacyCreation.status,410);
  const legacyDelete=await fetch(liveBase+'/api/admins/'+ids['manager-client'],{method:'DELETE',headers:{cookie}});
  assert.equal(legacyDelete.status,410);
  const managerLogin=await fetch(liveBase+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:'manager-client-ci@example.org',password})});
  assert.equal(managerLogin.status,200);
  const managerBody=await managerLogin.json();
  assert.equal(managerBody.admin.isRoot,false);
  assert.equal(managerBody.admin.companyRole,'manager');
  assert.equal(managerBody.admin.department,'client_relations');
  assert.equal(managerBody.admin.permissions.includes('team.manage'),true);
  assert.equal(managerBody.admin.permissions.includes('administrators.manage'),false);
  pass('Production-form root and manager login use the actual permission ceilings; legacy hard delete and create are rejected');
  console.log('COMPANY_OS_ALL_REAL_MONGO_TESTS_PASSED');
}catch(error){
  console.error('COMPANY_OS_FAILED',error?.stack||String(error));
  process.exitCode=1;
}finally{
  try{if(server)await new Promise(resolve=>server.close(resolve));}catch{}
  try{await mongoose.disconnect();}catch{}
}
