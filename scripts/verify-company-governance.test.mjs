import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 COMPANY_DEPARTMENTS,isCompanyDepartment,permittedCompanyPermissions,
 mayManageTeamMember,companyStaffPasswordValid,managementDepartments
} from '../shared/companyGovernance.js';
import {invitationDigest,staffInvitationReady} from '../services/companyOperatingSystem.js';

test('root has no manager and creates managers, managers own only direct staff',()=>{
  const root={isRoot:true,adminId:'owner@ips.example',companyRole:'root'};
  const manager={isRoot:false,adminId:'ADM-MANAGER-A',companyRole:'manager',department:'client_relations'};
  const other={...manager,adminId:'ADM-MANAGER-B',department:'academic_delivery'};
  const staff={id:'ADM-STAFF-A',company_role:'staff',department:'client_relations',manager_id:manager.adminId};
  const staffOther={...staff,department:'academic_delivery',manager_id:other.adminId};
  const peerManager={id:manager.adminId,company_role:'manager',department:'client_relations',manager_id:''};
  assert.equal(mayManageTeamMember(root,peerManager),true);
  assert.equal(mayManageTeamMember(root,staff),false,'root appoints managers, not direct staff');
  assert.equal(mayManageTeamMember(manager,staff),true);
  assert.equal(mayManageTeamMember(manager,staffOther),false);
  assert.equal(mayManageTeamMember(manager,peerManager),false);
  assert.equal(mayManageTeamMember(root,{...peerManager,isRoot:true}),false);
});
test('department permission ceiling excludes all owner, cross-department and unsupported controls',()=>{
  assert.equal(isCompanyDepartment('client_relations'),true);
  assert.equal(isCompanyDepartment('__proto__'),false);
  assert.ok(Object.keys(COMPANY_DEPARTMENTS).length>=6);
  for(const [dept,definition] of Object.entries(COMPANY_DEPARTMENTS)){
    const manager=permittedCompanyPermissions(dept,'manager');
    const staff=permittedCompanyPermissions(dept,'staff');
    assert.ok(manager.includes('team.manage'));
    assert.ok(manager.includes('platform.access'));
    assert.ok(manager.includes('dashboard.view'));
    assert.ok(staff.includes('platform.access'));
    assert.equal(staff.includes('team.manage'),false);
    assert.equal(manager.includes('administrators.manage'),false);
    assert.equal(staff.includes('administrators.manage'),false);
    assert.equal(manager.includes('settings.manage'),false);
    assert.equal(staff.includes('payments.manage'),false);
    assert.equal(manager.includes('*'),false);
    assert.ok(staff.every(p=>manager.includes(p)));
    assert.ok(definition.label);
  }
  assert.equal(permittedCompanyPermissions('nonexistent','manager').length,0);
  assert.equal(permittedCompanyPermissions('client_relations','superadmin').length,0);
  assert.deepEqual(permittedCompanyPermissions('client_relations','staff',['clients.view','payments.manage']),['clients.view']);
  assert.ok(permittedCompanyPermissions('client_relations','manager').includes('clients.recovery'));
  assert.equal(permittedCompanyPermissions('finance','manager').includes('clients.recovery'),false);
});
test('leadership coverage never infers missing managers from a scoped manager-only roster',()=>{
  const root={isRoot:true,companyRole:'root'};
  const manager={isRoot:false,companyRole:'manager',department:'client_relations'};
  const other={...manager,department:'academic_delivery'};
  const staff={isRoot:false,companyRole:'staff',department:'client_relations'};
  assert.equal(managementDepartments(root).length,Object.keys(COMPANY_DEPARTMENTS).length);
  assert.deepEqual(managementDepartments(manager).map(([id])=>id),['client_relations']);
  assert.deepEqual(managementDepartments(other).map(([id])=>id),['academic_delivery']);
  assert.deepEqual(managementDepartments(staff).map(([id])=>id),['client_relations']);
  assert.deepEqual(managementDepartments({...manager,department:'__proto__'}),[]);
});
test('staff self-selected password must include uppercase, digit, symbol and sufficient length',()=>{
  assert.equal(companyStaffPasswordValid('SecureTeamPassword2026!'),true);
  for(const password of ['short1!A','lowercase2026!','NOSYMBOL2026','NODIGITS!!','A'.repeat(129),''])
    assert.equal(companyStaffPasswordValid(password),false,password);
});
test('invitation tokens are HMAC-digested and only sent via a verified business origin',()=>{
  const token='A'.repeat(43),secret='x'.repeat(48);
  assert.equal(invitationDigest(token,secret).length,64);
  assert.notEqual(invitationDigest(token,secret),token);
  assert.notEqual(invitationDigest(token,secret),invitationDigest('B'.repeat(43),secret));
  const env={NODE_ENV:'production',PUBLIC_APP_URL:'https://www.ipsglobalservice.com',
    EMAIL_VERIFICATION_SECRET:secret,CONTACT_RESEND_API_KEY:'ci-only'};
  assert.equal(staffInvitationReady(env),true);
  assert.equal(staffInvitationReady({...env,PUBLIC_APP_URL:'http://www.ipsglobalservice.com'}),false);
  assert.equal(staffInvitationReady({...env,EMAIL_VERIFICATION_SECRET:'short'}),false);
  assert.equal(staffInvitationReady({...env,CONTACT_RESEND_API_KEY:''}),false);
});
test('company operating system has no hard admin deletion, browser token leak or staff password edit',async()=>{
  const server=await readFile(new URL('../server.js',import.meta.url),'utf8');
  const ui=await readFile(new URL('../src/components/admin/AdminAccessManager.jsx',import.meta.url),'utf8');
  const page=await readFile(new URL('../src/pages/StaffOnboardingPage.jsx',import.meta.url),'utf8');
  const model=await readFile(new URL('../models/Admin.js',import.meta.url),'utf8');
  assert.match(server,/Permanent administrator deletion is prohibited/);
  assert.match(server,/Legacy administrator creation is retired/);
  assert.match(server,/registerCompanyOperatingSystem/);
  assert.match(ui,/Company staff directory/);
  assert.match(ui,/Governed offboarding/);
  assert.doesNotMatch(ui,/findOneAndDelete|Remove\s*<\/button>|temporaryPassword|setTemporaryPassword/);
  assert.match(page,/window\.location\.hash/);
  assert.match(page,/window\.history\.replaceState/);
  assert.doesNotMatch(page,/services\/companyOperatingSystem/);
  assert.match(model,/manager_id/);
  assert.match(model,/company_role/);
});
test('client password assistance sends to verified email; staff never sets the password',async()=>{
  const service=await readFile(new URL('../services/companyOperatingSystem.js',import.meta.url),'utf8');
  const ui=await readFile(new URL('../src/components/admin/AdminClients.jsx',import.meta.url),'utf8');
  assert.match(service,/clients\.recovery/);
  assert.match(service,/requestPasswordRecovery\(client\.email/);
  assert.match(service,/recoveryReady\(env\)/);
  assert.match(service,/client\.email_verified_at/);
  assert.match(service,/result\.delivered/);
  assert.match(ui,/Send secure password recovery link|Start secure password recovery/);
  assert.match(ui,/email_verified_at/);
  assert.doesNotMatch(ui,/temporary_password/);
});
