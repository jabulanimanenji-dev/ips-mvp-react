import test from 'node:test';
import assert from 'node:assert/strict';
import {productionConfigurationErrors} from '../shared/runtimeConfig.js';
import {acceptsStripeEvent} from '../services/studentPayments.js';
const baseline=()=>({
  NODE_ENV:'production',IPS_STAGING_MODE:'true',
  MONGODB_URI:'mongodb+srv://ci-user:ci-password@ci.example.net/ips_staging_review?retryWrites=true',
  R2_BUCKET_NAME:'ips-academic-staging',
  CONTACT_EMAIL_NOTIFICATIONS_ENABLED:'false',
  PUBLIC_APP_URL:'https://ips-academic-staging.onrender.com'
});
const stageErrors=env=>productionConfigurationErrors(env).filter(x=>/Staging/.test(x));
test('staging refuses credentials selecting the real production database',()=>{
  const env=baseline();
  env.MONGODB_URI=env.MONGODB_URI.replace('ips_staging_review','ips_production');
  assert.ok(stageErrors(env).some(x=>x.includes('MongoDB')));
});
test('staging rejects unisolated R2 storage, production domains and live payments',()=>{
  const env=baseline();
  env.R2_BUCKET_NAME='ips-customer-files';
  env.PUBLIC_APP_URL='https://www.ipsglobalservice.com';
  env.STRIPE_SECRET_KEY='example-real-payment-key-do-not-use';
  env.CONTACT_EMAIL_NOTIFICATIONS_ENABLED='true';
  const errors=stageErrors(env);
  assert.ok(errors.some(x=>x.includes('R2')));
  assert.ok(errors.some(x=>x.includes('production domain')));
  assert.ok(errors.some(x=>x.includes('Stripe')));
  assert.ok(errors.some(x=>x.includes('email')));
});
test('distinct staging database, bucket and public URL satisfy isolation conditions',()=>{
  assert.deepEqual(stageErrors(baseline()),[]);
});

test('staging permits only genuine test-mode Stripe credentials and keeps signed test webhook boundary',()=>{
  const env={...baseline(),STRIPE_SECRET_KEY:'sk_test_AAAAAAAAAAAAAAAAAA',
    STRIPE_WEBHOOK_SECRET:'whsec_BBBBBBBBBBBBBBBBBB'};
  assert.deepEqual(stageErrors(env),[]);
  assert.ok(stageErrors({...env,STRIPE_SECRET_KEY:'sk_live_AAAAAAAAAAAAAAAAAA'})
    .some(x=>x.includes('Stripe')));
  assert.ok(stageErrors({...env,STRIPE_WEBHOOK_SECRET:''})
    .some(x=>x.includes('webhook')));
  assert.ok(stageErrors({...env,STRIPE_SECRET_KEY:''})
    .some(x=>x.includes('webhook')));
});
test('staging requires explicit, exact email-recipient allowlist before enabling account verification mail',()=>{
  const allowed={...baseline(),CONTACT_RESEND_API_KEY:'re_test_staging_example',
    IPS_STAGING_ALLOWLIST_EMAILS:'student.test@example.org,ops.test@example.org'};
  assert.deepEqual(stageErrors(allowed),[]);
  assert.ok(stageErrors({...allowed,IPS_STAGING_ALLOWLIST_EMAILS:''})
    .some(x=>x.includes('allowlist')));
  assert.ok(stageErrors({...allowed,IPS_STAGING_ALLOWLIST_EMAILS:'*@example.org'})
    .some(x=>x.includes('allowlist')));
});

test('test-mode-only staging refuses real-money and ambiguous signed checkout/refund events',()=>{
  const env={IPS_STAGING_MODE:'true'};
  assert.equal(acceptsStripeEvent({id:'evt_test',livemode:false},env),true);
  assert.equal(acceptsStripeEvent({id:'evt_live',livemode:true},env),false);
  assert.equal(acceptsStripeEvent({id:'evt_ambiguous'},env),false);
  assert.equal(acceptsStripeEvent({id:'evt_live'},{}),true);
});
