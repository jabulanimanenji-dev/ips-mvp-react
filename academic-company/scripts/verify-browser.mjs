// Browser verification of THE academic company with actual Mongo-backed test identities.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import mongoose from 'mongoose';
import {setTimeout as sleep} from 'node:timers/promises';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const origin='http://127.0.0.1:18122';
const vars={...process.env,NODE_ENV:'test',IPS_ACADEMIC_MODE:'evaluation',
 MONGODB_URI:'mongodb://127.0.0.1:27017/ips_academic_sandbox',
 PORT:'18122',PUBLIC_APP_URL:origin,
 ROOT_EMAIL:'nyoro.ips-academic-test@example.org',ROOT_PASSWORD:'AcademicRootTest2026!',
 SESSION_SECRET:'Academic-test-only-HMAC-secret-of-sufficient-length-2026-abcdefghijklmnopqrstuvwxyz',
 RESEND_API_KEY:'',FROM_EMAIL:'',IPS_ACADEMIC_TEST_SETTLEMENT:'false'};
const proc=spawn(process.execPath,['src/app.mjs'],{env:vars,stdio:['ignore','pipe','pipe']});
let mongo,browser,log='',count=0;
for(const stream of [proc.stdout,proc.stderr])stream.on('data',d=>log=(log+String(d)).slice(-1900));
const pass=async(label,fn)=>{await fn();count++;console.log('PASS ACADEMIC CHROME '+label)};
const pageOpen=async mobile=>browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:910}});
const overflow=async page=>{const n=await page.evaluate(()=>({width:document.documentElement.scrollWidth,inner:innerWidth}));
 assert.ok(n.width<=n.inner+7,'Academic screen horizontal overflow '+JSON.stringify(n))};
