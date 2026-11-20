import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MODULES} from '../src/administration/core.jsx';
import {isOpenCompanyCase,needsCompanyCaseOwner,isOverdueCompanyCase,summarizeCompanyCases} from '../shared/companyPulse.js';
import {isProtectedOwnerRecord,ownerPrincipalEmail} from '../services/companyOperatingSystem.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('Administration Four is mounted alone, replacing rejected Company OS v3 without any inherited admin screen',async()=>{
 const [app,shell,style]=await Promise.all([read('src/App.jsx'),read('src/administration/CompanyAdministration.jsx'),read('src/administration/ips4.css')]);
 const live=app.slice(app.indexOf('/* IPS ADMINISTRATION FOUR'),app.indexOf('/* FALLBACK'));
 assert.match(live,/ProtectedAdminRoute><CompanyAdministration/);
 for(const n of ['CompanyBridge','OperationsBoard','DepartmentBridge','JourneyBridge','Workforce','ClientRegistry',
   'SpecialistRegistry','TelegramOperations','IntakeDesk','CustomerSupportDesk','PrivateConversations','ProductionRegister','ProjectCaseFile'])
   assert.ok(live.includes('<'+n),'Missing new active company screen '+n);
 for(const rejected of ['CompanyShell','CompanyHome','CompanyWork','CompanyTeam','CompanyGuard','AdminEnquiries','AdminClients','AdminSupportTickets','ChannelInbox','DirectMessaging','ServiceJobDetail','ProtectedBusinessWorkspace'])
   assert.ok(!live.includes('<'+rejected),'Rejected screen mounted in new route tree '+rejected);
 assert.match(shell,/Nyoro/);assert.match(shell,/Root Admin/);
 assert.match(style,/color-scheme:dark/);assert.match(style,/\.ips4 :is\(input,textarea,select\)/);
 assert.match(style,/\.ips4-bubble/);assert.match(style,/\.ips4-dialog/);
 assert.doesNotMatch(style,/\.client-layout\{/);
});
test('all company responsibilities and identity-related work are available within permission ceilings',()=>{
 const paths=MODULES.map(x=>x.path);
 assert.equal(paths[0],'/admin/dashboard');
 assert.equal(new Set(paths).size,paths.length);
 for(const path of ['/admin/enquiries','/admin/external-chats','/admin/services','/admin/clients','/admin/writers',
  '/admin/support','/admin/messages','/admin/departments','/admin/access','/admin/reports','/admin/settings','/admin/payments','/admin/quality'])
  assert.ok(paths.includes(path),path);
 assert.equal(MODULES.find(x=>x.path==='/admin/access').permission,'team.manage');
 assert.equal(MODULES.find(x=>x.path==='/admin/writers').permission,'providers.view');
});
test('the root principal can never be managed as subordinate staff or created from a legacy row',()=>{
 const env={ADMIN_EMAIL:'owner@ipsglobalservice.com'};
 assert.equal(ownerPrincipalEmail(env),'owner@ipsglobalservice.com');
 assert.equal(isProtectedOwnerRecord({email:'OWNER@IPSGLOBALSERVICE.COM',id:'ADM-1'},env),true);
 assert.equal(isProtectedOwnerRecord({id:'owner@ipsglobalservice.com',email:'someone@other.com'},env),true);
 assert.equal(isProtectedOwnerRecord({email:'staff@company.com',id:'ADM-2'},env),false);
});
test('management pulse retains verified-customer and source-derived exception gates',()=>{
 const fixtures=[
 {kind:'enquiry',status:'new',verified:false,owner:'',due_at:'2020-01-01'},
 {kind:'enquiry',status:'new',verified:true,owner:'',due_at:'2020-01-01'},
 {kind:'support',status:'Open',tasks:{overdue:1}},
 {kind:'project',status:'Completed',tasks:{overdue:1}}
 ];
 assert.equal(needsCompanyCaseOwner(fixtures[0]),false);assert.equal(isOverdueCompanyCase(fixtures[0]),false);
 assert.equal(needsCompanyCaseOwner(fixtures[1]),true);assert.equal(isOverdueCompanyCase(fixtures[1]),true);
 assert.equal(isOpenCompanyCase(fixtures[3]),false);
 const report=summarizeCompanyCases(fixtures);
 assert.equal(report.open,3);assert.equal(report.unowned,1);assert.equal(report.overdue,2);
 assert.equal(summarizeCompanyCases(null),null);
});
test('new administration routes are actually backed by private operating APIs',async()=>{
 const files=['CompanyControl.jsx','OperationsBoard.jsx','PeopleHub.jsx','TelegramOperations.jsx',
  'IntakeDesk.jsx','CustomerSupportDesk.jsx','PrivateConversations.jsx','ProductionHub.jsx','Workforce.jsx'];
 const texts=await Promise.all(files.map(f=>read('src/administration/'+f)));
 for(const endpoint of ['/api/admin/company-cases','/api/admin/company-team/roster','/api/clients','/api/writers',
   '/api/contact-channels/admin/threads','/api/support-tickets','/api/contact-enquiries/admin','/api/conversations','/api/services'])
 assert.ok(texts.some(t=>t.includes(endpoint)),'Missing actual source endpoint '+endpoint);
 for(const src of texts)assert.doesNotMatch(src,/Math\.random\(|demoRevenue|fakeCases/);
});
