import test from 'node:test';
import assert from 'node:assert/strict';
import { IPS_EMAILS } from '../shared/businessEmails.js';
import { canSendContactEmail,sendBusinessEmail } from '../services/businessEmailTransport.js';
import { contactNotificationsEnabled,emailJobDefinitions } from '../services/contactEmailQueue.js';

const env={
  CONTACT_EMAIL_NOTIFICATIONS_ENABLED:'true',
  CONTACT_RESEND_API_KEY:'ci-local-mock-no-real-delivery',
  CONTACT_FROM_EMAIL:'support@ipsglobalservice.com',
  CONTACT_REPLY_TO_EMAIL:'contact@ipsglobalservice.com'
};
const enquiry={
  enquiry_id:'ENQ-ABCDE12345',username:'QuietStudent',name:'',email:'student@example.org',
  contact_consent:true,contact_verified:true,preferred_channel:'email',
  subject:'Help with research planning',messages:[{body:'Private research data must not appear in outbound queue.'}]
};
test('notifications cannot activate without explicit enablement and correct IPS-only sender',()=>{
  assert.equal(contactNotificationsEnabled({}),false);
  assert.equal(contactNotificationsEnabled({...env,CONTACT_EMAIL_NOTIFICATIONS_ENABLED:'false'}),false);
  assert.equal(contactNotificationsEnabled({...env,CONTACT_REPLY_TO_EMAIL:'personal@gmail.com'}),false);
  assert.equal(canSendContactEmail(env),true);
});
test('outbox composes only consented receipt and minimal staff alert',()=>{
  const all=emailJobDefinitions(enquiry);
  assert.equal(all.length,2);
  assert.equal(all[0].recipient,IPS_EMAILS.contact);
  assert.equal(all[1].recipient,'student@example.org');
  assert.ok(!JSON.stringify(all).includes('Private research data'));
  assert.ok(all[1].body.includes('No work has been ordered or charged'));
  assert.equal(emailJobDefinitions({...enquiry,email:'',contact_consent:true}).length,1);
  assert.equal(emailJobDefinitions({...enquiry,contact_consent:false}).length,1);
  assert.equal(emailJobDefinitions({...enquiry,contact_verified:false}).length,1);
  assert.equal(emailJobDefinitions({...enquiry,preferred_channel:'telegram'}).length,1);
  assert.ok(!JSON.stringify(all).includes('Example Student'));
});
test('provider receives IPS sender, correct reply path, stable idempotency header',async()=>{
  let calls=0;
  const request=async(url,options)=>{
    calls++;
    assert.equal(url,'https://api.resend.com/emails');
    assert.equal(options.headers['Idempotency-Key'],'ips-enquiry/ENQ-ABCDE12345/client_receipt');
    const body=JSON.parse(options.body);
    assert.equal(body.from,'IPS Academic Services <support@ipsglobalservice.com>');
    assert.equal(body.reply_to,'contact@ipsglobalservice.com');
    assert.deepEqual(body.to,['student@example.org']);
    assert.ok(!body.text.includes('Private research data'));
    return {ok:true,status:200,json:async()=>({id:'mock-provider-1'})};
  };
  const job=emailJobDefinitions(enquiry)[1];
  const id=await sendBusinessEmail({
    to:job.recipient,subject:job.subject,body:job.body,
    idempotencyKey:'ips-enquiry/ENQ-ABCDE12345/client_receipt',env,request
  });
  assert.equal(id,'mock-provider-1');
  assert.equal(calls,1);
});
test('mail transport rejects personal sender and invalid message identities',async()=>{
  let calls=0;
  const request=async()=>{calls++;return {ok:true,json:async()=>({id:'never'})};};
  await assert.rejects(sendBusinessEmail({to:'client@example.org',subject:'Receipt',body:'Hello',env:{...env,CONTACT_FROM_EMAIL:'personal@gmail.com'},request}),/not configured/);
  await assert.rejects(sendBusinessEmail({to:'client@example.org',subject:'Receipt',body:'Hello',idempotencyKey:'bad key',env,request}),/identity/);
  assert.equal(calls,0);
});
