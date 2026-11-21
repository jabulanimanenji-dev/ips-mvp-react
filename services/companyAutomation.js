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
  env=process.env,now=()=>new Date(),limit=MAX_TASKS,cursor=null,
  actionModel=CompanyCaseAction,adminModel=Admin,notificationModel=Notification
}={}){
  const at=safeDate(now());
  if(!Number.isFinite(at.getTime()))throw Error('Invalid automation clock');
  if(mongoose.connection.readyState!==1)return {scanned:0,created:0,escalated:0,nextCursor:null,databaseUnavailable:true};
  await notificationModel.init(); // Create the unique idempotency index before writing.
  const pageLimit=Math.min(MAX_TASKS,Math.max(1,Math.floor(limit)));
  const query={entry_kind:'task',task_status:'open',due_at:{$lte:at}};
  // Keyset paging prevents large overdue backlogs from starving newer work.
  if(cursor?.id&&cursor?.dueAt&&mongoose.isValidObjectId(cursor.id)){
    const after=safeDate(cursor.dueAt);
    if(Number.isFinite(after.getTime()))
      query.$or=[{due_at:{$gt:after}},{due_at:after,_id:{$gt:new mongoose.Types.ObjectId(cursor.id)}}];
  }
  const tasks=await actionModel.find(query).sort({due_at:1,_id:1}).limit(pageLimit).lean();
  const last=tasks[tasks.length-1];
  const nextCursor=tasks.length===pageLimit&&last?
    {dueAt:new Date(last.due_at).toISOString(),id:String(last._id)}:null;
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
    }).select('id email department company_role manager_id status').lean();
    if(!rootAssigned&&!assignee)continue;
    if(assignee&&isIpsQaFixtureAdmin(assignee)&&env.NODE_ENV==='production')continue;
    await notify('overdue',task,rootAssigned?rootRecipient:{recipient_id:assignee.id,recipient_role:'admin'});
    if(at.getTime()-new Date(task.due_at).getTime()<ESCALATION_MS)continue;
    let recipient=null;
    if(rootAssigned)continue;
    if(assignee.company_role==='manager')recipient=rootRecipient;
    else if(assignee.company_role==='staff'){
      const manager=await adminModel.findOne({
        id:assignee.manager_id,status:'Active',company_role:'manager',department:assignee.department
      }).select('id department status company_role').lean();
      recipient=manager?{recipient_id:manager.id,recipient_role:'admin'}:rootRecipient;
    }
    if(recipient)await notify('escalated',task,recipient);
  }
  return {scanned:tasks.length,created,escalated,nextCursor};
}

export function startCompanyAutomationWorker({env=process.env,intervalMs=60000}={}){
  if(!companyAutomationEnabled(env))return null;
  let busy=false,cursor=null;
  const tick=async()=>{
    if(busy)return;busy=true;
    try{const result=await runCompanyAutomationTick({env,cursor});cursor=result.nextCursor;}
    catch(error){console.error('IPS company task automation failed:',error?.name||'error');}
    finally{busy=false;}
  };
  const timer=setInterval(tick,intervalMs);
  timer.unref?.();
  void tick();
  return ()=>clearInterval(timer);
}
