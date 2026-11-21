import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Client from '../models/Client.js';
import Writer from '../models/Writer.js';
import ContactEnquiry from '../models/ContactEnquiry.js';
import ServiceRequest from '../models/ServiceRequest.js';
import StudentPayment from '../models/StudentPayment.js';
import SpecialistPayout from '../models/SpecialistPayout.js';
import Admin from '../models/Admin.js';
import SupportTicket from '../models/SupportTicket.js';
import CompanyCaseAction from '../models/CompanyCaseAction.js';
import ChannelContact from '../models/ChannelContact.js';
import ChannelMessage from '../models/ChannelMessage.js';
import Notification from '../models/Notification.js';
import {COMPANY_DEPARTMENTS,permittedCompanyPermissions} from '../shared/companyGovernance.js';

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
const managerPassword=String(process.env.IPS_EVAL_MANAGER_PASSWORD||'');
const staffPassword=String(process.env.IPS_EVAL_STAFF_PASSWORD||'');
if([clientPassword,writerPassword,managerPassword,staffPassword].some(password=>password.length<12))
  throw Error('All four isolated client, specialist, manager and staff passwords must be explicitly configured.');
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
  // The company demonstration includes a complete seven-department hierarchy
  // with one accountable manager per department and actual direct-report staff.
  // No synthetic account is ever seeded in a persistent or real production DB.
  const managerId=department=>'ADM-EVAL-MANAGER-'+department.toUpperCase();
  const staffId=department=>'ADM-EVAL-STAFF-'+department.toUpperCase();
  await Admin.insertMany(Object.entries(COMPANY_DEPARTMENTS).flatMap(([department,def])=>[
    {id:managerId(department),name:'Evaluation '+def.label+' Manager',
      email:'manager.'+department+'@example.org',password:hashPassword(managerPassword),
      role:'admin',company_role:'manager',department,manager_id:'',
      email_verified_at:now,status:'Active',must_change_password:false,
      permissions:permittedCompanyPermissions(department,'manager'),
      created_by:String(process.env.ADMIN_EMAIL||'')},
    {id:staffId(department),name:'Evaluation '+def.label+' Employee',
      email:'staff.'+department+'@example.org',password:hashPassword(staffPassword),
      role:'admin',company_role:'staff',department,manager_id:managerId(department),
      email_verified_at:now,status:'Active',must_change_password:false,
      permissions:permittedCompanyPermissions(department,'staff'),
      created_by:managerId(department)}
  ]),{ordered:true});
  const supportId='SUP-EVAL-SUPPORT-001';
  await SupportTicket.updateOne({ticket_id:supportId},{$setOnInsert:{
    ticket_id:supportId,client_id:clientId,client_name:'QuietResearcher',
    client_email:'client.evaluation@example.org',
    subject:'Demo: clarification on project feedback',category:'service',
    priority:'urgent',status:'In Progress',assigned_admin:staffId('client_relations'),
    messages:[
      {sender_id:clientId,sender_role:'client',body:'EVALUATION ONLY: I need help understanding the feedback delivery timeline.'},
      {sender_id:staffId('client_relations'),sender_role:'admin',
        body:'EVALUATION ONLY: Your request was received and assigned to the Client Relations team.'}
    ],last_activity_at:now
  }},{upsert:true});
  await CompanyCaseAction.updateOne({
    case_kind:'support',case_ref:supportId,entry_kind:'task',assigned_to:staffId('client_relations')
  },{$setOnInsert:{
    case_kind:'support',case_ref:supportId,entry_kind:'task',
    body:'EVALUATION ONLY: follow up on this test support case and document the resolution.',
    created_by:managerId('client_relations'),assigned_to:staffId('client_relations'),
    priority:'urgent',task_status:'open',
    due_at:new Date(now.getTime()-2*86400000)
  }},{upsert:true});
  const chat=await ChannelContact.findOneAndUpdate(
    {channel:'telegram',external_id:'eval-telegram-contact-1'},
    {$setOnInsert:{channel:'telegram',external_id:'eval-telegram-contact-1',
      display_name:'Demo Telegram Contact',verified_at:now,client_id:clientId,
      last_inbound_at:now,last_message_at:now,status:'open',unread_count:1}},
    {upsert:true,returnDocument:'after'}
  );
  for(const [external_message_id,direction,body] of [
    ['eval-inbound-1','inbound','EVALUATION ONLY: I would like a private written quotation for research methods coaching.'],
    ['eval-outbound-1','outbound','EVALUATION ONLY: IPS has received your message. No real Telegram message was sent.']
  ]){
    await ChannelMessage.updateOne({channel:'telegram',external_message_id},{$setOnInsert:{
      contact_id:chat._id,channel:'telegram',external_message_id,direction,body,
      status:direction==='inbound'?'received':'sent',
      sent_by:direction==='outbound'?'EVALUATION-SYSTEM':'',provider_at:now
    }},{upsert:true});
  }
  await Notification.insertMany([
    {recipient_role:'client',recipient_id:clientId,type:'evaluation_notice',
      message:'EVALUATION ONLY: Your private quotation and project workspace is ready to inspect.'},
    {recipient_role:'writer',recipient_id:writerId,type:'evaluation_notice',
      message:'EVALUATION ONLY: Review your synthetic assignment and the governed specialist workspace.'},
    {recipient_role:'admin',recipient_id:'admin',type:'evaluation_notice',
      message:'EVALUATION ONLY: Review all seven departments, real cases and task escalation evidence.'}
  ]);
  console.log('IPS EVALUATION ONLY: seven demo managers, seven employees, one support case, overdue task and protected Telegram/history are seeded.');
  console.log('IPS EVALUATION ONLY: disposable sample client, approved specialist, written enquiries and managed projects seeded.');
  console.log('IPS EVALUATION ONLY: all settled project and payout records are synthetic; no actual customer payment or delivery occurred.');
}finally{
  await mongoose.disconnect();
}
