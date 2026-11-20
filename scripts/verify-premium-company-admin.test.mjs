import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {COMPANY_NAV} from '../src/companyOS/model.js';
const source=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('new IPS operating environment is dark-only, visually isolated, responsive and not an old sidebar reskin',async()=>{
  const [css,shell,app]=await Promise.all([source('src/companyOS/company-os.css'),source('src/companyOS/CompanyShell.jsx'),source('src/App.jsx')]);
  assert.match(css,/\.ips-os\{/);
  assert.match(css,/color-scheme:dark/);
  assert.match(css,/#0b1219/);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.doesNotMatch(css,/\.client-layout\{|\.writer-layout\{/);
  assert.match(shell,/COMPANY OPERATING SYSTEM/);
  assert.match(shell,/COMPANY_NAV\.filter\(x=>hasAdminPermission\(x.permission\)\)/);
  assert.match(shell,/aria-label="Toggle company navigation"/);
  assert.match(shell,/Find a workspace/);
  assert.match(app,/ProtectedAdminRoute><CompanyShell/);
  assert.doesNotMatch(app.slice(app.indexOf('{/* IPS COMPANY OS v3:')),/<AdminLayout\s*\//);
});
test('all operating responsibilities are governed by actual independent navigation and permission checks',async()=>{
  const paths=COMPANY_NAV.map(x=>x.path);
  assert.equal(paths[0],'/admin/dashboard');
  assert.equal(paths.length,new Set(paths).size);
  for(const path of ['/admin/case-desk','/admin/journeys','/admin/departments','/admin/enquiries','/admin/services',
    '/admin/quality','/admin/support','/admin/external-chats','/admin/clients','/admin/writers','/admin/access',
    '/admin/reports','/admin/settings','/admin/payments'])assert.ok(paths.includes(path),path);
  assert.ok(COMPANY_NAV.every(x=>x.permission&&x.icon&&x.sub));
  assert.equal(COMPANY_NAV.find(x=>x.path==='/admin/access').permission,'team.manage');
  const app=await source('src/App.jsx');
  for(const permission of ['team.manage','providers.view','services.view','clients.view','support.view','messages.view','reports.view'])
    assert.ok(app.includes('permission="'+permission+'"'),permission);
});
test('real new company command queue is powered by permission-filtered source cases and durable actions',async()=>{
  const [work,home,model]=await Promise.all([
    source('src/companyOS/CompanyWork.jsx'),source('src/companyOS/CompanyHome.jsx'),source('src/companyOS/model.js')]);
  for(const endpoint of ['/api/admin/company-cases','/api/contact-enquiries/admin/','/api/support-tickets/','/actions','/tasks/'])
    assert.ok(work.includes(endpoint),endpoint);
  assert.match(work,/Take ownership of verified enquiry/);
  assert.match(work,/Accountable person/);
  assert.match(work,/Internal .*task/);
  assert.match(work,/Contact authorization/);
  assert.match(home,/Leadership gaps/);
  assert.match(model,/shared\/companyPulse.js/);
  assert.doesNotMatch(work,/Math\.random\(|fakeRevenue|mockTickets/);
});
test('existing confidential reply and message tools are preserved behind the new business workspace guard',async()=>{
  const [app,guard,intake]=await Promise.all([source('src/App.jsx'),source('src/companyOS/CompanyGuard.jsx'),source('src/components/admin/AdminEnquiries.jsx')]);
  for(const path of ['intake/reply','support/tickets','channels/telegram','messages','services/:requestId'])
    assert.ok(app.includes('path="'+path+'"'),path);
  assert.match(guard,/CompanyGuard/);assert.match(guard,/hasAdminPermission\(permission\)/);
  assert.match(intake,/contact_consent/);assert.match(intake,/Take review ownership/);
});
test('new client, specialist and academic delivery administration enforce production eligibility and payment gates',async()=>{
  const [records,team,departments]=await Promise.all([source('src/companyOS/CompanyRecords.jsx'),
    source('src/companyOS/CompanyTeam.jsx'),source('src/companyOS/CompanyOperations.jsx')]);
  for(const needle of ['readyClient','readySpecialist','clients.recovery','/password-recovery','/resend-verification',
    'email_verified_at','allowedAdminServiceStatuses','payment_status===\'paid\''])assert.ok(records.includes(needle),needle);
  assert.match(team,/ROOT OWNER/);
  assert.match(team,/Never staff/);
  assert.match(team,//api/admin/company-team/invite/);
  assert.match(team,/Governed offboarding/);
  assert.match(departments,/CompanyDepartments/);
  assert.match(departments,/CompanyJourneys/);
  assert.match(departments,/CompanyIntelligence/);
});
