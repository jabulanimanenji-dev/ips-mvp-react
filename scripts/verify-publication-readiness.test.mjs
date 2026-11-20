import test from 'node:test';
import assert from 'node:assert/strict';
import {nonpaymentPublicationGaps,enforcePublicationGate} from '../shared/publicationReadiness.js';

const safeFixture=()=>{
  const env={
    NODE_ENV:'production',IPS_PUBLICATION_STRICT:'true',
    MONGODB_URI:'mongodb://fake:ci_pass@127.0.0.1/ips_publication',
    STORAGE_PROVIDER:'r2',
    R2_ENDPOINT:'https://'+('a'.repeat(32))+'.r2.cloudflarestorage.com/',
    R2_BUCKET_NAME:'ips-private-storage',
    R2_PREFIX:'production',
    CONTACT_RESEND_API_KEY:'CI-only-not-real-email-key',
    CONTACT_FROM_EMAIL:'support@ipsglobalservice.com',
    CONTACT_REPLY_TO_EMAIL:'contact@ipsglobalservice.com',
    EMAIL_VERIFICATION_SECRET:'CI-only-example-email-verification-secret-123',
    CONTACT_EMAIL_NOTIFICATIONS_ENABLED:'true',
    CONTACT_RESEND_WEBHOOK_SECRET:'whsec_CI_REPLACE_WITH_REAL_SECRET',
    TELEGRAM_BOT_USERNAME:'IPScontactBot',
    TELEGRAM_BOT_TOKEN:'CI-no-network-bot-token',
    TELEGRAM_WEBHOOK_SECRET:'CI-private-webhook-token',
    WHATSAPP_PUBLIC_NUMBER:'48794088714',
    PUBLIC_APP_URL:'https://www.ipsglobalservice.com'
  };
  return env;
};
test('production refuses to claim only-payments-left when all nonpayment providers are absent',()=>{
  const missing=nonpaymentPublicationGaps({NODE_ENV:'production',IPS_PUBLICATION_STRICT:'true'});
  assert.ok(missing.includes('real-verified-email-signups-and-account-recovery'));
  assert.ok(missing.includes('telegram-business-channel'));
  assert.ok(missing.includes('whatsapp-direct-contact')===false); // company-approved public number has a valid direct link
  assert.ok(missing.includes('persistent-private-object-storage'));
  assert.throws(()=>enforcePublicationGate({NODE_ENV:'production',IPS_PUBLICATION_STRICT:'true'}),
    /nonpayment publication gate rejected/);
});
test('strict publication gate accepts configured nonpayment providers but not payments',()=>{
  const env=safeFixture();
  assert.deepEqual(nonpaymentPublicationGaps(env),[]);
  assert.deepEqual(enforcePublicationGate(env),[]);
  assert.equal(enforcePublicationGate({...env,IPS_PUBLICATION_STRICT:'false'}).length,0);
});
test('the launch gate catches missing mail, messaging, receipt, storage and company-domain fields independently',()=>{
  const env=safeFixture();
  const broken=[
    [{CONTACT_RESEND_API_KEY:''},'real-verified-email-signups-and-account-recovery'],
    [{TELEGRAM_BOT_TOKEN:''},'telegram-business-channel'],
    [{WHATSAPP_PUBLIC_NUMBER:'bad-number'},'whatsapp-direct-contact'],
    [{CONTACT_RESEND_WEBHOOK_SECRET:''},'email-delivery-receipts'],
    [{CONTACT_EMAIL_NOTIFICATIONS_ENABLED:'false'},'written-confirmation-delivery-worker'],
    [{STORAGE_PROVIDER:'local'},'persistent-private-object-storage'],
    [{PUBLIC_APP_URL:'http://example.org'},'verified-company-public-origin']
  ];
  for(const [override,expected] of broken)
    assert.ok(nonpaymentPublicationGaps({...env,...override}).includes(expected),expected);
});
test('direct WhatsApp needs no Meta Cloud API or webhook credentials',()=>{
  const env=safeFixture();
  assert.equal(env.WHATSAPP_ACCESS_TOKEN,undefined);
  assert.equal(env.WHATSAPP_APP_SECRET,undefined);
  assert.equal(env.WHATSAPP_PHONE_NUMBER_ID,undefined);
  assert.equal(nonpaymentPublicationGaps(env).includes('whatsapp-direct-contact'),false);
  assert.ok(nonpaymentPublicationGaps({...env,WHATSAPP_CONTACT_MODE:'api'})
    .includes('whatsapp-direct-contact'));
});
test('evaluation deliberately remains separate and never receives production provider authority',()=>{
  assert.deepEqual(nonpaymentPublicationGaps({NODE_ENV:'production',IPS_EVALUATION_MODE:'true'}),[]);
  assert.deepEqual(nonpaymentPublicationGaps({NODE_ENV:'development'}),[]);
});
