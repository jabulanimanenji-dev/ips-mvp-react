import test from 'node:test';
import assert from 'node:assert/strict';
import {productionConfigurationErrors} from '../shared/runtimeConfig.js';
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
  assert.ok(errors.some(x=>x.includes('payment')));
  assert.ok(errors.some(x=>x.includes('email')));
});
test('distinct staging database, bucket and public URL satisfy isolation conditions',()=>{
  assert.deepEqual(stageErrors(baseline()),[]);
});
