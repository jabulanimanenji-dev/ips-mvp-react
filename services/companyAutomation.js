import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import CompanyCaseAction from '../models/CompanyCaseAction.js';
import Notification from '../models/Notification.js';
import {isIpsQaFixtureAdmin} from '../shared/ipsCompanyScope.js';

// Server-owned, idempotent work escalation. No customer messages or external
// notifications are sent from this worker without customer-channel consent.
export const companyAutomationEnabled=(env=process.env)=>
  env.IPS_COMPANY_AUTOMATION_ENABLED==='true'||
  (env.NODE_ENV==='production'&&env.IPS_COMPANY_AUTOMATION_ENABLED!=='false');

const MAX_TASKS=80;
const ESCALATION_MS=24*60*60*1000;
const safeDate=x=>x instanceof Date?x:new Date(x);
const rootRecipient={recipient_id:'admin',recipient_role:'admin'};
const eventKey=(kind,task)=>'ips-task/'+kind+'/'+String(task._id)+'/'+new Date(task.due_at).getTime();

export async function runCompanyAutomationTick({
  env=process.env,now=()=>new Date(),limit=MAX_TASKS,
  actionModel=CompanyCaseAction,adminModel=Admin,notificationModel=Notification
}={}){
  const at=safeDate(now());
  if(!Number.isFinite(at.getTime()))throw Error('Invalid automation clock');
  if(mongoose.connection.readyState!==1)return {scanned:0,created:0,escalated:0,databaseUnavailable:true};
  await notificationModel.init(); // Create the unique idempotency index before writing.
  const tasks=await actionModel.find({entry_kind:'task',task_status:'open',due_at:{$lte:at}})
    .sort({due_at:1}).limit(Math.min(MAX_TASKS,Math.max(1,Math.floor(limit)))).lean();
  let created=0,escalated=0;
  async function notify(kind,task,recipient){
    const result=await notificationModel.updateOne({dedupe_key:eventKey(kind,task)},{$setOnInsert:{
      dedupe_key:eventKey(kind,task),...recipient,order_id:task.case_ref,
      type:kind==='overdue'?'company_task_overdue':'company_task_escalated',
      message:kind==='overdue'?
        'An assigned '+task.case_kind+' task is overdue. Review the case in the IPS Action Centre.':
        'An overdue '+task.case_kind+' task requires management review in the IPS Action Centre.',
      read:false
    }},{upsert:true});
    if(result.upsertedCount)created++;
    if(result.upsertedCount&&kind==='escalated')escalated++;
  }
  for(const task of tasks){
    // Idempotent by task and exact deadline; a genuine reschedule can alert again.
    const rootAssigned=env.ADMIN_EMAIL&&String(task.assigned_to).toLowerCase()===
      String(env.ADMIN_EMAIL).toLowerCase();
    const assignee=rootAssigned?null:await adminModel.findOne({
      id:task.assigned_to,status:'Active',company_role:{$in:['manager','staff']}
    }).select('id email company_role manager_id status').lean();
    if(!rootAssigned&&!assignee)continue;
    if(assignee&&isIpsQaFixtureAdmin(assignee)&&env.NODE_ENV==='production')continue;
    await notify('overdue',task,rootAssigned?rootRecipient:{recipient_id:assignee.id,recipient_role:'admin'});
    if(at.getTime()-new Date(task.due_at).getTime()<ESCALATION_MS)continue;
    let recipient=null;
    if(rootAssigned)continue;
    if(assignee.company_role==='manager')recipient=rootRecipient;
    else if(assignee.company_role==='staff'){
      const manager=await adminModel.findOne({
        id:assignee.manager_id,status:'Active',company_role:'manager',department:{$exists:true}
      }).select('id department status company_role').lean();
      recipient=manager?{recipient_id:manager.id,recipient_role:'admin'}:rootRecipient;
    }
    if(recipient)await notify('escalated',task,recipient);
  }
  return {scanned:tasks.length,created,escalated};
}

export function startCompanyAutomationWorker({env=process.env,intervalMs=60000}={}){
  if(!companyAutomationEnabled(env))return null;
  let busy=false;
  const tick=async()=>{
    if(busy)return;busy=true;
    try{await runCompanyAutomationTick({env});}
    catch(error){console.error('IPS company task automation failed:',error?.name||'error');}
    finally{busy=false;}
  };
  const timer=setInterval(tick,intervalMs);
  timer.unref?.();
  void tick();
  return ()=>clearInterval(timer);
}
