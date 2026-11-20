import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MODULES} from '../src/administration/core.jsx';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('Administration Four uses one scoped, readable matte-dark design without inherited white workspaces',async()=>{
 const [css,shell,app]=await Promise.all([read('src/administration/ips4.css'),read('src/administration/CompanyAdministration.jsx'),read('src/App.jsx')]);
 assert.match(css,/\.ips4\s*\{/);assert.match(css,/color-scheme:dark/);assert.match(css,/--control:#10212d/);
 assert.match(css,/\.ips4 :is\(input,textarea,select\)/);assert.match(css,/background:var\(--control\)!important/);
 assert.match(css,/\.ips4 \.ips4-bubble/);assert.match(css,/\.ips4 \.ips4-chat/);
 assert.match(css,/@media\(max-width:720px\)/);assert.doesNotMatch(css,/\.client-layout\{/);
 assert.match(shell,/COMPANY OPERATING|ADMINISTRATION/);assert.match(shell,/Nyoro/);assert.match(shell,/Root Admin/);
 assert.match(app,/ProtectedAdminRoute><CompanyAdministration/);
});
test('real company navigation is action-centered, complete, unique and authorized',()=>{
 assert.equal(MODULES[0].path,'/admin/dashboard');
 assert.equal(new Set(MODULES.map(x=>x.path)).size,MODULES.length);
 for(const x of MODULES)assert.ok(x.group&&x.label&&x.permission&&x.sub);
 const sections=new Set(MODULES.map(x=>x.group));
 assert.ok(sections.has('CUSTOMER JOURNEY'));assert.ok(sections.has('SERVICE PRODUCTION'));assert.ok(sections.has('ORGANIZATION'));
 assert.equal(MODULES.find(x=>x.path==='/admin/messages').permission,'messages.view');
});
test('full new intake, Telegram, support and private messages render their own dark components, not rejected controls',async()=>{
 const app=await read('src/App.jsx');
 const active=app.slice(app.indexOf('/* IPS ADMINISTRATION FOUR'),app.indexOf('/* FALLBACK'));
 const paths=['enquiries','external-chats','support','messages','services/:requestId'];
 for(const path of paths)assert.ok(active.includes('path="'+path+'"'));
 for(const rejected of ['<AdminEnquiries','<ChannelInbox','<AdminSupportTickets','<DirectMessaging','<ServiceJobDetail'])
 assert.equal(active.includes(rejected),false,'Legacy rejected component is still mounted: '+rejected);
 const telegram=await read('src/administration/TelegramOperations.jsx');
 assert.match(telegram,/ips4-chat/);assert.match(telegram,/reply_mode/);
 assert.match(telegram,/support_reply_allowed|general_support/);
 const messages=await read('src/administration/PrivateConversations.jsx');
 assert.match(messages,/api\/conversations/);assert.match(messages,/attachments/);
 const intake=await read('src/administration/IntakeDesk.jsx');
 assert.match(intake,/contact_verified/);assert.match(intake,/contact_consent/);assert.match(intake,/create-project/);
});
test('new client and specialist recovery never reveals credentials to IPS staff',async()=>{
 const [people,recovery,verify,account]=await Promise.all([
  read('src/administration/PeopleHub.jsx'),read('services/passwordRecovery.js'),
  read('services/accountVerification.js'),read('src/pages/PasswordRecoveryPage.jsx')]);
 assert.match(people,/\/api\/admin\/clients\//);
 assert.match(people,/\/api\/admin\/specialists\//);
 assert.match(people,/Send private password reset link/);
 assert.match(recovery,/scope==='writer'/);assert.match(recovery,/password_reset_hash/);
 assert.match(verify,/verificationLink/);
 assert.match(account,/Confirm new password/);
 assert.doesNotMatch(people,/password\s*[:=]\s*['"][^'"]+['"]/);
});
test('company people and project control never offers root employee mutation or premature payment access',async()=>{
 const [workforce,services,backend]=await Promise.all([
 read('src/administration/Workforce.jsx'),read('src/administration/ProductionHub.jsx'),read('services/companyOperatingSystem.js')]);
 assert.match(workforce,/Nyoro/);assert.match(workforce,/Root Admin/);assert.match(workforce,/offboard/);
 assert.match(workforce,/company-team\/invite/);
 assert.match(services,/allowedAdminServiceStatuses/);assert.match(services,/payment_status==='paid'/);
 assert.match(backend,/isProtectedOwnerRecord\(target,env\)/);
});
