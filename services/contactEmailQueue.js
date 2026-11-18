import ContactEmailJob from '../models/ContactEmailJob.js';
import { IPS_EMAILS } from '../shared/businessEmails.js';
import { canSendContactEmail,sendBusinessEmail } from './businessEmailTransport.js';

// Opt-in worker; secrets and switches are backend-only, never VITE_* variables.
export const contactNotificationsEnabled=(env=process.env)=>
  env.CONTACT_EMAIL_NOTIFICATIONS_ENABLED==='true'&&canSendContactEmail(env);

const idempotencyKey=job=>'ips-enquiry/'+job.enquiry_id+'/'+job.kind;
export function emailJobDefinitions(lead){
  const staff={
    enquiry_id:lead.enquiry_id,kind:'staff_notice',recipient:IPS_EMAILS.contact,
    subject:'IPS new customer enquiry · '+lead.enquiry_id,
    body:'An IPS customer submitted a new enquiry.\nReference: '+lead.enquiry_id+
      '\nSign in to the IPS administrator contact queue to review it.\n'+
      'Do not reply to this notification; reply to the customer from their enquiry.'
  };
  const receipt=lead.contact_consent===true&&lead.email?{
    enquiry_id:lead.enquiry_id,kind:'client_receipt',recipient:lead.email,
    subject:'IPS received your enquiry · '+lead.enquiry_id,
    body:'Hello '+lead.name+',\n\n'+
      'Thank you for contacting IPS Academic Services. We have received your enquiry.\n'+
      'Reference: '+lead.enquiry_id+'\n'+
      'Our team can follow up using the contact method you selected.\n'+
      'No work has been ordered or charged by submitting this enquiry.\n\n'+
      'If you need to add information, reply to this email.\n\n'+
      'IPS Academic Services\nsupport@ipsglobalservice.com'
  }:null;
  return receipt?[staff,receipt]:[staff];
}
export async function enqueueContactEmailJobs(lead,{env=process.env,model=ContactEmailJob}={}){
  if(!contactNotificationsEnabled(env))return {queued:0,enabled:false};
  const defs=emailJobDefinitions(lead);
  for(const data of defs){
    await model.updateOne({enquiry_id:data.enquiry_id,kind:data.kind},
      {$setOnInsert:{...data,status:'pending',attempts:0,next_attempt_at:new Date()}},{upsert:true});
  }
  return {queued:defs.length,enabled:true};
}
export async function processContactEmailJobs({env=process.env,model=ContactEmailJob,request=fetch,limit=8,now=()=>new Date()}={}){
  if(!contactNotificationsEnabled(env))return {processed:0,disabled:true};
  let processed=0,accepted=0,failed=0;
  for(let n=0;n<Math.min(20,Math.max(0,limit));n++){
    const at=now();
    const job=await model.findOneAndUpdate({
      attempts:{$lt:5},$or:[
        {status:{$in:['pending','retry']},next_attempt_at:{$lte:at}},
        {status:'sending',lease_until:{$lte:at}}
      ]
    },{$set:{status:'sending',lease_until:new Date(at.getTime()+45000)},
       $inc:{attempts:1}},{sort:{createdAt:1},new:true});
    if(!job)break;
    processed++;
    try{
      const providerId=await sendBusinessEmail({
        to:job.recipient,subject:job.subject,body:job.body,
        idempotencyKey:idempotencyKey(job),env,request
      });
      await model.updateOne({_id:job._id,status:'sending'},{$set:{
        status:'accepted',provider_id:providerId,provider_accepted_at:now(),
        last_error:''
      },$unset:{lease_until:''}});
      accepted++;
    }catch(error){
      const terminal=job.attempts>=5||(Number(error?.status)>=400&&Number(error?.status)<500&&![408,409,429].includes(Number(error.status)));
      const next=new Date(now().getTime()+Math.min(900000,60000*2**(job.attempts-1)));
      await model.updateOne({_id:job._id,status:'sending'},{
        $set:{status:terminal?'failed':'retry',next_attempt_at:next,
          last_error:terminal?'Provider rejected email':'Provider unavailable; retry scheduled'},
        $unset:{lease_until:''}
      });
      failed++;
    }
  }
  return {processed,accepted,failed};
}
export function startContactEmailWorker({env=process.env,intervalMs=20000}={}){
  if(!contactNotificationsEnabled(env))return null;
  let busy=false;
  const run=async()=>{
    if(busy)return;busy=true;
    try{await processContactEmailJobs({env});}
    catch(error){console.error('IPS email notification worker error:',error?.name||'error');}
    finally{busy=false;}
  };
  const timer=setInterval(run,intervalMs);
  timer.unref?.();
  return ()=>clearInterval(timer);
}
