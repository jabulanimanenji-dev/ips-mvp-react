import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import ServiceRequest from '../models/ServiceRequest.js';
import StudentPayment from '../models/StudentPayment.js';
import StudentRefund from '../models/StudentRefund.js';
import SpecialistPayout from '../models/SpecialistPayout.js';
import {registerCompanyFinanceRoutes} from '../services/companyFinance.js';

// Source-bound MongoDB integration: destructive fixture cleanup is restricted
// to the disposable CI database. NEVER run against a customer database.
const uri=String(process.env.MONGODB_URI||'');
if(process.env.NODE_ENV!=='development'||!/\/(?:ips_ci|ips_staging_evaluation)(?:\?|$)/.test(uri)||
   !/(?:127\.0\.0\.1|localhost)/.test(uri))
  throw Error('Finance qualification requires isolated loopback CI MongoDB.');
const tag=crypto.randomBytes(5).toString('hex').toUpperCase();
const genuine='SRV-FIN-GENUINE-'+tag;
const historic='SRV-FIN-SYNTHETIC-'+tag;
const validClient='CID-FIN-GENUINE-'+tag;
const fixtureClient='CID-TEST-FINANCE-'+tag;
const refs=[genuine,historic];
const paymentRefs=['PAY-FIN-GENUINE-'+tag,'PAY-FIN-FAKE-'+tag];
const refundRefs=['REF-FIN-GENUINE-'+tag,'REF-FIN-FAKE-'+tag];

await mongoose.connect(uri,{serverSelectionTimeoutMS:12000});
const servers=[];
const fixtureProject=(request_id,client_id,client_email)=>({
  request_id,client_id,client_name:'Synthetic CI Only',
  client_email,family:'professional',category:'Academic Support',
  source:'quote_intake',title:'Finance integrity CI '+tag,
  description:'Isolated test record, never a real customer',
  status:'Quoted',payment_status:'unpaid',
  quote:{total:125,currency:'PLN',version:1,accepted:true}
});
async function launch(env){
  const app=express();
  app.use((req,res,next)=>{
    const role=String(req.headers['x-ci-identity']||'');
    req.adminAccess={isSuperAdmin:false,permissions:role==='finance'?['payments.view']:[]};
    next();
  });
  registerCompanyFinanceRoutes(app,{
    env,requireSession:(req,res)=>{
      const role=String(req.headers['x-ci-identity']||'');
      if(!role){res.status(401).json({success:false});return null;}
      return {role:role==='client'?'client':'admin',id:role};
    }
  });
  const server=await new Promise((resolve,reject)=>{
    const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));
    instance.once('error',reject);
  });
  servers.push(server);
  return 'http://127.0.0.1:'+server.address().port;
}
async function query(base,role='finance'){
  const response=await fetch(base+'/api/admin/finance/operating-ledger',{
    headers:role?{'x-ci-identity':role}:{},signal:AbortSignal.timeout(14000)});
  return {code:response.status,data:await response.json()};
}
try{
  await Promise.all([
    ServiceRequest.create(fixtureProject(genuine,validClient,'review@example-company.invalid')),
    ServiceRequest.create(fixtureProject(historic,fixtureClient,'finance-qa@example.org'))
  ]);
  await Promise.all([
    StudentPayment.create({payment_id:paymentRefs[0],request_id:genuine,client_id:validClient,
      quote_version:1,amount_minor:12500,currency:'PLN',status:'review_required',provider:'ci_fixture'}),
    StudentPayment.create({payment_id:paymentRefs[1],request_id:historic,client_id:fixtureClient,
      quote_version:1,amount_minor:999900,currency:'PLN',status:'paid',provider:'ci_fixture'}),
    SpecialistPayout.create({request_id:genuine,writer_id:'WID-CI-FINANCE',amount_minor:6500,
      currency:'PLN',status:'approved',agreed_scope:'Isolated finance test',approved_by:'CI'}),
    SpecialistPayout.create({request_id:historic,writer_id:'WID-CI-FAKE',amount_minor:100000,
      currency:'PLN',status:'approved',agreed_scope:'Isolated false payment test',approved_by:'CI'}),
    StudentRefund.create({refund_id:refundRefs[0],request_id:genuine,payment_id:paymentRefs[0],
      client_id:validClient,amount_minor:1200,currency:'PLN',reason:'CI refund',requested_by:'CI',status:'requested'}),
    StudentRefund.create({refund_id:refundRefs[1],request_id:historic,payment_id:paymentRefs[1],
      client_id:fixtureClient,amount_minor:50000,currency:'PLN',reason:'CI synthetic refund',requested_by:'CI',status:'requested'})
  ]);
  const prod=await launch({NODE_ENV:'production',IPS_EVALUATION_MODE:'false',IPS_PAYMENTS_ENABLED:'false'});
  const production=await query(prod);
  assert.equal(production.code,200,JSON.stringify(production.data));
  assert.ok(production.data.financial_cases.some(x=>x.request_id===genuine));
  assert.ok(!production.data.financial_cases.some(x=>x.request_id===historic));
  for(const tab of ['payments','payouts','refunds']){
    assert.ok(production.data[tab].some(x=>x.request_id===genuine),'Legitimate '+tab+' hidden');
    assert.ok(!production.data[tab].some(x=>x.request_id===historic),'Synthetic '+tab+' leaked');
  }
  assert.equal(production.data.provider_pending,true);
  assert.ok(production.data.counts.payments_requiring_review>=1);
  assert.ok(production.data.counts.approved_payouts_pending>=1);
  assert.ok(production.data.counts.refunds_pending>=1);
  assert.equal((await query(prod,'')).code,401);
  assert.equal((await query(prod,'client')).code,403);
  assert.equal((await query(prod,'other_department')).code,403);
  console.log('PASS production finance excludes synthetic case, payment, payout and refund across four ledgers and counts');
  const evalHost=await launch({NODE_ENV:'production',IPS_EVALUATION_MODE:'true',IPS_PAYMENTS_ENABLED:'false'});
  const evaluation=await query(evalHost);
  assert.equal(evaluation.code,200);
  for(const tab of ['financial_cases','payments','payouts','refunds']){
    assert.ok(evaluation.data[tab].some(x=>x.request_id===historic),
      'Clearly labelled synthetic evaluation '+tab+' must remain inspectable');
  }
  console.log('PASS evaluation retains its synthetic ledger for QA while finance role access remains enforced');
}finally{
  await Promise.allSettled(servers.map(s=>new Promise(done=>s.close(done))));
  await Promise.allSettled([
    ServiceRequest.deleteMany({request_id:{$in:refs}}),
    StudentPayment.deleteMany({payment_id:{$in:paymentRefs}}),
    StudentRefund.deleteMany({refund_id:{$in:refundRefs}}),
    SpecialistPayout.deleteMany({request_id:{$in:refs}})
  ]);
  await mongoose.disconnect();
}
