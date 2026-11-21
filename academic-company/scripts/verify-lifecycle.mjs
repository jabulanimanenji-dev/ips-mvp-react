// True academic-service lifecycle acceptance against independent MongoDB 7, not production records.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import mongoose from 'mongoose';
import {setTimeout as sleep} from 'node:timers/promises';

const url='http://127.0.0.1:18122';
const dbName='ips_academic_sandbox';
const vars={...process.env,NODE_ENV:'test',IPS_ACADEMIC_MODE:'evaluation',IPS_ACADEMIC_TEST_SETTLEMENT:'true',
 MONGODB_URI:'mongodb://127.0.0.1:27017/'+dbName,PORT:'18122',PUBLIC_APP_URL:url,
 ROOT_EMAIL:'nyoro.ips-academic-test@example.org',ROOT_PASSWORD:'AcademicRootTest2026!',
 SESSION_SECRET:'Academic-test-only-HMAC-secret-of-sufficient-length-2026-abcdefghijklmnopqrstuvwxyz',
 RESEND_API_KEY:'',FROM_EMAIL:''};
const server=spawn(process.execPath,['src/app.mjs'],{env:vars,stdio:['ignore','pipe','pipe']});
let stderr='';for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{stderr=(stderr+String(d)).slice(-2700)});
let client;let db;let checks=0;
const random=()=>crypto.randomBytes(5).toString('hex');
const emailFor=p=>p+'-'+random()+'@example.org';
const assertCheck=async(title,fn)=>{await fn();checks++;console.log('PASS ACADEMIC '+title)};
async function request(endpoint,{method='GET',body,cookie,origin=url}={}){
 const res=await fetch(url+'/api'+endpoint,{method,headers:{...(body?{'Content-Type':'application/json','Origin':origin}:{}),...(cookie?{Cookie:cookie}:{})},
  body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(14000)});
 const raw=await res.text();let data;try{data=JSON.parse(raw)}catch{data={raw}};
 return {status:res.status,data,cookie:(res.headers.get('set-cookie')||'').split(';')[0],headers:res.headers};
}
async function call(endpoint,opts={},expected=200){
 const r=await request(endpoint,opts);
 assert.equal(r.status,expected,endpoint+': '+JSON.stringify(r.data).slice(0,350));
 return r;
}
async function inbox(emailAddr,fragment){
 const doc=await db.collection('academic_evaluation_mail').find({to:emailAddr,subject:{$regex:fragment}}).sort({createdAt:-1}).limit(1).toArray();
 assert.equal(doc.length,1,'Expected one real sandbox outbox record for '+fragment);return doc[0];
}
const token=(doc,name)=>{const m=doc.text.match(new RegExp('#'+name+'=([A-Za-z0-9_-]{43})'));assert.ok(m,name+' email token missing');return m[1]};
const withAuth=(cookie,body)=>({method:'POST',cookie,body:body||{}});
async function signIn(mail,password){const r=await call('/auth/login',{method:'POST',body:{email:mail,password}});assert.ok(r.cookie.startsWith('ips_academic_session='));return r.cookie}
const brief=(serviceId='academic-editing')=>({
 serviceId,academicLevel:'Undergraduate',subject:'Pediatric Nursing Research',
 requirements:'I need academic editing feedback on my independently written literature review, with tracked clarity and citation comments.',
 institutionGuidance:'Follow university author-contribution and academic integrity policy.',
 deadline:'2026-12-15',integrityAcknowledged:true,contactChannel:'workspace'
});
let rootCookie,studentCookie,specialistCookie,managerCookie,staffCookie,otherCookie;
let studentMail,specialistMail,managerMail,staffMail,guestReference,commissionId,quoteId,academicFileId;
try{
 for(let i=0;i<100;i++){try{const r=await request('/health');if(r.status===200&&r.data.ready)break}catch{}if(i===99)throw Error('Academic API failed boot: '+stderr);await sleep(220)}
 client=await mongoose.createConnection(vars.MONGODB_URI).asPromise();db=client.db;
 await assertCheck('Verified academic company identity and 16 genuine academic services',async()=>{
  const r=await call('/catalogue');assert.equal(r.data.company,'IPS Academic Services');assert.equal(r.data.services.length,16);
  assert.ok(r.data.services.some(x=>x.id==='thesis-dissertation'));assert.ok(r.data.services.every(x=>x.questions.length));
  const h=await call('/health');assert.equal(h.data.environment,'ISOLATED_ACADEMIC_REVIEW');
  assert.equal(h.data.payments,'integration-pending');
 });
 await assertCheck('Nyoro Root is environment-controlled, has no manager and no deletable row',async()=>{
  rootCookie=await signIn(vars.ROOT_EMAIL,vars.ROOT_PASSWORD);
  const s=await call('/session',{cookie:rootCookie});assert.equal(s.data.account.name,'Nyoro');assert.equal(s.data.account.role,'root');
  assert.equal(await db.collection('academic_accounts').countDocuments({role:'root'}),0);
 });
 await assertCheck('Student / Researcher signs up anonymously and MUST verify real email',async()=>{
  studentMail=emailFor('private-student');const user='PrivateScholar'+random();
  await call('/auth/register',{method:'POST',body:{role:'student',email:studentMail,username:user,
   password:'StudentAcademic2026!',privacyConsent:true}},202);
  await call('/auth/login',{method:'POST',body:{email:studentMail,password:'StudentAcademic2026!'}},403);
  const m=await inbox(studentMail,'Confirm your IPS Academic Services email');
  const verified=await call('/auth/verify',{method:'POST',body:{email:studentMail,token:token(m,'verify')}});
  studentCookie=verified.cookie;assert.ok(studentCookie.startsWith('ips_academic_session='));
  const row=await db.collection('academic_accounts').findOne({email:studentMail});
  assert.equal(row.name,'');assert.equal(row.verified,true);assert.ok(row.username.startsWith('PrivateScholar'));
 });
 await assertCheck('Qualified Specialist verifies email and cannot work until approved',async()=>{
  specialistMail=emailFor('academic-specialist');
  await call('/auth/register',{method:'POST',body:{role:'specialist',email:specialistMail,password:'SpecialistAcademic2026!',
   fullName:'Evaluation Academic Nursing Editor',qualification:'MSc Nursing Research',experience:'Editorial and methodology consultation',
   expertise:['academic-editing','thesis-dissertation'],privacyConsent:true}},202);
  const m=await inbox(specialistMail,'Confirm your IPS Academic Services email');
  const r=await call('/auth/verify',{method:'POST',body:{email:specialistMail,token:token(m,'verify')}));
  assert.equal(r.data.reviewRequired,true);
  await call('/auth/login',{method:'POST',body:{email:specialistMail,password:'SpecialistAcademic2026!'}},403);
  const person=await db.collection('academic_accounts').findOne({email:specialistMail});
  await call('/administration/people/'+person.id+'/decision',withAuth(rootCookie,{decision:'approve_specialist'}));
  specialistCookie=await signIn(specialistMail,'SpecialistAcademic2026!');
 });
 await assertCheck('Root appoints manager, manager invites department staff, staff cannot invite',async()=>{
  managerMail=emailFor('clientrelations-manager');
  const m=await call('/administration/invite',withAuth(rootCookie,{name:'Academic Client Relations Manager',
   email:managerMail,department:'client_relations'}),201);
  assert.equal(m.data.employee.role,'manager');
  const mt=token(await inbox(managerMail,'Your IPS Academic Services department invitation'),'invite');
  managerCookie=(await call('/auth/invitation/accept',{method:'POST',body:{email:managerMail,token:mt,password:'ManagerAcademic2026!'}})).cookie;
  staffMail=emailFor('clientrelations-staff');
  const s=await call('/administration/invite',withAuth(managerCookie,{name:'Academic Client Relations Associate',email:staffMail}),201);
  assert.equal(s.data.employee.role,'staff');assert.equal(s.data.employee.department,'client_relations');
  const st=token(await inbox(staffMail,'Your IPS Academic Services department invitation'),'invite');
  staffCookie=(await call('/auth/invitation/accept',{method:'POST',body:{email:staffMail,token:st,password:'StaffAcademic2026!'}})).cookie;
  await call('/administration/invite',withAuth(staffCookie,{name:'Unauthorized Manager',email:emailFor('unauthorized'),department:'governance'}),403);
 });
 await assertCheck('Guest sends real subject-specific academic quote without supplying legal name',async()=>{
  const guestEmail=studentMail;
  const q=await call('/academic/guest-quote',{method:'POST',body:{...brief('literature-reviews'),
   username:'AnonymousResearcher',email:guestEmail,contactChannel:'email',privacyConsent:true}},202);
  guestReference=q.data.reference;
  const doc=await inbox(guestEmail,'Confirm your confidential IPS Academic Services quotation request');
  const vt=token(doc,'guestconfirm');
  await call('/academic/guest-confirm',{method:'POST',body:{email:guestEmail,reference:guestReference,token:vt}});
  await call('/academic/guest-confirm',{method:'POST',body:{email:guestEmail,reference:guestReference,token:vt}},400);
  const r=await call('/academic/quotes/claim',withAuth(studentCookie,{reference:guestReference}));
  assert.equal(r.data.quote.serviceId,'literature-reviews');
 });
 await assertCheck('Academic enquiry cannot be priced before managerial academic-scope approval',async()=>{
  const r=await call('/academic/quotes',withAuth(studentCookie,brief()),201);quoteId=r.data.quote.id;
  await call('/academic/quotes/'+quoteId+'/offer',withAuth(rootCookie,{priceMinor:25000,
   deliverables:'Academic editing with tracked clarity suggestions.',terms:'Academic language feedback, one revision, no independent authorship.'}),409);
  await call('/academic/quotes/'+quoteId+'/scope',withAuth(staffCookie,{decision:'approved',note:'Permitted academic editing on independently authored materials.'}),403);
  await call('/academic/quotes/'+quoteId+'/scope',withAuth(rootCookie,{decision:'approved',note:'Legitimate editing feedback on student-authored nursing literature review.'}));
  await call('/academic/quotes/'+quoteId+'/offer',withAuth(staffCookie,{priceMinor:25000,
   deliverables:'Tracked language feedback on student-written research.',terms:'One editorial revision, no ghostwriting.'}),403);
  const offer=await call('/academic/quotes/'+quoteId+'/offer',withAuth(managerCookie,{priceMinor:25000,
   deliverables:'Tracked editing, clarity notes and verified reference-format feedback.',
   terms:'Consultation and comments on existing text; one revision within seven days.'}));
  assert.equal(offer.data.quote.status,'offered');assert.equal(offer.data.quote.priceMinor,25000);
 });
 await assertCheck('Student accepts actual reviewed quotation; production payment remains blocked',async()=>{
  const r=await call('/academic/quotes/'+quoteId+'/decision',withAuth(studentCookie,{decision:'accept'}));
  commissionId=r.data.commission.id;assert.equal(r.data.commission.status,'awaiting_payment_integration');
  assert.equal(r.data.commission.paymentStatus,'not_collected');
  const specialist=(await db.collection('academic_accounts').findOne({email:specialistMail}));
  await call('/academic/commissions/'+commissionId+'/assign',withAuth(rootCookie,{specialistId:specialist.id}),409);
 });
 await assertCheck('Only isolated test mode permits a declared synthetic financial witness',async()=>{
  const r=await call('/evaluation/confirm-synthetic-payment/'+commissionId,withAuth(rootCookie,{}));
  assert.equal(r.data.synthetic,true);assert.equal(r.data.commission.paymentStatus,'synthetic_test_only');
  const specialist=await db.collection('academic_accounts').findOne({email:specialistMail});
  const a=await call('/academic/commissions/'+commissionId+'/assign',withAuth(rootCookie,{specialistId:specialist.id}));
  assert.equal(a.data.commission.status,'specialist_assigned');
  await call('/academic/commissions/'+commissionId+'/assign',withAuth(staffCookie,{specialistId:specialist.id}),403);
 });
 const upload=async(text)=>call('/academic/commissions/'+commissionId+'/submission',
  withAuth(specialistCookie,{filename:'nursing-editing-feedback.txt',mime:'text/plain',data:Buffer.from(text).toString('base64')}),201);
 await assertCheck('Specialist submits a genuine private academic file to independent QA',async()=>{
  const r=await upload('IPS academic nursing manuscript feedback: improve citation consistency and avoid unsupported methodology claims.');
  academicFileId=r.data.submissionId;assert.ok(r.data.checksum.length===64);
  await call('/academic/files/'+academicFileId,{cookie:studentCookie},403);
  await call('/academic/commissions/'+commissionId+'/quality',withAuth(staffCookie,{decision:'approve',note:'Looks academically correct.'}),403);
 });
 await assertCheck('Root QA returns substantive corrections; Specialist resubmits with actual bytes',async()=>{
  const q=await call('/academic/commissions/'+commissionId+'/quality',withAuth(rootCookie,{
   decision:'return_for_correction',note:'Citation consistency must be corrected before academic client delivery.'}));
  assert.equal(q.data.commission.status,'correction_requested');
  await upload('Corrected nursing academic editing notes: citations are consistent and methodological limitations are clearly marked.');
  const approved=await call('/academic/commissions/'+commissionId+'/quality',withAuth(rootCookie,{
   decision:'approve',note:'Second editorial review confirmed consistency and correct ownership boundaries.'}));
  assert.equal(approved.data.commission.status,'client_delivery');
  const r=await fetch(url+'/api/academic/files/'+academicFileId,{headers:{Cookie:studentCookie}});
  assert.equal(r.status,200);assert.ok((await r.text()).startsWith('IPS academic nursing'));
 });
 await assertCheck('Student requests revision; Specialist returns final file; Root QA approves; student accepts',async()=>{
  await call('/academic/commissions/'+commissionId+'/student-decision',withAuth(studentCookie,{
   decision:'request_revision',note:'Please clarify the editorial explanation of qualitative sampling limitations.'}));
  const doc=await upload('Final corrected academic editing feedback: nursing literature citations checked and qualitative sampling limitations explained.');
  await call('/academic/commissions/'+commissionId+'/quality',withAuth(rootCookie,{decision:'approve',
   note:'IPS independent academic QA confirms corrected feedback and appropriate client release.'}));
  const final=await call('/academic/commissions/'+commissionId+'/student-decision',withAuth(studentCookie,{decision:'accept'}));
  assert.equal(final.data.commission.status,'completed');
  const file=await fetch(url+'/api/academic/files/'+doc.data.submissionId,{headers:{Cookie:studentCookie}});
  assert.equal(file.status,200);assert.equal(file.headers.get('x-content-sha256'),doc.data.checksum);
 });
 await assertCheck('Centralized company relay prevents uncontrolled student–Specialist messaging',async()=>{
  await call('/academic/commissions/'+commissionId+'/messages',withAuth(studentCookie,{body:'Please coordinate my feedback with the academic editor.'}),201);
  const specialist=await call('/academic/commissions/'+commissionId+'/messages',{cookie:specialistCookie});
  assert.ok(!specialist.data.messages.some(x=>x.body.includes('coordinate my feedback')));
  const student=await call('/academic/commissions/'+commissionId+'/messages',{cookie:studentCookie});
  assert.ok(student.data.messages.some(x=>x.body.includes('coordinate my feedback')));
  await call('/academic/commissions/'+commissionId+'/messages',withAuth(rootCookie,{
   body:'IPS has completed quality review and shared the approved delivery.',audience:'shared'}),201);
  const shared=await call('/academic/commissions/'+commissionId+'/messages',{cookie:specialistCookie});
  assert.ok(shared.data.messages.some(x=>x.body.includes('completed quality review')));
 });
 await assertCheck('Separate client identities cannot inspect each other’s academic files and correspondence',async()=>{
  const otherMail=emailFor('other-student');
  await call('/auth/register',{method:'POST',body:{role:'student',email:otherMail,
   username:'SecondScholar'+random(),password:'OtherAcademic2026!',privacyConsent:true}},202);
  const vt=token(await inbox(otherMail,'Confirm your IPS Academic Services email'),'verify');
  otherCookie=(await call('/auth/verify',{method:'POST',body:{email:otherMail,token:vt}})).cookie;
  await call('/academic/commissions/'+commissionId,{cookie:otherCookie},403);
  await call('/academic/commissions/'+commissionId+'/messages',{cookie:otherCookie},403);
  await call('/academic/files/'+academicFileId,{cookie:otherCookie},403);
  await call('/academic/quotes',{cookie:otherCookie});
 });
 await assertCheck('Client Relations staff records, answers and resolves written academic support cases',async()=>{
  const r=await call('/support',withAuth(studentCookie,{
   subject:'Nursing editing document',message:'Please clarify which reference corrections were included in my academic editing delivery.'}),201);
  const id=r.data.ticket.id;
  await call('/support/'+id+'/reply',withAuth(staffCookie,{message:'IPS has logged the reference-format explanation for your review.'}));
  const all=await call('/support',{cookie:studentCookie});assert.ok(all.data.tickets.some(t=>t.id===id&&t.replies.length===2));
  await call('/support/'+id+'/resolve',withAuth(studentCookie,{}));
  await call('/support/'+id+'/reply',withAuth(staffCookie,{message:'Should not be appended.'}),409);
 });
 await assertCheck('Authorized staff email account recovery; old student session gets revoked',async()=>{
  const user=await db.collection('academic_accounts').findOne({email:studentMail});
  await call('/administration/people/'+user.id+'/send-recovery',withAuth(staffCookie,{}),202);
  const link=token(await inbox(studentMail,'Your private IPS password recovery'),'recover');
  const r=await call('/auth/recovery/complete',{method:'POST',body:{email:studentMail,token:link,password:'RecoveredAcademic2027!'}});
  await call('/session',{cookie:studentCookie},401);
  await call('/auth/recovery/complete',{method:'POST',body:{email:studentMail,token:link,password:'AnotherAcademic2027!'}},400);
  studentCookie=r.cookie;
 });
 await assertCheck('Real database audit, scoped queues, role safety and dedicated academic collections',async()=>{
  const people=await call('/administration/people',{cookie:rootCookie});
  assert.ok(!people.data.people.some(x=>x.role==='root'));
  await call('/administration/people',{cookie:studentCookie},403);
  const queue=await call('/administration/queues',{cookie:rootCookie});
  assert.ok(queue.data.queues.some(x=>x.department==='quality_assurance'));
  const saved=await db.collection('academic_audit_events').countDocuments({});
  assert.ok(saved>14,'Academic business audit events missing');
  const coll=(await db.listCollections().toArray()).map(x=>x.name);
  assert.ok(coll.includes('academic_commissions'));
  assert.ok(!coll.includes('orders')&&!coll.includes('writers')&&!coll.includes('clients'));
 });
 console.log('IPS_ACADEMIC_REAL_MONGODB_LIFECYCLE_GREEN '+checks+' verified business and security checks, full edited academic file, QA/revision loop');
}catch(err){console.error('IPS_ACADEMIC_LIFECYCLE_FAIL',String(err),stderr);process.exitCode=1}
finally{try{await client?.close()}catch{}server.kill('SIGTERM');await sleep(250)}
