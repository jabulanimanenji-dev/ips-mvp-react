// True academic-service lifecycle acceptance against independent MongoDB 7, not production records.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import mongoose from 'mongoose';
import {SPECIALIST_AGREEMENT} from '../src/specialist-agreement.mjs';
import {Throttle} from '../src/security.mjs';
import {startFakeClamd} from './scan-test-server.mjs';
import {setTimeout as sleep} from 'node:timers/promises';

const mockScanner=await startFakeClamd();
const url='http://127.0.0.1:18122';
const dbName='ips_academic_sandbox';
const vars={...process.env,NODE_ENV:'test',IPS_ACADEMIC_MODE:'evaluation',IPS_ACADEMIC_TEST_SETTLEMENT:'true',
 MONGODB_URI:'mongodb://127.0.0.1:27017/'+dbName,PORT:'18122',PUBLIC_APP_URL:url,
 ROOT_EMAIL:'nyoro.ips-academic-test@example.org',ROOT_PASSWORD:'AcademicRootTest2026!',
 SESSION_SECRET:'Academic-test-only-HMAC-secret-of-sufficient-length-2026-abcdefghijklmnopqrstuvwxyz',
 RESEND_API_KEY:'',FROM_EMAIL:'',
 RESEND_WEBHOOK_SECRET:'whsec_'+Buffer.from('AcademicResendSignatureTestKey-2026').toString('base64'),
 IPS_TELEGRAM_BOT_USERNAME:'IPSAcademicReviewBot',
 TELEGRAM_BOT_TOKEN:'synthetic-no-live-provider-token',
 IPS_TELEGRAM_WEBHOOK_SECRET:'Academic_2026_Synthetic_Webhook_Secret_Only',
 IPS_CLAMAV_HOST:'127.0.0.1',
 IPS_CLAMAV_PORT:String(mockScanner.port)};
