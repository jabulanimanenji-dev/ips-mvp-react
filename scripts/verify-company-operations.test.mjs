import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  COMPANY_KIND_PERMISSIONS,normalizedCompanyCase,allowedCompanyCase
} from '../services/companyCaseDesk.js';

test('unified IPS company desk is strictly role-gated for every distinct case type',()=>{
  assert.deepEqual(Object.keys(COMPANY_KIND_PERMISSIONS),['enquiry','support','project','telegram']);
  for(const p of Object.values(COMPANY_KIND_PERMISSIONS)){
    assert.match(p.view,/\.view$/);assert.match(p.manage,/\.manage$/);
  }
  assert.notEqual(COMPANY_KIND_PERMISSIONS.enquiry.manage,COMPANY_KIND_PERMISSIONS.project.manage);
  assert.notEqual(COMPANY_KIND_PERMISSIONS.telegram.manage,COMPANY_KIND_PERMISSIONS.support.manage);
});
test('company desk rejects archived marketplace records and production fake identities',()=>{
  const q={enquiry_id:'IPS-Q-ABCDEF0123456789AB',request_type:'quote',source:'academic-quote',
    email:'private@university.edu',username:'ResearchAlias'};
  assert.equal(allowedCompanyCase('enquiry',q,{production:true}),true);
  assert.equal(allowedCompanyCase('enquiry',{...q,email:'synthetic@ips.test'},{production:true}),false);
  assert.equal(allowedCompanyCase('enquiry',{...q,source:'unrelated-platform'},{production:true}),false);
  assert.equal(allowedCompanyCase('support',{ticket_id:'SUP-REAL',client_email:'actual@university.edu'},{production:true}),true);
  assert.equal(allowedCompanyCase('support',{ticket_id:'SUP-TEST',client_email:'demo@example.org'},{production:true}),false);
  assert.equal(allowedCompanyCase('project',{category:'Car wash',source:'legacy'},{production:true}),false);
  assert.equal(allowedCompanyCase('project',{category:'Academic Support',source:'quote_intake',source_quote_id:'IPS-Q-123'},{production:true}),true);
  assert.equal(allowedCompanyCase('telegram',{channel:'telegram'},{production:true}),true);
  assert.equal(allowedCompanyCase('telegram',{channel:'whatsapp'},{production:true}),false);
});
test('normalized operational queues preserve pseudonym, real deadlines and actual status',()=>{
  const due=new Date('2026-12-01T12:00:00.000Z');
  const item=normalizedCompanyCase('enquiry',{enquiry_id:'IPS-Q-ABCDEF0123456789AB',
    username:'ChosenAlias',subject:'Research method',status:'in_progress',
    preferred_channel:'telegram',contact_verified:true,contact_consent:true,assigned_admin_id:'IPS-ADMIN',
    next_update_at:due,source:'academic-quote'});
  assert.equal(item.person,'ChosenAlias');
  assert.equal(item.verified,true);
  assert.equal(item.owner,'IPS-ADMIN');
  assert.equal(item.due_at,due);
  assert.equal(item.channel,'telegram');
  assert.equal(item.ref,'IPS-Q-ABCDEF0123456789AB');
  const project=normalizedCompanyCase('project',{request_id:'SRV-123',title:'Academic analysis',
    provider_id:'WID-1',provider_name:'Approved Specialist',status:'Submitted for Review'});
  assert.equal(project.assigned_specialist,true);
  assert.equal(project.status,'Submitted for Review');
});
test('new case operation is a source-bound protected service, not a decorative replacement panel',async()=>{
 const [app,work,css,server]=await Promise.all([
   readFile(new URL('../src/App.jsx',import.meta.url),'utf8'),
   readFile(new URL('../src/administration/OperationsBoard.jsx',import.meta.url),'utf8'),
   readFile(new URL('../src/administration/ips4.css',import.meta.url),'utf8'),
   readFile(new URL('../server.js',import.meta.url),'utf8')
 ]);
 assert.match(app,/ProtectedAdminRoute><CompanyAdministration/);
 assert.match(app,/path="case-desk" element={<Restricted permission="dashboard.view"><OperationsBoard/);
 for(const token of ['/api/admin/company-cases','/actions','/tasks/','Take case ownership','Accountable person','Activity history','Internal action register'])
  assert.ok(work.includes(token),token);
 assert.match(css,/ips4-record-layout/);
 assert.match(server,/registerCompanyCaseDesk\(app,\{requireSession\}\)/);
 assert.doesNotMatch(work,/fakeRevenue|mockTickets|Math\.random\(/);
});
test('private case tasks are persisted with assigned staff and not sent by customer email or Telegram',async()=>{
  const model=await readFile(new URL('../models/CompanyCaseAction.js',import.meta.url),'utf8');
  const source=await readFile(new URL('../services/companyCaseDesk.js',import.meta.url),'utf8');
  assert.match(model,/assigned_to/);
  assert.match(model,/case_kind/);
  assert.match(source,/assigned_to:assignedTo/);
  assert.match(source,/team\.manage/);
  assert.match(source,/CompanyCaseAction\.create/);
  assert.match(source,/CompanyCaseAction\.findOneAndUpdate/);
  assert.doesNotMatch(source,/sendEmail|sendTelegram|deliverExternalMessage/);
});
