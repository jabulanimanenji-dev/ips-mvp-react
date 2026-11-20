import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Writer from '../models/Writer.js';
import ServiceRequest from '../models/ServiceRequest.js';

const base=process.env.BROWSER_BASE_URL||'http://127.0.0.1:8080';
const adminEntry=process.env.VITE_ADMIN_ENTRY_PATH||'/ips-mission-control';
if(!process.env.MONGODB_URI||!base.startsWith('http://127.0.0.1:'))throw Error('Workspace browser qualification requires the isolated local CI API.');
await mkdir('workspace-evidence',{recursive:true});
const failures=[];
const output=(name,err)=>{failures.push({name,error:String(err)});console.error('FAIL '+name+' => '+err);};
const check=async(name,fn)=>{try{await fn();console.log('PASS '+name);}catch(e){output(name,e);}};
const hashPass=password=>{
  const salt=crypto.randomBytes(16).toString('hex');
  return 'scrypt$'+salt+'$'+crypto.scryptSync(password,salt,64).toString('hex');
};
const password='ExampleTestPassword123!';
await mongoose.connect(process.env.MONGODB_URI);
// Reuse the genuinely verified and IPS-approved specialist and completed
// academic project from the preceding three-role MongoDB lifecycle. No seeded
// account or administrator status forgery is needed for browser qualification.
const paidRequest=await ServiceRequest.findOne({
  client_id:'CID-TEST-ALICE',category:'Academic Support',payment_status:{$in:['paid','refunded']},
  provider_id:'WID-CI-VERIFIED-01'
}).sort({createdAt:-1}).lean();
assert.ok(paidRequest?.request_id,'Missing verified paid and approved specialist project from API integration.');
assert.equal(paidRequest.status,'Completed');
const writerIdentity=await Writer.findOne({writer_id:'WID-CI-VERIFIED-01'}).lean();
assert.equal(writerIdentity?.application_status,'approved');
assert.ok(writerIdentity?.email_verified_at);
await mongoose.disconnect();
console.log('PASS Browser reuses genuine paid assignment, approved specialist and completed client lifecycle');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const pages=[];
const open=async()=>{const p=await browser.newPage({viewport:{width:1440,height:900}});pages.push(p);return p};
async function evidence(page,name){await page.screenshot({path:'workspace-evidence/'+name+'.png',fullPage:true,animations:'disabled'});}
try{
  const outsider=await open();
  await check('Private workspace cannot open before authenticated login',async()=>{
    await outsider.goto(base+'/client/overview',{waitUntil:'domcontentloaded'});
    await outsider.waitForURL(/\/login/,{timeout:15000});
    assert.equal(await outsider.locator('.ipsa-auth-shell').count(),1);
  });
  await check('Browser local-storage forgery never opens an IPS workspace',async()=>{
    await outsider.evaluate(()=>localStorage.setItem('ips-user',JSON.stringify({client_id:'CID-TEST-ALICE',username:'ForgedAccount',email_verified_at:new Date().toISOString()})));
    await outsider.goto(base+'/client/overview',{waitUntil:'domcontentloaded'});
    await outsider.waitForURL(/\/login/,{timeout:15000});
    assert.equal(await outsider.locator('.client-layout').count(),0);
    assert.equal(await outsider.evaluate(()=>localStorage.getItem('ips-user')),null);
  });
  const student=await open();
  await check('Real Student / Researcher login opens private workspace with verified session',async()=>{
    await student.goto(base+'/login',{waitUntil:'domcontentloaded'});
    await student.locator('input[type=email]').fill('alice.test@example.org');
    await student.locator('input[type=password]').fill(password);
    await student.getByRole('button',{name:/open my workspace/i}).click();
    await student.waitForURL(/\/client\/overview/,{timeout:15000});
    await student.getByText('Private Quote Messages').waitFor({timeout:20000});
    assert.ok(await student.getByText('PrivateAlice').first().count()>=1);
    assert.equal(await student.evaluate(()=>localStorage.getItem('ips-user')),null);
    const hero=student.locator('.dashboard-zone-client-hero section');
    const gradient=await hero.evaluate(el=>getComputedStyle(el).backgroundImage);
    assert.ok(gradient.includes('rgb(16, 42, 67)'), 'Student hero must use readable deep-navy background: '+gradient);
    await evidence(student,'student-overview');
  });
  await check('Signed-in student sees only their own quotation and can reply',async()=>{
    await student.getByLabel('Choose your quotation').selectOption({index:0});
    assert.ok((await student.locator('[aria-label="Written quotation conversation"]').innerText()).includes('IPS reviewed'));
    await student.locator('textarea[placeholder*="clarify your request"]').fill('I confirm the preferred timeline and ask for a revised quotation.');
    await student.getByRole('button',{name:'Send Written Reply'}).click();
    await student.getByText('Your written reply has been saved for IPS.').waitFor({timeout:10000});
    await evidence(student,'student-private-quotation');
  });
  await check('Private quotation links to the same paid and IPS-governed customer project',async()=>{
    try{
      const projectLink=student.getByRole('link',{name:/Open managed IPS project/}).first();
      await projectLink.waitFor({timeout:12000});
      await projectLink.click();
      await student.waitForURL(/\/client\/services\/SRV-[0-9A-F]{18}/,{timeout:12000});
      await student.getByRole('heading',{name:paidRequest.title,exact:true}).waitFor({timeout:15000});
      const text=await student.locator('body').innerText();
      assert.ok(text.includes(paidRequest.request_id),'The public quote and managed project must have one real reference.');
      await evidence(student,'customer-quote-to-managed-project');
    }finally{
      await student.goto(base+'/client/overview',{waitUntil:'domcontentloaded'});
      await student.getByText('Private Quote Messages').waitFor({timeout:15000});
    }
  });
  await check('Authenticated workspace persists across reload by server session, not browser storage',async()=>{
    await student.reload({waitUntil:'domcontentloaded'});
    await student.getByText('Private Quote Messages').waitFor({timeout:15000});
    assert.ok(await student.locator('.client-layout').count()===1);
    assert.equal(await student.evaluate(()=>localStorage.getItem('ips-user')),null);
  });
  const studentRoutes=[
    ['/client/services','student-services'],
    ['/client/orders','student-orders'],
    ['/client/profile','student-profile'],
    ['/client/support','student-support'],
    ['/client/payments','student-stripe-refund-records']
  ];
  for(const [route,name] of studentRoutes)await check('Student workflow '+route,async()=>{
    await student.goto(base+route,{waitUntil:'domcontentloaded'});
    await student.locator('.client-layout').waitFor({timeout:15000});
    assert.equal(await student.locator('body').evaluate(el=>el.scrollWidth>window.innerWidth+4),false);
    await evidence(student,name);
  });
  const specialist=await open();
  await check('Real approved Specialist login opens only the Specialist workspace',async()=>{
    await specialist.goto(base+'/writer/login',{waitUntil:'domcontentloaded'});
    await specialist.locator('input[type=email]').fill('writer.ci@example.org');
    await specialist.locator('input[type=password]').fill(password);
    await specialist.getByRole('button',{name:/open my workspace/i}).click();
    await specialist.waitForURL(/\/writer/,{timeout:15000});
    await specialist.goto(base+'/writer/dashboard',{waitUntil:'domcontentloaded'});
    await specialist.locator('.writer-layout').waitFor({timeout:15000});
    const hero=specialist.locator('.dashboard-zone-writer-hero section');
    const gradient=await hero.evaluate(el=>getComputedStyle(el).backgroundImage);
    assert.ok(gradient.includes('rgb(16, 42, 67)'), 'Specialist hero must use readable deep-navy background: '+gradient);
    assert.ok(await specialist.getByText('Specialist Workspace').count()>=1);
    await specialist.getByRole('button',{name:'Completed',exact:true}).click();
    await specialist.getByText(paidRequest.title).first().waitFor({timeout:12000});
    assert.ok(await specialist.getByText(paidRequest.title).count()>=1,
      'The paid, reviewed and completed customer project must appear under the specialist Completed filter.');
    await specialist.waitForFunction(()=>{
      const cards=[...document.querySelectorAll('.dashboard-zone-writer-stats .card')];
      const first=cards.find(card=>card.textContent?.includes('All jobs'));
      const active=cards.find(card=>card.textContent?.includes('Active'));
      return Number(first?.querySelector('strong')?.textContent)>=1 &&
        Number(active?.querySelector('strong')?.textContent)===0;
    },null,{timeout:15000});
    assert.ok(await specialist.locator('.dashboard-zone-writer-stats .card').first().getByText('1').count()>=1,
      'Specialist totals must reflect the assigned paid work.');
    await evidence(specialist,'specialist-dashboard');
  });
  for(const [route,name] of [
    ['/writer/orders','specialist-orders'],
    ['/writer/services','specialist-assigned-services'],
    ['/writer/messages','specialist-messages'],
    ['/writer/actions','specialist-tasks'],
    ['/writer/profile','specialist-verified-profile'],
    ['/writer/earnings','specialist-real-payment-ledger']
  ])await check('Specialist workflow '+route,async()=>{
    await specialist.goto(base+route,{waitUntil:'domcontentloaded'});
    await specialist.locator('.writer-layout').waitFor({timeout:15000});
    assert.equal(await specialist.locator('body').evaluate(el=>el.scrollWidth>window.innerWidth+4),false);
    await evidence(specialist,name);
  });
  await check('Three-role finance ledgers reflect the same paid and refunded project',async()=>{
    await specialist.goto(base+'/writer/earnings',{waitUntil:'domcontentloaded'});
    await specialist.getByText('My Payment Records').waitFor({timeout:14000});
    await specialist.getByText('CI-BANK-TEST-TRANSFER-001').count(); // reference is not exposed in specialist browser
    await specialist.getByText(paidRequest.request_id).first().waitFor({timeout:14000});
    await student.goto(base+'/client/payments',{waitUntil:'domcontentloaded'});
    await student.getByText('My Payments & Refunds').first().waitFor({timeout:14000});
    await student.getByText(paidRequest.request_id).first().waitFor({timeout:14000});
    await evidence(student,'client-provider-verified-payments-refunds');
  });
  await check('Refunded customers never see a second payment request for the same quotation',async()=>{
    await student.goto(base+'/client/services/'+encodeURIComponent(paidRequest.request_id),{waitUntil:'domcontentloaded'});
    await student.getByText(/This quotation was fully refunded/).waitFor({timeout:15000});
    assert.equal(await student.getByRole('button',{name:/^Pay\s+[^m]/}).count(),0);
    await evidence(student,'fully-refunded-quote-no-repeat-charge');
  });
  await check('Student identity cannot open specialist or administrator workspaces',async()=>{
    await student.goto(base+'/writer/dashboard',{waitUntil:'domcontentloaded'});
    await student.waitForURL(/\/writer\/login/,{timeout:15000});
    await student.goto(base+'/admin/enquiries',{waitUntil:'domcontentloaded'});
    await student.waitForURL(/ips-mission-control/,{timeout:15000});
  });
  const admin=await open();
  await check('Administrator login and protected queue opens under actual authenticated session',async()=>{
    await admin.goto(base+'/ips-mission-control',{waitUntil:'domcontentloaded'});
    await admin.locator('input[type=email]').fill(process.env.ADMIN_EMAIL);
    await admin.locator('input[type=password]').fill(process.env.ADMIN_PASSWORD);
    await admin.getByRole('button',{name:'Sign In'}).click();
    await admin.waitForURL(/\/admin\//,{timeout:15000});
    await admin.goto(base+'/admin/enquiries',{waitUntil:'domcontentloaded'});
    const control=admin.locator('.ips-contact-admin');
    await control.waitFor({timeout:15000});
    const sidebar=admin.locator('.admin-sidebar');
    const tone=await sidebar.evaluate(el=>{
      const style=getComputedStyle(el);
      return {background:style.backgroundColor,text:getComputedStyle(el.querySelector('nav a')).color};
    });
    assert.equal(tone.background,'rgb(20, 43, 61)','All IPS portal sidebars must use the same professional navy');
    assert.equal(tone.text,'rgb(203, 216, 224)','Administration navigation links must retain readable contrast');
    assert.equal(await admin.getByText('Contact & callbacks').count(),0);
    await evidence(admin,'admin-private-quotation-queue');
  });
  await check('Premium IPS command center, case desk and keyboard-searchable administration are rendered in real Chrome',async()=>{
    await admin.goto(base+'/admin/dashboard',{waitUntil:'domcontentloaded'});
    await admin.locator('.ips-operations-console').waitFor({timeout:15000});
    assert.equal(await admin.locator('.ips-premium-admin').count(),1);
    assert.equal(await admin.getByRole('heading',{name:'Operations command desk'}).count(),1);
    assert.equal(await admin.locator('.ips-ops-stat').count(),4);
    await admin.locator('.ips-ops-case-row').first().waitFor({timeout:15000});
    await admin.locator('.ips-ops-case-row').first().click();
    await admin.locator('.ips-ops-case-brief').waitFor({timeout:15000});
    await admin.getByRole('tab',{name:/Follow-ups/}).click();
    await admin.locator('.ips-ops-action-editor').waitFor({timeout:15000});
    await admin.locator('.ips-ops-action-editor textarea').fill('Review this case in the centrally managed IPS operational workflow.');
    await admin.locator('.ips-ops-action-editor').getByRole('button',{name:'Add follow-up task'}).click();
    await admin.getByRole('status').filter({hasText:'Internal follow-up task recorded.'}).waitFor({timeout:15000});
    await admin.getByRole('button',{name:'Refresh live work'}).click();
    await admin.locator('.ips-ops-case-brief').waitFor({timeout:15000});
    await admin.getByRole('button',{name:'Switch administration to dark mode'}).click();
    await admin.locator('.ips-dark-admin').waitFor({timeout:10000});
    const dark=await admin.locator('.ips-premium-admin').evaluate(el=>getComputedStyle(el).backgroundColor);
    assert.equal(dark,'rgb(17, 30, 41)','Dark administration must be a genuine readable dark surface.');
    await evidence(admin,'ips-company-operations-dark');
    await admin.getByRole('button',{name:'Switch administration to light mode'}).click();
    const palette=await admin.locator('.ips-premium-admin').evaluate(el=>getComputedStyle(el).backgroundColor);
    assert.equal(palette,'rgb(247, 247, 243)','Light administration must restore its scoped surface.');
    await evidence(admin,'ips-company-operations-light');
    await admin.getByRole('button',{name:'Search administration sections'}).click();
    const dialog=admin.getByRole('dialog',{name:'Search IPS workspaces'});
    await dialog.getByRole('searchbox',{name:'Find workspace'}).fill('Academic projects');
    await dialog.getByRole('link',{name:/Academic projects/}).click();
    await admin.waitForURL(/\/admin\/services/,{timeout:15000});
    await admin.locator('.ips-projects-workspace').waitFor({timeout:15000});
    await evidence(admin,'ips-premium-academic-projects');
    await admin.goto(base+'/admin/enquiries',{waitUntil:'domcontentloaded'});
    await admin.locator('.ips-case-grid').waitFor({timeout:15000});
    await admin.locator('.ips-case-overview').waitFor({timeout:15000});
    await evidence(admin,'ips-premium-case-workspace');
  });
  await check('Root company screen protects owner, shows manager hierarchy and has no destructive Remove action',async()=>{
    await admin.goto(base+'/admin/access',{waitUntil:'domcontentloaded'});
    await admin.getByRole('heading',{name:'Company management'}).waitFor({timeout:15000});
    await admin.getByText('Protected company owner').waitFor({timeout:15000});
    await admin.getByRole('heading',{name:'Company staff directory'}).waitFor({timeout:15000});
    assert.equal(await admin.locator('.ips-company-people').getByRole('button',{name:/^Remove$/}).count(),0);
    assert.equal(await admin.locator('.ips-company-people').getByRole('button',{name:/^Delete$/}).count(),0);
    await admin.getByRole('heading',{name:'Invite department manager'}).waitFor({timeout:15000});
    await evidence(admin,'ips-root-company-manager-hierarchy');
  });
  await check('Root can initiate but cannot see the password in verified client recovery controls',async()=>{
    await admin.goto(base+'/admin/clients',{waitUntil:'domcontentloaded'});
    const row=admin.locator('tr').filter({hasText:'CID-TEST-ALICE'}).first();
    await row.waitFor({timeout:15000});
    await row.getByRole('button',{name:'Manage'}).click();
    const dialog=admin.getByRole('dialog',{name:'Manage private student account'});
    await dialog.getByText('Client password recovery').waitFor({timeout:15000});
    await dialog.getByRole('button',{name:'Start secure password recovery'}).click();
    await dialog.getByRole('button',{name:'Email private recovery link'}).waitFor({timeout:15000});
    assert.equal(await dialog.getByText('Send only to: alice.test@example.org').count(),1);
    assert.equal(await dialog.locator('input[type=password]').count(),0);
    await evidence(admin,'ips-client-private-account-recovery');
    await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  });
  const departmentManager=await open();
  await check('Department manager sees only their staff and cannot invite another manager',async()=>{
    await departmentManager.goto(base+'/ips-mission-control',{waitUntil:'domcontentloaded'});
    await departmentManager.locator('input[type=email]').fill('manager-client-ci@example.org');
    await departmentManager.locator('input[type=password]').fill('TestCompanyPassword2026!');
    await departmentManager.getByRole('button',{name:'Sign In'}).click();
    await departmentManager.waitForURL(/\/admin\//,{timeout:15000});
    await departmentManager.goto(base+'/admin/access',{waitUntil:'domcontentloaded'});
    await departmentManager.getByRole('heading',{name:'My department'}).waitFor({timeout:15000});
    await departmentManager.getByText('Client Care Officer B').waitFor({timeout:15000});
    assert.equal(await departmentManager.getByText('Academic Reviewer').count(),0);
    await departmentManager.getByRole('heading',{name:'Invite team member'}).waitFor({timeout:15000});
    assert.equal(await departmentManager.getByRole('heading',{name:'Invite department manager'}).count(),0);
    await evidence(departmentManager,'ips-manager-only-own-team');
  });
  for(const [route,name] of [
    ['/admin/clients','admin-private-accounts'],
    ['/admin/writers','admin-specialist-applications'],
    ['/admin/services','admin-service-assignments'],
    ['/admin/payments','admin-specialist-payout-reconciliation']
  ])await check('Administrator workflow '+route,async()=>{
    await admin.goto(base+route,{waitUntil:'domcontentloaded'});
    await admin.locator('.admin-layout').waitFor({timeout:15000});
    assert.equal(await admin.locator('body').evaluate(el=>el.scrollWidth>window.innerWidth+4),false);
    await evidence(admin,name);
  });
  await check('Student logout clears the cookie and denies re-entry to private workspaces',async()=>{
    await student.goto(base+'/client/overview',{waitUntil:'domcontentloaded'});
    await student.locator('.client-sidebar').getByRole('button',{name:'Logout'}).click();
    await student.waitForURL(base+'/',{timeout:15000});
    const response=await student.request.get(base+'/api/client/me');
    assert.equal(response.status(),401);
    await student.goto(base+'/client/overview',{waitUntil:'domcontentloaded'});
    await student.waitForURL(/\/login/,{timeout:15000});
  });
  await check('Verified Specialist sign-out closes the backend session, not only the screen',async()=>{
    await specialist.goto(base+'/writer/dashboard',{waitUntil:'domcontentloaded'});
    await specialist.locator('.writer-sidebar').getByRole('button',{name:'Logout'}).click();
    await specialist.waitForURL(/\/writer\/login/,{timeout:15000});
    assert.equal((await specialist.request.get(base+'/api/writer/me')).status(),401);
    await specialist.goto(base+'/writer/dashboard',{waitUntil:'domcontentloaded'});
    await specialist.waitForURL(/\/writer\/login/,{timeout:15000});
  });
  await check('Administrator sign-out invalidates backend authentication',async()=>{
    await admin.goto(base+'/admin/enquiries',{waitUntil:'domcontentloaded'});
    await admin.locator('.admin-sidebar').getByRole('button',{name:'Logout'}).click();
    await admin.waitForURL(url=>url.pathname===adminEntry,{timeout:15000});
    assert.equal((await admin.request.get(base+'/api/admin/me')).status(),401);
    await admin.goto(base+'/admin/enquiries',{waitUntil:'domcontentloaded'});
    await admin.waitForURL(url=>url.pathname===adminEntry,{timeout:15000});
  });
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});pages.push(mobile);
  await check('Mobile signup and quotation display private-first labels without overflow',async()=>{
    await mobile.goto(base+'/signup',{waitUntil:'domcontentloaded'});
    await mobile.getByLabel('Choose a username').waitFor({timeout:15000});
    assert.equal(await mobile.locator('input[autocomplete=name]').count(),0);
    assert.equal(await mobile.locator('body').evaluate(el=>el.scrollWidth>window.innerWidth+4),false);
    await evidence(mobile,'mobile-private-signup');
    await mobile.goto(base+'/#request-support',{waitUntil:'domcontentloaded'});
    await mobile.locator('.ipsa-request-form').waitFor({timeout:15000});
    await evidence(mobile,'mobile-private-quotation');
  });
}finally{
  for(const page of pages)await page.close().catch(()=>{});
  await browser.close();
}
console.log('WORKSPACE_BROWSER_CASES '+JSON.stringify({failures:failures.length,errors:failures}));
if(failures.length)process.exitCode=1;