const server=spawn(process.execPath,['src/app.mjs'],{env:vars,stdio:['ignore','pipe','pipe']});
let stderr='';for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{stderr=(stderr+String(d)).slice(-2700)});
let client;let db;let checks=0;
const random=()=>crypto.randomBytes(5).toString('hex');
const emailFor=p=>p+'-'+random()+'@example.org';
const assertCheck=async(title,fn)=>{await fn();checks++;console.log('PASS ACADEMIC '+title)};
async function request(endpoint,{method='GET',body,cookie,origin=url,rootTarget}={}){
 const res=await fetch(url+'/api'+endpoint,{method,headers:{...(body?{'Content-Type':'application/json','Origin':origin}:{}),...(cookie?{Cookie:cookie}:{}),...(rootTarget?{'X-IPS-Root-Workspace-Target':rootTarget}:{})},
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
let studentMail,specialistMail,pendingSpecialistMail,managerMail,staffMail,guestReference,commissionId,quoteId,academicFileId;
try{
 for(let i=0;i<100;i++){try{const r=await request('/health');if(r.status===200&&r.data.ready)break}catch{}if(i===99)throw Error('Academic API failed boot: '+stderr);await sleep(220)}
 client=await mongoose.createConnection(vars.MONGODB_URI).asPromise();db=client.db;
 await assertCheck('Verified academic company identity and 16 genuine academic services',async()=>{
  const r=await call('/catalogue');assert.equal(r.data.company,'IPS Academic Services');assert.equal(r.data.services.length,16);
  assert.ok(r.data.services.some(x=>x.id==='thesis-dissertation'));assert.ok(r.data.services.every(x=>x.questions.length));
  const h=await call('/health');assert.equal(h.data.environment,'ISOLATED_ACADEMIC_REVIEW');
  assert.equal(h.data.payments,'integration-pending');
 });
 await assertCheck('Distributed production abuse limits are atomic, shared, private and fail closed',async()=>{
  const collection=db.collection('academic_abuse_rate_windows');
  const first=new Throttle(),second=new Throttle();
  first.attach(collection,{production:true,secret:vars.SESSION_SECRET});
  second.attach(collection,{production:true,secret:vars.SESSION_SECRET});
  const req={ip:'198.51.100.73'},action='production-test-'+random();
  const decisions=await Promise.all(Array.from({length:18},(_,i)=>
   (i%2?first:second).limited(req,action,6)));
  assert.equal(decisions.filter(x=>x===false).length,6,
   'Concurrent workers must never admit more than the configured shared limit');
  assert.equal(decisions.filter(x=>x===true).length,12);
  assert.equal(await first.limited(req,action,6),true);
  assert.equal(await first.limited(req,action+'-other',6),false);
  const record=await collection.findOne({action});
  assert.ok(record?record._id.length===64:false,'Throttle key must be hashed');
  assert.equal(record.attempts,19);
  assert.ok(record.expiresAt instanceof Date);
  const leaked=JSON.stringify(record);
  assert.ok(!leaked.includes(req.ip),'MongoDB abuse counters must not expose a raw IP');
  const unavailable=new Throttle();
  unavailable.attach({findOneAndUpdate:async()=>{throw Error('simulated_db_unavailable')}},
   {production:true,secret:vars.SESSION_SECRET});
  await assert.rejects(()=>unavailable.limited(req,'fails-closed',4),/simulated_db_unavailable/);
  assert.throws(()=>new Throttle().attach(null,{production:true,secret:'short'}),
   /shared MongoDB abuse limiter/);
 });
 await assertCheck('Nyoro Root is environment-controlled, has no manager and no deletable row',async()=>{
  rootCookie=await signIn(vars.ROOT_EMAIL,vars.ROOT_PASSWORD);
  const s=await call('/session',{cookie:rootCookie});assert.equal(s.data.account.name,'Nyoro');assert.equal(s.data.account.role,'root');
  assert.equal(await db.collection('academic_accounts').countDocuments({role:'root'}),0);
 });
 await assertCheck('Student / Researcher signs up anonymously and MUST verify real email',async()=>{
  studentMail=emailFor('private-student');const user='PrivateScholar'+random();
  await call('/auth/register',{method:'POST',body:{role:'student',email:studentMail,username:user,
   password:'StudentAcademic2026!',confirmPassword:'StudentAcademic2026!',privacyConsent:true}},202);
  await call('/auth/login',{method:'POST',body:{email:studentMail,password:'StudentAcademic2026!'}},403);
  const m=await inbox(studentMail,'Confirm your IPS Academic Services email');
  const verified=await call('/auth/verify',{method:'POST',body:{email:studentMail,token:token(m,'verify')}});
  studentCookie=verified.cookie;assert.ok(studentCookie.startsWith('ips_academic_session='));
  const row=await db.collection('academic_accounts').findOne({email:studentMail});
  assert.equal(row.name,'');assert.equal(row.verified,true);assert.ok(row.username.startsWith('PrivateScholar'));
 });
 await assertCheck('Sign-up rejects mismatched password confirmation',async()=>{
  await call('/auth/register',{method:'POST',body:{role:'student',email:emailFor('mismatch'),
   username:'MismatchedStudent'+random(),password:'StudentAcademic2026!',confirmPassword:'DifferentAcademic2026!',
   privacyConsent:true}},400);
  assert.equal(await db.collection('academic_accounts').countDocuments({usernameKey:{$regex:'^mismatchedstudent'}}),0);
 });
 await assertCheck('Specialist application publishes immutable confidentiality terms and rejects unsigned identities',async()=>{
  const terms=(await call('/specialist/agreement')).data;
  assert.equal(terms.version,SPECIALIST_AGREEMENT.version);
  assert.equal(terms.sha256,crypto.createHash('sha256').update(terms.text).digest('hex'));
  const baseline={role:'specialist',email:emailFor('unsigned-specialist'),
   password:'ResearchEditor2026!',confirmPassword:'ResearchEditor2026!',
   fullName:'Academic Research Consultant',qualification:'MA Research Methods',
   expertise:['academic-editing'],privacyConsent:true};
  await call('/auth/register',{method:'POST',body:baseline},400);
  await call('/auth/register',{method:'POST',body:{
   ...baseline,email:emailFor('mismatched-signature'),
   specialistAgreementVersion:terms.version,specialistAgreementAccepted:true,
   specialistSignature:'Someone Else'}},400);
  assert.equal(await db.collection('academic_accounts').countDocuments({
   email:baseline.email}),0);
 });
 await assertCheck('Qualified Specialist verifies email and cannot work until approved',async()=>{
  specialistMail=emailFor('academic-specialist');
  await call('/auth/register',{method:'POST',body:{role:'specialist',email:specialistMail,password:'SpecialistAcademic2026!',confirmPassword:'SpecialistAcademic2026!',
   fullName:'Evaluation Academic Nursing Editor',qualification:'MSc Nursing Research',experience:'Editorial and methodology consultation',
   expertise:['academic-editing','thesis-dissertation'],privacyConsent:true,
   specialistAgreementVersion:SPECIALIST_AGREEMENT.version,
   specialistAgreementAccepted:true,specialistSignature:'Evaluation Academic Nursing Editor'}},202);
  const m=await inbox(specialistMail,'Confirm your IPS Academic Services email');
  const r=await call('/auth/verify',{method:'POST',body:{email:specialistMail,token:token(m,'verify')}});
  assert.equal(r.data.reviewRequired,true);
  await call('/auth/login',{method:'POST',body:{email:specialistMail,password:'SpecialistAcademic2026!'}},403);
  const person=await db.collection('academic_accounts').findOne({email:specialistMail});
  assert.equal(person.specialistAgreementVersion,SPECIALIST_AGREEMENT.version);
  assert.equal(person.specialistAgreementSha256,SPECIALIST_AGREEMENT.sha256);
  assert.equal(person.specialistAgreementSignature,'Evaluation Academic Nursing Editor');
  await call('/administration/people/'+person.id+'/decision',withAuth(rootCookie,
   {decision:'approve_specialist'}),400);
  await call('/administration/people/'+person.id+'/decision',withAuth(rootCookie,{
   decision:'approve_specialist',
   reviewNote:'Verified professional MSc qualification, nursing research skills and institutional experience using independent credential evidence.'}),400);
  await call('/administration/people/'+person.id+'/decision',withAuth(rootCookie,{
   decision:'approve_specialist',credentialEvidenceReviewed:true,
   reviewNote:'Verified professional MSc qualification, nursing research skills and institutional experience using independent credential evidence.'}));
  const accepted=await db.collection('academic_accounts').findOne({id:person.id});
  assert.equal(accepted.credentialEvidenceReviewed,true);
  assert.ok(accepted.credentialReviewNote.includes('independent credential'));
  specialistCookie=await signIn(specialistMail,'SpecialistAcademic2026!');
  await call('/specialist/agreement/accept',withAuth(specialistCookie,{
   specialistAgreementVersion:SPECIALIST_AGREEMENT.version,
   specialistAgreementAccepted:true,specialistSignature:'Another Person'}),400);
  const receipt=await call('/specialist/agreement/accept',withAuth(specialistCookie,{
   specialistAgreementVersion:SPECIALIST_AGREEMENT.version,
   specialistAgreementAccepted:true,specialistSignature:'Evaluation Academic Nursing Editor'}));
  assert.equal(receipt.data.agreementVersion,SPECIALIST_AGREEMENT.version);
 });
 await assertCheck('Root appoints manager, manager invites department staff, staff cannot invite',async()=>{
  managerMail=emailFor('clientrelations-manager');
  const m=await call('/administration/invite',withAuth(rootCookie,{name:'Academic Client Relations Manager',
   email:managerMail,department:'client_relations'}),201);
  assert.equal(m.data.employee.role,'manager');
  const mt=token(await inbox(managerMail,'Your IPS Academic Services department invitation'),'invite');
  managerCookie=(await call('/auth/invitation/accept',{method:'POST',body:{email:managerMail,token:mt,password:'ManagerAcademic2026!',confirmPassword:'ManagerAcademic2026!'}})).cookie;
  staffMail=emailFor('clientrelations-staff');
  const s=await call('/administration/invite',withAuth(managerCookie,{name:'Academic Client Relations Associate',email:staffMail}),201);
  assert.equal(s.data.employee.role,'staff');assert.equal(s.data.employee.department,'client_relations');
  const st=token(await inbox(staffMail,'Your IPS Academic Services department invitation'),'invite');
  staffCookie=(await call('/auth/invitation/accept',{method:'POST',body:{email:staffMail,token:st,password:'StaffAcademic2026!',confirmPassword:'StaffAcademic2026!'}})).cookie;
  await call('/administration/invite',withAuth(staffCookie,{name:'Unauthorized Manager',email:emailFor('unauthorized'),department:'governance'}),403);
 });
 await assertCheck('Client Relations staff claims an unowned enquiry and managers perform audited handoff',async()=>{
  const q=(await call('/academic/quotes',withAuth(studentCookie,brief('academic-editing')),201)).data.quote;
  await call('/academic/quotes/'+q.id+'/claim',withAuth(studentCookie,{}),403);
  await call('/academic/quotes/'+q.id+'/claim',withAuth(specialistCookie,{}),403);
  const claimed=await call('/academic/quotes/'+q.id+'/claim',withAuth(staffCookie,{}));
  const staff=await db.collection('academic_accounts').findOne({email:staffMail});
  const manager=await db.collection('academic_accounts').findOne({email:managerMail});
  assert.equal(claimed.data.quote.assignedTo,staff.id);
  await call('/academic/quotes/'+q.id+'/claim',withAuth(managerCookie,{}),409);
  await call('/academic/quotes/'+q.id+'/messages',{cookie:staffCookie});
  await call('/academic/quotes/'+q.id+'/assign',withAuth(staffCookie,{
   assigneeId:manager.id,reason:'This enquiry requires Client Relations oversight.'}),403);
  const assigned=await call('/academic/quotes/'+q.id+'/assign',withAuth(managerCookie,{
   assigneeId:manager.id,reason:'Manager takes responsibility for revised academic scope.'}));
  assert.equal(assigned.data.quote.assignedTo,manager.id);
  await call('/academic/quotes/'+q.id+'/messages',{cookie:staffCookie},403);
  await call('/academic/quotes/'+q.id+'/files',{cookie:staffCookie},403);
  assert.ok(!(await call('/academic/quotes',{cookie:staffCookie})).data.quotes.some(x=>x.id===q.id));
  const student=await call('/academic/quotes',{cookie:studentCookie});
  const studentQuote=student.data.quotes.find(x=>x.id===q.id);
  assert.ok(studentQuote);
  assert.equal(Object.hasOwn(studentQuote,'ownershipHistory'),false);
  assert.equal(Object.hasOwn(studentQuote,'assignedBy'),false);
  await call('/academic/quotes/'+q.id+'/ownership',{cookie:studentCookie},403);
  const history=await call('/academic/quotes/'+q.id+'/ownership',{cookie:managerCookie});
  assert.equal(history.data.history.length,2);
  assert.equal(history.data.history[1].from,staff.id);
  assert.ok(await db.collection('academic_audit_events').findOne({
   action:'academic_enquiry_reassigned',ref:q.id}));
 });
 await assertCheck('Competing enquiry claims cannot silently assign two different employees',async()=>{
  const q=(await call('/academic/quotes',withAuth(studentCookie,brief('academic-editing')),201)).data.quote;
  const outcomes=await Promise.all([
   request('/academic/quotes/'+q.id+'/claim',withAuth(rootCookie,{})),
   request('/academic/quotes/'+q.id+'/claim',withAuth(staffCookie,{}))
  ]);
  assert.deepEqual(outcomes.map(x=>x.status).sort((a,b)=>a-b),[200,409]);
  const saved=await db.collection('academic_quotations').findOne({id:q.id});
  assert.equal(saved.ownershipHistory.length,1);
  assert.ok([vars.ROOT_EMAIL,(await db.collection('academic_accounts').findOne({email:staffMail})).id]
   .includes(saved.assignedTo));
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
 await assertCheck('Workspace quotation is private and never generates an unsolicited offer email',async()=>{
  const row=await db.collection('academic_quotations').findOne({id:quoteId});
  assert.equal(row.contactChannel,'workspace');
  assert.equal(row.status,'offered');
  assert.equal(await db.collection('academic_evaluation_mail').countDocuments({
   to:studentMail,subject:{$regex:'your reviewed quotation'}}),0);
  const student=await db.collection('academic_accounts').findOne({email:studentMail});
  assert.equal(await db.collection('academic_notification_deliveries').countDocuments({
   accountId:student.id,kind:'quotation'}),0);
 });
 await assertCheck('Explicit quotation email preference queues generic notices; private terms stay inside IPS',async()=>{
  const q=(await call('/academic/quotes',withAuth(studentCookie,{
   ...brief('academic-editing'),contactChannel:'email'}),201)).data.quote;
  assert.equal(q.contactChannel,'email');
  await call('/academic/quotes/'+q.id+'/scope',withAuth(rootCookie,{
   decision:'approved',note:'Academic scope is eligible for private editorial feedback.'}));
  await call('/academic/quotes/'+q.id+'/offer',withAuth(rootCookie,{
   priceMinor:32100,deliverables:'Highly confidential academic editing scope for this test.',
   terms:'Private fee agreement and subject details must never appear in an email notice.'}));
  const queue=db.collection('academic_notification_deliveries');
  const notices=await queue.find({to:studentMail,kind:'quotation'}).toArray();
  assert.equal(notices.length,1,'Offer must queue one generic notice for explicit email opt-in');
  assert.ok(notices[0].text.includes('secure workspace'));
  assert.ok(!notices[0].text.includes('321.00')&&!notices[0].text.includes('Highly confidential')&&
   !notices[0].text.includes('Private fee agreement'));
  assert.equal(await db.collection('academic_evaluation_mail').countDocuments({
   to:studentMail,subject:{$regex:'your reviewed quotation'}}),0);
  await call('/academic/quotes/'+q.id+'/messages',withAuth(rootCookie,{
   body:'A confidential private academic clarification is available in IPS only.',
   audience:'student'}),201);
  const messageNotices=await queue.find({to:studentMail,kind:'quote_message'}).toArray();
  assert.equal(messageNotices.length,1);
  assert.ok(!messageNotices[0].text.includes('academic clarification'));
 });
 await assertCheck('One-use Telegram bot linking verifies private chat ownership and safely queues private updates',async()=>{
  const student=await db.collection('academic_accounts').findOne({email:studentMail});
  const queue=db.collection('academic_notification_deliveries');
  const priorEmail=await queue.countDocuments({to:studentMail,kind:'quotation'});
  const unlinked=await call('/contact/telegram/status',{cookie:studentCookie});
  assert.equal(unlinked.data.available,true);assert.equal(unlinked.data.linked,false);
  await call('/profile',{method:'PATCH',cookie:studentCookie,body:{contactPreference:'telegram'}},409);
  await call('/academic/quotes',withAuth(studentCookie,{
   ...brief(),contactChannel:'telegram'}),409);
  await call('/academic/guest-quote',{method:'POST',body:{
   ...brief(),username:'GuestTgResearch'+random(),email:emailFor('guest-telegram'),
   contactChannel:'telegram',privacyConsent:true}},409);
  const link=await call('/contact/telegram/link',withAuth(studentCookie,{}));
  const startPayload=new URL(link.data.url).searchParams.get('start');
  assert.ok(/^ips_[A-Za-z0-9_-]{43}$/.test(startPayload));
  const update={update_id:21001,message:{
   text:'/start '+startPayload,chat:{id:487654321,type:'private'},
   from:{id:487654321,username:'PrivateAcademicTester'}}};
  const webhook=async (secret,payload)=>fetch(url+'/api/integrations/telegram/webhook',{
   method:'POST',headers:{'Content-Type':'application/json',
    'X-Telegram-Bot-Api-Secret-Token':secret},body:JSON.stringify(payload)});
  const unauthorized=await webhook('invalid-token',update);
  assert.equal(unauthorized.status,401);
  const mismatch=await webhook(vars.IPS_TELEGRAM_WEBHOOK_SECRET,{...update,message:{
   ...update.message,from:{id:999999999}}});
  assert.equal(mismatch.status,200);assert.equal((await mismatch.json()).linked,false);
  const accepted=await webhook(vars.IPS_TELEGRAM_WEBHOOK_SECRET,update);
  assert.equal(accepted.status,200);assert.equal((await accepted.json()).linked,true);
  const replay=await webhook(vars.IPS_TELEGRAM_WEBHOOK_SECRET,update);
  assert.equal(replay.status,200);assert.equal((await replay.json()).linked,false);
  assert.equal((await call('/contact/telegram/status',{cookie:studentCookie})).data.linked,true);
  const account=await db.collection('academic_accounts').findOne({id:student.id});
  assert.equal(account.telegramChatId,487654321);
  assert.equal(account.telegramConnectionStatus,'confirmed');
  assert.equal(account.telegramLinkHash,undefined);
  const confirmation=await db.collection('academic_evaluation_mail').findOne({
   to:'telegram:487654321',provider:'telegram-sandbox'});
  assert.ok(confirmation,'No synthetic Telegram bot confirmation was recorded');
  await call('/profile',{method:'PATCH',cookie:studentCookie,body:{contactPreference:'telegram'}});
  const q=(await call('/academic/quotes',withAuth(studentCookie,{
   ...brief('academic-editing'),contactChannel:'telegram'}),201)).data.quote;
  await call('/academic/quotes/'+q.id+'/scope',withAuth(rootCookie,{
   decision:'approved',note:'Legitimate academic guidance and editorial feedback approved.'}));
  await call('/academic/quotes/'+q.id+'/offer',withAuth(rootCookie,{
   priceMinor:19900,deliverables:'Permitted editorial guidance on student-owned academic work.',
   terms:'The reviewed academic scope and price are available only inside the private IPS workspace.'}));
  const outbound=await queue.findOne({accountId:student.id,channel:'telegram',kind:'quotation'});
  assert.ok(outbound,'A chosen verified Telegram channel must queue a real provider job');
  assert.equal(outbound.chatId,487654321);
  assert.ok(!outbound.text.includes('199.00')&&!outbound.text.includes('Permitted editorial'));
  assert.equal(await queue.countDocuments({to:studentMail,kind:'quotation'}),priorEmail,
   'Telegram choice must never silently switch to an email notice');
  let sent;
  for(let i=0;i<35;i++){
   sent=await queue.findOne({id:outbound.id});
   if(sent?.status==='synthetic_dispatched')break;
   await sleep(300);
  }
  assert.equal(sent?.status,'synthetic_dispatched',
   'Sandbox Telegram should be recorded as synthetic, never as a human receipt');
  assert.equal(sent?.provider,'telegram-sandbox');
  // Account-linked inbound Telegram text must be visible and replyable to authorized personnel.
  const incoming={update_id:21002,message:{message_id:773,chat:{id:487654321,type:'private'},
   from:{id:487654321,username:'PrivateAcademicTester'},
   text:'Hello IPS, I have a question about how to contact your team.'}};
  const incomingResult=await webhook(vars.IPS_TELEGRAM_WEBHOOK_SECRET,incoming);
  assert.equal(incomingResult.status,200);
  assert.equal((await incomingResult.json()).accepted,true);
  const repeated=await webhook(vars.IPS_TELEGRAM_WEBHOOK_SECRET,incoming);
  assert.equal((await repeated.json()).duplicate,true);
  assert.equal(await db.collection('academic_telegram_messages').countDocuments({
   accountId:student.id,direction:'inbound'}),1,'Telegram replay must not duplicate the message');
  await call('/communications/telegram/threads',{cookie:studentCookie},403);
  await call('/communications/telegram/threads',{cookie:managerCookie},403);
  const threads=await call('/communications/telegram/threads',{cookie:rootCookie});
  assert.ok(threads.data.threads.some(x=>x.accountId===student.id&&x.unread===1));
  const conversation=await call('/communications/telegram/threads/'+student.id,{cookie:rootCookie});
  assert.equal(conversation.data.messages.length,1);
  assert.ok(conversation.data.messages[0].body.includes('contact your team'));
  await call('/communications/telegram/threads/'+student.id+'/reply',
   withAuth(rootCookie,{body:'Confidential details belong inside your secure IPS workspace.'}),400);
  const reply=await call('/communications/telegram/threads/'+student.id+'/reply',
   withAuth(rootCookie,{body:'Please sign in to IPS to share the details securely.',
    privacyConfirmed:true}),202);
  assert.equal(reply.data.queued,true);
  const job=await db.collection('academic_notification_deliveries').findOne({
   telegramMessageId:reply.data.messageId});
  assert.equal(job.channel,'telegram');
  for(let i=0;i<35;i++){
   const status=await db.collection('academic_telegram_messages').findOne({id:reply.data.messageId});
   if(status?.status==='synthetic_dispatched')break;
   await sleep(300);
  }
  const sentReply=await db.collection('academic_telegram_messages').findOne({
   id:reply.data.messageId});
  assert.equal(sentReply.status,'synthetic_dispatched');
  await call('/communications/telegram/threads/'+student.id+'/read',withAuth(rootCookie,{}));
  const read=await db.collection('academic_telegram_messages').findOne({
   accountId:student.id,direction:'inbound'});
  assert.equal(read.read,true);
  const pendingId='IPS-TELEGRAM-REVOKE-'+random();
  await queue.insertOne({id:pendingId,accountId:student.id,chatId:487654321,
   channel:'telegram',kind:'telegram_revocation',
   text:'A generic IPS update.',status:'pending',attempts:0,
   nextAttemptAt:new Date(Date.now()+60000),createdAt:new Date()});
  await call('/contact/telegram/unlink',withAuth(studentCookie,{}));
  const cancelled=await queue.findOne({id:pendingId});
  assert.equal(cancelled.status,'cancelled',
   'Revoking a chat must cancel outstanding Telegram deliveries immediately');
  assert.equal((await call('/contact/telegram/status',{cookie:studentCookie})).data.linked,false);
  const after=await db.collection('academic_accounts').findOne({id:student.id});
  assert.equal(after.contactPreference,'workspace');
  assert.equal(after.telegramChatId,undefined);
  const afterRevocation=await webhook(vars.IPS_TELEGRAM_WEBHOOK_SECRET,{
   update_id:21003,message:{message_id:774,chat:{id:487654321,type:'private'},
    from:{id:487654321},text:'This unlinked chat must not be accepted.'}});
  assert.equal((await afterRevocation.json()).accepted,false);
  await call('/communications/telegram/threads/'+student.id+'/reply',
   withAuth(rootCookie,{body:'A reply after revocation must fail.',privacyConfirmed:true}),409);
  await call('/academic/quotes',withAuth(studentCookie,{
   ...brief(),contactChannel:'telegram'}),409);
 });
 await assertCheck('Signed Resend webhook tracks delivery, rejects forgeries/replays and escalates bounces',async()=>{
  const emailId='re-ips-academic-'+random(),jobId='OUT-RESEND-'+random();
  const queue=db.collection('academic_notification_deliveries');
  await queue.insertOne({id:jobId,provider:'resend',providerMessageId:emailId,
   status:'provider_accepted',kind:'academic_test_notification',
   accountId:'',to:emailFor('provider-proof'),attempts:0,createdAt:new Date()});
  const webhook=async(id,payload,opts={})=>{
   const stamp=opts.timestamp??Math.floor(Date.now()/1000);
   const raw=JSON.stringify(payload);
   const signature=crypto.createHmac('sha256',
    Buffer.from(vars.RESEND_WEBHOOK_SECRET.slice(6),'base64'))
    .update(id+'.'+stamp+'.'+raw).digest('base64');
   const response=await fetch(url+'/api/integrations/resend/webhook',{
    method:'POST',headers:{'Content-Type':'application/json',
     'svix-id':id,'svix-timestamp':String(stamp),
     'svix-signature':'v1,'+(opts.invalidSignature?'not-a-signature':signature)},
    body:raw});
   return {status:response.status,data:await response.json()};
  };
  const delivered={type:'email.delivered',data:{email_id:emailId}};
  assert.equal((await webhook('msg_bad-'+random(),delivered,{invalidSignature:true})).status,401);
  assert.equal((await webhook('msg_stale-'+random(),delivered,
   {timestamp:Math.floor(Date.now()/1000)-400})).status,401);
  const deliveredId='msg_delivered-'+random();
  const valid=await webhook(deliveredId,delivered);
  assert.equal(valid.status,200);assert.equal(valid.data.duplicate,false);
  assert.equal((await queue.findOne({id:jobId})).status,'delivered');
  const duplicate=await webhook(deliveredId,delivered);
  assert.equal(duplicate.status,200);assert.equal(duplicate.data.duplicate,true);
  assert.equal(await db.collection('academic_provider_delivery_events').countDocuments({id:deliveredId}),1);
  await webhook('msg_delayed-'+random(),{type:'email.delivery_delayed',data:{email_id:emailId}});
  assert.equal((await queue.findOne({id:jobId})).status,'delivered',
   'A delayed out-of-order event cannot erase provider delivery proof');
  await webhook('msg_bounce-'+random(),{type:'email.bounced',data:{email_id:emailId}});
  assert.equal((await queue.findOne({id:jobId})).status,'bounced');
  const incident=await db.collection('academic_notifications').findOne({
   kind:'communication_failure',ref:'resend:'+emailId});
  assert.ok(incident,'Permanent email failure must reach company management');
  const status=await call('/operations/delivery-status',{cookie:rootCookie});
  assert.ok(status.data.exceptions.some(x=>x.id===jobId&&x.status==='bounced'));
  await call('/operations/delivery/'+jobId+'/retry',withAuth(rootCookie,{}),409);
  await webhook('msg_complaint-'+random(),{type:'email.complained',data:{email_id:emailId}});
  assert.equal((await queue.findOne({id:jobId})).status,'complained');
 });
 await assertCheck('Verified guest receives queued generic offer notice without academic or financial content',async()=>{
  const guestEmail=emailFor('guest-quote');
  const q=(await call('/academic/guest-quote',{method:'POST',body:{
   ...brief('literature-reviews'),username:'GuestResearch'+random(),
   email:guestEmail,contactChannel:'email',privacyConsent:true}},202)).data.reference;
  const confirm=await inbox(guestEmail,'Confirm your confidential IPS Academic Services quotation request');
  await call('/academic/guest-confirm',{method:'POST',body:{
   email:guestEmail,reference:q,token:token(confirm,'guestconfirm')}});
  await call('/academic/quotes/'+q+'/scope',withAuth(rootCookie,{
   decision:'approved',note:'The proposed literature-search feedback is within legitimate services.'}));
  await call('/academic/quotes/'+q+'/offer',withAuth(rootCookie,{
   priceMinor:54000,deliverables:'Privately discussed research consultation and permitted reference verification.',
   terms:'Private academic service agreement and permitted scope acceptance in the secured workspace.'}));
  const items=await db.collection('academic_notification_deliveries').find({
   to:guestEmail,kind:'quotation'}).toArray();
  assert.equal(items.length,1);
  assert.equal(items[0].accountId,'');
  assert.ok(!items[0].text.includes('540.00')&&!items[0].text.includes('research consultation'));
 });
 await assertCheck('Clarification creates a complete Student-to-IPS review loop, not a dead-end',async()=>{
  const q=(await call('/academic/quotes',withAuth(studentCookie,brief('academic-editing')),201)).data.quote;
  const clarification=await call('/academic/quotes/'+q.id+'/scope',withAuth(rootCookie,{
   decision:'clarify',note:'We need the specific formatting style and the current student-authored draft.'}));
  assert.equal(clarification.data.quote.status,'clarify');
  await call('/academic/quotes/'+q.id+'/scope',withAuth(rootCookie,{
   decision:'approved',note:'No approval without Student clarification.'}),409);
  await call('/academic/quotes/'+q.id+'/resubmit',withAuth(rootCookie,{
   clarification:'Unauthorized approval of another Student account.'}),403);
  const revisedBrief='I need permitted academic proofreading and reference guidance for my existing student-authored manuscript.';
  const reply=await call('/academic/quotes/'+q.id+'/resubmit',withAuth(studentCookie,{
   clarification:'My faculty requires APA format, and I have provided my original author-owned draft.',
   requirements:revisedBrief}));
  assert.equal(reply.data.quote.status,'received');
  assert.equal(reply.data.quote.requirements,revisedBrief);
  assert.equal(reply.data.quote.scopeRevision,1);
  const messages=await call('/academic/quotes/'+q.id+'/messages',{cookie:studentCookie});
  assert.ok(messages.data.messages.some(x=>x.body.includes('faculty requires APA')));
  const approved=await call('/academic/quotes/'+q.id+'/scope',withAuth(rootCookie,{
   decision:'approved',note:'Student-authorized editing and citation checks are now clearly scoped.'}));
  assert.equal(approved.data.quote.status,'scoped');
  assert.ok(await db.collection('academic_audit_events').findOne({
   action:'academic_quotation_clarification_submitted',ref:q.id}));
 });
 await assertCheck('Revised written offers retain prior prices, scope, expiry and reason history',async()=>{
  const q=(await call('/academic/quotes',withAuth(studentCookie,brief('academic-editing')),201)).data.quote;
  await call('/academic/quotes/'+q.id+'/scope',withAuth(rootCookie,{
   decision:'approved',note:'Legitimate editorial support on student-authored academic materials.'}));
  const first=await call('/academic/quotes/'+q.id+'/offer',withAuth(rootCookie,{
   priceMinor:14000,deliverables:'Permitted English language editing with written feedback.',
   terms:'Student retains authorship. Initial editing service only; no fabricated references.'}));
  assert.equal(first.data.quote.offerVersion,1);
  assert.equal(first.data.quote.offerHistory.length,1);
  assert.ok(first.data.quote.expires>new Date().toISOString().slice(0,10));
  await call('/academic/quotes/'+q.id+'/revise-offer',withAuth(studentCookie,{
   priceMinor:22000,deliverables:'Client cannot revise a manager-issued price.',
   terms:'This access must be rejected and must not change the approved quotation.',
   reason:'Student has no finance authority.'}),403);
  const second=await call('/academic/quotes/'+q.id+'/revise-offer',withAuth(rootCookie,{
   priceMinor:22000,deliverables:'Additional annotated reference-format guidance on existing academic writing.',
   terms:'Author-owned editing and documented reference-format checks with two review rounds.',
   reason:'The verified faculty guidance requires additional reference review.'}));
  assert.equal(second.data.quote.offerVersion,2);
  assert.equal(second.data.quote.priceMinor,22000);
  assert.equal(second.data.quote.offerHistory.length,2);
  assert.equal(second.data.quote.offerHistory[0].priceMinor,14000);
  assert.equal(second.data.quote.offerHistory[1].priceMinor,22000);
  assert.equal(second.data.quote.offerHistory[1].note,'The verified faculty guidance requires additional reference review.');
  assert.ok(await db.collection('academic_audit_events').findOne({
   action:'academic_written_offer_revised',ref:q.id}));
 });
 await assertCheck('Expired quote cannot be accepted; worker expires it and a fresh offer reopens acceptance',async()=>{
  const q=(await call('/academic/quotes',withAuth(studentCookie,brief('academic-editing')),201)).data.quote;
  await call('/academic/quotes/'+q.id+'/scope',withAuth(rootCookie,{
   decision:'approved',note:'Permitted editorial guidance and verifiable research-reference checks.'}));
  await call('/academic/quotes/'+q.id+'/offer',withAuth(rootCookie,{
   priceMinor:19500,deliverables:'Permitted editorial feedback on student-authored work.',
   terms:'The recorded scope and fee expire on the stated UTC calendar date.'}));
  const yesterday=new Date(Date.now()-2*86400000).toISOString().slice(0,10);
  await db.collection('academic_quotations').updateOne({id:q.id},{$set:{expires:yesterday}});
  await call('/academic/quotes/'+q.id+'/decision',withAuth(studentCookie,{decision:'accept'}),409);
  let expired;
  for(let i=0;i<24;i++){
   expired=await db.collection('academic_quotations').findOne({id:q.id});
   if(expired?.status==='expired')break;
   await sleep(400);
  }
  assert.equal(expired?.status,'expired','Automatic expiry worker must update the actual MongoDB quotation');
  const reopened=await call('/academic/quotes/'+q.id+'/revise-offer',withAuth(rootCookie,{
   priceMinor:20500,deliverables:'A refreshed and appropriately reviewed academic editing service.',
   terms:'Updated expiry, unchanged student authorship and truthful consultant responsibilities.',
   reason:'Original quotation expired before the Student gave a decision.'}));
  assert.equal(reopened.data.quote.status,'offered');
  assert.equal(reopened.data.quote.offerVersion,2);
  const accepted=await call('/academic/quotes/'+q.id+'/decision',withAuth(studentCookie,{decision:'accept'}));
  assert.equal(accepted.data.commission.paymentStatus,'not_collected');
  const saved=await db.collection('academic_quotations').findOne({id:q.id});
  assert.equal(saved.acceptedOfferVersion,2);
 });
 await assertCheck('Approaching quote expiry creates exactly one timely private reminder',async()=>{
  const q=(await call('/academic/quotes',withAuth(studentCookie,brief('academic-editing')),201)).data.quote;
  await call('/academic/quotes/'+q.id+'/scope',withAuth(rootCookie,{
   decision:'approved',note:'Legitimate academic methodology consultation is permitted.'}));
  const soon=new Date(Date.now()+86400000).toISOString().slice(0,10);
  await call('/academic/quotes/'+q.id+'/offer',withAuth(rootCookie,{
   priceMinor:12000,deliverables:'Consultative written academic language feedback only.',
   terms:'Appropriate student-owned support with no academic ghostwriting or invented findings.',
   expires:soon}));
  let marked;
  for(let i=0;i<24;i++){
   marked=await db.collection('academic_quotations').findOne({id:q.id});
   if(marked?.reminderSentAt)break;
   await sleep(400);
  }
  assert.ok(marked?.reminderSentAt,'Expiry reminder should be automatically scheduled');
  const one=await db.collection('academic_notifications').countDocuments({
   accountId:marked.studentId,kind:'quotation_expiry_reminder',
   message:{$regex:q.id}});
  assert.equal(one,1,'Exactly one private reminder is generated for the expiring quotation');
  await sleep(1500);
  assert.equal(await db.collection('academic_notifications').countDocuments({
   accountId:marked.studentId,kind:'quotation_expiry_reminder',
   message:{$regex:q.id}}),one);
 });
 await assertCheck('Student accepts actual reviewed quotation; production payment remains blocked',async()=>{
  const r=await call('/academic/quotes/'+quoteId+'/decision',withAuth(studentCookie,{decision:'accept'}));
  commissionId=r.data.commission.id;assert.equal(r.data.commission.status,'awaiting_payment_integration');
  assert.equal(r.data.commission.paymentStatus,'not_collected');
  const specialist=(await db.collection('academic_accounts').findOne({email:specialistMail}));
  await call('/academic/commissions/'+commissionId+'/assign',withAuth(rootCookie,{specialistId:specialist.id}),409);
 });
 await assertCheck('Accepted academic quotation produces truthful non-payable billing and private access',async()=>{
  const student=await call('/finance/my-billing',{cookie:studentCookie});
  const bill=student.data.records.find(x=>x.commissionId===commissionId);
  assert.ok(bill,'A quotation was accepted but no billing preparation was recorded');
  assert.equal(bill.state,'payment_provider_pending');
  assert.equal(bill.paymentStatus,'not_collected');
  assert.equal(bill.receiptIssued,false);
  assert.equal(bill.invoiceNumber,null);
  assert.equal(student.data.paymentsEnabled,false);
  await call('/finance/my-billing',{cookie:rootCookie},403);
  await call('/finance/overview',{cookie:studentCookie},403);
  await call('/finance/overview',{cookie:managerCookie},403);
  const summary=await call('/finance/overview',{cookie:rootCookie});
  assert.ok(summary.data.billing.some(x=>x.commissionId===commissionId));
  assert.equal(summary.data.totals.issuedReceipts,0);
  assert.equal(summary.data.totals.collectedAmountMinor,0);
  assert.equal(await db.collection('academic_billing_records').countDocuments({
   commissionId}),1,'Each accepted commission must have one billing preparation');
 });
 await assertCheck('Student billing concerns are governed without fictitious refunds',async()=>{
  await call('/finance/disputes',withAuth(rootCookie,{commissionId,reason:'Not the student'}),403);
  const created=await call('/finance/disputes',withAuth(studentCookie,{
   commissionId,reason:'Please clarify whether the accepted quote can be revised before payments become available.'}),201);
  const disputeId=created.data.dispute.id;
  const studentDisputes=await call('/finance/disputes',{cookie:studentCookie});
  assert.ok(studentDisputes.data.disputes.some(d=>d.id===disputeId));
  await call('/finance/disputes/'+disputeId+'/review',withAuth(studentCookie,{
   decision:'resolved_without_settlement',note:'Student should not approve own finance resolution.'}),403);
  const reviewed=await call('/finance/disputes/'+disputeId+'/review',withAuth(rootCookie,{
   decision:'resolved_without_settlement',
   note:'IPS has clarified the quote in writing. No payment or refund has occurred.'}));
  assert.equal(reviewed.data.refundsEnabled,false);
  assert.equal(reviewed.data.dispute.status,'resolved_without_settlement');
 });
 await assertCheck('Only isolated test mode permits a declared synthetic financial witness',async()=>{
  const r=await call('/evaluation/confirm-synthetic-payment/'+commissionId,withAuth(rootCookie,{}));
  assert.equal(r.data.synthetic,true);assert.equal(r.data.commission.paymentStatus,'synthetic_test_only');
  assert.equal(r.data.commission.milestones.find(m=>m.name==='Commission/payment verification')?.status,'synthetic_test_only');
  const specialist=await db.collection('academic_accounts').findOne({email:specialistMail});
  const initially=await call('/specialist/availability',{cookie:specialistCookie});
  assert.equal(initially.data.availabilityStatus,'unavailable');
  await call('/academic/commissions/'+commissionId+'/assign',withAuth(rootCookie,{specialistId:specialist.id}),409);
  await call('/specialist/availability',{method:'PATCH',cookie:specialistCookie,body:{
   availabilityStatus:'available',maxConcurrentCases:1,turnaroundDays:5}});
  const a=await call('/academic/commissions/'+commissionId+'/assign',withAuth(rootCookie,{specialistId:specialist.id}));
  assert.equal(a.data.commission.status,'specialist_assigned');
  await call('/academic/commissions/'+commissionId+'/assign',withAuth(staffCookie,{specialistId:specialist.id}),403);
 });
 await assertCheck('Specialist work logs, fee consent and Finance authority are end-to-end but unpaid',async()=>{
  const payload={commissionId,minutes:85,workDate:'2026-11-20',
   summary:'Academic nursing manuscript corrections and literature source verification as agreed in the approved editorial brief.',
   requestId:'IPS-FIN-'+random()};
  await call('/finance/work-logs',{method:'POST',cookie:studentCookie,body:payload},403);
  const created=await call('/finance/work-logs',withAuth(specialistCookie,payload),201);
  const logId=created.data.log.id;
  const repeated=await call('/finance/work-logs',withAuth(specialistCookie,payload));
  assert.equal(repeated.data.duplicate,true);
  assert.equal(await db.collection('academic_specialist_work_logs').countDocuments({
   specialistId:(await db.collection('academic_accounts').findOne({email:specialistMail})).id,
   requestId:payload.requestId}),1);
  const own=await call('/finance/work-logs',{cookie:specialistCookie});
  assert.ok(own.data.logs.some(w=>w.id===logId));
  await call('/finance/work-logs',{cookie:studentCookie},403);
  await call('/finance/work-logs/'+logId+'/decision',withAuth(managerCookie,{
   decision:'approve',note:'A Client Relations manager cannot approve Finance time records.'}),403);
  const reviewed=await call('/finance/work-logs/'+logId+'/decision',withAuth(rootCookie,{
   decision:'approve',note:'Confirmed the assigned academic editing and actual time stated.'}));
  assert.equal(reviewed.data.log.status,'approved');
  assert.equal(reviewed.data.payoutExecuted,false);
  await call('/finance/work-logs/'+logId+'/decision',withAuth(rootCookie,{
   decision:'approve',note:'This decision cannot be repeated.'}),409);
  const p=await db.collection('academic_commissions').findOne({id:commissionId});
  await call('/finance/compensation/'+commissionId+'/propose',withAuth(rootCookie,{
   feeMinor:p.priceMinor+1,reason:'Over-pricing must be rejected.'}),400);
  const proposed=await call('/finance/compensation/'+commissionId+'/propose',
   withAuth(rootCookie,{feeMinor:Math.max(1,Math.floor(p.priceMinor/2)),
    reason:'Proposed agreed specialist fee for the documented approved academic editing work.'}));
  assert.equal(proposed.data.proposal.status,'proposed');
  const visible=await call('/finance/compensation/'+commissionId,{cookie:specialistCookie});
  assert.equal(visible.data.proposal.status,'proposed');
  await call('/finance/compensation/'+commissionId+'/respond',withAuth(studentCookie,{
   decision:'accept'}),403);
  const responded=await call('/finance/compensation/'+commissionId+'/respond',
   withAuth(specialistCookie,{decision:'accept'}));
  assert.equal(responded.data.proposal.status,'accepted');
  assert.equal(responded.data.payoutExecuted,false);
  await call('/finance/compensation/'+commissionId+'/propose',
   withAuth(rootCookie,{feeMinor:100,reason:'Attempt to overwrite agreed specialist terms.'}),409);
  const overview=await call('/finance/overview',{cookie:rootCookie});
  assert.equal(overview.data.totals.executedPayoutMinor,0);
  assert.ok(overview.data.workLogs.some(x=>x.id===logId&&x.status==='approved'));
 });
 let secondCommissionId;
 await assertCheck('A fully booked Specialist cannot be assigned a second academic case',async()=>{
  const specialist=await db.collection('academic_accounts').findOne({email:specialistMail});
  const q=(await call('/academic/quotes',withAuth(studentCookie,brief('academic-editing')),201)).data.quote;
  await call('/academic/quotes/'+q.id+'/scope',withAuth(rootCookie,{
   decision:'approved',note:'Permitted editing of independently authored academic content.'}));
  await call('/academic/quotes/'+q.id+'/offer',withAuth(rootCookie,{
   priceMinor:21000,deliverables:'Editorial notes and verified citations for a student-owned manuscript.',
   terms:'Academic editing is limited to student-authored materials and requires independent review.'}));
  const r=await call('/academic/quotes/'+q.id+'/decision',withAuth(studentCookie,{decision:'accept'}));
  secondCommissionId=r.data.commission.id;
  await call('/evaluation/confirm-synthetic-payment/'+secondCommissionId,withAuth(rootCookie,{}));
  await call('/academic/commissions/'+secondCommissionId+'/assign',
   withAuth(rootCookie,{specialistId:specialist.id}),409);
  const listing=await call('/operations/available-specialists?service=academic-editing',{cookie:rootCookie});
  assert.ok(!listing.data.specialists.some(x=>x.id===specialist.id));
  assert.equal((await db.collection('academic_accounts').findOne({id:specialist.id})).activeAssignments,1);
  await call('/specialist/availability',{method:'PATCH',cookie:specialistCookie,body:{
   availabilityStatus:'limited',maxConcurrentCases:0,turnaroundDays:5}},400);
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
  const corrected=await upload('Corrected nursing academic editing notes: citations are consistent and methodological limitations are clearly marked.');
  const approved=await call('/academic/commissions/'+commissionId+'/quality',withAuth(rootCookie,{
   decision:'approve',note:'Second editorial review confirmed consistency and correct ownership boundaries.'}));
  assert.equal(approved.data.commission.status,'client_delivery');
  const rejected=await fetch(url+'/api/academic/files/'+academicFileId,{headers:{Cookie:studentCookie}});
  assert.equal(rejected.status,403,'Student must never download the QA-rejected academic draft');
  const released=await fetch(url+'/api/academic/files/'+corrected.data.submissionId,{headers:{Cookie:studentCookie}});
  assert.equal(released.status,200);assert.ok((await released.text()).startsWith('Corrected nursing'));
 });
 await assertCheck('Student requests revision; Specialist returns final file; Root QA approves; student accepts',async()=>{
  await call('/academic/commissions/'+commissionId+'/student-decision',withAuth(studentCookie,{
   decision:'request_revision',note:'Please clarify the editorial explanation of qualitative sampling limitations.'}));
  const doc=await upload('Final corrected academic editing feedback: nursing literature citations checked and qualitative sampling limitations explained.');
  await call('/academic/commissions/'+commissionId+'/quality',withAuth(rootCookie,{decision:'approve',
   note:'IPS independent academic QA confirms corrected feedback and appropriate client release.'}));
  const final=await call('/academic/commissions/'+commissionId+'/student-decision',withAuth(studentCookie,{decision:'accept'}));
  assert.equal(final.data.commission.status,'completed');
  const finalFiles=await call('/academic/commissions/'+commissionId+'/files',{cookie:studentCookie});
  assert.equal(finalFiles.data.files.length,1,'Student received non-approved Specialist drafts');
  assert.equal(finalFiles.data.files[0].id,doc.data.submissionId);
  const rejectedDraft=await call('/academic/files/'+academicFileId,{cookie:studentCookie},403);
  assert.ok(rejectedDraft);
  assert.ok(await db.collection('academic_private_files').countDocuments({commissionId})>=3,
   'Academic correction versions should be retained for IPS governance');
  const stages=Object.fromEntries(final.data.commission.milestones.map(m=>[m.name,m.status]));
  assert.equal(stages['Commission/payment verification'],'synthetic_test_only');
  assert.equal(stages['Specialist assignment'],'complete');
  assert.equal(stages['Academic quality assurance'],'complete');
  assert.equal(stages['Secure final delivery'],'complete');
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
   username:'SecondScholar'+random(),password:'OtherAcademic2026!',confirmPassword:'OtherAcademic2026!',privacyConsent:true}},202);
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
 await assertCheck('Completing a case releases the reserved slot for another real commission',async()=>{
  const specialist=await db.collection('academic_accounts').findOne({email:specialistMail});
  assert.equal(specialist.activeAssignments,0);
  const choices=await call('/operations/available-specialists?service=academic-editing',{cookie:rootCookie});
  const free=choices.data.specialists.find(x=>x.id===specialist.id);
  assert.equal(free.availableSlots,1);
  const assigned=await call('/academic/commissions/'+secondCommissionId+'/assign',
   withAuth(rootCookie,{specialistId:specialist.id}));
  assert.equal(assigned.data.commission.status,'specialist_assigned');
  assert.equal((await db.collection('academic_accounts').findOne({id:specialist.id})).activeAssignments,1);
  await call('/specialist/availability',{method:'PATCH',cookie:specialistCookie,body:{
   availabilityStatus:'unavailable',maxConcurrentCases:0,turnaroundDays:0}});
  const hidden=await call('/operations/available-specialists?service=academic-editing',{cookie:rootCookie});
  assert.ok(!hidden.data.specialists.some(x=>x.id===specialist.id));
 });
 await assertCheck('Authorized staff email account recovery; old student session gets revoked',async()=>{
  const user=await db.collection('academic_accounts').findOne({email:studentMail});
  await call('/administration/people/'+user.id+'/send-recovery',withAuth(staffCookie,{}),202);
  const link=token(await inbox(studentMail,'Your private IPS password recovery'),'recover');
  const r=await call('/auth/recovery/complete',{method:'POST',body:{email:studentMail,token:link,password:'RecoveredAcademic2027!',confirmPassword:'RecoveredAcademic2027!'}});
  await call('/session',{cookie:studentCookie},401);
  await call('/auth/recovery/complete',{method:'POST',body:{email:studentMail,token:link,password:'AnotherAcademic2027!',confirmPassword:'AnotherAcademic2027!'}},400);
  studentCookie=r.cookie;
 });
 await assertCheck('Root opens working Student and Specialist workspaces without swapping accounts or forging identity',async()=>{
  const student=await db.collection('academic_accounts').findOne({email:studentMail});
  const specialist=await db.collection('academic_accounts').findOne({email:specialistMail});
  await db.collection('academic_accounts').updateMany({id:{$in:[student.id,specialist.id]}},{$set:{synthetic:true}});
  const studentLens=await call('/academic/dashboard',{cookie:rootCookie,rootTarget:student.id});
  assert.equal(studentLens.data.account.role,'student');assert.equal(studentLens.data.account.id,student.id);
  const specialistLens=await call('/academic/commissions',{cookie:rootCookie,rootTarget:specialist.id});
  assert.ok(specialistLens.data.commissions.some(p=>p.id===commissionId));
  await call('/academic/dashboard',{cookie:otherCookie,rootTarget:student.id},403);
  await call('/profile',{method:'PATCH',cookie:rootCookie,rootTarget:student.id,body:{contactPreference:'telegram',telegram:'fakehandle'}},403);
  const rootQuote=await call('/academic/quotes',{method:'POST',cookie:rootCookie,rootTarget:student.id,body:brief('research-methods')},201);
  assert.equal(rootQuote.data.quote.studentId,student.id);
  assert.equal(rootQuote.data.quote.rootAssistedBy,vars.ROOT_EMAIL);
  const assistedMessage=await call('/academic/commissions/'+commissionId+'/messages',{method:'POST',
   cookie:rootCookie,rootTarget:specialist.id,body:{body:'IPS Root is coordinating the academic revision in this workspace.',audience:'student'}},201);
  assert.equal(assistedMessage.data.message.actorRole,'root');
  assert.equal(assistedMessage.data.message.actorId,vars.ROOT_EMAIL);
  assert.equal(assistedMessage.data.message.assistedAccountId,specialist.id);
  const rootSession=await call('/session',{cookie:rootCookie});
  assert.equal(rootSession.data.account.role,'root');
  const auditEvent=await db.collection('academic_audit_events').findOne({action:'academic_quote_created',ref:rootQuote.data.quote.id});
  assert.equal(auditEvent.actorRole,'root');
  assert.equal(auditEvent.details.selectedRole,'student');
 });
 await assertCheck('Students and Root exchange real written academic enquiry messages before payment',async()=>{
  const q=await db.collection('academic_quotations').findOne({rootAssistedBy:vars.ROOT_EMAIL,studentId:{$exists:true}});
  assert.ok(q?.id);
  await call('/academic/quotes/'+q.id+'/messages',{method:'POST',cookie:studentCookie,body:{
   body:'Please explain the distinction between editing and legitimate research-methodology guidance.'}},201);
  const r=await call('/academic/quotes/'+q.id+'/messages',withAuth(rootCookie,{
   body:'IPS confirms a scope review is required before an academic quotation can be issued.',
   audience:'student'}),201);
  assert.equal(r.data.message.actorRole,'root');
  const view=await call('/academic/quotes/'+q.id+'/messages',{cookie:studentCookie});
  assert.equal(view.data.messages.length,2);
  await call('/academic/quotes/'+q.id+'/messages',{cookie:otherCookie},403);
 });
 await assertCheck('Student and Root upload and download genuine academic enquiry attachments before paid commissioning',async()=>{
  const student=await db.collection('academic_accounts').findOne({email:studentMail});
  const q=await db.collection('academic_quotations').findOne({studentId:student.id,status:{$in:['received','scoped','offered']}});
  assert.ok(q?.id,'A pre-commission academic enquiry must exist');
  const source=Buffer.from('Student-owned nursing research guidance and approved supervisor comments for academic scope review.');
  const shared=await call('/academic/quotes/'+q.id+'/files',withAuth(studentCookie,{
   filename:'research-brief.txt',mime:'text/plain',data:source.toString('base64')}),201);
  assert.equal(shared.data.file.audience,'student');
  const quoteFiles=await call('/academic/quotes/'+q.id+'/files',{cookie:studentCookie});
  assert.ok(quoteFiles.data.files.some(f=>f.id===shared.data.file.id));
  const raw=await fetch(url+'/api/academic/quote-files/'+shared.data.file.id,{headers:{Cookie:studentCookie}});
  assert.equal(raw.status,200);
  assert.equal(Buffer.from(await raw.arrayBuffer()).toString(),source.toString());
  const internal=await call('/academic/quotes/'+q.id+'/files',withAuth(rootCookie,{
   filename:'internal-review.txt',mime:'text/plain',
   data:Buffer.from('Internal IPS pre-commission academic integrity review notes.').toString('base64'),
   audience:'internal'}),201);
  assert.equal(internal.data.file.audience,'internal');
  const studentView=await call('/academic/quotes/'+q.id+'/files',{cookie:studentCookie});
  assert.ok(!studentView.data.files.some(f=>f.id===internal.data.file.id));
  const staffView=await call('/academic/quotes/'+q.id+'/files',{cookie:rootCookie});
  assert.ok(staffView.data.files.some(f=>f.id===internal.data.file.id));
  await call('/academic/quote-files/'+internal.data.file.id,{cookie:studentCookie},403);
  await call('/academic/quotes/'+q.id+'/files',{cookie:otherCookie},403);
  assert.ok(await db.collection('academic_audit_events').findOne({action:'academic_enquiry_document_uploaded',ref:q.id}));
 });
 await assertCheck('Root sends any verified Student a direct message and a private downloadable document; Student replies',async()=>{
  const student=await db.collection('academic_accounts').findOne({email:studentMail});
  const msg=await call('/operations/direct-message',withAuth(rootCookie,{recipientId:student.id,
   body:'IPS is coordinating your nursing academic support. Please check the approved document.'}),201);
  assert.equal(msg.data.message.fromRole,'root');
  const inbox=await call('/operations/direct-message',{cookie:studentCookie});
  assert.ok(inbox.data.messages.some(m=>m.id===msg.data.message.id));
  const r=await call('/operations/direct-message/'+msg.data.message.id+'/reply',
   withAuth(studentCookie,{body:'Thank you. I have read the IPS academic note.'}),201);
  assert.equal(r.data.message.toId,vars.ROOT_EMAIL);
  const contents=Buffer.from('Student-private nursing research reference guidance from IPS Root. The file is for this verified Student only.');
  const doc=await call('/operations/direct-message/file',withAuth(rootCookie,{
   recipientId:student.id,filename:'private-academic-note.txt',mime:'text/plain',data:contents.toString('base64')}),201);
  const raw=await fetch(url+'/api/operations/direct-file/'+doc.data.file.id,{headers:{Cookie:studentCookie}});
  assert.equal(raw.status,200);assert.equal(Buffer.from(await raw.arrayBuffer()).toString(),contents.toString());
  await call('/operations/direct-file/'+doc.data.file.id,{cookie:otherCookie},403);
  assert.equal(await db.collection('academic_notification_deliveries').countDocuments({
   accountId:student.id,kind:'direct_message'}),0,
   'Workspace-only direct messages must not queue unsolicited email; unrelated explicitly opted-in quotation notices are legitimate');
 });
 await assertCheck('Root takes over a real academic job and privately outsources without exposing provider details',async()=>{
  const q=(await call('/academic/quotes',withAuth(studentCookie,brief('academic-editing')),201)).data.quote;
  await call('/academic/quotes/'+q.id+'/scope',withAuth(rootCookie,
   {decision:'approved',note:'Student-authored nursing research editing feedback remains permitted.'}));
  await call('/academic/quotes/'+q.id+'/offer',withAuth(rootCookie,{
   priceMinor:17000,deliverables:'Editorial review on existing student-authored nursing research.',
   terms:'No ghostwriting. One editorial review and one revision allowed for the fictional IPS case.'}));
  const dec=await call('/academic/quotes/'+q.id+'/decision',withAuth(studentCookie,{decision:'accept'}));
  const job=dec.data.commission;
  await call('/operations/'+job.id+'/takeover',withAuth(rootCookie,{reason:'Unavailable Specialist; Root needs to source this approved academic review.'}),409);
  await call('/evaluation/confirm-synthetic-payment/'+job.id,withAuth(rootCookie,{}));
  const assigned=await call('/operations/'+job.id+'/takeover',withAuth(rootCookie,{
   reason:'No approved Specialist available for this subject, Root assumes academic delivery.'}));
  assert.equal(assigned.data.commission.status,'root_in_progress');
  assert.equal(assigned.data.commission.milestones.find(x=>x.name==='Specialist assignment')?.status,'complete',
   'Root work allocation must not remain incorrectly pending');
  await call('/operations/'+job.id+'/outsourcing',withAuth(rootCookie,{
   provider:'Private offline research editor reference, known only to Nyoro',
   instructions:'Root arranges independent academic editing assistance manually and takes responsibility for review.'}));
  const privateInfo=await call('/operations/'+job.id+'/outsourcing',{cookie:rootCookie});
  assert.ok(privateInfo.data.privateFulfilment.providerReference.includes('Private offline'));
  await call('/operations/'+job.id+'/outsourcing',{cookie:studentCookie},403);
  const ref=await call('/operations/'+job.id+'/upload',withAuth(studentCookie,{
   filename:'student-reference.txt',mime:'text/plain',purpose:'reference',
   data:Buffer.from('An independently written nursing literature-review draft reference, owned by the Student.').toString('base64')}),201);
  const before=await call('/operations/'+job.id+'/files',{cookie:studentCookie});
  assert.ok(before.data.files.some(x=>x.id===ref.data.file.id));
  const submitted=await call('/operations/'+job.id+'/upload',withAuth(rootCookie,{
   filename:'reviewed-feedback.txt',mime:'text/plain',purpose:'deliverable',
   data:Buffer.from('Academic editing feedback on independent nursing research text: correct citation structure and clarify methodology limitations.').toString('base64')}),201);
  assert.equal(submitted.data.needsQa,true);
  const preApproved=await call('/operations/'+job.id+'/files',{cookie:studentCookie});
  assert.equal(preApproved.data.files.length,1,'Student cannot see Root draft prior to independent QA');
  const rootQa=await call('/academic/commissions/'+job.id+'/quality',withAuth(rootCookie,{
   decision:'approve',note:'Root has reviewed the internally sourced editing feedback for academic integrity and final delivery.'}));
  assert.equal(rootQa.data.commission.qaMode,'root_supervised_exception',
   'Nyoro emergency release of its own delivery must never be falsely labeled independent QA');
  const released=await call('/operations/'+job.id+'/files',{cookie:studentCookie});
  assert.equal(released.data.files.length,2);
  assert.ok(released.data.files.some(x=>x.id===submitted.data.file.id));
  const raw=await fetch(url+'/api/academic/files/'+submitted.data.file.id,{headers:{Cookie:studentCookie}});
  assert.equal(raw.status,200);
  assert.equal(raw.headers.get('x-content-sha256'),submitted.data.file.sha256);
  await call('/academic/commissions/'+job.id,{cookie:specialistCookie},403);
  await call('/operations/'+job.id+'/files',{cookie:otherCookie},403);
  assert.ok(await db.collection('academic_audit_events').findOne({action:'root_academic_job_takeover',ref:job.id}));
  assert.ok(await db.collection('academic_audit_events').findOne({action:'root_private_external_fulfilment_recorded',ref:job.id}));
 });
 await assertCheck('Nyoro authorizes private supplier safeguards and alone accesses the checksummed vault',async()=>{
  const q=(await call('/academic/quotes',withAuth(studentCookie,brief('academic-editing')),201)).data.quote;
  await call('/academic/quotes/'+q.id+'/scope',withAuth(rootCookie,{
   decision:'approved',note:'Only legitimate student-authored editorial assistance is permitted.'}));
  await call('/academic/quotes/'+q.id+'/offer',withAuth(rootCookie,{
   priceMinor:29000,deliverables:'Independent professional written commentary on author-owned academic material.',
   terms:'Academic integrity, confidential document handling and an accountable Root review are mandatory.'}));
  const accepted=await call('/academic/quotes/'+q.id+'/decision',withAuth(studentCookie,{decision:'accept'}));
  const jobId=accepted.data.commission.id;
  await call('/evaluation/confirm-synthetic-payment/'+jobId,withAuth(rootCookie,{}));
  await call('/operations/'+jobId+'/takeover',withAuth(rootCookie,{
   reason:'Root must coordinate a permitted private academic editorial consultation.'}));
  await call('/operations/'+jobId+'/outsourcing',withAuth(rootCookie,{
   provider:'Private Research Editorial Supplier 2026 - Root eyes only',
   instructions:'Provide lawful source verification and editorial feedback; never invent research or author contributions.'}));
  const returned=Buffer.from('Independent editorial check: adjust the citation format and explain the factual limitations in student-authored nursing research.');
  const supplier={filename:'private-supplier-return.txt',mime:'text/plain',
   data:returned.toString('base64'),kind:'supplier_return'};
  await call('/operations/'+jobId+'/external-files',withAuth(rootCookie,supplier),409);
  await call('/operations/'+jobId+'/outsourcing/authorize',withAuth(rootCookie,{
   agreementReference:'Signed confidential NDA dated 2026-11-21, synthetic evaluation only',
   clientDisclosureReference:'Documented fictional student privacy and permitted subcontracting policy',
   confidentialityChecked:true,academicIntegrityChecked:true,minimumNecessaryDataOnly:true}));
  await call('/operations/'+jobId+'/outsourcing/authorize',withAuth(studentCookie,{
   agreementReference:'Not authorized',clientDisclosureReference:'Not authorized',
   confidentialityChecked:true,academicIntegrityChecked:true,minimumNecessaryDataOnly:true}),403);
  const saved=await call('/operations/'+jobId+'/external-files',withAuth(rootCookie,supplier),201);
  const file=saved.data.file;
  assert.equal(file.sha256,crypto.createHash('sha256').update(returned).digest('hex'));
  await call('/operations/'+jobId+'/external-files',{cookie:studentCookie},403);
  await call('/operations/'+jobId+'/external-files',{cookie:managerCookie},403);
  await call('/operations/external-files/'+file.id,{cookie:studentCookie},403);
  const download=await fetch(url+'/api/operations/external-files/'+file.id,{headers:{Cookie:rootCookie}});
  assert.equal(download.status,200);
  assert.equal(Buffer.from(await download.arrayBuffer()).toString(),returned.toString());
  assert.equal(download.headers.get('x-content-sha256'),file.sha256);
  const publicCase=await call('/academic/commissions/'+jobId,{cookie:studentCookie});
  assert.ok(!JSON.stringify(publicCase.data).includes('Private Research Editorial Supplier'));
  const normalFiles=await call('/operations/'+jobId+'/files',{cookie:studentCookie});
  assert.ok(!normalFiles.data.files.some(f=>f.id===file.id));
  const rootOnly=await call('/operations/'+jobId+'/external-files',{cookie:rootCookie});
  assert.equal(rootOnly.data.files.length,1);
  assert.ok(await db.collection('academic_audit_events').findOne({
   action:'root_private_supplier_file_downloaded',ref:jobId}));
  const qa=await call('/operations/'+jobId+'/external-files/'+file.id+'/submit-qa',
   withAuth(rootCookie,{}));
  assert.equal(qa.data.releaseMode,'root_supervised_exception');
  assert.equal(qa.data.sha256,file.sha256);
  await call('/operations/'+jobId+'/external-files/'+file.id+'/submit-qa',
   withAuth(rootCookie,{}),409);
  const caseAfter=await db.collection('academic_commissions').findOne({id:jobId});
  assert.equal(caseAfter.status,'qa_pending');
  assert.equal(caseAfter.qaMode,'root_supervised_exception');
  const pending=await call('/operations/'+jobId+'/files',{cookie:studentCookie});
  assert.ok(!pending.data.files.some(f=>f.id===qa.data.fileId));
  const qaDone=await call('/academic/commissions/'+jobId+'/quality',withAuth(rootCookie,{
   decision:'approve',note:'Root-supervised exceptional QA confirms the sourced editing is lawful and accurately attributed.'}));
  assert.equal(qaDone.data.commission.qaMode,'root_supervised_exception');
  const accessible=await call('/operations/'+jobId+'/files',{cookie:studentCookie});
  assert.ok(accessible.data.files.some(f=>f.id===qa.data.fileId));
  assert.ok(!JSON.stringify(accessible.data).includes('Private Research Editorial Supplier'));
  const rootProof=await db.collection('academic_root_external_files').findOne({id:file.id});
  assert.equal(rootProof.status,'sent_to_qa');
  assert.equal(rootProof.qaFileId,qa.data.fileId);
  assert.ok(await db.collection('academic_audit_events').findOne({
   action:'root_supplier_return_accepted_for_qa',ref:jobId}));
 });
 await assertCheck('Verified pending Specialist recovers immediately without manager or Root action',async()=>{
  const pendingEmail=emailFor('pending-specialist');
  pendingSpecialistMail=pendingEmail;
  await call('/auth/register',{method:'POST',body:{role:'specialist',email:pendingEmail,
   fullName:'Evaluation Pending Academic Specialist',password:'PendingAcademic2026!',
   confirmPassword:'PendingAcademic2026!',qualification:'BSc Research',expertise:['academic-editing'],
   privacyConsent:true,specialistAgreementVersion:SPECIALIST_AGREEMENT.version,
   specialistAgreementAccepted:true,specialistSignature:'Evaluation Pending Academic Specialist'}},202);
  const verification=token(await inbox(pendingEmail,'Confirm your IPS Academic Services email'),'verify');
  await call('/auth/verify',{method:'POST',body:{email:pendingEmail,token:verification}});
  const request=await call('/auth/recovery/request',{method:'POST',body:{email:pendingEmail}},202);
  assert.equal(request.data.accepted,true);
  const recovery=token(await inbox(pendingEmail,'Your private IPS password recovery'),'recover');
  const completed=await call('/auth/recovery/complete',{method:'POST',body:{
   email:pendingEmail,token:recovery,password:'RecoveredPending2026!',confirmPassword:'RecoveredPending2026!'}});
  assert.equal(completed.data.reviewRequired,true);
  await call('/auth/login',{method:'POST',body:{email:pendingEmail,password:'RecoveredPending2026!'}},403);
 });
 await assertCheck('Email-preferring accounts receive fast private queued notifications with no case content or manager intervention',async()=>{
  const student=await db.collection('academic_accounts').findOne({email:studentMail});
  await call('/profile',{method:'PATCH',cookie:studentCookie,
   body:{contactPreference:'email',telegram:''}});
  const msg=await call('/operations/direct-message',withAuth(rootCookie,{
   recipientId:student.id,
   body:'IPS has a private nursing research support update available for your account.'}),201);
  assert.ok(msg.data.message.id);
  const queue=db.collection('academic_notification_deliveries');
  let delivered;
  for(let i=0;i<35;i++){
   delivered=await queue.findOne({accountId:student.id,kind:'direct_message',status:'synthetic_dispatched'});
   if(delivered)break;
   await sleep(300);
  }
  assert.ok(delivered,'Selected email preference must be fulfilled automatically by the worker');
  const email=await db.collection('academic_evaluation_mail').findOne({to:studentMail,
   subject:'IPS Academic Services — new private update'});
  assert.ok(email?.text,'Actual synthetic email receipt must exist');
  assert.ok(!email.text.includes('nursing research support'),'Email must not reveal case subject or private messages');
  assert.equal(await queue.countDocuments({notificationId:delivered.notificationId}),1,
   'One queued delivery per in-app notice');
  await call('/profile',{method:'PATCH',cookie:studentCookie,
   body:{contactPreference:'workspace',telegram:''}});
  const before=await queue.countDocuments({accountId:student.id});
  await call('/operations/direct-message',withAuth(rootCookie,{
   recipientId:student.id,body:'The next case update is only available in your workspace.'}),201);
  assert.equal(await queue.countDocuments({accountId:student.id}),before,
   'Workspace-only recipients must not be forced onto email');
 });
 await assertCheck('Root sees provider failures without private recipient disclosure and can retry without manual email drafting',async()=>{
  const student=await db.collection('academic_accounts').findOne({email:studentMail});
  const id='OUT-EVAL-FAILED-'+random().toUpperCase();
  await db.collection('academic_notification_deliveries').insertOne({
   id,notificationId:'NT-EVAL-RETRY-'+random(),accountId:student.id,to:studentMail,
   kind:'communications',subject:'IPS Academic Services — new private update',
   text:'A private IPS update is ready. Sign in: '+url,
   status:'failed',attempts:4,lastError:'Provider delivery failed',
   createdAt:new Date(),nextAttemptAt:new Date(Date.now()+3600000)
  });
  const view=await call('/operations/delivery-status',{cookie:rootCookie});
  assert.ok(view.data.exceptions.some(x=>x.id===id));
  assert.ok(!JSON.stringify(view.data).includes(studentMail),'Root dashboard must not expose raw recipient addresses');
  await call('/operations/delivery-status',{cookie:studentCookie},403);
  await call('/operations/delivery/'+id+'/retry',withAuth(studentCookie,{}),403);
  const retried=await call('/operations/delivery/'+id+'/retry',withAuth(rootCookie,{}));
  assert.equal(retried.data.status,'pending');
  let status;
  for(let i=0;i<35;i++){
   status=await db.collection('academic_notification_deliveries').findOne({id});
   if(status?.status==='delivered')break;
   await sleep(300);
  }
  assert.equal(status?.status,'synthetic_dispatched','Sandbox retry must record synthetic dispatch, not external delivery');
  assert.ok(status.providerMessageId&&status.provider==='sandbox');
  assert.equal(await db.collection('academic_evaluation_mail').countDocuments({idempotencyKey:id}),1);
  // A stale retry of the exact same delivery job must reuse the same provider
  // identity instead of generating a second email or overstating receipt.
  await db.collection('academic_notification_deliveries').updateOne({id},
   {$set:{status:'failed',nextAttemptAt:new Date(Date.now()+3600000)}});
  await call('/operations/delivery/'+id+'/retry',withAuth(rootCookie,{}));
  let repeated;
  for(let i=0;i<35;i++){
   repeated=await db.collection('academic_notification_deliveries').findOne({id});
   if(repeated?.status==='synthetic_dispatched')break;
   await sleep(300);
  }
  assert.equal(repeated?.status,'synthetic_dispatched');
  assert.equal(repeated.providerMessageId,status.providerMessageId);
  assert.equal(await db.collection('academic_evaluation_mail').countDocuments({idempotencyKey:id}),1,
   'Idempotent retry must not create a duplicate outbound email');
  assert.equal(await db.collection('academic_notification_deliveries').countDocuments({
   id,status:'delivered'}),0,'External delivery must not be falsely asserted in isolated testing');
  assert.ok(await db.collection('academic_audit_events').findOne({action:'academic_notification_retry_requested',ref:id}));
 });
 await assertCheck('Student uploads and privately retrieves a 7 MB pre-commission enquiry attachment',async()=>{
  const student=await db.collection('academic_accounts').findOne({email:studentMail});
  const quote=(await db.collection('academic_quotations').findOne({studentId:student.id}));
  assert.ok(quote?.id);
  const bytes=Buffer.alloc(7*1024*1024,65);
  const checksum=crypto.createHash('sha256').update(bytes).digest('hex');
  const saved=await fetch(url+'/api/academic/quotes/'+quote.id+'/files-binary',{
   method:'POST',headers:{Cookie:studentCookie,Origin:url,
    'Content-Type':'application/octet-stream',
    'X-IPS-File-Name':'thesis-source-reference.txt',
    'X-IPS-File-Type':'text/plain'},body:bytes});
  assert.equal(saved.status,201,'Academic Client precommission upload failed: '+(await saved.clone().text()).slice(0,220));
  const data=await saved.json();
  assert.equal(data.file.sha256,checksum);
  assert.equal(data.file.byteLength,bytes.length);
  const stored=await db.collection('academic_quote_files').findOne({id:data.file.id});
  assert.ok(stored?.blobId);
  assert.equal(stored.fileData,undefined);
  const studentDownload=await fetch(url+'/api/academic/quote-files/'+stored.id,{headers:{Cookie:studentCookie}});
  assert.equal(studentDownload.status,200);
  assert.equal(crypto.createHash('sha256').update(Buffer.from(await studentDownload.arrayBuffer())).digest('hex'),checksum);
  const staffDownload=await fetch(url+'/api/academic/quote-files/'+stored.id,{headers:{Cookie:rootCookie}});
  assert.equal(staffDownload.status,200);
  assert.equal((await staffDownload.arrayBuffer()).byteLength,bytes.length);
  const excluded=await fetch(url+'/api/academic/quote-files/'+stored.id,{headers:{Cookie:otherCookie}});
  assert.equal(excluded.status,403);
  const internal=await fetch(url+'/api/academic/quotes/'+quote.id+'/files-binary',{
   method:'POST',headers:{Cookie:rootCookie,Origin:url,
    'Content-Type':'application/octet-stream','X-IPS-File-Name':'private-ips-note.txt',
    'X-IPS-File-Type':'text/plain','X-IPS-File-Audience':'internal'},
   body:Buffer.from('Confidential IPS internal assessment for this quotation.')});
  assert.equal(internal.status,201);
  const internalData=await internal.json();
  await call('/academic/quote-files/'+internalData.file.id,{cookie:studentCookie},403);
  const studentListing=await call('/academic/quotes/'+quote.id+'/files',{cookie:studentCookie});
  assert.ok(!studentListing.data.files.some(f=>f.id===internalData.file.id));
 });
 await assertCheck('Student uploads a 6 MB commissioned reference without bypassing privacy or QA',async()=>{
  const bytes=Buffer.alloc(6*1024*1024,66);
  const checksum=crypto.createHash('sha256').update(bytes).digest('hex');
  const saved=await fetch(url+'/api/operations/'+commissionId+'/upload-reference-binary',{
   method:'POST',headers:{Cookie:studentCookie,Origin:url,
    'Content-Type':'application/octet-stream',
    'X-IPS-File-Name':'research-dataset-guidance.txt',
    'X-IPS-File-Type':'text/plain'},body:bytes});
  assert.equal(saved.status,201,'Commission reference upload failed: '+(await saved.clone().text()).slice(0,220));
  const item=(await saved.json()).file;
  assert.equal(item.sha256,checksum);
  const stored=await db.collection('academic_private_files').findOne({id:item.id});
  assert.ok(stored?.blobId);
  assert.equal(stored.purpose,'reference');
  const retrieved=await fetch(url+'/api/academic/files/'+item.id,{headers:{Cookie:studentCookie}});
  assert.equal(retrieved.status,200);
  assert.equal(crypto.createHash('sha256').update(Buffer.from(await retrieved.arrayBuffer())).digest('hex'),checksum);
  await call('/academic/files/'+item.id,{cookie:otherCookie},403);
  const listing=await call('/operations/'+commissionId+'/files',{cookie:studentCookie});
  assert.ok(listing.data.files.some(f=>f.id===item.id));
 });
 await assertCheck('ClamAV wire gate scans real academic routes and denies synthetic flagged documents',async()=>{
  const flagged=Buffer.from('This harmless synthetic test carries IPS_SYNTHETIC_EICAR_TEST inside.');
  const initial=await db.collection('academic_quote_files').countDocuments({quoteId});
  await call('/academic/quotes/'+quoteId+'/files',withAuth(studentCookie,{
   filename:'synthetic-flagged.txt',mime:'text/plain',data:flagged.toString('base64'),
   audience:'student'}),422);
  assert.equal(await db.collection('academic_quote_files').countDocuments({quoteId}),initial,
   'Flagged academic document must not persist');
  const safe=Buffer.from('IPS compliant student-owned reference material for legitimate editorial feedback.');
  const accepted=await call('/academic/quotes/'+quoteId+'/files',withAuth(studentCookie,{
   filename:'screened-reference.txt',mime:'text/plain',data:safe.toString('base64'),
   audience:'student'}),201);
  const file=await db.collection('academic_quote_files').findOne({id:accepted.data.file.id});
  assert.equal(file.scanStatus,'clean','Real upload path must store scanner clean result');
 });
 await assertCheck('Multi-megabyte Specialist document streams securely through GridFS, QA and client delivery',async()=>{
  const prefix=Buffer.from('IPS permitted academic editing and research-guidance notes.\\n');
  const bytes=Buffer.concat([prefix,Buffer.alloc(7*1024*1024-prefix.length,65)]);
  const checksum=crypto.createHash('sha256').update(bytes).digest('hex');
  const bad=await fetch(url+'/api/academic/commissions/'+secondCommissionId+'/submission-binary',{
   method:'POST',headers:{Cookie:specialistCookie,'Origin':url,
    'Content-Type':'application/octet-stream','X-IPS-File-Name':'wrong-extension.pdf',
    'X-IPS-File-Type':'text/plain'},body:Buffer.from('This is invalid as a PDF document.')});
  assert.equal(bad.status,400,'Mismatched binary media types must be rejected');
  const saved=await fetch(url+'/api/academic/commissions/'+secondCommissionId+'/submission-binary',{
   method:'POST',headers:{Cookie:specialistCookie,'Origin':url,
    'Content-Type':'application/octet-stream','X-IPS-File-Name':'research-editing-notes.txt',
    'X-IPS-File-Type':'text/plain'},body:bytes});
  assert.equal(saved.status,201,'Large Specialist upload failed: '+(await saved.clone().text()).slice(0,220));
  const response=await saved.json();
  assert.equal(response.checksum,checksum);
  assert.equal(response.storage,'private_gridfs');
  assert.equal(response.byteLength,bytes.length);
  const record=await db.collection('academic_private_files').findOne({id:response.submissionId});
  assert.ok(record.blobId,'GridFS document reference not persisted');
  assert.equal(record.fileData,undefined,'Large academic bytes must not be embedded in BSON');
  const denied=await fetch(url+'/api/academic/files/'+record.id,{headers:{Cookie:studentCookie}});
  assert.equal(denied.status,403,'Student cannot read a pending QA document');
  const rootDoc=await fetch(url+'/api/academic/files/'+record.id,{headers:{Cookie:rootCookie}});
  assert.equal(rootDoc.status,200);
  assert.equal(crypto.createHash('sha256').update(Buffer.from(await rootDoc.arrayBuffer())).digest('hex'),checksum);
  const qa=await call('/academic/commissions/'+secondCommissionId+'/quality',
   withAuth(rootCookie,{decision:'approve',
    note:'Verified confidential academic guidance content and reviewed the full uploaded file.'}));
  assert.equal(qa.data.commission.status,'client_delivery');
  const studentDoc=await fetch(url+'/api/academic/files/'+record.id,{headers:{Cookie:studentCookie}});
  assert.equal(studentDoc.status,200);
  const downloaded=Buffer.from(await studentDoc.arrayBuffer());
  assert.equal(downloaded.length,bytes.length);
  assert.equal(crypto.createHash('sha256').update(downloaded).digest('hex'),checksum);
  const outsider=await fetch(url+'/api/academic/files/'+record.id,{headers:{Cookie:otherCookie}});
  assert.equal(outsider.status,403);
  const chunks=await db.collection('academic_document_blobs.chunks').countDocuments({files_id:record.blobId});
  assert.ok(chunks>2,'Multi-megabyte academic document did not use multiple GridFS chunks');
 });
 await assertCheck('Nyoro Root receives one-use recovery email, revokes old sessions and remains non-deletable',async()=>{
  const rootMail=vars.ROOT_EMAIL,firstSession=rootCookie;
  const neutral=await call('/auth/recovery/request',{method:'POST',body:{
   email:'unknown-root-recovery@example.org'}},202);
  assert.equal(neutral.data.accepted,true);
  const request=await call('/auth/recovery/request',{method:'POST',body:{
   email:rootMail}},202);
  assert.equal(request.data.accepted,true);
  const first=token(await inbox(rootMail,'Nyoro IPS Root Admin password recovery'),'recover');
  await call('/auth/recovery/complete',{method:'POST',body:{
   email:rootMail,token:first,password:'RootPasswordChanged2027!',
   confirmPassword:'NoMatch2027!'}},400);
  const changed=await call('/auth/recovery/complete',{method:'POST',body:{
   email:rootMail,token:first,password:'RootPasswordChanged2027!',
   confirmPassword:'RootPasswordChanged2027!'}});
  assert.equal(changed.data.account.name,'Nyoro');
  await call('/session',{cookie:firstSession},401);
  await call('/auth/login',{method:'POST',body:{
   email:rootMail,password:vars.ROOT_PASSWORD}},401);
  const newSession=await signIn(rootMail,'RootPasswordChanged2027!');
  const record=await db.collection('academic_root_credentials').findOne({id:rootMail});
  assert.equal(record.sessionVersion,2);
  assert.ok(record.passwordHash?.startsWith('scrypt'+String.fromCharCode(36)));
  assert.equal(await db.collection('academic_accounts').countDocuments({role:'root'}),0);
  await call('/auth/recovery/complete',{method:'POST',body:{
   email:rootMail,token:first,password:'AttackerReplay2027!',
   confirmPassword:'AttackerReplay2027!'}},400);
  await call('/auth/recovery/request',{method:'POST',body:{
   email:rootMail}},202);
  const second=token(await inbox(rootMail,'Nyoro IPS Root Admin password recovery'),'recover');
  assert.notEqual(second,first);
  const restored=await call('/auth/recovery/complete',{method:'POST',body:{
   email:rootMail,token:second,password:vars.ROOT_PASSWORD,
   confirmPassword:vars.ROOT_PASSWORD}});
  assert.equal(restored.data.account.role,'root');
  await call('/session',{cookie:newSession},401);
  rootCookie=await signIn(rootMail,vars.ROOT_PASSWORD);
  const final=await db.collection('academic_root_credentials').findOne({id:rootMail});
  assert.equal(final.sessionVersion,3);
  assert.equal(await db.collection('academic_accounts').countDocuments({role:'root'}),0);
  assert.ok(await db.collection('academic_audit_events').findOne({
   action:'nyoro_root_password_recovered'}));
 });
 await assertCheck('Root and managers reassign, revoke sessions and offboard personnel without orphaning records',async()=>{
  const secondManagerMail=emailFor('person-governance-manager');
  await call('/administration/invite',withAuth(rootCookie,{
   name:'Additional Academic Client Relations Manager',
   email:secondManagerMail,department:'client_relations'}),201);
  const mt=token(await inbox(secondManagerMail,'Your IPS Academic Services department invitation'),'invite');
  const secondManagerCookie=(await call('/auth/invitation/accept',{method:'POST',body:{
   email:secondManagerMail,token:mt,password:'SecondManager2026!',
   confirmPassword:'SecondManager2026!'}})).cookie;
  const secondManager=await db.collection('academic_accounts').findOne({email:secondManagerMail});
  const secondStaffMail=emailFor('person-governance-staff');
  await call('/administration/invite',withAuth(secondManagerCookie,{
   name:'Additional Client Relations Associate',email:secondStaffMail}),201);
  const st=token(await inbox(secondStaffMail,'Your IPS Academic Services department invitation'),'invite');
  let secondStaffCookie=(await call('/auth/invitation/accept',{method:'POST',body:{
   email:secondStaffMail,token:st,password:'SecondStaff2026!',confirmPassword:'SecondStaff2026!'}})).cookie;
  const secondStaff=await db.collection('academic_accounts').findOne({email:secondStaffMail});
  const firstManager=await db.collection('academic_accounts').findOne({email:managerMail});
  await call('/administration/people/'+secondStaff.id+'/reassign-manager',
   withAuth(secondManagerCookie,{managerId:firstManager.id,reason:'Managers must not reassign staff outside their delegated authority.'}),403);
  await call('/administration/people/'+secondManager.id+'/offboard',
   withAuth(rootCookie,{reason:'Cannot offboard while a reporting employee remains active.'}),409);
  await call('/administration/people/'+secondStaff.id+'/reassign-manager',withAuth(rootCookie,{
   managerId:firstManager.id,reason:'Accountable handover of additional academic intake worker to original manager.'}));
  await call('/session',{cookie:secondStaffCookie},401);
  secondStaffCookie=await signIn(secondStaffMail,'SecondStaff2026!');
  const history=await call('/administration/people/'+secondStaff.id+'/history',{cookie:rootCookie});
  assert.ok(history.data.history.some(x=>x.action==='academic_staff_manager_reassigned'));
  await call('/administration/people/'+secondStaff.id+'/history',{cookie:studentCookie},403);
  await call('/administration/people/'+secondStaff.id+'/revoke-sessions',
   withAuth(secondManagerCookie,{reason:'No management authority remains after transfer.'}),403);
  await call('/administration/people/'+secondStaff.id+'/revoke-sessions',
   withAuth(managerCookie,{reason:'Security review after accountable workforce transfer is complete.'}));
  await call('/session',{cookie:secondStaffCookie},401);
  secondStaffCookie=await signIn(secondStaffMail,'SecondStaff2026!');
  await call('/administration/people/'+secondManager.id+'/offboard',
   withAuth(rootCookie,{reason:'Department staffing was transferred; retire now-unused manager account.'}));
  await call('/session',{cookie:secondManagerCookie},401);
  await call('/administration/people/'+secondStaff.id+'/offboard',
   withAuth(managerCookie,{reason:'Offboard this temporary employee after an uneventful assignment handover.'}));
  await call('/session',{cookie:secondStaffCookie},401);
  await call('/administration/people/'+secondStaff.id+'/offboard',
   withAuth(rootCookie,{reason:'Attempt to repeat offboarding decision must fail.'}),409);
  const preserved=await db.collection('academic_audit_events').countDocuments({
   ref:secondStaff.id,action:{$in:['academic_staff_manager_reassigned','academic_person_sessions_revoked','academic_employee_offboarded']}});
  assert.equal(preserved,3);
  assert.equal((await db.collection('academic_accounts').findOne({id:secondStaff.id})).status,'disabled');
 });
 await assertCheck('Documented Specialist rejection is private, role-controlled and queued for written delivery',async()=>{
  // Reuse the fully verified, agreement-signed pending applicant from the previous
  // recovery journey. This retains the real seven-attempt-per-IP registration
  // abuse policy rather than disabling rate limits to satisfy a long CI suite.
  const emailAddr=pendingSpecialistMail;
  const applicant=await db.collection('academic_accounts').findOne({email:emailAddr});
  assert.equal(applicant.status,'pending_review');
  assert.equal(applicant.verified,true);
  assert.equal(applicant.specialistAgreementVersion,SPECIALIST_AGREEMENT.version);
  await call('/administration/people/'+applicant.id+'/decision',withAuth(managerCookie,{
   decision:'reject_specialist',reviewNote:'Client Relations cannot decide Specialist Network professional applications.'}),403);
  await call('/administration/people/'+applicant.id+'/decision',withAuth(rootCookie,{
   decision:'reject_specialist',reviewNote:'Brief.'}),400);
  const reason='IPS Specialist Network could not verify the submitted professional qualification against satisfactory independent evidence.';
  await call('/administration/people/'+applicant.id+'/decision',withAuth(rootCookie,{
   decision:'reject_specialist',reviewNote:reason}));
  const record=await db.collection('academic_accounts').findOne({id:applicant.id});
  assert.equal(record.status,'rejected');
  assert.equal(record.approved,false);
  assert.equal(record.credentialReviewDecision,'rejected');
  assert.equal(record.credentialReviewNote,reason);
  await call('/auth/login',{method:'POST',body:{
   email:emailAddr,password:'RecoveredPending2026!'}},403);
  assert.ok(await db.collection('academic_notification_deliveries').findOne({
   accountId:applicant.id,kind:'specialist_application_review',channel:'email'}));
  await call('/administration/people/'+applicant.id+'/decision',withAuth(rootCookie,{
   decision:'approve_specialist',reviewNote:'Cannot undo a rejected professional review silently.',
   credentialEvidenceReviewed:true}),409);
 });
 await assertCheck('Server-side people search pages beyond 300 accounts without leaking scoped identities',async()=>{
  // Direct test inserts model genuine directory scale; sandbox only, no invitation
  // or password bypass in the real registration endpoints.
  const salt=random(),createdAt=new Date();
  const entries=Array.from({length:330},(_,i)=>({
   id:'CI-DIR-'+salt+'-'+String(i).padStart(4,'0'),
   role:'student',email:'ci-directory-'+salt+'-'+i+'@example.org',
   username:'CiDirectory'+salt+i,usernameKey:'cidirectory'+salt+i,
   name:'',verified:true,approved:true,status:'active',sessionVersion:1,
   createdAt,updatedAt:createdAt
  }));
  await db.collection('academic_accounts').insertMany(entries,{ordered:true});
  const p1=await call('/administration/people?page=1&pageSize=100&role=student',
   {cookie:rootCookie});
  assert.equal(p1.data.page,1);
  assert.equal(p1.data.pageSize,100);
  assert.equal(p1.data.people.length,100);
  assert.equal(p1.data.hasNext,true);
  assert.ok(p1.data.total>=330);
  const last=await call('/administration/people?page=4&pageSize=100&role=student',
   {cookie:rootCookie});
  assert.ok(last.data.people.length>=30);
  assert.equal(last.data.hasNext,false);
  assert.equal(last.data.hasPrevious,true);
  const exact=await call('/administration/people?role=student&search='+encodeURIComponent(entries[248].email),
   {cookie:rootCookie});
  assert.equal(exact.data.people.length,1);
  assert.equal(exact.data.people[0].id,entries[248].id);
  assert.ok(!JSON.stringify(exact.data.people[0]).includes('passwordHash'));
  const regexLiteral=await call('/administration/people?role=student&search='+encodeURIComponent('.*'),
   {cookie:rootCookie});
  assert.equal(regexLiteral.data.people.length,0,'Search input must never become an unrestricted MongoDB regular expression');
  const scoped=await call('/administration/people?role=student&search=ci-directory-',
   {cookie:managerCookie});
  assert.equal(scoped.data.people.length,100);
  await call('/administration/people?role=student&search=ci-directory-',
   {cookie:studentCookie},403);
  await call('/administration/people?role=student&status=secret',{cookie:rootCookie},400);
  await call('/administration/people?pageSize=301',{cookie:rootCookie},400);
  await call('/administration/people?page=-1',{cookie:rootCookie},400);
  // This suite shares its disposable database with the later Chrome run.
  // Remove ONLY the synthetic stress fixture so browser accounts remain visible.
  const cleanup=await db.collection('academic_accounts').deleteMany({
   id:{$regex:'^CI-DIR-'+salt+'-'}});
  assert.equal(cleanup.deletedCount,330);
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
finally{try{await client?.close()}catch{}server.kill('SIGTERM');await sleep(250);await mockScanner.close()}
