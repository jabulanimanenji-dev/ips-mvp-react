import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePublicEnquiry,canSendContactEmail,sendEmailReply,attestManualWhatsAppContact } from '../services/contactEnquiries.js';
import {permissionForAdminRequest} from '../shared/adminPermissions.js';
import { IPS_EMAILS, IPS_EMAIL_DOMAIN, isIPSEmail } from '../shared/businessEmails.js';

const enquiry={
  username:'QuietStudent',
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
  assert.equal(value.username,'QuietStudent');
});
test('phone callbacks are forbidden; only explicit written WhatsApp is available',()=>{
  assert.ok(validatePublicEnquiry({...enquiry,preferred_channel:'phone'}).error);
  assert.ok(validatePublicEnquiry({...enquiry,preferred_channel:'whatsapp',phone:'794 088 714'}).error);
  assert.equal(validatePublicEnquiry({...enquiry,preferred_channel:'whatsapp',phone:'+48 794 088 714'}).value.phone,'+48794088714');
  assert.ok(validatePublicEnquiry({...enquiry,username:'Legal Name'}).error);
});
test('no unsolicited contact without explicit enquiry consent',()=>{
  assert.ok(validatePublicEnquiry({...enquiry,contact_consent:false}).error);
  assert.ok(validatePublicEnquiry({...enquiry,website:'bot-honeypot'}).error);
  assert.ok(validatePublicEnquiry({...enquiry,preferred_channel:'telegram',email:'',phone:''}).error);
  assert.equal(validatePublicEnquiry({...enquiry,preferred_channel:'telegram',email:'',phone:'',telegram_username:'QuietResearcher'}).value.telegram_username,'quietresearcher');
  assert.ok(validatePublicEnquiry({...enquiry,preferred_channel:'email',email:''}).error);
  assert.ok(validatePublicEnquiry({...enquiry,message:'hello'}).error);
});
test('outbound email stays unavailable until sender and credential are configured',()=>{
  assert.equal(canSendContactEmail({}),false);
  assert.equal(canSendContactEmail({CONTACT_RESEND_API_KEY:'test'}),false);
  assert.equal(canSendContactEmail({CONTACT_RESEND_API_KEY:'test',CONTACT_FROM_EMAIL:'support@ips.example'}),false);
  assert.equal(canSendContactEmail({CONTACT_RESEND_API_KEY:'test',CONTACT_FROM_EMAIL:'personal@gmail.com',CONTACT_REPLY_TO_EMAIL:'contact@ipsglobalservice.com'}),false);
  assert.equal(canSendContactEmail({CONTACT_RESEND_API_KEY:'test',CONTACT_FROM_EMAIL:'support@ipsglobalservice.com',CONTACT_REPLY_TO_EMAIL:'personal@gmail.com'}),false);
  assert.equal(canSendContactEmail({CONTACT_RESEND_API_KEY:'test',CONTACT_FROM_EMAIL:'support@ipsglobalservice.com',CONTACT_REPLY_TO_EMAIL:'contact@ipsglobalservice.com'}),true);
});
test('provider email reply is plain text to stored email, not arbitrary browser-supplied destination',async()=>{
  let observed;
  const env={CONTACT_RESEND_API_KEY:'ci-fake-only',CONTACT_FROM_EMAIL:'support@ipsglobalservice.com',CONTACT_REPLY_TO_EMAIL:'contact@ipsglobalservice.com'};
  const request=async (url,opts)=>{observed={url,opts};return {ok:true,json:async()=>({id:'provider-fixture-email-123'})};};
  const providerId=await sendEmailReply({to:'student@example.org',subject:'Project guidance',
    body:'Thank you for reaching out.',reference:'ENQ-LOCALTEST',env,request});
  assert.equal(providerId,'provider-fixture-email-123');
  assert.equal(observed.url,'https://api.resend.com/emails');
  const payload=JSON.parse(observed.opts.body);
  assert.deepEqual(payload.to,['student@example.org']);
  assert.ok(payload.text.includes('ENQ-LOCALTEST'));
  assert.equal(payload.reply_to,'contact@ipsglobalservice.com');
  assert.equal(payload.from,'IPS Academic Services <support@ipsglobalservice.com>');
  assert.equal(observed.opts.headers.Authorization,'Bearer ci-fake-only');
});


test('IPS email identities use only the verified business domain and five intentional inbox roles',()=>{
  assert.equal(IPS_EMAIL_DOMAIN,'ipsglobalservice.com');
  assert.equal(Object.keys(IPS_EMAILS).length,5);
  assert.equal(IPS_EMAILS.orders,'orders@ipsglobalservice.com');
  assert.equal(IPS_EMAILS.billing,'billing@ipsglobalservice.com');
  assert.equal(IPS_EMAILS.privacy,'privacy@ipsglobalservice.com');
  assert.equal(isIPSEmail('support@ipsglobalservice.com'),true);
  assert.equal(isIPSEmail('personal@gmail.com'),false);
});

test('manual WhatsApp confirmation requires exact reference, observed sender and explicit staff attestation',async()=>{
  const ref='IPS-Q-ABCDEF0123456789AB';
  const calls=[];
  const model={updateOne:async(filter,update)=>{calls.push({filter,update});return {modifiedCount:1};}};
  const input={enquiryId:ref,observedReference:ref,observedPhone:'+48 794 088 714',
    attested:true,reviewerId:'IPS-REVIEWER-17',model,now:()=>new Date('2026-11-20T15:00:00Z')};
  const accepted=await attestManualWhatsAppContact(input);
  assert.equal(accepted.success,true);
  assert.equal(accepted.verification_method,'whatsapp_manual_attested');
  assert.equal(calls.length,1);
  assert.equal(calls[0].filter.phone,'+48794088714');
  assert.equal(calls[0].filter.contact_consent,true);
  assert.equal(calls[0].filter.contact_verified,false);
  assert.equal(calls[0].filter.preferred_channel,'whatsapp');
  assert.deepEqual(calls[0].filter.status,{$ne:'closed'});
  assert.equal(calls[0].update.$set.contact_verified_by,'IPS-REVIEWER-17');
  assert.equal(calls[0].update.$set.contact_verification_method,'whatsapp_manual_attested');
  assert.equal(calls[0].update.$unset.purge_at,'');
  for(const override of [
    {observedReference:'IPS-Q-000000000000000000'},
    {observedPhone:'invalid'},
    {observedPhone:'+48111111111',attested:false},
    {reviewerId:''},
    {attested:false}
  ]){
    const rejected=await attestManualWhatsAppContact({...input,...override});
    assert.equal(rejected.status,400);
    assert.equal(rejected.success,false);
  }
  assert.equal(calls.length,1);
  assert.equal((await attestManualWhatsAppContact({...input,model:{updateOne:async()=>({modifiedCount:0})}})).status,409);
});
test('manual WhatsApp actions belong to support.manage and are never public authentication',()=>{
  const id='IPS-Q-ABCDEF0123456789AB';
  assert.equal(permissionForAdminRequest('POST','/api/contact-enquiries/admin/'+id+'/whatsapp-manual-verify'),'support.manage');
  assert.equal(permissionForAdminRequest('POST','/api/contact-enquiries/admin/'+id+'/whatsapp-contact-withdrawn'),'support.manage');
});
