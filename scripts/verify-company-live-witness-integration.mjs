import assert from 'node:assert/strict';
import {verifyCompanyLiveWitness} from '../services/liveCompanyWitness.js';
// Authorize production-equivalent role checks only against the real isolated
// MongoDB CI listener; never send the root secret to public web endpoints.
const mongo=String(process.env.MONGODB_URI||'');
if(process.env.NODE_ENV!=='development'||!mongo.includes('/ips_ci?')||
   !/127\.0\.0\.1|localhost/.test(mongo))
  throw Error('Read-only Root HTTP witness CI cannot target real IPS customer infrastructure.');
const report=await verifyCompanyLiveWitness({
  port:Number(process.env.PORT||8080),
  env:{
    NODE_ENV:'production',IPS_EVALUATION_MODE:'false',
    IPS_COMPANY_LIVE_WITNESS_RUN_ID:'IPS_CI_COMPANY_20261121',
    ADMIN_EMAIL:process.env.ADMIN_EMAIL,ADMIN_PASSWORD:process.env.ADMIN_PASSWORD
  }
});
assert.equal(report.root,'Nyoro');
assert.equal(report.checks,14);
assert.equal(report.real_authenticated_backend,true);
assert.equal(report.no_customer_writes,true);
assert.equal(report.private_customer_inboxes_denied,true);
assert.equal(report.payments_disabled,true);
console.log('PASS real MongoDB Express root witness: all 14 signed ownership, company, finance and confidential-privacy decisions');
