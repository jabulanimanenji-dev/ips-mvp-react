import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {COMPANY_NAV,caseNeedsOwner,caseLate,caseNeedsDecision,summarizeWork,departmentCoverage,readyClient,readySpecialist} from '../src/companyOS/model.js';
import {isProtectedOwnerRecord,ownerPrincipalEmail} from '../services/companyOperatingSystem.js';
const source=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('new IPS company operating system replaces all primary admin routes rather than reusing old dashboard',async()=>{
  const app=await source('src/App.jsx');
  const shell=await source('src/companyOS/CompanyShell.jsx');
  const css=await source('src/companyOS/company-os.css');
  const active=app.slice(app.indexOf('{/* IPS COMPANY OS v3:'));
  assert.match(active,/ProtectedAdminRoute><CompanyShell/);
  for(const name of ['CompanyHome','CompanyWork','CompanyTeam','CompanyClients','CompanySpecialists','CompanyProjects','CompanyDepartments','CompanyJourneys','CompanyIntelligence'])
    assert.ok(active.includes('<'+name),'Missing active new workspace '+name);
  assert.doesNotMatch(active,/CompanyCommandCenter|CompanyOperationsDesk|AdminAccessManager|AdminSidebar|AdminDashboard/);
  assert.match(shell,/COMPANY_NAV\.filter\(x=>hasAdminPermission\(x.permission\)\)/);
  assert.match(shell,/ips-os-rail/);
  assert.match(shell,/Ctrl K/);
  assert.match(shell,/isRoot\?'Root owner'/);
  assert.match(css,/color-scheme:dark/);
  assert.match(css,/\.ips-os-rail/);
  assert.doesNotMatch(css,/html\[data-theme/);
});
test('new navigation is unique, least privilege, action-centered and links all company responsibilities',()=>{
  const paths=COMPANY_NAV.map(x=>x.path);
  assert.equal(paths[0],'/admin/dashboard');
  assert.equal(paths.length,new Set(paths).size);
  for(const section of ['/admin/case-desk','/admin/journeys','/admin/departments','/admin/access',
    '/admin/clients','/admin/writers','/admin/enquiries','/admin/services','/admin/quality','/admin/support',
    '/admin/external-chats','/admin/reports','/admin/payments','/admin/settings'])assert.ok(paths.includes(section),section);
  assert.ok(COMPANY_NAV.every(x=>x.group&&x.permission&&x.name&&x.sub));
  assert.equal(COMPANY_NAV.find(x=>x.path==='/admin/access').permission,'team.manage');
  assert.equal(COMPANY_NAV.find(x=>x.path==='/admin/writers').permission,'providers.view');
});
test('root identity is permanently outside staff scope even if legacy database row shares email',()=>{
  const env={ADMIN_EMAIL:'Owner@IpsGlobalService.com'};
  assert.equal(ownerPrincipalEmail(env),'owner@ipsglobalservice.com');
  assert.equal(isProtectedOwnerRecord({email:'OWNER@IPSGLOBALSERVICE.COM',id:'ADM-LEGACY'},env),true);
  assert.equal(isProtectedOwnerRecord({email:'other@example.com',id:'OWNER@IPSGLOBALSERVICE.COM'},env),true);
  assert.equal(isProtectedOwnerRecord({email:'staff@example.com',id:'ADM-OTHER'},env),false);
});
test('unverified enquiries are not counted as unowned or overdue and no fake totals appear',()=>{
  const future='2035-01-01T00:00:00.000Z';
  const data=[{kind:'enquiry',status:'new',verified:false,due_at:'2020-01-01',owner:''},
    {kind:'enquiry',status:'new',verified:true,due_at:'2020-01-01',owner:''},
    {kind:'project',status:'Submitted for Review',owner:'ADM-ONE'},
    {kind:'project',status:'Completed',tasks:{overdue:9}},
    {kind:'support',status:'Open',tasks:{overdue:1}},
    {kind:'telegram',status:'open',new_message:true}];
  assert.equal(caseNeedsOwner(data[0]),false);assert.equal(caseLate(data[0]),false);
  assert.equal(caseNeedsOwner(data[1]),true);assert.equal(caseLate(data[1]),true);
  assert.equal(caseNeedsDecision(data[2]),true);assert.equal(caseNeedsDecision(data[3]),false);
  const summary=summarizeWork(data);
  assert.equal(summary.open,5);assert.equal(summary.unowned,1);assert.equal(summary.overdue,2);
  assert.equal(summarizeWork(null),null);
  const covered=departmentCoverage([{company_role:'manager',department:'finance',status:'Invited'},
    {company_role:'staff',department:'finance',status:'Active'}]);
  assert.equal(covered.length,7);
  assert.equal(covered.find(x=>x.id==='finance').managers.length,0);
  assert.equal(covered.find(x=>x.id==='finance').pending.length,1);
  assert.equal(departmentCoverage(null),null);
  assert.ok(future);
});
test('real client and specialist eligibility requires approved, verified, active identities',()=>{
  assert.equal(readyClient({client_id:'CID-REAL-001',email:'client@university.edu',status:'Active',email_verified_at:new Date()}),true);
  assert.equal(readyClient({client_id:'CID-REAL-001',email:'client@university.edu',status:'Active'}),false);
  assert.equal(readySpecialist({email:'specialist@university.edu',status:'Active',application_status:'approved',email_verified_at:new Date()}),true);
  assert.equal(readySpecialist({email:'specialist@university.edu',status:'Active',application_status:'approved'}),false);
  assert.equal(readySpecialist({email:'test@ips.test',status:'Active',application_status:'approved',email_verified_at:new Date()}),false);
});
test('fresh company work and people actions use real APIs, client consent, payment and authorized status gates',async()=>{
  const [work,team,records,journey,backend,server]=await Promise.all([
    source('src/companyOS/CompanyWork.jsx'),source('src/companyOS/CompanyTeam.jsx'),source('src/companyOS/CompanyRecords.jsx'),
    source('src/companyOS/CompanyOperations.jsx'),source('services/companyOperatingSystem.js'),source('server.js')]);
  for(const marker of ['/api/admin/company-cases','/actions','/tasks/','/api/contact-enquiries/admin/','/api/support-tickets/'])
    assert.ok(work.includes(marker),marker);
  for(const marker of ['/api/admin/company-team/roster','/invite','/offboard','/reinvite','/legacy/'])
    assert.ok(team.includes(marker),marker);
  for(const marker of ['clients.recovery','/password-recovery','/resend-verification','/api/provider/applications/',
    'allowedAdminServiceStatuses','payment_status===\'paid\'','readySpecialist','source_quote_id'])
    assert.ok(records.includes(marker),marker);
  assert.match(journey,/Independent quality/);assert.match(journey,/Payment provider is pending/);
  assert.match(backend,/isProtectedOwnerRecord\(target,env\)/);
  assert.match(backend,/const withoutOwner=members.filter/);
  assert.match(backend,/email===ownerPrincipalEmail\(env\)/);
  assert.match(server,/if \(email === adminEmail\) \{/);
  assert.match(server,/Historic MongoDB rows can share the root email/);
  assert.doesNotMatch(work,/Math\.random\(/);
});
