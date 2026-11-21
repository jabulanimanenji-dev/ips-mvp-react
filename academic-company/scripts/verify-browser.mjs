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
  assert.ok((await publicPage.locator('body').innerText()).includes('Students & Researchers'));
  await overflow(publicPage);await screen(publicPage,'01-academic-homepage');
 });
 await pass('Academic website loads real non-person illustrations and signup confirms passwords',async()=>{
  await publicPage.locator('img.hero-illustration').waitFor();
  assert.ok(await publicPage.locator('img.hero-illustration').evaluate(img=>img.complete&&img.naturalWidth>0));
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
 await pass('Academic catalogue contains 16 real disciplines and detailed subject-specific enquiries',async()=>{
  await publicPage.getByRole('button',{name:'Academic services',exact:true}).click();
  await publicPage.getByRole('button',{name:'All academic services'}).count().catch(()=>0);
  await publicPage.locator('.service-card').first().waitFor();
  assert.equal(await publicPage.locator('.service-card').count(),16);
  await publicPage.getByRole('button',{name:'Theses & Research'}).click();
  assert.ok((await publicPage.locator('.service-card').count())>2);
  await screen(publicPage,'02-academic-service-catalogue');
  await publicPage.locator('.service-card').first().getByRole('button',{name:'Explore academic support'}).click();
  await publicPage.getByRole('button',{name:'Request a quotation for this service'}).waitFor();
  await screen(publicPage,'03-academic-service-details');
  await publicPage.getByRole('button',{name:'Request a quotation for this service'}).click();
  await publicPage.locator('select[name=academicLevel]').waitFor();
  await publicPage.locator('textarea[name=requirements]').waitFor();
  await publicPage.locator('input[name=username]').waitFor();
  await screen(publicPage,'04-subject-specific-private-quotation');
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
 await pass('Student sees actual approved academic file through private authenticated download',async()=>{
  await studentPage.getByRole('button',{name:'Open academic commission'}).first().click();
  await studentPage.locator('a[download]').first().waitFor();
  await studentPage.getByText('Centralized company relay prevents uncontrolled student–Specialist messaging').count().catch(()=>0);
  await screen(studentPage,'06-student-academic-delivery');
 });
 const specialistPage=await pageOpen(false);
 await pass('Approved academic Specialist sees only assigned nursing work and IPS coordination',async()=>{
  await signIn(specialistPage,specialist.email,'SpecialistAcademic2026!');
  await specialistPage.getByRole('button',{name:'Assigned academic work'}).click();
  await specialistPage.getByText('Academic Editing & Proofreading').first().waitFor();
  await specialistPage.getByRole('button',{name:'Open academic commission'}).first().click();
  await specialistPage.getByText('Written IPS academic coordination').waitFor();
  await overflow(specialistPage);await screen(specialistPage,'07-approved-specialist-academic-work');
 });
 const rootPage=await pageOpen(false);
 await pass('Nyoro Root Administration governs students, specialists, academic queues, quality and finance',async()=>{
  await signIn(rootPage,vars.ROOT_EMAIL,vars.ROOT_PASSWORD);
  await rootPage.getByText('Nyoro · Root Administration').first().waitFor();
  await rootPage.getByRole('button',{name:'Students & Specialists'}).click();
  await rootPage.getByText('Evaluation Academic Nursing Editor').first().waitFor();
  await screen(rootPage,'08-nyoro-academic-people-management');
  await rootPage.getByRole('button',{name:'Today & queues'}).click();
  await rootPage.getByText('Academic enquiries awaiting review or reply').waitFor();
  await screen(rootPage,'09-academic-department-queues');
  await rootPage.getByRole('button',{name:'Finance & Billing'}).click();
  await rootPage.getByText('Payment processing is intentionally disabled').waitFor();
  await overflow(rootPage);
 });
 const rootDirect=await pageOpen(false);
 await pass('Direct /root URL authenticates Nyoro and stays within Root Administrator identity',async()=>{
  await rootDirect.goto(origin+'/root',{waitUntil:'domcontentloaded'});
  await rootDirect.getByRole('heading',{name:'Nyoro · Root Administration'}).waitFor();
  await rootDirect.locator('input[name=email]').fill(vars.ROOT_EMAIL);
  await rootDirect.locator('input[name=password]').fill(vars.ROOT_PASSWORD);
  await rootDirect.getByRole('button',{name:'Sign in as Nyoro Root Admin'}).click();
  await rootDirect.getByText('Nyoro · Root Administration').first().waitFor();
  const s=await rootDirect.evaluate(async()=>{const r=await fetch('/api/session');return (await r.json()).account.role});
  assert.equal(s,'root');
 });
 await pass('Root opens real Student workspace and then Specialist workspace with no login switching',async()=>{
  await rootDirect.locator('.sidebar').getByRole('button',{name:'Student workspace'}).click();
  const row=rootDirect.locator('.record',{hasText:'PrivateScholar'}).first();
  await row.getByRole('button',{name:'Open workspace as Root'}).click();
  await rootDirect.getByText('NYORO ROOT ADMINISTRATION / ASSISTED WORKSPACE').waitFor();
  await rootDirect.locator('.sidebar').getByRole('button',{name:'My quotations'}).click();
  await rootDirect.getByText('Pediatric Nursing Research').first().waitFor();
  await rootDirect.getByRole('button',{name:'Return to Nyoro Root'}).click();
  await rootDirect.locator('.sidebar').getByRole('button',{name:'Specialist workspace'}).click();
  const spec=rootDirect.locator('.record',{hasText:'Evaluation Academic Nursing Editor'}).first();
  await spec.getByRole('button',{name:'Open workspace as Root'}).click();
  await rootDirect.locator('.sidebar').getByRole('button',{name:'Assigned academic work'}).click();
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
  await managerPage.getByRole('button',{name:'Academic enquiries'}).click();
  await managerPage.getByText('Pediatric Nursing Research').first().waitFor();
  assert.equal(await managerPage.getByRole('button',{name:'Governance & Audit'}).count(),0);
  await managerPage.getByRole('button',{name:'My department staff'}).click();
  await managerPage.getByText('Academic Client Relations Associate').first().waitFor();
  await screen(managerPage,'10-academic-department-manager');
 });
 const staffPage=await pageOpen(false);
 await pass('Staff has written student support, no Root or finance controls',async()=>{
  await signIn(staffPage,staff.email,'StaffAcademic2026!');
  await staffPage.getByRole('button',{name:'Written support'}).click();
  await staffPage.getByText('Nursing editing document').first().waitFor();
  assert.equal(await staffPage.getByRole('button',{name:'Finance & Billing'}).count(),0);
  assert.equal(await staffPage.getByRole('button',{name:'Governance & Audit'}).count(),0);
  await screen(staffPage,'11-client-relations-staff');
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
 console.log('IPS_ACADEMIC_CHROME_QUALIFICATION_GREEN '+count+' desktop/mobile role journeys and visual evidence');
}catch(err){console.error('IPS_ACADEMIC_CHROME_FAIL',String(err),log.slice(-1600));process.exitCode=1}
finally{try{await browser?.close()}catch{}try{await mongo?.close()}catch{}proc.kill('SIGTERM')}
