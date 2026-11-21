import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import CompanyCaseAction from '../models/CompanyCaseAction.js';
import Notification from '../models/Notification.js';
import ContactEnquiry from '../models/ContactEnquiry.js';
import SupportTicket from '../models/SupportTicket.js';
import {runCompanyAutomationTick,runUnownedCaseTick} from '../services/companyAutomation.js';

const uri=String(process.env.MONGODB_URI||'');
const url=new URL(uri);
if(!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=='/ips_ci')
  throw Error('Automation integration requires the isolated local ips_ci MongoDB fixture');
url.pathname='/ips_automation_ci';
const now=new Date('2026-11-21T12:00:00Z');
const due=new Date(now.getTime()-48*3600000);
const future=new Date(now.getTime()+24*3600000);
const suffix=crypto.randomBytes(5).toString('hex');
const prefix='AUTO-'+suffix;
const managerId=prefix+'-M',staffId=prefix+'-S';
const cases={staff:prefix+'-STAFF',manager:prefix+'-MANAGER',future:prefix+'-FUTURE'};
const env={NODE_ENV:'development',ADMIN_EMAIL:'owner-ci@example.invalid'};
try{
  await mongoose.connect(url.toString());
  await Notification.init();
  await Admin.insertMany([
    {id:managerId,name:'Automation Manager',email:'auto-manager-'+suffix+'@example.org',
      password:'integration-fixture-no-login',company_role:'manager',department:'client_relations',
      status:'Active',permissions:['platform.access','dashboard.view','team.manage']},
    {id:staffId,name:'Automation Worker',email:'auto-staff-'+suffix+'@example.org',
      password:'integration-fixture-no-login',company_role:'staff',department:'client_relations',
      manager_id:managerId,status:'Active',permissions:['platform.access','dashboard.view']}
  ]);
  const task=({ref,assigned,dueAt,entryKind='task',status='open'})=>({
    case_kind:'enquiry',case_ref:ref,entry_kind:entryKind,
    body:'A scheduled IPS review action requiring an accountable response.',
    assigned_to:assigned,created_by:managerId,due_at:dueAt,task_status:status
  });
  await CompanyCaseAction.insertMany([
    task({ref:cases.staff,assigned:staffId,dueAt:due}),
    task({ref:cases.manager,assigned:managerId,dueAt:due}),
    task({ref:cases.future,assigned:staffId,dueAt:future}),
    task({ref:prefix+'-DONE',assigned:staffId,dueAt:due,status:'done'}),
    task({ref:prefix+'-NOTE',assigned:staffId,dueAt:due,entryKind:'note'})
  ]);
  const first=await runCompanyAutomationTick({env,now:()=>now});
  assert.equal(first.scanned,2);
  assert.equal(first.created,4);
  assert.equal(first.escalated,2);
  let records=await Notification.find({type:{$in:['company_task_overdue','company_task_escalated']}}).lean();
  assert.equal(records.length,4);
  assert.equal(records.filter(n=>n.recipient_id===staffId&&n.type==='company_task_overdue').length,1);
  assert.equal(records.filter(n=>n.recipient_id===managerId&&n.type==='company_task_escalated').length,1);
  assert.equal(records.filter(n=>n.recipient_id===managerId&&n.type==='company_task_overdue').length,1);
  assert.equal(records.filter(n=>n.recipient_id==='admin'&&n.type==='company_task_escalated').length,1);
  assert.ok(records.every(n=>n.recipient_role==='admin'));
  const replay=await runCompanyAutomationTick({env,now:()=>now});
  assert.equal(replay.created,0);
  assert.equal(replay.escalated,0);
  assert.equal(await Notification.countDocuments({}),4,'Repeated scans must not spam a task');
  await CompanyCaseAction.updateOne({case_ref:cases.staff},{$set:{task_status:'done'}});
  const completed=await runCompanyAutomationTick({env,now:()=>now});
  assert.equal(completed.scanned,1,'Completed tasks are no longer eligible for escalation');
  assert.equal(completed.created,0);
  const rescheduled=new Date(now.getTime()-72*3600000);
  await CompanyCaseAction.updateOne({case_ref:cases.manager},{$set:{due_at:rescheduled}});
  const changed=await runCompanyAutomationTick({env,now:()=>now});
  assert.equal(changed.created,2,'A genuinely changed deadline may create a new accountability event');
  assert.equal(await Notification.countDocuments({}),6);
  // Seven more due tasks exceed the per-tick scan limit. Keyset pagination must
  // eventually alert all of them instead of rescanning only the oldest tasks.
  const pageCases=Array.from({length:7},(_,i)=>prefix+'-PAGE-'+i);
  await CompanyCaseAction.insertMany(pageCases.map(ref=>task({
    ref,assigned:staffId,dueAt:new Date(now.getTime()-6*3600000)
  })));
  let cursor=null,passes=0;
  do{
    const page=await runCompanyAutomationTick({env,now:()=>now,limit:3,cursor});
    cursor=page.nextCursor;
    passes++;
  }while(cursor&&passes<10);
  assert.ok(passes>=3,'Backlog must be scanned across multiple pages');
  assert.equal(await Notification.countDocuments({order_id:{$in:pageCases}}),7,
    'Every real overdue task must eventually get its unique alert');

  const oldAt=new Date(now.getTime()-60*60000);
  const currentAt=new Date(now.getTime()-3*60000);
  const quoteRef='IPS-Q-'+crypto.randomBytes(9).toString('hex').toUpperCase();
  const unverifiedRef='IPS-Q-'+crypto.randomBytes(9).toString('hex').toUpperCase();
  const claimedRef='IPS-Q-'+crypto.randomBytes(9).toString('hex').toUpperCase();
  const ticketRef='TICKET-'+suffix;
  const normalLead=(reference,overrides={})=>({
    enquiry_id:reference,username:'ConfidentialResearcher',request_type:'quote',
    subject:'Research assistance enquiry',email:'private-guest-'+suffix+'@example.org',
    preferred_channel:'email',contact_consent:true,consent_at:oldAt,
    contact_verified:true,verification_status:'verified',status:'new',
    createdAt:oldAt,updatedAt:oldAt, ...overrides
  });
  await ContactEnquiry.insertMany([
    normalLead(quoteRef),
    normalLead(unverifiedRef,{contact_verified:false,verification_status:'awaiting_verification'}),
    normalLead(claimedRef,{assigned_admin_id:managerId}),
    normalLead('IPS-Q-'+crypto.randomBytes(9).toString('hex').toUpperCase(),{createdAt:currentAt})
  ]);
  await SupportTicket.create({
    ticket_id:ticketRef,client_id:'CID-AUTOMATION-'+suffix,
    client_name:'PrivateClient',client_email:'verified-private-'+suffix+'@example.org',
    subject:'Please investigate my support request',
    status:'Open',createdAt:oldAt
  });
  const unowned=await runUnownedCaseTick({env,now:()=>now,limit:2});
  assert.equal(unowned.scanned,2,'Only aged, verified and unassigned requests are eligible');
  assert.equal(unowned.created,2);
  assert.equal(unowned.nextCursor!==null,true,'The first full page includes a continuation');
  const unownedReplay=await runUnownedCaseTick({env,now:()=>now,limit:2});
  assert.equal(unownedReplay.created,0,'Unclaimed customer cases must not spam Root');
  const events=await Notification.find({type:'company_case_unowned'}).lean();
  assert.deepEqual(events.map(x=>x.order_id).sort(),[quoteRef,ticketRef].sort());
  assert.ok(events.every(n=>n.recipient_role==='admin'&&n.recipient_id==='admin'));
  assert.ok(events.every(n=>!n.message.includes('ConfidentialResearcher')&&
    !n.message.includes('private-guest-')),'Customer identity must not enter escalation alerts');
  const emptyPage=await runUnownedCaseTick({env,now:()=>now,limit:2,cursor:unowned.nextCursor});
  assert.equal(emptyPage.created,0);
  console.log('COMPANY_INTAKE_AUTOMATION_GREEN verified enquiry and support escalation, consent, ownership, cooldown and deduplication');

  console.log('COMPANY_AUTOMATION_GREEN real MongoDB overdue, role escalation, idempotency, closure, reschedule and backlog pagination');
}finally{
  if(mongoose.connection.readyState===1){
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}
