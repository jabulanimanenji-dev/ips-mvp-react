import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const BASE=process.env.IPS_TEST_BASE_URL||'http://127.0.0.1:8080';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const cases=[];
async function call(path,{method='GET',session='',json,headers={},raw}={}){
  const res=await fetch(BASE+path,{
    method,headers:{...(session?{cookie:session}:{}),...(json?{'Content-Type':'application/json'}:{}),...headers},
    body:json?JSON.stringify(json):raw
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

  const alice=await call('/api/clients',{method:'POST',json:{full_name:'Student Alice',email:'alice.test@example.invalid',password:'ExampleTestPassword123!'}});
  assert.equal(alice.status,200,JSON.stringify(alice.body));
  assert.ok(alice.cookie.startsWith('ips_session='));
  const aliceId=alice.body.client.client_id;
  pass('Real student signup and signed HttpOnly cookie');

  const bob=await call('/api/clients',{method:'POST',json:{full_name:'Student Bob',email:'bob.test@example.invalid',password:'ExampleTestPassword123!'}});
  assert.equal(bob.status,200);
  assert.notEqual(bob.body.client.client_id,aliceId);
  pass('Separate student identity');

  const admin=await call('/api/admin/login',{method:'POST',json:{email:'owner-ci@example.invalid',password:'LocalOnlyAdminPassword123!'}});
  assert.equal(admin.status,200,JSON.stringify(admin.body));
  pass('Actual administrator authentication');

  const publicContact={name:'Guest Student',email:'guest@example.org',phone:'+48794088714',
    preferred_channel:'phone',subject:'Please call me about research coaching',
    message:'I would like to discuss your research coaching service and get a callback.',contact_consent:true};
  const invalidContact=await call('/api/contact-enquiries',{method:'POST',json:{...publicContact,contact_consent:false}});
  assert.equal(invalidContact.status,400);
  const submitted=await call('/api/contact-enquiries',{method:'POST',json:publicContact});
  assert.equal(submitted.status,201,JSON.stringify(submitted.body));
  const reference=submitted.body.enquiry_id;
  assert.match(reference,/^ENQ-[A-F0-9]{18}$/);
  pass('Guest enquiry and callback saved without signup or payment');

  const guestQueue=await call('/api/contact-enquiries/admin');
  assert.equal(guestQueue.status,401);
  const clientQueue=await call('/api/contact-enquiries/admin',{session:alice.cookie});
  assert.equal(clientQueue.status,403);
  const ownerQueue=await call('/api/contact-enquiries/admin',{session:admin.cookie});
  assert.equal(ownerQueue.status,200,JSON.stringify(ownerQueue.body));
  assert.equal(ownerQueue.body.enquiries.find(x=>x.enquiry_id===reference)?.phone,'+48794088714');
  pass('Only IPS administrators see guest contact details and explicit reply consent');

  const noEmail=await call('/api/contact-enquiries/admin/'+reference+'/email-reply',{
    method:'POST',session:admin.cookie,json:{message:'We will call you to discuss the enquiry.'}});
  assert.equal(noEmail.status,503,JSON.stringify(noEmail.body));
  const moved=await call('/api/contact-enquiries/admin/'+reference,{
    method:'PATCH',session:admin.cookie,json:{status:'in_progress',admin_note:'Callback requested by student'}});
  assert.equal(moved.status,200);
  assert.equal(moved.body.enquiry.status,'in_progress');
  const ownerQueueAfter=await call('/api/contact-enquiries/admin',{session:admin.cookie});
  assert.equal(ownerQueueAfter.body.enquiries.find(x=>x.enquiry_id===reference)?.messages.length,1);
  pass('Owner manages callback queue; unconfigured email never pretends to send');

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

  const replyText='I would like a consultation before sending documents';
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

  const unlink=await call('/api/contact-channels/unlink',{method:'POST',session:alice.cookie,json:{channel:'telegram'}});
  assert.equal(unlink.status,200);
  const afterUnlink=await call('/api/contact-channels/me',{session:alice.cookie});
  assert.equal(afterUnlink.body.contacts.some(t=>t.channel==='telegram'),false);
  pass('Student-controlled channel unlink');

  console.log('ALL '+cases.length+' database-backed workflow gates passed.');
}
go().catch(err=>{console.error('INTEGRATION_FAILED:',err.stack||String(err));process.exitCode=1;});
