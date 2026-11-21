// Admission test for exact isolated Render review image: five authenticated academic roles and no external providers.
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:18123';
async function call(path,{method='GET',body,cookie,originHeader=origin}={}){
 const r=await fetch(origin+'/api'+path,{method,headers:{
  ...(body?{'Content-Type':'application/json','Origin':originHeader}:{}),...(cookie?{'Cookie':cookie}:{})},
  body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
 const data=await r.json().catch(()=>({}));
 return {status:r.status,data,cookie:(r.headers.get('set-cookie')||'').split(';')[0]};
}
const health=await call('/health');assert.equal(health.status,200);
assert.equal(health.data.product,'IPS Academic Services');assert.equal(health.data.environment,'ISOLATED_ACADEMIC_REVIEW');
assert.equal(health.data.payments,'integration-pending');
const catalog=await call('/catalogue');assert.equal(catalog.data.services.length,16);
const people=[
 ['student.academic.review@example.org','AcademicStudentPreview2026!','student'],
 ['specialist.academic.review@example.org','AcademicSpecialistPreview2026!','specialist'],
 ['manager.academic.review@example.org','AcademicManagerPreview2026!','manager'],
 ['staff.academic.review@example.org','AcademicStaffPreview2026!','staff'],
 ['nyoro.academic.review@example.org','AcademicRootPreview2026!','root']
];
let studentCookie,specialistCookie,rootCookie,staffCookie,managerCookie;
for(const [email,password,expected] of people){
 const r=await call('/auth/login',{method:'POST',body:{email,password}});
 assert.equal(r.status,200,expected+': '+JSON.stringify(r.data));
 assert.equal(r.data.account.role,expected);assert.ok(r.cookie.startsWith('ips_academic_session='));
 const session=await call('/session',{cookie:r.cookie});assert.equal(session.status,200);
 if(expected==='student')studentCookie=r.cookie;
 if(expected==='specialist')specialistCookie=r.cookie;
 if(expected==='root')rootCookie=r.cookie;
 if(expected==='staff')staffCookie=r.cookie;
 if(expected==='manager')managerCookie=r.cookie;
 const dashboard=await call('/academic/dashboard',{cookie:r.cookie});
 assert.equal(dashboard.status,200);assert.equal(dashboard.data.company,'IPS Academic Services');
 console.log('PASS ACADEMIC IMAGE verified signed-in '+expected+' workspace');
}
const studentDocs=await call('/academic/commissions',{cookie:studentCookie});
assert.equal(studentDocs.status,200);assert.ok(studentDocs.data.commissions.some(p=>p.serviceId==='thesis-dissertation'));
const p=studentDocs.data.commissions.find(x=>x.id==='IPS-A-EVAL-THESIS'&&x.status==='completed');
assert.ok(p,'Completed fictional thesis guidance must remain accessible alongside active academic cases');
const active=studentDocs.data.commissions.find(x=>x.id==='IPS-A-EVAL-EDITING-ACTIVE');
assert.ok(active&&active.status==='specialist_assigned');
const offers=await call('/academic/quotes',{cookie:studentCookie});
assert.ok(offers.data.quotes.some(q=>q.id==='IPS-Q-EVAL-RESEARCH-OFFER'&&q.status==='offered'));
const quoteFiles=await call('/academic/quotes/IPS-Q-EVAL-EDITING/files',{cookie:studentCookie});
assert.equal(quoteFiles.status,200);
assert.equal(quoteFiles.data.files.length,1,'The Student must see their own fictional pre-commission brief but not private IPS notes');
assert.equal(quoteFiles.data.files[0].filename,'nursing-review-formatting-guidance.txt');
const rootQuoteFiles=await call('/academic/quotes/IPS-Q-EVAL-EDITING/files',{cookie:rootCookie});
assert.equal(rootQuoteFiles.data.files.length,2,'Root should see both Student source and private IPS quote review');
const internal=rootQuoteFiles.data.files.find(f=>f.audience==='internal');
assert.ok(internal);
assert.equal((await call('/academic/quote-files/'+internal.id,{cookie:studentCookie})).status,403);
const quoteDoc=await fetch(origin+'/api/academic/quote-files/'+quoteFiles.data.files[0].id,
 {headers:{Cookie:studentCookie}});
assert.equal(quoteDoc.status,200);
assert.ok((await quoteDoc.text()).includes('EVALUATION ONLY'));
const quoteConversation=await call('/academic/quotes/IPS-Q-EVAL-EDITING/messages',{cookie:studentCookie});
assert.equal(quoteConversation.data.messages.length,2,'The fictional enquiry must have a usable two-way correspondence history');
const dm=await call('/operations/direct-message',{cookie:studentCookie});
const seededMessage=dm.data.messages.find(x=>x.attachmentId==='DMF-EVAL-ROOT-GUIDANCE');
assert.ok(seededMessage,'Student review inbox must contain real Root attachment');
const dmThread=await call('/operations/direct-message/'+seededMessage.id+'/thread',{cookie:studentCookie});
assert.equal(dmThread.status,200);
assert.equal(dmThread.data.messages.length,2,'Two-way private messages must be visible');
const privateFile=await fetch(origin+'/api/operations/direct-file/DMF-EVAL-ROOT-GUIDANCE',
 {headers:{Cookie:studentCookie}});
assert.equal(privateFile.status,200);
assert.ok((await privateFile.text()).includes('EVALUATION ONLY'));
const privateOutsider=await call('/operations/direct-file/DMF-EVAL-ROOT-GUIDANCE',{cookie:specialistCookie});
assert.equal(privateOutsider.status,403);
const files=await call('/academic/commissions/'+p.id+'/files',{cookie:studentCookie});
assert.ok(files.data.files.length);
const data=await fetch(origin+'/api/academic/files/'+files.data.files[0].id,{headers:{Cookie:studentCookie}});
assert.equal(data.status,200);assert.ok((await data.text()).includes('FICTIONAL EVALUATION DOCUMENT'));
const staffed=await call('/administration/people',{cookie:staffCookie});assert.equal(staffed.status,200);
assert.ok(staffed.data.people.every(p=>p.role==='student'));
const mgr=await call('/administration/people',{cookie:managerCookie});
assert.ok(mgr.data.people.some(p=>p.role==='staff'));assert.ok(!mgr.data.people.some(p=>p.role==='root'));
const own=await call('/administration/people',{cookie:rootCookie});
assert.equal(own.status,200);assert.equal(own.data.people.filter(p=>p.role!=='root').length,4);
const forbidden=await call('/administration/people',{cookie:studentCookie});assert.equal(forbidden.status,403);
const foreign=await call('/auth/login',{method:'POST',body:{email:people[0][0],password:people[0][1]},originHeader:'https://outside.example'});
assert.equal(foreign.status,403);
const noSynthetic=await call('/evaluation/confirm-synthetic-payment/'+p.id,{method:'POST',cookie:rootCookie,body:{}});
assert.equal(noSynthetic.status,404);
console.log('IPS_ACADEMIC_IMAGE_REVIEW_GREEN five signed academic roles, private thesis deliverable, scoped personnel and disabled payments.');
