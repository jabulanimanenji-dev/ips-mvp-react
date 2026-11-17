import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePublicEnquiry,canSendContactEmail,sendEmailReply } from '../services/contactEnquiries.js';

const enquiry={
  name:'Student Example',
  email:'student@example.org',
  phone:'+48794088714',
  subject:'Question about editing',
  message:'I would like IPS to follow up about editing an authorized document.',
  preferred_channel:'email',
  contact_consent:true
};
test('enquiry accepts a consented email contact and normalizes contact details',()=>{
  const value=validatePublicEnquiry({...enquiry,email:' STUDENT@EXAMPLE.ORG '}).value;
  assert.equal(value.email,'student@example.org');
  assert.equal(value.contact_consent,true);
  assert.equal(value.name,'Student Example');
});
test('callback requires a full international phone number',()=>{
  assert.ok(validatePublicEnquiry({...enquiry,preferred_channel:'phone',phone:''}).error);
  assert.ok(validatePublicEnquiry({...enquiry,preferred_channel:'whatsapp',phone:'794 088 714'}).error);
  assert.equal(validatePublicEnquiry({...enquiry,preferred_channel:'phone',email:''}).value.phone,'+48794088714');
  assert.equal(validatePublicEnquiry({...enquiry,preferred_channel:'phone',phone:'+48 794 088 714'}).value.phone,'+48794088714');
});
test('no unsolicited contact without explicit enquiry consent',()=>{
  assert.ok(validatePublicEnquiry({...enquiry,contact_consent:false}).error);
  assert.ok(validatePublicEnquiry({...enquiry,website:'bot-honeypot'}).error);
  assert.ok(validatePublicEnquiry({...enquiry,preferred_channel:'telegram',email:'',phone:''}).error);
  assert.ok(validatePublicEnquiry({...enquiry,preferred_channel:'email',email:''}).error);
  assert.ok(validatePublicEnquiry({...enquiry,message:'hello'}).error);
});
test('outbound email stays unavailable until sender and credential are configured',()=>{
  assert.equal(canSendContactEmail({}),false);
  assert.equal(canSendContactEmail({CONTACT_RESEND_API_KEY:'test'}),false);
  assert.equal(canSendContactEmail({CONTACT_RESEND_API_KEY:'test',CONTACT_FROM_EMAIL:'support@ips.example'}),true);
});
test('provider email reply is plain text to stored email, not arbitrary browser-supplied destination',async()=>{
  let observed;
  const env={CONTACT_RESEND_API_KEY:'ci-fake-only',CONTACT_FROM_EMAIL:'no-reply@ips.example',CONTACT_REPLY_TO_EMAIL:'help@ips.example'};
  const request=async (url,opts)=>{observed={url,opts};return {ok:true,json:async()=>({id:'provider-fixture-email-123'})};};
  const providerId=await sendEmailReply({to:'student@example.org',subject:'Project guidance',
    body:'Thank you for reaching out.',reference:'ENQ-LOCALTEST',env,request});
  assert.equal(providerId,'provider-fixture-email-123');
  assert.equal(observed.url,'https://api.resend.com/emails');
  const payload=JSON.parse(observed.opts.body);
  assert.deepEqual(payload.to,['student@example.org']);
  assert.ok(payload.text.includes('ENQ-LOCALTEST'));
  assert.equal(payload.reply_to,'help@ips.example');
  assert.equal(observed.opts.headers.Authorization,'Bearer ci-fake-only');
});
