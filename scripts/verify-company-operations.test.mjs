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
test('real administration route is no longer a generic counter-only dashboard',async()=>{
  const app=await readFile(new URL('../src/App.jsx',import.meta.url),'utf8');
  const desk=await readFile(new URL('../src/components/admin/CompanyOperationsDesk.jsx',import.meta.url),'utf8');
  const css=await readFile(new URL('../src/components/admin/company-desk.css',import.meta.url),'utf8');
  const server=await readFile(new URL('../server.js',import.meta.url),'utf8');
  assert.match(app,/element=\{<CompanyOperationsDesk \/>\}/);
  for(const endpoint of ['/api/admin/company-cases','/actions','/tasks/'])assert.ok(desk.includes(endpoint));
  for(const token of ['ips-ops-queue','ips-ops-detail','Case overview','Timeline','Follow-ups','Internal notes',
    'Take case ownership','Assign to me','Create follow-up'])assert.ok(desk.includes(token),token);
  assert.match(css,/\.ips-ops-body/);
  assert.match(server,/registerCompanyCaseDesk\(app,\{requireSession\}\)/);
  assert.doesNotMatch(desk,/fakeRevenue|mockTickets|Math\.random\(/);
});
test('private case tasks are persisted with assigned staff and not sent by customer email or Telegram',async()=>{
  const model=await readFile(new URL('../models/CompanyCaseAction.js',import.meta.url),'utf8');
  const source=await readFile(new URL('../services/companyCaseDesk.js',import.meta.url),'utf8');
  assert.match(model,/assigned_to/);
  assert.match(model,/case_kind/);
  assert.match(source,/assigned_to:assignedTo/);
  assert.match(source,/administrators\.manage/);
  assert.match(source,/CompanyCaseAction\.create/);
  assert.match(source,/CompanyCaseAction\.findOneAndUpdate/);
  assert.doesNotMatch(source,/sendEmail|sendTelegram|deliverExternalMessage/);
});
