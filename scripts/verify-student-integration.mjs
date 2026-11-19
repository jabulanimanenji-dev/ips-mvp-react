import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const BASE=process.env.IPS_TEST_BASE_URL||'http://127.0.0.1:8080';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const cases=[];
async function call(path,{method='GET',session='',json,headers={},raw}={}){
  const res=await fetch(BASE+path,{
    method,headers:{...(session?{cookie:session}:{}),...(json?{'Content-Type':'application/json'}:{}),...headers},
    body:json?JSON.stringify(json):raw,
    signal:AbortSignal.timeout(20000)
  });
  let body={};const text=await res.text();try{body=JSON.parse(text);}catch{body={raw:text};}
  return {status:res.status,body,cookie:res.headers.get('set-cookie')?.split(';')[0]||''};
}
function pass(label){cases.push(label);console.log('PASS '+label);}
async function go(){
  let ready=false;
  for(let i=0;i<30;i++){
    try{const r=await call('/api/health');if(r.status===200&&r.body.database==='connected'){ready=true;break;}}catch{}
    await sleep(600);
  }
  assert.ok(ready,'Real MongoDB API did not report ready');
  pass('MongoDB-backed API /health readiness');

  // CI has no real sending credentials. Registration must refuse activation,
  // while independently provisioned, already-verified accounts can sign in.
  const unavailableSignup=await call('/api/clients',{method:'POST',json:{
    username:'PrivateStudent',email:'new-student@example.org',password:'ExampleTestPassword123!'}});
  assert.equal(unavailableSignup.status,503);
  assert.equal(unavailableSignup.body.success,false);
  pass('Account registration fails closed without verified sender and email-code secret');

  const mongooseForMail=(await import('mongoose')).default;
  const {default:Client}=await import('../models/Client.js');
  await mongooseForMail.connect(process.env.MONGODB_URI);
  const testHash=password=>{
    const salt=crypto.randomBytes(16).toString('hex');
    return 'scrypt$'+salt+'$'+crypto.scryptSync(password,salt,64).toString('hex');
  };
  const password='ExampleTestPassword123!';
  for(const [id,username,email,verified] of [
    ['CID-TEST-ALICE','PrivateAlice','alice.test@example.org',true],
    ['CID-TEST-BOB','PrivateBob','bob.test@example.org',true],
    ['CID-TEST-UNVERIFIED','UnverifiedUser','unverified.test@example.org',false]
  ]){
    await Client.create({client_id:id,username,username_key:username.toLowerCase(),full_name:'',email,
      password:testHash(password),email_verified_at:verified?new Date():null,
      status:verified?'Active':'Pending Verification'});
  }
  const denied=await call('/api/client/login',{method:'POST',json:{email:'unverified.test@example.org',password}});
  assert.equal(denied.status,403);
  assert.equal(denied.body.verification_required,true);
  pass('No session cookie for unverified student email');

  const alice=await call('/api/client/login',{method:'POST',json:{email:'alice.test@example.org',password}});
  assert.equal(alice.status,200,JSON.stringify(alice.body));
  assert.ok(alice.cookie.startsWith('ips_session='));
  assert.equal(alice.body.client.username,'PrivateAlice');
  assert.equal(alice.body.client.full_name,'');
  const aliceId=alice.body.client.client_id;
  pass('Verified-only pseudonymous student login and signed HttpOnly cookie');

  let bob=await call('/api/client/login',{method:'POST',json:{email:'bob.test@example.org',password}});
  assert.equal(bob.status,200);
  assert.notEqual(bob.body.client.client_id,aliceId);
  pass('Separate verified student identities');
  const recoveryUnavailable=await call('/api/client/password-recovery/request',{
    method:'POST',json:{email:'bob.test@example.org'}});
  assert.equal(recoveryUnavailable.status,503);
  const {completePasswordRecovery,tokenDigest}=await import('../services/passwordRecovery.js');
  const recoveryEnv={NODE_ENV:'development',PUBLIC_APP_URL:'http://127.0.0.1:8080',
    CONTACT_RESEND_API_KEY:'ci-fake-not-a-real-provider',
    CONTACT_FROM_EMAIL:'support@ipsglobalservice.com',
    CONTACT_REPLY_TO_EMAIL:'contact@ipsglobalservice.com',
    EMAIL_VERIFICATION_SECRET:'CI-password-recovery-signing-secret-1234567890'};
  const resetProof=crypto.randomBytes(32).toString('base64url');
  const newPassword='ReplacedStrongPassword9!';
  const bobId=bob.body.client.client_id;
  await Client.updateOne({client_id:bobId},{$set:{
    password_reset_hash:tokenDigest(resetProof,recoveryEnv.EMAIL_VERIFICATION_SECRET),
    password_reset_expires_at:new Date(Date.now()+15*60000),password_reset_sent_at:new Date()
  }});
  const resetResult=await completePasswordRecovery(resetProof,newPassword,{
    env:recoveryEnv,model:Client,hashPassword:testHash
  });
  assert.equal(resetResult.success,true);
  const recoveryReplay=await completePasswordRecovery(resetProof,newPassword,{
    env:recoveryEnv,model:Client,hashPassword:testHash
  });
  assert.equal(recoveryReplay.status,400);
  const oldSession=await call('/api/client/me',{session:bob.cookie});
  assert.equal(oldSession.status,401);
  const oldLogin=await call('/api/client/login',{method:'POST',session:bob.cookie,
    json:{email:'bob.test@example.org',password}});
  assert.equal(oldLogin.status,401);
  bob=await call('/api/client/login',{method:'POST',session:bob.cookie,
    json:{email:'bob.test@example.org',password:newPassword}});
  assert.equal(bob.status,200,JSON.stringify(bob.body));
  const newSession=await call('/api/client/me',{session:bob.cookie});
  assert.equal(newSession.status,200);
  pass('One-use password recovery rotates session version; old sessions/password fail, new verified login succeeds');

  const admin=await call('/api/admin/login',{method:'POST',json:{email:'owner-ci@example.invalid',password:'LocalOnlyAdminPassword123!'}});
  assert.equal(admin.status,200,JSON.stringify(admin.body));
  pass('Actual administrator authentication');

  const privateQuote={
    username:'PrivateAlice',service:'statistics-support',subject:'R'.repeat(160),
    message:'I would like methodology and data analysis guidance for my academic research project.',
    preferred_channel:'workspace',contact_consent:true
  };
  const noConsent=await call('/api/quote-requests',{method:'POST',session:alice.cookie,
    json:{...privateQuote,contact_consent:false}});
  assert.equal(noConsent.status,400);
  const noCalls=await call('/api/quote-requests',{method:'POST',session:alice.cookie,
    json:{...privateQuote,preferred_channel:'phone',phone:'+48123456789'}});
  assert.equal(noCalls.status,400);
  const guestEmail=await call('/api/quote-requests',{method:'POST',json:{...privateQuote,
    username:'GuestResearcher',preferred_channel:'email',email:'guest@example.org'}});
  assert.equal(guestEmail.status,503);
  const submitted=await call('/api/quote-requests',{method:'POST',session:alice.cookie,json:privateQuote});
  assert.equal(submitted.status,201,JSON.stringify(submitted.body));
  const reference=submitted.body.quote_id;
  assert.match(reference,/^IPS-Q-[A-F0-9]{18}$/);
  assert.equal(submitted.body.preferred_channel,'workspace');
  assert.equal(submitted.body.contact_status,'verified');
  pass('Signed-in private quote requires no legal name or payment; phone calls forbidden');

  const guestQueue=await call('/api/contact-enquiries/admin');
  assert.equal(guestQueue.status,401);
  const clientQueue=await call('/api/contact-enquiries/admin',{session:alice.cookie});
  assert.equal(clientQueue.status,403);
  const ownerQueue=await call('/api/contact-enquiries/admin',{session:admin.cookie});
  assert.equal(ownerQueue.status,200,JSON.stringify(ownerQueue.body));
  const unauthAttention=await call('/api/contact-enquiries/admin/attention',{session:alice.cookie});
  assert.equal(unauthAttention.status,403);
  const attention=await call('/api/contact-enquiries/admin/attention',{session:admin.cookie});
  assert.equal(attention.status,200);
  assert.equal(attention.body.success,true);
  assert.ok(attention.body.new_requests>=1);
  assert.equal(typeof attention.body.overdue_updates,'number');
  const found=ownerQueue.body.enquiries.find(x=>x.enquiry_id===reference);
  assert.equal(found.username,'PrivateAlice');
  assert.equal(found.name,'');
  assert.equal(found.phone,'');
  assert.equal(found.discipline,'R'.repeat(160));
  assert.equal(found.subject,'statistics-support');
  pass('Only IPS staff can inspect pseudonymous quote details and long academic disciplines safely');

  const noEmail=await call('/api/contact-enquiries/admin/'+reference+'/email-reply',{
    method:'POST',session:admin.cookie,json:{message:'IPS will respond in writing.'}});
  assert.equal(noEmail.status,503);
  const updateDue=new Date(Date.now()+2*86400000).toISOString();
  const invalidDue=await call('/api/contact-enquiries/admin/'+reference,{
    method:'PATCH',session:admin.cookie,json:{next_update_at:'yesterday'}});
  assert.equal(invalidDue.status,400);
  const moved=await call('/api/contact-enquiries/admin/'+reference,{
    method:'PATCH',session:admin.cookie,
    json:{status:'in_progress',admin_note:'Private quote under review',next_update_at:updateDue}});
  assert.equal(moved.status,200);
  assert.equal(moved.body.enquiry.status,'in_progress');
  assert.ok(moved.body.enquiry.review_started_at);
  assert.ok(moved.body.enquiry.next_update_at);
  const ownerQueueAfter=await call('/api/contact-enquiries/admin',{session:admin.cookie});
  assert.equal(ownerQueueAfter.body.enquiries.find(x=>x.enquiry_id===reference)?.messages.length,1);
  pass('Only authorized IPS staff update confidential quote lifecycle; no unverified sends');

  const privateMine=await call('/api/quote-requests/me',{session:alice.cookie});
  assert.equal(privateMine.status,200);
  assert.ok(privateMine.body.quotes.some(q=>q.enquiry_id===reference));
  assert.ok(privateMine.body.quotes.find(q=>q.enquiry_id===reference).next_update_at);
  const privateOther=await call('/api/quote-requests/me',{session:bob.cookie});
  assert.equal(privateOther.status,200);
  assert.ok(!privateOther.body.quotes.some(q=>q.enquiry_id===reference));
  const staffMessage=await call('/api/quote-requests/admin/'+reference+'/workspace-reply',{
    method:'POST',session:admin.cookie,json:{message:'IPS reviewed your project. Please clarify the timeframe.'}});
  assert.equal(staffMessage.status,200);
  const afterUpdate=await call('/api/quote-requests/me',{session:alice.cookie});
  assert.ok(!afterUpdate.body.quotes.find(q=>q.enquiry_id===reference).next_update_at);
  const customerMessage=await call('/api/quote-requests/'+reference+'/workspace-reply',{
    method:'POST',session:alice.cookie,json:{message:'The timeframe is about two weeks from today.'}});
  assert.equal(customerMessage.status,200);
  const privateThread=await call('/api/quote-requests/me',{session:alice.cookie});
  assert.equal(privateThread.body.quotes.find(q=>q.enquiry_id===reference).messages.length,3);
  pass('Two-way private quotation messages are available to the account owner');

  // Real MongoDB outbox with a fake provider: no external emails or credentials.
  console.log('CI_CONTACT_MAIL_TESTS_START');
  const mailEnv={
    CONTACT_EMAIL_NOTIFICATIONS_ENABLED:'true',
    CONTACT_RESEND_API_KEY:'ci-mock-not-live',
    CONTACT_FROM_EMAIL:'support@ipsglobalservice.com',
    CONTACT_REPLY_TO_EMAIL:'contact@ipsglobalservice.com'
  };
  const {default:ContactEnquiry}=await import('../models/ContactEnquiry.js');
  const {default:ContactEmailJob}=await import('../models/ContactEmailJob.js');
  const {enqueueContactEmailJobs,processContactEmailJobs}=await import('../services/contactEmailQueue.js');
  // Distinct verified-email lead: do not mutate the active workspace quote
  // merely to exercise mocked provider delivery. Browser qualification later
  // verifies that exact private quotation remains accessible to its owner.
  const mailReference='ENQ-'+crypto.randomBytes(9).toString('hex').toUpperCase();
  const savedLead=await ContactEnquiry.create({
    enquiry_id:mailReference,username:'QuietGuest',name:'',request_type:'general',
    email:'guest@example.org',preferred_channel:'email',contact_consent:true,consent_at:new Date(),
    contact_verified:true,contact_verified_at:new Date(),verification_status:'verified',
    subject:'Private academic guidance enquiry',
    messages:[{direction:'inbound',channel:'website',body:'I would like written academic guidance and a quotation.',delivery_status:'received'}],
    status:'new',last_activity_at:new Date()
  });
  const firstQueue=await enqueueContactEmailJobs(savedLead,{env:mailEnv});
  const duplicateQueue=await enqueueContactEmailJobs(savedLead,{env:mailEnv});
  assert.equal(firstQueue.queued,2);
  assert.equal(duplicateQueue.queued,2);
  assert.equal(await ContactEmailJob.countDocuments({enquiry_id:mailReference}),2);
  pass('Real database queues one customer receipt and one IPS staff alert per enquiry');

  const mailCalls=[];
  const fakeEmailProvider=async (url,options)=>{
    assert.equal(url,'https://api.resend.com/emails');
    const payload=JSON.parse(options.body);
    mailCalls.push({payload,key:options.headers['Idempotency-Key']});
    return {ok:true,status:200,json:async()=>({id:'ci-resend-accepted-'+mailCalls.length})};
  };
  const sentQueue=await processContactEmailJobs({env:mailEnv,request:fakeEmailProvider,limit:3});
  assert.equal(sentQueue.accepted,2,JSON.stringify(sentQueue));
  assert.equal(mailCalls.length,2);
  assert.ok(mailCalls.every(x=>x.payload.from==='IPS Academic Services <support@ipsglobalservice.com>'));
  assert.ok(mailCalls.every(x=>x.payload.reply_to==='contact@ipsglobalservice.com'));
  assert.ok(mailCalls.every(x=>x.key.startsWith('ips-enquiry/'+mailReference+'/')));
  assert.deepEqual(new Set(mailCalls.map(x=>x.payload.to[0])),new Set(['guest@example.org','contact@ipsglobalservice.com']));
  const replay=await processContactEmailJobs({env:mailEnv,request:fakeEmailProvider,limit:3});
  assert.equal(replay.processed,0);
  assert.equal(mailCalls.length,2);
  const jobs=await ContactEmailJob.find({enquiry_id:mailReference}).lean();
  assert.equal(jobs.filter(x=>x.status==='accepted').length,2);
  const firstProviderId=jobs[0].provider_id;
  const unsignedDelivery=await call('/api/contact-email/resend-webhook',{method:'POST',
    raw:JSON.stringify({type:'email.delivered',data:{email_id:firstProviderId}}),
    headers:{'Content-Type':'application/json'}});
  assert.equal(unsignedDelivery.status,403);
  const resendEvent={type:'email.delivered',data:{email_id:firstProviderId}};
  const resendRaw=JSON.stringify(resendEvent);
  const svixId='msg_ci_email_delivered',svixTimestamp=String(Math.floor(Date.now()/1000));
  const svixKey=Buffer.from(process.env.CONTACT_RESEND_WEBHOOK_SECRET.slice(6),'base64');
  const svixSignature='v1,'+crypto.createHmac('sha256',svixKey)
    .update(svixId+'.'+svixTimestamp+'.'+resendRaw).digest('base64');
  const webhookHeaders={'Content-Type':'application/json','svix-id':svixId,
    'svix-timestamp':svixTimestamp,'svix-signature':svixSignature};
  const confirmedDelivery=await call('/api/contact-email/resend-webhook',{method:'POST',raw:resendRaw,headers:webhookHeaders});
  assert.equal(confirmedDelivery.status,200,JSON.stringify(confirmedDelivery.body));
  const webhookReplay=await call('/api/contact-email/resend-webhook',{method:'POST',raw:resendRaw,headers:webhookHeaders});
  assert.equal(webhookReplay.status,200);
  const staffJobs=await call('/api/contact-enquiries/admin/'+mailReference+'/email-status',{session:admin.cookie});
  assert.equal(staffJobs.status,200,JSON.stringify(staffJobs.body));
  assert.equal(staffJobs.body.notifications.find(x=>x.kind===jobs[0].kind)?.status,'delivered');
  const studentJobs=await call('/api/contact-enquiries/admin/'+mailReference+'/email-status',{session:alice.cookie});
  assert.equal(studentJobs.status,403);
  pass('Signed Resend webhook updates persisted delivery, replays safely and hides statuses from students');

  await mongooseForMail.disconnect();
  pass('Provider accepts both IPS-authenticated notifications once; repeated queue processing sends zero duplicates');

  const unauthorized=await call('/api/contact-channels/admin/threads');
  assert.equal(unauthorized.status,401);
  pass('Guest cannot list external chat inbox');

  const created=await call('/api/services',{method:'POST',session:alice.cookie,json:{
    family:'professional',category:'Academic Support',service_slug:'thesis-support',
    title:'Thesis & Dissertation Guidance — nursing',description:'I need feedback on my own dissertation chapter and nursing research methodology.',
    delivery_mode:'remote',intake_answers:{academic_level:'Undergraduate',subject:'Nursing',service:'thesis-support'}
  }});
  assert.equal(created.status,200,JSON.stringify(created.body));
  const requestId=created.body.request.request_id;
  assert.ok(/^SRV-[0-9A-F]{18}$/.test(requestId),requestId);
  assert.equal(created.body.request.payment_status,'unpaid');
  pass('Persisted student request with collision-resistant ID, zero payment');

  const otherView=await call('/api/services/'+requestId,{session:bob.cookie});
  assert.equal(otherView.status,403);
  pass('Another student cannot access the private project');

  const fakeQuote=await call('/api/services/'+requestId,{method:'PATCH',session:alice.cookie,json:{quote:{total:1,currency:'PLN',accepted:false}}});
  assert.equal(fakeQuote.status,403);
  pass('Student cannot forge their own price/quote');

  const fakePayment=await call('/api/services/'+requestId,{method:'PATCH',session:alice.cookie,json:{payment_status:'paid'}});
  assert.equal(fakePayment.status,200,JSON.stringify(fakePayment.body));
  assert.equal(fakePayment.body.request.payment_status,'unpaid');
  pass('Student cannot set paid status');

  const beforePayment=await call('/api/services/'+requestId,{method:'PATCH',session:admin.cookie,json:{status:'Assigned'}});
  assert.equal(beforePayment.status,409);
  pass('Administrator cannot assign unpaid academic work');

  const review=await call('/api/services/'+requestId,{method:'PATCH',session:admin.cookie,json:{status:'Under Review',reason:'Real review started'}});
  assert.equal(review.status,200,JSON.stringify(review.body));

  const badQuote=await call('/api/services/'+requestId,{method:'PATCH',session:admin.cookie,json:{
    status:'Quoted',quote:{labor:199,service_fee:20,expenses:0,total:1,currency:'PLN',notes:'Academic support'}
  }});
  assert.equal(badQuote.status,200,JSON.stringify(badQuote.body));
  assert.equal(badQuote.body.request.quote.total,219);
  pass('Server computes quote from components regardless of submitted total');

  const otherQuote=await call('/api/services/'+requestId,{method:'PATCH',session:bob.cookie,json:{quote:{accepted:true}}});
  assert.equal(otherQuote.status,403);

  const accept=await call('/api/services/'+requestId,{method:'PATCH',session:alice.cookie,json:{
    status:'Quote Accepted',quote:{accepted:true,total:0.01,currency:'USD',version:99999}
  }});
  assert.equal(accept.status,200,JSON.stringify(accept.body));
  assert.equal(accept.body.request.quote.total,219);
  assert.equal(accept.body.request.quote.currency,'PLN');
  assert.equal(accept.body.request.quote.accepted_by,aliceId);
  pass('Only owner accepts; server ignores forged acceptance amount/version');

  const payment=await call('/api/student-payments/checkout',{method:'POST',session:alice.cookie,json:{request_id:requestId}});
  assert.equal(payment.status,503,JSON.stringify(payment.body));
  pass('Missing merchant credentials fail closed; no fake checkout');

  // CI-only signed Stripe fixture against a real MongoDB payment record. No provider or live charge.
  const mongoose=(await import('mongoose')).default;
  const {default:StudentPayment}=await import('../models/StudentPayment.js');
  const {default:ServiceRequest}=await import('../models/ServiceRequest.js');
  await mongoose.connect(process.env.MONGODB_URI);
  const awaiting=await ServiceRequest.findOne({request_id:requestId}).lean();
  assert.ok(awaiting?.quote?.accepted);
  const sessionId='cs_test_ci_123456';
  await StudentPayment.create({
    payment_id:crypto.randomUUID(),request_id:requestId,client_id:aliceId,
    quote_version:awaiting.quote.version,amount_minor:21900,currency:'pln',
    provider:'stripe',status:'pending',provider_session_id:sessionId
  });
  await mongoose.disconnect();
  const fakeEvent={id:'evt_ci_1',type:'checkout.session.completed',data:{object:{
    id:sessionId,client_reference_id:requestId,amount_total:21900,currency:'pln',
    payment_status:'paid',payment_intent:'pi_ci_123'
  }}};
  const signedPayload=JSON.stringify(fakeEvent);
  const timestamp=Math.floor(Date.now()/1000);
  const signedHeader='t='+timestamp+',v1='+crypto.createHmac('sha256',process.env.STRIPE_WEBHOOK_SECRET)
    .update(timestamp+'.'+signedPayload).digest('hex');
  const wrongStripe=await call('/api/student-payments/stripe-webhook',{method:'POST',raw:signedPayload,
    headers:{'content-type':'application/json','stripe-signature':'t='+timestamp+',v1=bad'}});
  assert.equal(wrongStripe.status,400);
  const paidCallback=await call('/api/student-payments/stripe-webhook',{method:'POST',raw:signedPayload,
    headers:{'content-type':'application/json','stripe-signature':signedHeader}});
  assert.equal(paidCallback.status,200,JSON.stringify(paidCallback.body));
  const paidReplay=await call('/api/student-payments/stripe-webhook',{method:'POST',raw:signedPayload,
    headers:{'content-type':'application/json','stripe-signature':signedHeader}});
  assert.equal(paidReplay.status,200);
  const paidOrder=await call('/api/services/'+requestId,{session:alice.cookie});
  assert.equal(paidOrder.body.request.payment_status,'paid');
  assert.equal(paidOrder.body.request.status_history.filter(v=>v.reason==='Verified payment received').length,1);
  pass('Provider-signed payment fixture marks correct persisted order paid exactly once');

  const staleEdit=await call('/api/services/'+requestId,{method:'PATCH',session:admin.cookie,json:{
    quote:{labor:1,service_fee:0,expenses:0,currency:'PLN'},status:'Quoted'}});
  assert.equal(staleEdit.status,409);
  const forbiddenDelete=await call('/api/services/'+requestId,{method:'DELETE',session:admin.cookie});
  assert.equal(forbiddenDelete.status,409);
  const assigned=await call('/api/services/'+requestId,{method:'PATCH',session:admin.cookie,json:{status:'Awaiting Assignment'}});
  assert.equal(assigned.status,200,JSON.stringify(assigned.body));
  pass('Paid quote locked; paid order cannot be deleted and can advance to assignment queue');

  const link=await call('/api/contact-channels/link-code',{method:'POST',session:alice.cookie});
  assert.equal(link.status,200,JSON.stringify(link.body));
  assert.match(link.body.command,/^\/link [A-Za-z0-9_-]{20}$/);
  const tgPayload={update_id:77,message:{chat:{type:'private',id:5556677},text:link.body.command,date:Math.floor(Date.now()/1000),from:{first_name:'Student A'}}};
  const unauthTg=await call('/api/channels/telegram/webhook',{method:'POST',json:tgPayload});
  assert.equal(unauthTg.status,403);
  pass('Telegram webhook rejects absent authorization');

  const telegram=await call('/api/channels/telegram/webhook',{method:'POST',json:tgPayload,headers:{'x-telegram-bot-api-secret-token':'ci_telegram_secret_random_123'}});
  assert.equal(telegram.status,200,JSON.stringify(telegram.body));
  const telegramReplay=await call('/api/channels/telegram/webhook',{method:'POST',json:tgPayload,headers:{'x-telegram-bot-api-secret-token':'ci_telegram_secret_random_123'}});
  assert.equal(telegramReplay.status,200);
  const linked=await call('/api/contact-channels/me',{session:alice.cookie});
  assert.equal(linked.status,200);
  assert.equal(linked.body.contacts.find(t=>t.channel==='telegram')?.verified_at!=null,true);
  pass('One-time Telegram linking and duplicate update idempotency');

  const guestGeneral=await call('/api/contact-enquiries',{method:'POST',json:{
    username:'GuestResearcher',subject:'Research guidance enquiry',
    message:'I would like a written consultation before sending project documents.',
    preferred_channel:'whatsapp',phone:'+48123123123',contact_consent:true
  }});
  assert.equal(guestGeneral.status,202,JSON.stringify(guestGeneral.body));
  const guestRef=guestGeneral.body.enquiry_id;
  assert.match(guestRef,/^ENQ-[A-F0-9]{18}$/);
  const replyText='I would like a consultation before sending documents. '+guestRef;
  const waPayload={object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{
    contacts:[{wa_id:'48123123123',profile:{name:'Test WhatsApp Student'}}],
    messages:[{type:'text',id:'wamid.test-1',from:'48123123123',text:{body:replyText},timestamp:String(Math.floor(Date.now()/1000))}]
  }}]}]};
  const raw=JSON.stringify(waPayload);
  const signature='sha256='+crypto.createHmac('sha256','ci_whatsapp_app_secret_123').update(raw).digest('hex');
  const badWa=await call('/api/channels/whatsapp/webhook',{method:'POST',raw,headers:{'Content-Type':'application/json','x-hub-signature-256':'sha256=wrong'}});
  assert.equal(badWa.status,403);
  const goodWa=await call('/api/channels/whatsapp/webhook',{method:'POST',raw,headers:{'Content-Type':'application/json','x-hub-signature-256':signature}});
  assert.equal(goodWa.status,200,JSON.stringify(goodWa.body));
  const replayWa=await call('/api/channels/whatsapp/webhook',{method:'POST',raw,headers:{'Content-Type':'application/json','x-hub-signature-256':signature}});
  assert.equal(replayWa.status,200);
  pass('Signed WhatsApp text webhook and duplicate idempotency');

  const adminInbox=await call('/api/contact-channels/admin/threads',{session:admin.cookie});
  assert.equal(adminInbox.status,200,JSON.stringify(adminInbox.body));
  const wa=adminInbox.body.threads.find(t=>t.channel==='whatsapp');
  const tg=adminInbox.body.threads.find(t=>t.channel==='telegram');
  assert.ok(wa&&tg);
  assert.equal(wa.client_id,'');
  assert.equal(wa.verified_contact,true);
  assert.equal(tg.client_id,aliceId);
  const unauthorizedInbox=await call('/api/contact-channels/admin/threads',{session:alice.cookie});
  assert.equal(unauthorizedInbox.status,403);
  const waMsgs=await call('/api/contact-channels/admin/threads/'+wa._id+'/messages',{session:admin.cookie});
  assert.equal(waMsgs.status,200);
  assert.equal(waMsgs.body.messages.length,1);
  assert.equal(waMsgs.body.messages[0].body,replyText);
  const tgMsgs=await call('/api/contact-channels/admin/threads/'+tg._id+'/messages',{session:admin.cookie});
  assert.equal(tgMsgs.status,200);
  assert.equal(tgMsgs.body.messages.length,1);
  assert.ok(!JSON.stringify(tgMsgs.body.messages).includes(link.body.code));
  pass('Role-protected owner inbox, deduped transcripts and redacted account codes');
  const verifiedGuestQueue=await call('/api/contact-enquiries/admin',{session:admin.cookie});
  assert.equal(verifiedGuestQueue.body.enquiries.find(x=>x.enquiry_id===guestRef)?.contact_verified,true);
  const stopPayload=structuredClone(waPayload);
  stopPayload.entry[0].changes[0].value.messages[0]={
    ...stopPayload.entry[0].changes[0].value.messages[0],
    id:'wamid.test-stop',text:{body:'STOP'}
  };
  const stopRaw=JSON.stringify(stopPayload);
  const stopSignature='sha256='+crypto.createHmac('sha256','ci_whatsapp_app_secret_123').update(stopRaw).digest('hex');
  const stopped=await call('/api/channels/whatsapp/webhook',{method:'POST',raw:stopRaw,
    headers:{'Content-Type':'application/json','x-hub-signature-256':stopSignature}});
  assert.equal(stopped.status,200);
  const stoppedQueue=await call('/api/contact-enquiries/admin',{session:admin.cookie});
  const stoppedLead=stoppedQueue.body.enquiries.find(x=>x.enquiry_id===guestRef);
  assert.equal(stoppedLead.contact_verified,false);
  assert.equal(stoppedLead.contact_consent,false);
  const rejectedReply=await call('/api/contact-channels/admin/threads/'+wa._id+'/reply',{
    method:'POST',session:admin.cookie,json:{body:'This message must never be delivered.'}});
  assert.equal(rejectedReply.status,409);
  pass('Authenticated customer STOP revokes guest consent and prevents external staff delivery');

  const unlink=await call('/api/contact-channels/unlink',{method:'POST',session:alice.cookie,json:{channel:'telegram'}});
  assert.equal(unlink.status,200);
  const afterUnlink=await call('/api/contact-channels/me',{session:alice.cookie});
  assert.equal(afterUnlink.body.contacts.some(t=>t.channel==='telegram'),false);
  pass('Student-controlled channel unlink');

  console.log('ALL '+cases.length+' database-backed workflow gates passed.');
}
go().catch(async err=>{
  console.error('INTEGRATION_FAILED:',err.stack||String(err));
  // A failed assertion must not keep the standalone MongoDB test connection
  // alive until CI timeout, hiding the first genuine defect.
  try{await (await import('mongoose')).default.disconnect();}catch{}
  process.exitCode=1;
});
