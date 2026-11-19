import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Client from '../models/Client.js';
import Writer from '../models/Writer.js';
import ContactEnquiry from '../models/ContactEnquiry.js';
import ServiceRequest from '../models/ServiceRequest.js';
import StudentPayment from '../models/StudentPayment.js';
import SpecialistPayout from '../models/SpecialistPayout.js';

if(process.env.IPS_EVALUATION_MODE!=='true'||process.env.NODE_ENV!=='production')
  throw Error('The isolated evaluation seed must never run outside the production-mode dedicated sandbox.');
const uri=String(process.env.MONGODB_URI||'');
const hostname=new URL(uri).hostname;
const dbName=new URL(uri).pathname.slice(1);
if(!['127.0.0.1','localhost'].includes(hostname)||dbName!=='ips_staging_evaluation')
  throw Error('Refusing to seed a database other than the loopback IPS evaluation database.');
if(process.env.STRIPE_SECRET_KEY||process.env.CONTACT_RESEND_API_KEY||process.env.R2_ENDPOINT||
   process.env.TELEGRAM_BOT_TOKEN||process.env.WHATSAPP_ACCESS_TOKEN)
  throw Error('Evaluation must never receive external payment, contact, or storage credentials.');

const hashPassword=password=>{
  const salt=crypto.randomBytes(16).toString('hex');
  return 'scrypt$'+salt+'$'+crypto.scryptSync(password,salt,64).toString('hex');
};
const now=new Date();
const clientId='CID-EVAL-PRIVATE-001';
const writerId='WID-EVAL-SPECIALIST-1';
const quoteA='IPS-Q-E1A2B3C4D5E6F70809';
const quoteB='IPS-Q-FFEEDDCCBBAA998877';
const newId='SRV-E1A2B3C4D5E6F70809';
const assignedId='SRV-AABBCCDDEEFF001122';
const doneId='SRV-112233445566778899';
const clientPassword=String(process.env.IPS_EVAL_CLIENT_PASSWORD||'');
const writerPassword=String(process.env.IPS_EVAL_SPECIALIST_PASSWORD||'');
if(clientPassword.length<12||writerPassword.length<12)
  throw Error('Both isolated evaluation role passwords must be explicitly configured.');
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
  await Promise.all([
    Client.updateOne({client_id:clientId},{$setOnInsert:{
      client_id:clientId,username:'QuietResearcher',username_key:'quietresearcher',
      full_name:'',email:'client.evaluation@example.org',password:hashPassword(clientPassword),
      email_verified_at:now,status:'Active'
    }},{upsert:true}),
    Writer.updateOne({writer_id:writerId},{$setOnInsert:{
      writer_id:writerId,full_name:'Evaluation Research Specialist',
      email:'specialist.evaluation@example.org',password:hashPassword(writerPassword),
      email_verified_at:now,status:'Active',application_status:'approved',
      reviewed_at:now,reviewed_by:'EVALUATION-SYSTEM',
      primary_expertise:'Academic research methods',services:['research-methods','statistics-support'],
      availability:'Available',application_source:'admin'
    }},{upsert:true})
  ]);
  await Promise.all([
    ContactEnquiry.updateOne({enquiry_id:quoteA},{$setOnInsert:{
      enquiry_id:quoteA,request_type:'quote',client_id:clientId,username:'QuietResearcher',
      service:'research-methods',discipline:'Academic research methodology',
      study_level:'Undergraduate',subject:'research-methods',preferred_channel:'workspace',
      contact_verified:true,verification_status:'verified',contact_verified_at:now,
      contact_consent:true,consent_at:now,status:'in_progress',
      review_started_at:now,assigned_admin_id:'EVALUATION-SYSTEM',assigned_at:now,
      service_request_id:newId,
      messages:[
        {direction:'inbound',channel:'website',delivery_status:'received',
          body:'Evaluation-only example. I need written research methods consultation and feedback on my own methodology plan.'},
        {direction:'outbound',channel:'website',delivery_status:'sent',
          body:'IPS demonstration: We received your test request. This message was seeded for evaluation; no human has been contacted.'}
      ]
    }},{upsert:true}),
    ContactEnquiry.updateOne({enquiry_id:quoteB},{$setOnInsert:{
      enquiry_id:quoteB,request_type:'quote',client_id:clientId,username:'QuietResearcher',
      service:'statistics-support',discipline:'Data analysis consultation',
      study_level:'Undergraduate',subject:'statistics-support',preferred_channel:'workspace',
      contact_verified:true,verification_status:'verified',contact_verified_at:now,
      contact_consent:true,consent_at:now,status:'new',service_request_id:'',
      messages:[{direction:'inbound',channel:'website',delivery_status:'received',
        body:'Evaluation-only example. I am seeking guidance on descriptive statistics and my own research interpretation.'}]
    }},{upsert:true})
  ]);
  const base={
    family:'professional',category:'Academic Support',client_id:clientId,
    client_name:'QuietResearcher',client_email:'client.evaluation@example.org',
    delivery_mode:'remote'
  };
  await Promise.all([
    ServiceRequest.updateOne({request_id:newId},{$setOnInsert:{
      ...base,request_id:newId,source_quote_id:quoteA,source:'quote_intake',
      title:'Research Methods Consultation — Evaluation Intake',service_slug:'research-methods',
      description:'Demo only: written research methodology guidance for a self-authored student project.',
      status:'New Request',payment_status:'unpaid',
      status_history:[{status:'New Request',actor_id:'EVALUATION-SYSTEM',actor_role:'admin',
        reason:'Seeded synthetic example: awaiting management quotation',changed_at:now}]
    }},{upsert:true}),
    ServiceRequest.updateOne({request_id:assignedId},{$setOnInsert:{
      ...base,request_id:assignedId,source:'legacy',service_slug:'statistics-support',
      title:'Statistics Support — Assigned Example (SIMULATED PAID)',description:'SYNTHETIC EXAMPLE ONLY. A fictional settled engagement ready for a professional to review.',
      status:'Assigned',payment_status:'paid',provider_id:writerId,provider_name:'Evaluation Research Specialist',
      progress:15,quote:{labor:130,service_fee:20,expenses:0,total:150,currency:'PLN',
        accepted:true,version:1,accepted_by:clientId,accepted_at:now},
      status_history:[{status:'Assigned',actor_id:'EVALUATION-SYSTEM',actor_role:'admin',
        reason:'Only a synthetic paid fixture for IPS sandbox evaluation',changed_at:now}]
    }},{upsert:true}),
    ServiceRequest.updateOne({request_id:doneId},{$setOnInsert:{
      ...base,request_id:doneId,source:'legacy',service_slug:'research-methods',
      title:'Methodology Feedback — Completed Example (SIMULATED)',description:'SYNTHETIC EXAMPLE ONLY. A fictional fully completed professional research-methods consultation.',
      status:'Completed',payment_status:'paid',provider_id:writerId,provider_name:'Evaluation Research Specialist',
      progress:100,quote:{labor:220,service_fee:30,expenses:0,total:250,currency:'PLN',
        accepted:true,version:1,accepted_by:clientId,accepted_at:now},
      status_history:[{status:'Completed',actor_id:clientId,actor_role:'client',
        reason:'This is synthetic example data, not a genuine customer acceptance',changed_at:now}]
    }},{upsert:true})
  ]);
  await Promise.all([
    StudentPayment.updateOne({payment_id:'PAY-EVALUATION-ASSIGNED-1'},{$setOnInsert:{
      payment_id:'PAY-EVALUATION-ASSIGNED-1',request_id:assignedId,client_id:clientId,
      quote_version:1,amount_minor:15000,currency:'pln',status:'paid',
      provider:'evaluation_fixture',provider_payment_intent:'',
      paid_at:now
    }},{upsert:true}),
    StudentPayment.updateOne({payment_id:'PAY-EVALUATION-COMPLETE-1'},{$setOnInsert:{
      payment_id:'PAY-EVALUATION-COMPLETE-1',request_id:doneId,client_id:clientId,
      quote_version:1,amount_minor:25000,currency:'pln',status:'paid',
      provider:'evaluation_fixture',provider_payment_intent:'',
      paid_at:now
    }},{upsert:true}),
    SpecialistPayout.updateOne({request_id:doneId},{$setOnInsert:{
      request_id:doneId,writer_id:writerId,amount_minor:18000,currency:'PLN',
      status:'approved',agreed_scope:'Evaluation-only synthetic approved research methods fee. Not a bank transfer.',
      approved_by:'EVALUATION-SYSTEM',approved_at:now
    }},{upsert:true})
  ]);
  console.log('IPS EVALUATION ONLY: disposable sample client, approved specialist, written enquiries and managed projects seeded.');
  console.log('IPS EVALUATION ONLY: all settled project and payout records are synthetic; no actual customer payment or delivery occurred.');
}finally{
  await mongoose.disconnect();
}
