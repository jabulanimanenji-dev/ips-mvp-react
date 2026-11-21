import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {issueEmailChallenge,confirmEmailChallenge} from '../services/accountVerification.js';

const env={NODE_ENV:'development',PUBLIC_APP_URL:'http://127.0.0.1:8080',
  CONTACT_RESEND_API_KEY:'test-only-no-network',
  CONTACT_FROM_EMAIL:'support@ipsglobalservice.com',
  CONTACT_REPLY_TO_EMAIL:'contact@ipsglobalservice.com',
  EMAIL_VERIFICATION_SECRET:'isolated-guest-verification-secret-1234567890'};
function request(type){
  return {enquiry_id:(type==='quote'?'IPS-Q-':'ENQ-')+'A'.repeat(18),
    request_type:type,email:'private-client@example.org',
    async save(){this.saved=(this.saved||0)+1;}};
}
for(const type of ['quote','general']){
  test('public '+type+' contact gets one-click email proof rather than a client-account link',async()=>{
    const record=request(type),mail=[];
    const issued=await issueEmailChallenge(record,{env,codeFactory:()=>'12345678',
      send:async message=>mail.push(message)});
    assert.equal(issued.verification_required,true);
    assert.equal(mail.length,1);
    const link=mail[0].body.match(/http:\/\/127\.0\.0\.1:8080\/verify-email#[^\s]+/);
    assert.ok(link,'One-click link must be in the actual email body');
    const params=new URLSearchParams(link[0].split('#')[1]);
    assert.equal(params.get('role'),type==='general'?'enquiry':'quote');
    assert.equal(params.get(type==='quote'?'quote_id':'enquiry_id'),record.enquiry_id);
    assert.equal(params.get('email'),record.email);
    assert.equal(params.get('code'),'12345678');
    const verified=await confirmEmailChallenge(record,'12345678',{env});
    assert.equal(verified.success,true);
    const replay=await confirmEmailChallenge(record,'12345678',{env});
    assert.equal(replay.status,400,'Mailbox proof must not be reusable');
  });
}
test('client and specialist verification link behavior remains unchanged',async()=>{
  for(const [account,expected] of [
    [{email:'client@example.org',async save(){}} ,'client'],
    [{email:'writer@example.org',writer_id:'WID-TEST',async save(){}} ,'writer']
  ]){
    const mail=[];
    await issueEmailChallenge(account,{env,codeFactory:()=>'87654321',
      send:async msg=>mail.push(msg)});
    assert.match(mail[0].body,new RegExp('role='+expected));
  }
});
test('saved guest quotation and general enquiry can reissue proof without staff or duplicate submission',async()=>{
  const [quote,general,page,form]=await Promise.all([
    readFile(new URL('../services/quoteRequests.js',import.meta.url),'utf8'),
    readFile(new URL('../services/contactEnquiries.js',import.meta.url),'utf8'),
    readFile(new URL('../src/pages/EmailConfirmationPage.jsx',import.meta.url),'utf8'),
    readFile(new URL('../src/components/public/QuoteRequestForm.jsx',import.meta.url),'utf8')
  ]);
  assert.match(quote,/\/api\/quote-requests\/resend-verification/);
  assert.match(general,/\/api\/contact-enquiries\/resend-verification/);
  assert.match(quote,/email_delivery_pending/);
  assert.match(general,/email_delivery_pending/);
  assert.match(quote,/success:true,\.\.\.contactStatus\(lead\)/);
  assert.match(page,/contactRole\(targetRole\)/);
  assert.match(page,/quote_id:reference/);
  assert.match(form,/Resend verification email/);
  assert.match(form,/email_delivery_pending/);
});
