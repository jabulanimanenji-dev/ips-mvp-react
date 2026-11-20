import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 isOpenCompanyCase,isOverdueCompanyCase,needsCompanyCaseOwner,
 requiresManagementAttention,summarizeCompanyCases,departmentLeadershipState
} from '../shared/companyPulse.js';

const now=Date.parse('2026-11-20T12:00:00Z');
const enquiry=(overrides={})=>({kind:'enquiry',ref:'Q-12345',status:'new',verified:true,owner:'',
 tasks:{open:1,overdue:0},due_at:'2026-11-19T12:00:00Z',...overrides});

test('only open, verified cases can be counted as unassigned or overdue customer contact',()=>{
 const pending=enquiry({verified:false});
 const complete=enquiry({status:'closed'});
 assert.equal(needsCompanyCaseOwner(pending),false);
 assert.equal(isOverdueCompanyCase(pending,now),false);
 assert.equal(requiresManagementAttention(pending,now),false);
 assert.equal(needsCompanyCaseOwner(complete),false);
 assert.equal(isOverdueCompanyCase(complete,now),false);
 assert.equal(requiresManagementAttention(complete,now),false);
 assert.equal(needsCompanyCaseOwner(enquiry()),true);
 assert.equal(isOverdueCompanyCase(enquiry(),now),true);
 assert.equal(isOpenCompanyCase({status:'Completed'}),false);
});
test('unread communications and approval exceptions drive management attention',()=>{
 assert.equal(requiresManagementAttention({kind:'telegram',status:'open',new_message:true}),true);
 assert.equal(requiresManagementAttention({kind:'project',status:'Submitted for Review'}),true);
 assert.equal(requiresManagementAttention({kind:'project',status:'Completed',priority:'urgent'}),false);
 assert.equal(requiresManagementAttention({kind:'support',status:'Open',tasks:{overdue:1}}),true);
});
test('pulse metrics derive from visible records and never invent figures when source is unavailable',()=>{
 assert.equal(summarizeCompanyCases(null),null);
 const cases=[enquiry(),enquiry({ref:'Q-2',owner:'ADM-2',due_at:null}),
  {kind:'project',status:'In Progress',tasks:{open:2,overdue:1}},
  {kind:'telegram',status:'open',new_message:true},
  {kind:'support',status:'Resolved',tasks:{open:10,overdue:4}}];
 const pulse=summarizeCompanyCases(cases,now);
 assert.deepEqual(pulse,{open:4,attention:4,unowned:1,overdue:2,tasks:4,
  counts:{enquiry:2,support:0,project:1,telegram:1}});
 assert.equal(Object.isFrozen(pulse),true);
});
test('department manager coverage distinguishes vacant, invited and active',()=>{
 const staff=[{company_role:'staff',department:'finance',status:'Active'},
  {company_role:'manager',department:'finance',status:'Invited'}];
 assert.equal(departmentLeadershipState(null,'finance'),'unavailable');
 assert.equal(departmentLeadershipState(staff,'finance'),'invited');
 assert.equal(departmentLeadershipState(staff,'academic_delivery'),'vacant');
 staff.push({company_role:'manager',department:'finance',status:'Active'});
 assert.equal(departmentLeadershipState(staff,'finance'),'appointed');
});
test('Nyoro receives a real independent Administration Four bridge with role-bound cases and leadership coverage',async()=>{
 const [app,shell,operations,bridge,styles]=await Promise.all([
  readFile(new URL('../src/App.jsx',import.meta.url),'utf8'),
  readFile(new URL('../src/administration/CompanyAdministration.jsx',import.meta.url),'utf8'),
  readFile(new URL('../src/administration/OperationsBoard.jsx',import.meta.url),'utf8'),
  readFile(new URL('../src/administration/CompanyControl.jsx',import.meta.url),'utf8'),
  readFile(new URL('../src/administration/ips4.css',import.meta.url),'utf8')
 ]);
 assert.match(app,/path="dashboard" element={<Restricted permission="dashboard.view"><CompanyBridge/);
 assert.match(app,/path="case-desk" element={<Restricted permission="dashboard.view"><OperationsBoard/);
 assert.match(shell,/Nyoro/);assert.match(shell,/Root Admin/);
 assert.match(operations,/api\/admin\/company-cases/);
 assert.match(bridge,/summarizeCompanyCases/);assert.match(bridge,/COMPANY_DEPARTMENTS/);
 assert.match(styles,/color-scheme:dark/);
 assert.doesNotMatch(styles,/\.client-layout\{/);
});

test('administrative recovery never bypasses client mailbox verification or account-holder code proof',async()=>{
 const backend=await readFile(new URL('../services/companyOperatingSystem.js',import.meta.url),'utf8');
 const ui=await readFile(new URL('../src/administration/PeopleHub.jsx',import.meta.url),'utf8');
 assert.match(backend,/\/api\/admin\/clients\/:id\/resend-verification/);
 assert.match(backend,/hasAdminPermission\(access,'clients.manage'\)/);
 assert.match(backend,/await issueEmailChallenge\(client,\{env,send\}\)/);
 assert.match(backend,/company_client_verification_reissued/);
 assert.match(backend,/Only active email-verified IPS clients can receive recovery links/);
 assert.match(ui,/Reissue verification code/);
 assert.match(ui,/secure password recovery becomes available/i);
 assert.doesNotMatch(backend,/email_verified_at\s*=\s*new Date\(\)/);
});
