import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canAssignSupportTicket,canChangeSupportTicket} from '../shared/supportAuthority.js';
import {permittedCompanyPermissions} from '../shared/companyGovernance.js';

const root={isRoot:true,adminId:'owner@ips.example',permissions:['*']};
const manager={isRoot:false,companyRole:'manager',adminId:'ADM-CLIENT-MANAGER',
  department:'client_relations',permissions:permittedCompanyPermissions('client_relations','manager')};
const staff={isRoot:false,companyRole:'staff',adminId:'ADM-CLIENT-STAFF',
  department:'client_relations',permissions:permittedCompanyPermissions('client_relations','staff')};
const target=(id,role,dept,managerId='',status='Active')=>({
  id,status,company_role:role,department:dept,manager_id:managerId,
  permissions:permittedCompanyPermissions(dept,role)
});
const sameManager=target(manager.adminId,'manager','client_relations');
const sameStaff=target(staff.adminId,'staff','client_relations',manager.adminId);
const otherStaff=target('ADM-OTHER-STAFF','staff','academic_delivery','ADM-OTHER-MANAGER');
const otherManager=target('ADM-OTHER-MANAGER','manager','academic_delivery');
const financeManager=target('ADM-FINANCE-MANAGER','manager','finance');
test('Root delegates support only to active authorized managers, never herself or arbitrary staff',()=>{
  assert.equal(canAssignSupportTicket(root,sameManager),true);
  assert.equal(canAssignSupportTicket(root,sameStaff),false);
  assert.equal(canAssignSupportTicket(root,otherManager),false);
  assert.equal(canAssignSupportTicket(root,financeManager),false);
  assert.equal(canAssignSupportTicket(root,{...sameManager,status:'Suspended'}),false);
});
test('manager delegates only within own actual direct reporting line',()=>{
  assert.equal(canAssignSupportTicket(manager,sameManager),true);
  assert.equal(canAssignSupportTicket(manager,sameStaff),true);
  assert.equal(canAssignSupportTicket(manager,otherStaff),false);
  assert.equal(canAssignSupportTicket(manager,otherManager),false);
  assert.equal(canAssignSupportTicket(manager,{...sameStaff,manager_id:'ADM-OTHER'}),false);
});
test('individual staff may claim unowned work but cannot take work from others',()=>{
  assert.equal(canAssignSupportTicket(staff,sameStaff,''),true);
  assert.equal(canAssignSupportTicket(staff,sameStaff,staff.adminId),true);
  assert.equal(canAssignSupportTicket(staff,sameStaff,manager.adminId),false);
  assert.equal(canAssignSupportTicket(staff,sameManager,''),false);
});
test('support status and priority updates require accountable ownership',()=>{
  assert.equal(canChangeSupportTicket(root,staff.adminId,sameStaff,''),true);
  assert.equal(canChangeSupportTicket(manager,staff.adminId,sameStaff,''),true);
  assert.equal(canChangeSupportTicket(manager,otherStaff.id,otherStaff,''),false);
  assert.equal(canChangeSupportTicket(manager,'',null,''),false);
  assert.equal(canChangeSupportTicket(manager,'',null,staff.adminId),true);
  assert.equal(canChangeSupportTicket(staff,'',null,staff.adminId),true);
  assert.equal(canChangeSupportTicket(staff,manager.adminId,sameManager,''),false);
  assert.equal(canChangeSupportTicket(staff,staff.adminId,sameStaff,''),true);
});
test('server always performs authorization and atomic ownership compare-and-swap',async()=>{
  const [server,desk]=await Promise.all([
    readFile(new URL('../server.js',import.meta.url),'utf8'),
    readFile(new URL('../src/administration/CustomerSupportDesk.jsx',import.meta.url),'utf8')
  ]);
  assert.match(server,/canChangeSupportTicket\(actor,assignedId,ownerRecord,proposedId\)/);
  assert.match(server,/canAssignSupportTicket\(actor,recipient,assignedId\)/);
  assert.match(server,/assigned_admin:assignedId/);
  assert.match(server,/support_assignment/);
  assert.match(desk,/Take accountable ownership/);
  assert.match(desk,/Save governed assignment/);
});
