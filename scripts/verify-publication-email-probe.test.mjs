import test from 'node:test';
import assert from 'node:assert/strict';
import {sendPublicationEmailProbe} from '../services/publicationEmailProbe.js';

const env={
  NODE_ENV:'production',IPS_PUBLICATION_STRICT:'true',
  IPS_EMAIL_PROBE_RUN_ID:'20261120_company_mail_1',
  CONTACT_RESEND_API_KEY:'ci-no-network',
  CONTACT_FROM_EMAIL:'support@ipsglobalservice.com',
  CONTACT_REPLY_TO_EMAIL:'contact@ipsglobalservice.com'
};
test('internal production mail probe is opt-in, company-only and idempotent',async()=>{
  const calls=[];
  const result=await sendPublicationEmailProbe({env,send:async args=>{
    calls.push(args);return 'mock-resend-accepted-001';
  }});
  assert.deepEqual(result,{accepted:true,run_id:env.IPS_EMAIL_PROBE_RUN_ID});
  assert.equal(calls.length,1);
  assert.equal(calls[0].to,'contact@ipsglobalservice.com');
  assert.equal(calls[0].subject,'IPS production Resend delivery check - '+env.IPS_EMAIL_PROBE_RUN_ID);
  assert.equal(calls[0].idempotencyKey,'ips-publication-probe/'+env.IPS_EMAIL_PROBE_RUN_ID);
  assert.ok(!calls[0].body.includes('student'));
  assert.equal(calls[0].env,env);
});
test('probe never contacts external provider without explicit strict production approval',async()=>{
  const never=async()=>{throw Error('unexpected network')};
  assert.deepEqual(await sendPublicationEmailProbe({env:{...env,IPS_EMAIL_PROBE_RUN_ID:''},send:never}),{skipped:true});
  assert.deepEqual(await sendPublicationEmailProbe({env:{...env,NODE_ENV:'development'},send:never}),{skipped:true});
  assert.deepEqual(await sendPublicationEmailProbe({env:{...env,IPS_EVALUATION_MODE:'true'},send:never}),{skipped:true});
  assert.deepEqual(await sendPublicationEmailProbe({env:{...env,IPS_PUBLICATION_STRICT:'false'},send:never}),{skipped:true});
});
test('probe rejects invalid diagnostic ID and provider failures',async()=>{
  await assert.rejects(sendPublicationEmailProbe({env:{...env,IPS_EMAIL_PROBE_RUN_ID:'bad space'},send:async()=> 'abc'}),/probe ID/);
  await assert.rejects(sendPublicationEmailProbe({env,send:async()=>{throw Error('provider unavailable')}}),/provider unavailable/);
  await assert.rejects(sendPublicationEmailProbe({env,send:async()=> ''}),/acceptance identifier/);
});
