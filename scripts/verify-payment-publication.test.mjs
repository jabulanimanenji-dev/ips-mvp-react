import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentLaunchState} from '../shared/paymentLaunch.js';

const simulatedKey=(mode)=>['sk',mode,'NOT_A_REAL_CREDENTIAL_ABCDEFGHIJKLMNOP'].join('_');
const live={
  NODE_ENV:'production',
  PUBLIC_APP_URL:'https://www.ipsglobalservice.com',
  STRIPE_SECRET_KEY:simulatedKey('live'),
  STRIPE_WEBHOOK_SECRET:['whsec','FAKE_NOT_A_SECRET_ABCDEFGHIJKLMNOP'].join('_')
};
test('publication leaves checkout disabled even if inherited Render secrets exist',()=>{
  const result=paymentLaunchState(live);
  assert.equal(result.enabled,false);
  assert.equal(result.pending,true);
  assert.match(result.notice,/do not transfer money/i);
});
test('payment launch cannot be enabled with missing provider credentials',()=>{
  assert.equal(paymentLaunchState({...live,IPS_PAYMENTS_ENABLED:'true',STRIPE_SECRET_KEY:''}).enabled,false);
  assert.equal(paymentLaunchState({...live,IPS_PAYMENTS_ENABLED:'true',STRIPE_WEBHOOK_SECRET:''}).enabled,false);
  assert.equal(paymentLaunchState({...live,IPS_PAYMENTS_ENABLED:'true',PUBLIC_APP_URL:'http://www.ipsglobalservice.com'}).enabled,false);
});
test('payment launch requires explicit selection and correct live provider configuration',()=>{
  assert.equal(paymentLaunchState({...live,IPS_PAYMENTS_ENABLED:'true'}).enabled,true);
  assert.equal(paymentLaunchState({...live,IPS_PAYMENTS_ENABLED:'yes'}).enabled,false);
});
test('production cannot accidentally activate a Stripe test-mode provider or insecure URL',()=>{
  const sandbox={...live,IPS_PAYMENTS_ENABLED:'true',STRIPE_SECRET_KEY:simulatedKey('test')};
  assert.equal(paymentLaunchState(sandbox).enabled,false);
  assert.equal(paymentLaunchState({...sandbox,NODE_ENV:'test'}).enabled,true);
  assert.equal(paymentLaunchState({...sandbox,IPS_STAGING_MODE:'true',NODE_ENV:'production'}).enabled,true);
});
test('evaluation never takes real or test money even when provider credentials are configured',()=>{
  assert.equal(paymentLaunchState({...live,IPS_PAYMENTS_ENABLED:'true',IPS_EVALUATION_MODE:'true'}).enabled,false);
});