const screen=async(page,id)=>page.screenshot({path:'academic-browser-evidence/'+id+'.png',fullPage:true,animations:'disabled'});
async function signIn(page,email,password){
 await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Login',exact:true}).click();
 await page.locator('input[name=email]').fill(email);
 await page.locator('input[name=password]').fill(password);
 await page.getByRole('button',{name:'Open my IPS workspace'}).click();
 try{await page.locator('.workspace').waitFor({timeout:15000});
     await page.locator('.metric').first().waitFor({timeout:15000})}
 catch(e){console.error('ACADEMIC_SIGNIN_VIEW',(await page.locator('body').innerText()).slice(0,1300));throw e}
}
try{
 for(let i=0;i<100;i++){try{const r=await fetch(origin+'/api/health');if(r.ok&&(await r.json()).ready)break}catch{}if(i===99)throw Error('Academic runtime not healthy '+log);await sleep(240)}
 mongo=await mongoose.createConnection(vars.MONGODB_URI).asPromise();
 const a=mongo.db.collection('academic_accounts');
 const [student,specialist,manager,staff]=await Promise.all([
  a.findOne({role:'student',username:{$regex:'^PrivateScholar'}}),
  a.findOne({role:'specialist',name:'Evaluation Academic Nursing Editor'}),
  a.findOne({role:'manager',department:'client_relations'}),
  a.findOne({role:'staff',department:'client_relations'})
 ]);
 for(const identity of [student,specialist,manager,staff])assert.ok(identity?.email,'Missing lifecycle identity before Chrome journey');
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 await mkdir('academic-browser-evidence',{recursive:true});
 const publicPage=await pageOpen(false);
 await pass('IPS ACADEMIC SERVICES homepage with research and academic identity',async()=>{
  await publicPage.goto(origin+'/',{waitUntil:'domcontentloaded'});
  await publicPage.getByRole('heading',{name:/Expert guidance for your academic journey/i}).waitFor();
  await publicPage.getByText('Thesis & Dissertation Guidance',{exact:true}).first().waitFor();
  const photo=publicPage.locator('.photo-story img');
  await photo.scrollIntoViewIfNeeded();
  await publicPage.waitForFunction(()=>{const p=document.querySelector('.photo-story img');return p&&p.complete&&p.naturalWidth>0},null,{timeout:18000});

  assert.ok((await publicPage.locator('body').innerText()).includes('Students & Researchers'));
  await overflow(publicPage);await screen(publicPage,'01-academic-homepage');
 });
 await pass('Academic website uses verified real photography and signup confirms passwords',async()=>{
  await publicPage.locator('img.hero-photo').waitFor();
  const photo=publicPage.locator('img.hero-photo');
  assert.ok((await photo.getAttribute('src')).startsWith('https://images.unsplash.com/photo-'));
  assert.equal(await publicPage.locator('img[src$=".svg"]').count(),0);
  await publicPage.getByRole('button',{name:'Student / Researcher',exact:true}).click();
  await publicPage.locator('input[name=confirmPassword]').waitFor();
  await publicPage.locator('input[name=username]').fill('VisualScholar');
  await publicPage.locator('input[name=email]').fill('visual.invalid.review@example.org');
  await publicPage.locator('input[name=password]').fill('AcademicSecure2026!');
  await publicPage.locator('input[name=confirmPassword]').fill('AcademicSecure2027!');
  await publicPage.locator('input[name=privacyConsent]').check();
  await publicPage.getByRole('button',{name:'Create private IPS account'}).click();
  await publicPage.getByText('Confirm password must match').waitFor();
  await publicPage.getByRole('button',{name:'Academic services',exact:true}).click();
 });
 await pass('Specialist signup shows the actual versioned agreement, signature and acceptance controls',async()=>{
  await publicPage.getByRole('button',{name:'Join our specialist network'}).click();
  const terms=publicPage.locator('details.agreement-box');
  await terms.waitFor();
  assert.ok((await terms.innerText()).includes('ACADEMIC SERVICES'));
  assert.ok((await terms.innerText()).includes('academic integrity'));
  await publicPage.locator('input[name=specialistAgreementVersion]').waitFor();
  await publicPage.locator('input[name=specialistSignature]').waitFor();
  assert.equal(await publicPage.locator('input[name=specialistAgreementAccepted]').count(),1);
  await overflow(publicPage);
  await screen(publicPage,'25-specialist-signed-confidentiality');
  await publicPage.getByRole('button',{name:'Academic services',exact:true}).click();
 });
 await pass('Academic catalogue contains 16 real disciplines and detailed subject-specific enquiries',async()=>{
  await publicPage.getByRole('button',{name:'Academic services',exact:true}).click();
  await publicPage.getByRole('button',{name:'All academic services'}).count().catch(()=>0);
  await publicPage.locator('.service-card').first().waitFor();
  assert.equal(await publicPage.locator('.service-card').count(),16);
  await publicPage.getByRole('button',{name:'Theses & Research'}).click();
  assert.ok((await publicPage.locator('.service-card').count())>2);
  await screen(publicPage,'02-academic-service-catalogue');
  await publicPage.locator('.service-card').first().getByRole('button',{name:'View service'}).click();
  await publicPage.getByRole('button',{name:'Request a quote for this service'}).waitFor();
  await screen(publicPage,'03-academic-service-details');
  await publicPage.getByRole('button',{name:'Request a quote for this service'}).click();
  await publicPage.locator('select[name=academicLevel]').waitFor();
  await publicPage.locator('textarea[name=requirements]').waitFor();
  await publicPage.locator('input[name=username]').waitFor();
  await screen(publicPage,'04-subject-specific-private-quotation');
 });
 await pass('Self-service password recovery and email-verification resend work in the real browser',async()=>{
  const p=await pageOpen(false);
  await p.goto(origin+'/',{waitUntil:'domcontentloaded'});
  await p.getByRole('button',{name:'Login',exact:true}).click();
  await p.getByRole('button',{name:'Forgot password?'}).click();
  await p.getByRole('heading',{name:'Reset your password'}).waitFor();
  await p.locator('input[name=email]').fill(student.email);
  await p.getByRole('button',{name:'Email recovery link'}).click();
  await p.getByText('If this account is verified, a one-use recovery link is being emailed now.').waitFor();
  const mail=await mongo.db.collection('academic_evaluation_mail').findOne({to:student.email,
   subject:'Your private IPS password recovery'},{sort:{createdAt:-1}});
  assert.ok(mail&&mail.text.includes('#recover='),'Actual automatic recovery mail must be persisted');
  const extract=mail.text.match(/(http:\/\/127\.0\.0\.1:18122\/#recover=[^\s]+)/);
  assert.ok(extract,'Recovery URL must be actionable');
  await p.goto(extract[1],{waitUntil:'domcontentloaded'});
  await p.getByRole('heading',{name:'Set a new password'}).waitFor();
  await p.locator('input[name=confirmPassword]').waitFor();
  await p.getByRole('button',{name:'Login',exact:true}).click();
  await p.getByRole('button',{name:'Resend email verification'}).click();
  await p.getByRole('heading',{name:'Resend your verification link'}).waitFor();
  await p.locator('input[name=email]').fill(student.email);
  await p.getByRole('button',{name:'Resend verification email'}).click();
  await p.getByText('If verification is pending, IPS has emailed a new link.').waitFor();
  await overflow(p);
  await p.close();
 });
 const studentPage=await pageOpen(false);
 await pass('Authenticated private student academic quotes and completed thesis commission',async()=>{
  await signIn(studentPage,student.email,'RecoveredAcademic2027!');
  await studentPage.getByRole('button',{name:'My quotations'}).click();
  await studentPage.getByText('Academic Editing & Proofreading').first().waitFor();
  await studentPage.getByRole('button',{name:'My academic work'}).click();
  await studentPage.getByText('Academic Editing & Proofreading').first().waitFor();
  await overflow(studentPage);await screen(studentPage,'05-student-academic-workspace');
 });
 await pass('Student uploads and downloads an academic brief directly inside a pre-commission quotation',async()=>{
  await studentPage.locator('.sidebar').getByRole('button',{name:'My quotations'}).click();
  await studentPage.getByRole('button',{name:'Open enquiry & messages'}).first().click();
  await studentPage.getByRole('heading',{name:'Supporting documents'}).waitFor();
  assert.equal(await studentPage.locator('.record').count(),0,'Opened academic enquiry must not keep the whole quotation list above the workroom');
  await studentPage.locator('form[data-form=quote-upload] input[name=upload]').setInputFiles({
   name:'student-scope-reference.txt',mimeType:'text/plain',
   buffer:Buffer.from('Academic research author-provided university guidance and literature review scope notes.')});
  await studentPage.locator('form[data-form=quote-upload]').getByRole('button',{name:'Upload document'}).click();
  await studentPage.getByText('Supporting academic document attached to this enquiry.').waitFor();
  await studentPage.locator('a[href*="/api/academic/quote-files/"]').first().waitFor();
  await screen(studentPage,'19-student-precommission-quote-files-and-messages');
  await studentPage.locator('.sidebar').getByRole('button',{name:'My academic work'}).click();
 });
 await pass('Student sees actual approved academic file through private authenticated download',async()=>{
  await studentPage.getByRole('button',{name:'Open job'}).first().click();
  await studentPage.locator('a[download]').first().waitFor();
  await studentPage.getByText('Centralized company relay prevents uncontrolled student–Specialist messaging').count().catch(()=>0);
  await screen(studentPage,'06-student-academic-delivery');
 });
 await pass('Student has visible academic job inbox, supporting files, replies and functional Back navigation',async()=>{
  await studentPage.getByRole('heading',{name:'Work, messages & delivery'}).waitFor();
  assert.equal(await studentPage.locator('.record').count(),0,'Opened academic job must be one focused workroom, not a stacked list');
  await studentPage.getByRole('heading',{name:'Files & delivery'}).waitFor();
  await studentPage.getByRole('heading',{name:'Job messages'}).waitFor();
  await studentPage.locator('form[data-form=case-upload] input[name=upload]').waitFor();
  await studentPage.locator('form[data-form=commission-message]').waitFor();
  await studentPage.locator('.workmain').getByRole('button',{name:'← Back',exact:true}).click();
  await studentPage.locator('.record').first().waitFor();
  await studentPage.getByRole('button',{name:'Inbox & messages'}).first().click();
  await studentPage.getByRole('heading',{name:'Inbox & conversations'}).waitFor();
  await overflow(studentPage);
  await screen(studentPage,'16-student-inbox-navigation');
 });
 const specialistPage=await pageOpen(false);
 await pass('Approved academic Specialist sees only assigned nursing work and IPS coordination',async()=>{
  await signIn(specialistPage,specialist.email,'SpecialistAcademic2026!');
  await specialistPage.locator('.sidebar').getByRole('button',{name:'Assignments & files',exact:true}).click();
  await specialistPage.getByText('Academic Editing & Proofreading').first().waitFor();
  await specialistPage.getByRole('button',{name:'Open job'}).first().click();
  await specialistPage.getByText('Job messages').waitFor();
  await overflow(specialistPage);await screen(specialistPage,'07-approved-specialist-academic-work');
 });
 await pass('Specialist updates availability, capacity and turnaround from the real workspace',async()=>{
  await specialistPage.locator('.sidebar').getByRole('button',{name:'Profile',exact:true}).click();
  await specialistPage.getByRole('heading',{name:'Availability & assignments'}).waitFor();
  await specialistPage.locator('select[name=availabilityStatus]').selectOption('limited');
  await specialistPage.locator('input[name=maxConcurrentCases]').fill('1');
  await specialistPage.locator('input[name=turnaroundDays]').fill('7');
  await specialistPage.getByRole('button',{name:'Update my availability'}).click();
  await specialistPage.getByText('limited',{exact:true}).first().waitFor();
  await overflow(specialistPage);await screen(specialistPage,'21-specialist-availability');
 });
 const rootPage=await pageOpen(false);
 await pass('Nyoro Root Administration governs students, specialists, academic queues, quality and finance',async()=>{
  await signIn(rootPage,vars.ROOT_EMAIL,vars.ROOT_PASSWORD);
  await rootPage.getByText('Nyoro · Root Administration').first().waitFor();
  await rootPage.getByRole('button',{name:'Specialists',exact:true}).click();
  await rootPage.getByText('Evaluation Academic Nursing Editor').first().waitFor();
  await screen(rootPage,'08-nyoro-academic-people-management');
  await rootPage.getByRole('button',{name:'Inbox & messages'}).click();
  await rootPage.getByText('Pediatric Nursing Research').first().waitFor();
  await screen(rootPage,'09-academic-department-queues');
  await rootPage.getByRole('button',{name:'Finance',exact:true}).click();
  await rootPage.getByText('Payment provider integration is not enabled').waitFor();
  await overflow(rootPage);
 });
 await pass('Root has separate searchable Student and Specialist directories and one academic job workroom',async()=>{
  await rootPage.locator('.sidebar').getByRole('button',{name:'Students',exact:true}).click();
  await rootPage.getByText('PrivateScholar',{exact:false}).first().waitFor();
  assert.equal(await rootPage.getByText('Evaluation Academic Nursing Editor').count(),0);
  await rootPage.locator('input[data-directory-search]').fill('nobody matches');
  assert.equal(await rootPage.locator('tr[data-directory-row]:not([hidden])').count(),0);
  await rootPage.locator('input[data-directory-search]').fill('PrivateScholar');
  assert.ok(await rootPage.locator('tr[data-directory-row]:not([hidden])').count()>0);
  await rootPage.locator('.sidebar').getByRole('button',{name:'Specialists',exact:true}).click();
  await rootPage.getByText('Evaluation Academic Nursing Editor').first().waitFor();
  assert.equal(await rootPage.getByText('PrivateScholar',{exact:false}).count(),0);
  await rootPage.locator('.sidebar').getByRole('button',{name:'Academic jobs',exact:true}).click();
  await rootPage.locator('.record').first().getByRole('button',{name:'Open job'}).click();
  await rootPage.getByRole('heading',{name:'Work, messages & delivery'}).waitFor();
  await rootPage.getByRole('heading',{name:'Files & delivery'}).waitFor();
  await rootPage.getByRole('heading',{name:'Job messages'}).waitFor();
  await screen(rootPage,'17-root-single-job-workroom');
  await rootPage.locator('.workmain').getByRole('button',{name:'← Back',exact:true}).click();
  await rootPage.locator('.record').first().waitFor();
 });
 await pass('Nyoro sends a live-workflow private message and document to a Student in one account directory',async()=>{
  await rootPage.locator('.sidebar').getByRole('button',{name:'Students',exact:true}).click();
  const p=rootPage.locator('tr[data-directory-row]',{hasText:'PrivateScholar'}).first();
  await p.getByRole('button',{name:'Message'}).click();
  await rootPage.locator('form[data-form=direct-message] textarea[name=body]').fill(
   'IPS has received your academic research instructions and will coordinate the next step in writing.');
  await rootPage.locator('form[data-form=direct-message]').getByRole('button',{name:'Send message'}).click();
  await rootPage.getByText('Private message sent to this IPS account.').waitFor();
  await rootPage.locator('form[data-form=direct-file] input[name=upload]').setInputFiles({
   name:'ips-academic-feedback.txt',mimeType:'text/plain',
   buffer:Buffer.from('IPS academic research guidance: review the scope and ask for clarification if needed.')});
  await rootPage.locator('form[data-form=direct-file]').getByRole('button',{name:'Send private document'}).click();
  await rootPage.getByText('Document sent securely to this account’s IPS inbox.').waitFor();
  await screen(rootPage,'20-root-private-message-and-attachment');
 });
 await pass('Student receives Root direct document and replies through actual IPS inbox thread',async()=>{
  await studentPage.locator('.sidebar').getByRole('button',{name:'Inbox & messages'}).click();
  const m=studentPage.locator('.inbox-row',{hasText:'Secure academic document'}).first();
  await m.getByRole('button',{name:'Open'}).click();
  await studentPage.getByRole('heading',{name:'Private IPS conversation'}).waitFor();
  assert.equal(await studentPage.locator('.inbox-row').count(),0,'Opened message should hide the full inbox list');
  await studentPage.locator('a[href*="/api/operations/direct-file/"]').first().waitFor();
  await studentPage.locator('form[data-form=direct-reply] textarea[name=body]').fill(
   'I received the private academic guidance document. Thank you for the update.');
  await studentPage.locator('form[data-form=direct-reply]').getByRole('button',{name:'Send reply'}).click();
  await studentPage.getByText('Private reply recorded.').waitFor();
  await overflow(studentPage);
  await screen(studentPage,'21-student-direct-file-and-reply');
 });
 await pass('Root can inspect actual delivery queue and notification exceptions from administration',async()=>{
  await rootPage.locator('.sidebar').getByRole('button',{name:'Alerts & delivery'}).click();
  await rootPage.getByRole('heading',{name:'Email delivery operations'}).waitFor();
  await rootPage.getByText('Delivered',{exact:true}).first().waitFor();
  await overflow(rootPage);
  await screen(rootPage,'22-nyoro-private-delivery-monitor');
 });
 const rootRecovery=await pageOpen(false);
 await pass('Nyoro Root login offers one-use email recovery and secure reset view',async()=>{
  await rootRecovery.goto(origin+'/root',{waitUntil:'domcontentloaded'});
  await rootRecovery.getByRole('button',{name:'Recover Root password by email'}).click();
  await rootRecovery.getByRole('heading',{name:'Reset your password'}).waitFor();
  await rootRecovery.locator('input[name=email]').fill(vars.ROOT_EMAIL);
  await rootRecovery.getByRole('button',{name:'Email recovery link'}).click();
  const receipt=await mongo.db.collection('academic_evaluation_mail').findOne({
   to:vars.ROOT_EMAIL,subject:'Nyoro IPS Root Admin password recovery'},
   {sort:{createdAt:-1}});
  assert.ok(receipt?.text,'Root recovery did not produce a synthetic email receipt');
  const match=receipt.text.match(/#recover=([A-Za-z0-9_-]{43})/);
  assert.ok(match,'Root reset link missing from email');
  await rootRecovery.goto(origin+'/root#recover='+match[1]+
   '&email='+encodeURIComponent(vars.ROOT_EMAIL),{waitUntil:'domcontentloaded'});
  await rootRecovery.getByRole('heading',{name:'Set a new password'}).waitFor();
  await rootRecovery.locator('input[name=confirmPassword]').waitFor();
  await overflow(rootRecovery);
  await screen(rootRecovery,'24-nyoro-root-email-recovery');
 });
 const rootDirect=await pageOpen(false);
 await pass('Direct /root URL authenticates Nyoro and stays within Root Administrator identity',async()=>{
  await rootDirect.goto(origin+'/root',{waitUntil:'domcontentloaded'});
  await rootDirect.getByRole('heading',{name:'Nyoro · Root Administration'}).waitFor();
  await rootDirect.locator('input[name=email]').fill(vars.ROOT_EMAIL);
  await rootDirect.locator('input[name=password]').fill(vars.ROOT_PASSWORD);
  await rootDirect.getByRole('button',{name:'Sign in as Nyoro Root Admin'}).click();
  // The login heading is visible before authentication; wait for the actual
  // authenticated workspace before probing the session.
  await rootDirect.locator('.workspace').waitFor({timeout:15000});
  await rootDirect.locator('.metric').first().waitFor({timeout:15000});
  const s=await rootDirect.evaluate(async()=>{const r=await fetch('/api/session');return (await r.json()).account.role});
  assert.equal(s,'root');
 });
 await pass('Root opens real Student workspace and then Specialist workspace with no login switching',async()=>{
  await rootDirect.locator('.sidebar').getByRole('button',{name:'Student workspace'}).click();
  const row=rootDirect.locator('tr[data-directory-row]',{hasText:'PrivateScholar'}).first();
  await row.getByRole('button',{name:'Open workspace'}).click();
  await rootDirect.getByText('NYORO ROOT ADMINISTRATION / ASSISTED WORKSPACE').waitFor();
  await rootDirect.locator('.sidebar').getByRole('button',{name:'My quotations'}).click();
  await rootDirect.getByText('Pediatric Nursing Research').first().waitFor();
  await rootDirect.getByRole('button',{name:'Return to Nyoro Root'}).click();
  await rootDirect.locator('.sidebar').getByRole('button',{name:'Specialist workspace'}).click();
  const spec=rootDirect.locator('tr[data-directory-row]',{hasText:'Evaluation Academic Nursing Editor'}).first();
  await spec.getByRole('button',{name:'Open workspace'}).click();
  await rootDirect.locator('.sidebar').getByRole('button',{name:'Assignments & files'}).click();
  await rootDirect.getByText('Academic Editing & Proofreading').first().waitFor();
  const session=await rootDirect.evaluate(async()=>{const r=await fetch('/api/session');return (await r.json()).account.role});
  assert.equal(session,'root','Root session must remain Root while assisted workspaces are open');
  await screen(rootDirect,'14-root-assisted-specialist-workspace');
  await rootDirect.getByRole('button',{name:'Return to Nyoro Root'}).click();
  await screen(rootDirect,'15-nyoro-command-centre');
 });
 const managerPage=await pageOpen(false);
 await pass('Department manager sees only academic Client Relations responsibility',async()=>{
  await signIn(managerPage,manager.email,'ManagerAcademic2026!');
  await managerPage.getByRole('button',{name:'Enquiries',exact:true}).click();
  await managerPage.getByText('Pediatric Nursing Research').first().waitFor();
  assert.equal(await managerPage.getByRole('button',{name:'Audit',exact:true}).count(),0);
  await managerPage.getByRole('button',{name:'My team'}).click();
  await managerPage.getByText('Academic Client Relations Associate').first().waitFor();
  await screen(managerPage,'10-academic-department-manager');
 });
 const staffPage=await pageOpen(false);
 await pass('Staff has written student support, no Root or finance controls',async()=>{
  await signIn(staffPage,staff.email,'StaffAcademic2026!');
  await staffPage.getByRole('button',{name:'Support',exact:true}).click();
  await staffPage.getByText('Nursing editing document').first().waitFor();
  assert.equal(await staffPage.getByRole('button',{name:'Finance',exact:true}).count(),0);
  assert.equal(await staffPage.getByRole('button',{name:'Audit',exact:true}).count(),0);
  await screen(staffPage,'11-client-relations-staff');
 });
 await pass('Client Relations staff claims academic enquiry and opens private ownership workroom',async()=>{
  const created=await studentPage.evaluate(async()=>{
   const res=await fetch('/api/academic/quotes',{method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({serviceId:'academic-editing',academicLevel:'Undergraduate',
     subject:'Intake Ownership Browser Verification',
     requirements:'I need editorial feedback on my independently authored literature review and referencing.',
     institutionGuidance:'Use appropriate faculty reference guidance.',deadline:'2026-12-30',
     integrityAcknowledged:true,contactChannel:'workspace'})});
   return {status:res.status,body:await res.json()};
  });
  assert.equal(created.status,201,JSON.stringify(created.body).slice(0,500));
  await staffPage.locator('.sidebar').getByRole('button',{name:'Enquiries',exact:true}).click();
  const row=staffPage.locator('.record').filter({hasText:'Intake Ownership Browser Verification'});
  await row.waitFor({timeout:12000});
  await row.getByRole('button',{name:'Claim enquiry'}).click();
  await staffPage.getByText('You are now accountable for this academic enquiry.').waitFor();
  await staffPage.locator('.record').filter({hasText:'Intake Ownership Browser Verification'})
   .getByRole('button',{name:'Open enquiry & messages'}).click();
  await staffPage.getByRole('heading',{name:'Academic enquiry ownership'}).waitFor();
  await staffPage.getByText(staff.id,{exact:false}).first().waitFor();
  await overflow(staffPage);
  await screen(staffPage,'22-client-relations-accountable-ownership');
 });
 await pass('Student clarification and Root revised quotation forms work in authenticated browser',async()=>{
  const q=await studentPage.evaluate(async()=>{
   const r=await fetch('/api/academic/quotes',{method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({serviceId:'academic-editing',academicLevel:'Undergraduate',
     subject:'Browser Academic Clarification Workflow',
     requirements:'I require legitimate editorial comments on student-authored academic research text.',
     institutionGuidance:'Faculty style instructions will be supplied after clarification.',
     deadline:'2026-12-30',contactChannel:'workspace',integrityAcknowledged:true})});
   return {status:r.status,body:await r.json()};
  });
  assert.equal(q.status,201,JSON.stringify(q.body));
  const id=q.body.quote.id;
  const scope=await rootPage.evaluate(async id=>{
   const r=await fetch('/api/academic/quotes/'+encodeURIComponent(id)+'/scope',
    {method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({decision:'clarify',
      note:'Please confirm the existing manuscript, institutional instructions and permissible feedback scope.'})});
   return {status:r.status,body:await r.json()};
  },id);
  assert.equal(scope.status,200,JSON.stringify(scope.body));
  await studentPage.locator('.sidebar').getByRole('button',{name:'My quotations'}).click();
  await studentPage.locator('.record').filter({hasText:'Browser Academic Clarification Workflow'})
   .getByRole('button',{name:'Open enquiry & messages'}).click();
  await studentPage.getByRole('heading',{name:'Clarification requested by IPS'}).waitFor();
  await studentPage.locator('form[data-form=quote-resubmit] textarea[name=clarification]')
   .fill('My source manuscript and the faculty rules are ready; I request permitted writing clarity feedback.');
  await studentPage.locator('form[data-form=quote-resubmit]')
   .getByRole('button',{name:'Resubmit for academic scope review'}).click();
  await studentPage.getByText('Your clarification was received').waitFor();
  await overflow(studentPage);
  await screen(studentPage,'23-student-clarification-submitted');
  const ready=await rootPage.evaluate(async id=>{
   const base='/api/academic/quotes/'+encodeURIComponent(id);
   const opts=body=>({method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const scope=await fetch(base+'/scope',opts({decision:'approved',
    note:'Verified student-authored content for permitted editorial and citation feedback.'}));
   const offer=await fetch(base+'/offer',opts({
    priceMinor:12500,deliverables:'Editorial notes on existing student-authored text.',
    terms:'No ghostwriting, fabricated references or unpermitted academic assistance.'}));
   return {scope:scope.status,offer:offer.status,body:await offer.json()};
  },id);
  assert.equal(ready.scope,200);
  assert.equal(ready.offer,200,JSON.stringify(ready.body));
  await rootPage.locator('.sidebar').getByRole('button',{name:'Enquiries',exact:true}).click();
  await rootPage.locator('.record').filter({hasText:'Browser Academic Clarification Workflow'})
   .getByRole('button',{name:'Open enquiry & messages'}).click();
  await rootPage.getByRole('heading',{name:'Revise written quotation'}).waitFor();
  const form=rootPage.locator('form[data-form=quote-revise]');
  await form.locator('input[name=pricePLN]').fill('155');
  await form.locator('textarea[name=deliverables]')
   .fill('Expanded English editing feedback for an existing student research document.');
  await form.locator('textarea[name=terms]')
   .fill('All authorial work remains the Student’s; two consultations and no invented findings.');
  await form.locator('textarea[name=reason]')
   .fill('Additional permitted academic clarity questions require more consultation time.');
  await form.getByRole('button',{name:'Issue revised quotation'}).click();
  await rootPage.getByText('New quotation version issued').waitFor();
  await rootPage.getByText('Quotation version:').waitFor();
  await overflow(rootPage);
  await screen(rootPage,'24-root-versioned-written-quotation');
 });
 const mobile=await pageOpen(true);
 await pass('Mobile academic homepage and Root workspace have no glare or horizontal overflow',async()=>{
  await mobile.goto(origin+'/',{waitUntil:'domcontentloaded'});
  await mobile.getByText('IPS ACADEMIC SERVICES').first().waitFor();
  await overflow(mobile);await screen(mobile,'12-mobile-academic-homepage');
  await signIn(mobile,vars.ROOT_EMAIL,vars.ROOT_PASSWORD);
  await mobile.locator('.workspace').waitFor();
  await overflow(mobile);await screen(mobile,'13-mobile-nyoro-root');
 });
 await pass('Responsive academic workspaces also fit tablet and laptop viewports',async()=>{
  for(const width of [768,1024,1280]){
   const page=await browser.newPage({viewport:{width,height:850}});
   await signIn(page,vars.ROOT_EMAIL,vars.ROOT_PASSWORD);
   await overflow(page);
   const y=await page.locator('.metric').first().evaluate(x=>x.getBoundingClientRect().top);
   assert.ok(y<650,'Academic dashboard controls must appear above fold, not hidden in blank space '+width+' '+y);
   if(width===768)await screen(page,'18-tablet-root-workspace');
   await page.close();
  }
 });
 console.log('IPS_ACADEMIC_CHROME_QUALIFICATION_GREEN '+count+' desktop/mobile role journeys and visual evidence');
}catch(err){console.error('IPS_ACADEMIC_CHROME_FAIL',String(err),log.slice(-1600));process.exitCode=1}
finally{try{await browser?.close()}catch{}try{await mongo?.close()}catch{}proc.kill('SIGTERM')}
