import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import CompanyCaseAction from '../models/CompanyCaseAction.js';
import Notification from '../models/Notification.js';
import {runCompanyAutomationTick} from '../services/companyAutomation.js';

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
  console.log('COMPANY_AUTOMATION_GREEN real MongoDB overdue, direct recipient, staff-manager-root escalations, idempotency, completion and reschedule');
}finally{
  if(mongoose.connection.readyState===1){
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}
