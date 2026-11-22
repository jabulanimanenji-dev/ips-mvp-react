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
 await pass('Public written support and verified data-rights contact are reachable without registration',async()=>{
  await publicPage.locator('.topnav').getByRole('button',{name:'Contact IPS'}).click();
  await publicPage.getByRole('heading',{name:'Tell IPS what you need.'}).waitFor();
  assert.equal(await publicPage.locator('form[data-form=public-contact]').count(),1);
  await publicPage.locator('select[name=category]').selectOption('privacy_request');
  await publicPage.locator('input[name=email]').fill('privacy-browser-evaluation@example.org');
  await publicPage.locator('input[name=subject]').fill('Request review of my IPS data');
  await publicPage.locator('textarea[name=message]').fill(
   'Please explain how to obtain my records and correct any inaccurate information.');
  await publicPage.locator('input[name=privacyConsent]').check();
  await publicPage.getByRole('button',{name:'Send private request'}).click();
  await publicPage.getByText('IPS sent a one-use email verification link',{exact:false}).waitFor();
  const mail=await mongo.db.collection('academic_evaluation_mail').findOne({
   to:'privacy-browser-evaluation@example.org',
   subject:'Confirm your written IPS Academic Services request'});
  assert.ok(mail?.text.includes('#contactverify='));
  await publicPage.locator('.topnav').getByRole('button',{name:'Privacy'}).click();
  await publicPage.getByRole('heading',{name:'Discreet academic support with accountable data handling.'}).waitFor();
  await overflow(publicPage);
  await screen(publicPage,'35-public-data-rights-policy');
  await publicPage.locator('a.mark[data-nav=home]').click();
  await publicPage.locator('img.hero-photo').waitFor();
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
  await publicPage.locator('input[name=specialistAgreementVersion]').waitFor({state:'attached'});
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
 await pass('Student browser shows genuine accepted quote billing without invented invoices or receipts',async()=>{
  await studentPage.locator('.sidebar').getByRole('button',{name:'Billing'}).click();
  await studentPage.getByRole('heading',{name:'Your academic billing'}).waitFor();
  await studentPage.getByText('Payment gateway not enabled').first().waitFor();
  await studentPage.getByRole('heading',{name:'Written billing concerns'}).waitFor();
  await overflow(studentPage);
  await screen(studentPage,'29-student-private-billing-no-receipts');
 });
 await pass('Student uploads and downloads an academic brief directly inside a pre-commission quotation',async()=>{
  await studentPage.locator('.sidebar').getByRole('button',{name:'My quotations'}).click();
  await studentPage.getByRole('button',{name:'Open enquiry'}).first().click();
  await studentPage.getByRole('heading',{name:'Supporting documents'}).waitFor();
  assert.equal(await studentPage.locator('.record').count(),0,'Opened academic enquiry must not keep the whole quotation list above the workroom');
  await studentPage.locator('form[data-form=quote-upload] input[name=upload]').setInputFiles({
   name:'student-scope-reference.txt',mimeType:'text/plain',
   buffer:Buffer.from('Academic research author-provided university guidance and literature review scope notes.')});
  await studentPage.locator('form[data-form=quote-upload]').getByRole('button',{name:'Upload document'}).click();
  await studentPage.getByText('Supporting academic document attached to this enquiry.').waitFor();
  await studentPage.locator('a[href*="/api/academic/quote-files/"]').first().waitFor();
  await studentPage.locator('form[data-form=quote-upload] input[name=upload]').setInputFiles({
   name:'student-large-thesis-reference.txt',mimeType:'text/plain',
   buffer:Buffer.alloc(6*1024*1024,65)});
  await studentPage.locator('form[data-form=quote-upload]').getByRole('button',{name:'Upload document'}).click();
  await studentPage.getByText('Your large academic document is securely attached to this enquiry.')
   .waitFor({timeout:20000});
  const large=await mongo.db.collection('academic_quote_files').findOne({
   filename:'student-large-thesis-reference.txt',blobId:{$exists:true}});
  assert.ok(large?.blobId);
  assert.equal(large.byteLength,6*1024*1024);

  await screen(studentPage,'19-student-precommission-quote-files-and-messages');
  await studentPage.locator('.sidebar').getByRole('button',{name:'My academic work'}).click();
 });
 await pass('Student sees actual approved academic file through private authenticated download',async()=>{
  await studentPage.getByRole('button',{name:'Open job'}).first().click();
  await studentPage.locator('a[download]').first().waitFor();
  const caseForm=studentPage.locator('form[data-form=case-upload]');
  await caseForm.locator('input[name=upload]').setInputFiles({
   name:'student-large-project-reference.txt',mimeType:'text/plain',
   buffer:Buffer.alloc(6*1024*1024,66)});
  await caseForm.getByRole('button',{name:'Upload document'}).click();
  await studentPage.getByText('Your large academic reference is securely attached to this workroom.')
   .waitFor({timeout:20000});
  const reference=await mongo.db.collection('academic_private_files').findOne({
   filename:'student-large-project-reference.txt',blobId:{$exists:true}});
  assert.ok(reference?.blobId);
  assert.equal(reference.byteLength,6*1024*1024);

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
 await pass('Student sees honest Telegram availability without an unverified bot destination',async()=>{
  await studentPage.locator('.sidebar').getByRole('button',{name:'Profile',exact:true}).click();
  await studentPage.getByRole('heading',{name:'Private Telegram updates'}).waitFor();
  await studentPage.getByText('Telegram connection is not yet enabled.').waitFor();
  assert.equal(await studentPage.locator('select[name=contactPreference] option[value=telegram]').count(),0);
  await overflow(studentPage);
  await screen(studentPage,'27-student-honest-telegram-contact');
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
 await pass('Specialist browser shows governed work records without invented payouts',async()=>{
  await specialistPage.locator('.sidebar').getByRole('button',{name:'Work records'}).click();
  await specialistPage.getByRole('heading',{name:'Specialist work records'}).waitFor();
  await specialistPage.getByText('No payout is available',{exact:false}).first().waitFor();
  await overflow(specialistPage);
  await screen(specialistPage,'30-specialist-work-records');
 });
 await pass('Real Specialist browser submits a 6 MB document through GridFS',async()=>{
  const now=new Date(),id='IPS-A-CHROME-BINARY-'+Date.now().toString(36).toUpperCase();
  await mongo.db.collection('academic_commissions').insertOne({
   id,quoteId:'IPS-Q-CHROME-BINARY-'+Date.now().toString(36).toUpperCase(),
   studentId:student.id,specialistId:specialist.id,
   subject:'Synthetic Large Document Upload',serviceId:'academic-editing',
   serviceName:'Academic Editing & Proofreading',
   academicLevel:'Undergraduate',status:'specialist_assigned',
   requirements:'Fictional permitted editing feedback for browser evaluation.',
   paymentStatus:'synthetic_test_only',evaluationPayment:true,
   revisionCount:0,createdAt:now,updatedAt:now,synthetic:true
  });
  await specialistPage.locator('.sidebar').getByRole('button',{name:'Assignments & files'}).click();
  await specialistPage.locator('.record').filter({hasText:'Synthetic Large Document Upload'})
   .getByRole('button',{name:'Open job'}).click();
  const form=specialistPage.locator('form[data-form=case-upload]');
  await form.locator('select[name=purpose]').selectOption('deliverable');
  await form.locator('input[name=upload]').setInputFiles({
   name:'large-academic-feedback.txt',mimeType:'text/plain',
   buffer:Buffer.alloc(6*1024*1024,65)});
  await form.getByRole('button',{name:'Upload document'}).click();
  await specialistPage.getByText('Document securely submitted for independent IPS quality review.')
   .waitFor({timeout:20000});
  const stored=await mongo.db.collection('academic_private_files').findOne({
   filename:'large-academic-feedback.txt',blobId:{$exists:true}});
  assert.ok(stored?.blobId);
  assert.equal(stored.byteLength,6*1024*1024);
  await overflow(specialistPage);
  await screen(specialistPage,'26-specialist-private-large-document');
 });
 const rootPage=await pageOpen(false);
 await pass('Nyoro Root Administration governs students, specialists, academic queues, quality and finance',async()=>{
  await signIn(rootPage,vars.ROOT_EMAIL,vars.ROOT_PASSWORD);
  await rootPage.getByText('Nyoro · Root Administration').first().waitFor();
  await rootPage.getByRole('button',{name:'Specialists',exact:true}).click();
  await rootPage.getByText('Evaluation Academic Nursing Editor').first().waitFor();
  await rootPage.getByText('Agreement signed').first().waitFor();
  await screen(rootPage,'08-nyoro-academic-people-management');
  await rootPage.getByRole('button',{name:'Inbox & messages'}).click();
  await rootPage.getByRole('heading',{name:'Inbox & conversations'}).waitFor();
  assert.ok(await rootPage.locator('[data-work-row]:not([hidden])').count()<=14,
   'Root inbox must not render an endless first page of academic cases');
  await rootPage.locator('input[data-work-search]').fill('Pediatric Nursing Research');
  assert.ok(await rootPage.locator('[data-work-row]:not([hidden])').count()>0,
   'Root must find academic case messages by subject');
  await rootPage.locator('input[data-work-search]').fill('');
  await screen(rootPage,'09-nyoro-searchable-academic-company-inbox');
  await rootPage.getByRole('button',{name:'Finance',exact:true}).click();
  await rootPage.getByRole('heading',{name:'Accepted quotation billing'}).waitFor();
  await rootPage.getByRole('heading',{name:'Specialist time & review'}).waitFor();
  await rootPage.getByRole('heading',{name:'Billing concerns'}).waitFor();
  assert.equal(await rootPage.locator('form[data-form=compensation-propose]').count(),1);
  await overflow(rootPage);await screen(rootPage,'31-root-real-finance-workspace');
 });
 await pass('Root navigates searchable departmental queues without an endless list',async()=>{
  await rootPage.locator('.sidebar').getByRole('button',{name:'Department queues'}).click();
  await rootPage.locator('#workbody').getByRole('heading',{name:'Department queues'}).waitFor();
  const n=await rootPage.locator('[data-work-row]').count();
  assert.ok(n>0,'The company must have accountable academic work waiting in the real queue');
  assert.ok(await rootPage.locator('[data-work-row]:not([hidden])').count()<=14);
  await rootPage.locator('input[data-work-search]').fill('no matching case expected 27');
  assert.equal(await rootPage.locator('[data-work-row]:not([hidden])').count(),0);
  await rootPage.locator('input[data-work-search]').fill('');
  if(n>14){
   await rootPage.getByRole('button',{name:'Next page'}).click();
   assert.ok((await rootPage.locator('[data-work-page]').innerText()).includes('Page 2'));
   await rootPage.getByRole('button',{name:'Previous page'}).click();
   assert.ok((await rootPage.locator('[data-work-page]').innerText()).includes('Page 1'));
  }
  await overflow(rootPage);
  await screen(rootPage,'32-root-searchable-paginated-responsibility-queues');
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
 await pass('Root takes over an unassigned job in one click, then sees the next action without supplier paperwork',async()=>{
  const id='IPS-A-CHROME-QUICK-TAKEOVER';
  const subject='Quick Root takeover usability check';
  const now=new Date();
  await mongo.db.collection('academic_commissions').insertOne({
   id,quoteId:'IPS-Q-CHROME-QUICK-TAKEOVER',studentId:student.id,
   specialistId:'',serviceId:'academic-editing',serviceName:'Academic Editing & Proofreading',
   academicLevel:'Undergraduate',subject,requirements:'Synthetic editorial review only.',
   status:'ready_for_assignment',paymentStatus:'synthetic_test_only',
   priceMinor:12500,currency:'PLN',evaluationPayment:true,synthetic:true,
   createdAt:now,updatedAt:now,revisionCount:0,
   milestones:[{name:'Specialist assignment',status:'pending',at:null}]
  });
  await rootPage.locator('.sidebar').getByRole('button',{name:'Academic jobs',exact:true}).click();
  const job=rootPage.locator('.record').filter({hasText:subject});
  await job.getByRole('button',{name:'Take over job'}).click();
  await rootPage.getByText('Nyoro now manages this job. Upload the deliverable for quality review.').waitFor();
  assert.equal((await mongo.db.collection('academic_commissions').findOne({id})).status,'root_in_progress');
  assert.equal(await rootPage.locator('form[data-form=root-takeover]').count(),0,
   'Takeover must never ask Nyoro to fill out a mandatory prose form');
  assert.equal(await rootPage.getByRole('button',{name:'Take over job'}).count(),0,
   'Root must not see an action to take over a job already under Root management');
  assert.equal(await rootPage.locator('form[data-form=case-upload] select[name=purpose]').inputValue(),
   'deliverable','The next upload should default to a QA-bound deliverable');
  assert.equal(await rootPage.locator('details.optional-root-tools').count(),1);
  assert.equal(await rootPage.locator('details.optional-root-tools').getAttribute('open'),null,
   'Optional external sourcing must be collapsed for direct IPS delivery');
  await overflow(rootPage);
  await screen(rootPage,'40-root-one-click-job-takeover');
 });
 await pass('Root takeover of a pending Specialist offer confirms withdrawal and stops later acceptance',async()=>{
  const id='IPS-A-CHROME-PENDING-OFFER';
  const now=new Date();
  await mongo.db.collection('academic_commissions').insertOne({
   id,quoteId:'IPS-Q-CHROME-PENDING-OFFER',studentId:student.id,specialistId:'',
   serviceId:'academic-editing',serviceName:'Academic Editing & Proofreading',
   academicLevel:'Undergraduate',subject:'Pending Specialist offer quick Root decision',
   requirements:'Synthetic consent-based editorial assistance.',
   status:'awaiting_specialist_acceptance',paymentStatus:'synthetic_test_only',
   priceMinor:13000,currency:'PLN',evaluationPayment:true,synthetic:true,
   assignmentVersion:1,assignmentOffer:{specialistId:specialist.id,version:1,
    feeMinor:6000,terms:'Optional, synthetic specialist assignment offer.',
    createdAt:now,expiresAt:new Date(Date.now()+7200000)},
   createdAt:now,updatedAt:now,
   milestones:[{name:'Specialist assignment',status:'pending',at:null}]
  });
  await rootPage.locator('.sidebar').getByRole('button',{name:'Academic jobs',exact:true}).click();
  const row=rootPage.locator('.record').filter({hasText:'Pending Specialist offer quick Root decision'});
  await row.getByRole('button',{name:'Take over job'}).waitFor();
  rootPage.once('dialog',dialog=>dialog.dismiss());
  await row.getByRole('button',{name:'Take over job'}).click();
  assert.equal((await mongo.db.collection('academic_commissions').findOne({id})).status,
   'awaiting_specialist_acceptance','Declining the withdrawal prompt must not reassign the job');
  rootPage.once('dialog',dialog=>dialog.accept());
  await row.getByRole('button',{name:'Take over job'}).click();
  await rootPage.getByText('Nyoro now manages this job. Upload the deliverable for quality review.').waitFor();
  const changed=await mongo.db.collection('academic_commissions').findOne({id});
  assert.equal(changed.status,'root_in_progress');
  assert.equal(changed.assignmentOffer,undefined,'The pending offer must be revoked');
  await overflow(rootPage);
  await screen(rootPage,'41-root-simplified-pending-offer-withdrawal');
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
  await rootDirect.locator('#workbody .metrics').first().waitFor();
  await rootDirect.getByRole('heading',{name:'Work requiring action now'}).waitFor();
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
  await row.getByRole('button',{name:'Open enquiry'}).click();
  await staffPage.getByRole('button',{name:'Take this enquiry'}).click();
  await staffPage.getByText('You are now accountable for this academic enquiry.').waitFor();
  assert.equal(await staffPage.locator('form[data-form=quote-assign]').count(),0,
   'Routine staff ownership must not display a management handoff form');
  await staffPage.getByText(staff.id,{exact:false}).first().waitFor();
  await overflow(staffPage);
  await screen(staffPage,'22-client-relations-accountable-ownership');
 });
 await pass('Nyoro reviews an unowned enquiry directly without a separate claim or handoff form',async()=>{
  const id='IPS-Q-CHROME-DIRECT-REVIEW';
  const at=new Date();
  await mongo.db.collection('academic_quotations').insertOne({
   id,studentId:student.id,contactEmail:student.email,username:student.username,
   serviceId:'academic-editing',serviceName:'Academic Editing & Proofreading',
   academicLevel:'Undergraduate',subject:'Direct enquiry review without claim',
   requirements:'Student-authored draft needs citation-consistency and structure feedback.',
   status:'received',scopeDecision:'pending',contactVerified:true,
   integrityAcknowledged:true,createdAt:at,updatedAt:at,synthetic:true
  });
  await rootPage.locator('.sidebar').getByRole('button',{name:'Enquiries',exact:true}).click();
  const row=rootPage.locator('.record').filter({hasText:'Direct enquiry review without claim'});
  await row.getByRole('button',{name:'Review enquiry'}).click();
  assert.equal(await rootPage.getByRole('button',{name:'Claim this enquiry'}).count(),0);
  assert.equal(await rootPage.locator('form[data-form=quote-assign]').count(),1,
   'Delegation must exist but be inside secondary optional section');
  const delegate=rootPage.locator('details.optional-admin-tools');
  assert.equal(await delegate.getAttribute('open'),null,'Routine handoff must stay collapsed');
  assert.equal(await rootPage.locator('form[data-form=scope]').count(),1);
  await rootPage.locator('form[data-form=scope] textarea[name=note]')
   .fill('Permitted editorial guidance on a verified student-owned manuscript.');
  await rootPage.locator('form[data-form=scope]').getByRole('button',{name:'Record review'}).click();
  await rootPage.getByText('Academic scope decision has been recorded.').waitFor();
  const owned=await mongo.db.collection('academic_quotations').findOne({id});
  assert.equal(owned.assignedTo,vars.ROOT_EMAIL,
   'Root review must automatically claim an unowned enquiry');
  assert.equal(owned.status,'scoped');
  await rootPage.getByRole('heading',{name:'Send written quotation'}).waitFor();
  await overflow(rootPage);
  await screen(rootPage,'42-nyoro-direct-enquiry-review');
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
   .getByRole('button',{name:'Open enquiry'}).click();
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
   .getByRole('button',{name:'Open enquiry'}).click();
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
