// Central IPS communications, support ownership, academic queues and safe automation.
import {publicDocument} from './security.mjs';
export function registerSupportRoutes(ctx){
 const {app,db,rootEmail,notify,audit,authorize,department,wrap,now,uid}=ctx;
 const canSee=(a,t)=>a&&(a.role==='root'||a.id===t.ownerId||
  (['manager','staff'].includes(a.role)&&a.department==='client_relations'));
 const view=t=>publicDocument(t);
 app.post('/api/support',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','specialist']))return;
  const subject=String(req.body?.subject||'').trim(),message=String(req.body?.message||'').trim();
  if(subject.length<5||subject.length>180||message.length<15||message.length>5000)
   return res.status(400).json({error:'Explain the academic-service issue with a clear subject and written message.'});
  const item={id:uid('IPS-S'),ownerId:req.actor.id,ownerRole:req.actor.role,
   subject,category:String(req.body?.category||'academic_service').slice(0,60),
   status:'open',priority:'normal',assignedTo:'',createdAt:now(),updatedAt:now(),
   replies:[{actorId:req.actor.id,role:req.actor.role,message,at:now()}]};
  await db.support.insertOne(item);
  await notify(rootEmail,'New IPS Academic Services support request '+item.id,'support');
  await audit(req.actor,'academic_support_opened',item.id);
  res.status(201).json({ticket:view(item)});
 }));
 app.get('/api/support',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','specialist','root','manager','staff']))return;
  const a=req.actor;
  if(['manager','staff'].includes(a.role)&&a.department!=='client_relations')
   return res.status(403).json({error:'Only Client Relations handles general academic support cases.'});
  const filter=['student','specialist'].includes(a.role)?{ownerId:a.id}:{};
  res.json({tickets:(await db.support.find(filter).sort({updatedAt:-1}).limit(100).toArray()).map(view)});
 }));
 app.post('/api/support/:id/reply',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','specialist','root','manager','staff']))return;
  const t=await db.support.findOne({id:req.params.id});if(!t)return res.status(404).json({error:'Support case does not exist.'});
  if(!canSee(req.actor,t))return res.status(403).json({error:'You cannot read or respond to this case.'});
  const message=String(req.body?.message||'').trim();
  if(message.length<2||message.length>3500)return res.status(400).json({error:'Write a helpful private reply.'});
  if(t.status==='closed')return res.status(409).json({error:'The case is closed; request reopening through IPS.'});
  const update={$push:{replies:{actorId:req.actor.id,role:req.actor.role,message,at:now()}},
    $set:{updatedAt:now()}};
  if(['root','manager','staff'].includes(req.actor.role))update.$set.assignedTo=req.actor.id;
  await db.support.updateOne({id:t.id,status:{$ne:'closed'}},update);
  await notify(req.actor.id===t.ownerId?t.assignedTo||rootEmail:t.ownerId,
   'Confidential academic support response on '+t.id,'support');
  await audit(req.actor,'academic_support_replied',t.id);
  res.json({success:true});
 }));
 app.post('/api/support/:id/resolve',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','specialist','root','manager','staff']))return;
  const t=await db.support.findOne({id:req.params.id});if(!t)return res.status(404).json({error:'Support case not found.'});
  if(!canSee(req.actor,t))return res.status(403).json({error:'You cannot resolve this case.'});
  const p=await db.support.findOneAndUpdate({id:t.id,status:'open'},
   {$set:{status:'closed',closedBy:req.actor.id,closedAt:now(),updatedAt:now()}},{returnDocument:'after'});
  if(!p)return res.status(409).json({error:'Support case already closed.'});
  await audit(req.actor,'academic_support_resolved',t.id);
  res.json({success:true,ticket:view(p)});
 }));
 app.get('/api/notifications',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','specialist','root','manager','staff']))return;
  res.json({notifications:(await db.notifications.find({accountId:req.actor.id})
   .sort({createdAt:-1}).limit(60).toArray()).map(publicDocument)});
 }));
 app.post('/api/notifications/:id/read',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','specialist','root','manager','staff']))return;
  const p=await db.notifications.updateOne({id:req.params.id,accountId:req.actor.id},{$set:{read:true}});
  if(!p.matchedCount)return res.status(404).json({error:'Notification not found.'});
  res.json({success:true});
 }));
 app.get('/api/administration/queues',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','manager','staff']))return;
  const a=req.actor,root=a.role==='root',dept=a.department||'';
  const queues=[];
  if(root||dept==='client_relations'){
   const ownership=a.role==='staff'?{$or:[{assignedTo:a.id},{assignedTo:''},
     {assignedTo:null},{assignedTo:{$exists:false}}]}:{};
   const cases=await db.quotes.find({status:{$in:['received','clarify','offer_delivery_failed']},
    ...ownership}).sort({createdAt:1}).limit(50).toArray();
   queues.push({department:'client_relations',name:'Academic enquiries awaiting review or reply',
    count:cases.length,items:cases.map(q=>({id:q.id,service:q.serviceName,subject:q.subject,
      stage:q.status,assignedTo:q.assignedTo||'',createdAt:q.createdAt}))});
   const support=await db.support.find({status:'open'}).sort({createdAt:1}).limit(50).toArray();
   queues.push({department:'client_relations',name:'Written student/specialist support',
    count:support.length,items:support.map(t=>({id:t.id,service:'Support',subject:t.subject,
      stage:t.status,createdAt:t.createdAt}))});
  }
  if(root||dept==='specialist_network'){
   const applications=await db.accounts.find({role:'specialist',status:'pending_review',verified:true})
    .sort({createdAt:1}).limit(50).toArray();
   queues.push({department:'specialist_network',name:'Verified Specialist applications awaiting evaluation',
    count:applications.length,items:applications.map(a=>({id:a.id,service:'Specialist application',
      subject:a.name,stage:'pending_review',createdAt:a.createdAt}))});
  }
  if(root||dept==='quality_assurance'){
   const waiting=await db.projects.find({status:'qa_pending'}).sort({updatedAt:1}).limit(50).toArray();
   queues.push({department:'quality_assurance',name:'Academic deliverables awaiting QA',
    count:waiting.length,items:waiting.map(p=>({id:p.id,service:p.serviceName,subject:p.subject,
      stage:'qa_pending',createdAt:p.updatedAt}))});
  }
  if(root||dept==='academic_delivery'){
   const ready=await db.projects.find({status:'ready_for_assignment'}).sort({updatedAt:1}).limit(50).toArray();
   queues.push({department:'academic_delivery',name:'Commissioned academic work awaiting a qualified Specialist',
    count:ready.length,items:ready.map(p=>({id:p.id,service:p.serviceName,subject:p.subject,
      stage:p.status,createdAt:p.updatedAt}))});
  }
  if(root||dept==='finance'){
   const waiting=await db.projects.find({status:'awaiting_payment_integration'}).sort({updatedAt:1}).limit(50).toArray();
   queues.push({department:'finance',name:'Accepted academic quotations blocked until payment integration',
    count:waiting.length,items:waiting.map(p=>({id:p.id,service:p.serviceName,subject:p.subject,
      stage:p.status,createdAt:p.updatedAt}))});
  }
  res.json({queues,product:'IPS Academic Services',paymentsEnabled:false});
 }));
}
export function beginCompanyAutomation(ctx){
 const {db,rootEmail,notify,notifyQuotation,audit,sendEmail,uid,config}=ctx;
 let busy=false,mailBusy=false;
 const deliveryTick=async()=>{
  if(mailBusy)return;mailBusy=true;
  try{
   for(let i=0;i<8;i++){
    const now=new Date(),stale=new Date(Date.now()-65000);
    const job=await db.notificationDeliveries.findOneAndUpdate({
     nextAttemptAt:{$lte:now},
     $or:[{status:'pending'},{status:'sending',lockedAt:{$lt:stale}}]
    },{$set:{status:'sending',lockedAt:now}},{sort:{createdAt:1},returnDocument:'after'});
    if(!job)break;
    try{
     const receipt=await sendEmail(job.to,job.subject,job.text,job.id);
     const status=config.sandbox?'synthetic_dispatched':'provider_accepted';
     // Provider API acceptance is not proof of inbox delivery.
     // Delivery events must be verified independently before marking delivered.
     await db.notificationDeliveries.updateOne({id:job.id,status:'sending'},{
      $set:{status,provider:receipt.provider,providerMessageId:receipt.id,
       acceptedAt:new Date()},$unset:{lockedAt:''}});
    }catch(e){
     const attempts=(job.attempts||0)+1,failed=attempts>=4;
     const delay=Math.min(180000,4000*(2**(attempts-1)));
     await db.notificationDeliveries.updateOne({id:job.id,status:'sending'},{
      $set:{status:failed?'failed':'pending',attempts,
       nextAttemptAt:new Date(Date.now()+delay),lastError:'Provider delivery failed'},
      $unset:{lockedAt:''}});
     if(failed)await db.notifications.insertOne({
      id:uid('NT'),accountId:rootEmail,kind:'communication_failure',
      message:'An opted-in IPS email notice could not be delivered after retries: '+job.id,
      read:false,createdAt:new Date()});
    }
   }
  }catch(err){console.error('IPS academic notification delivery incident',err?.name||'Error')}
  finally{mailBusy=false}
 };
 const tick=async()=>{
  if(busy)return;busy=true;
  try{
   const cutoff=new Date(Date.now()-10*60000);
   for(const q of await db.quotes.find({status:'received',createdAt:{$lt:cutoff}}).limit(100).toArray()){
    await db.notifications.updateOne({accountId:rootEmail,kind:'intake_escalation',ref:q.id},
     {$setOnInsert:{id:'NT-ESC-'+q.id,accountId:rootEmail,kind:'intake_escalation',ref:q.id,
      message:'Academic enquiry has been waiting for review: '+q.id,read:false,createdAt:new Date()}},{upsert:true});
   }
   const overdue=new Date(Date.now()-24*3600000);
   for(const p of await db.projects.find({status:'qa_pending',updatedAt:{$lt:overdue}}).limit(100).toArray()){
    await db.notifications.updateOne({accountId:rootEmail,kind:'qa_escalation',ref:p.id},
     {$setOnInsert:{id:'NT-QA-'+p.id,accountId:rootEmail,kind:'qa_escalation',ref:p.id,
      message:'Academic deliverable QA overdue for '+p.id,read:false,createdAt:new Date()}},{upsert:true});
   }
    // Date-only quote validity is expressed in UTC to keep enforcement stable.
    // Transition expiry atomically; only the winning worker notifies the Student.
    const today=new Date().toISOString().slice(0,10);
    const inTwoDays=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
    for(const q of await db.quotes.find({status:'offered',expires:{$gt:'',$lt:today}})
      .limit(100).toArray()){
     const expired=await db.quotes.findOneAndUpdate({
      id:q.id,status:'offered',expires:{$gt:'',$lt:today}
     },{$set:{status:'expired',expiredAt:new Date(),updatedAt:new Date()}},
     {returnDocument:'after'});
     if(expired){
      await notifyQuotation(expired,'Your reviewed academic quotation has expired. IPS can issue an updated offer.',
       'quotation_expired');
      await audit({id:'system',role:'system'},'academic_quotation_expired',q.id);
     }
    }
    for(const q of await db.quotes.find({status:'offered',
     expires:{$gte:today,$lte:inTwoDays},reminderSentAt:{$exists:false}})
     .limit(100).toArray()){
     const claimed=await db.quotes.findOneAndUpdate({
      id:q.id,status:'offered',expires:{$gte:today,$lte:inTwoDays},
      reminderSentAt:{$exists:false}
     },{$set:{reminderSentAt:new Date()}},{returnDocument:'after'});
     if(claimed)await notifyQuotation(claimed,'Your reviewed academic quotation will expire soon.',
      'quotation_expiry_reminder');
    }
  }catch(e){console.error('IPS academic automation incident',e?.name||'Error')}
  finally{busy=false}
 };
 const handle=setInterval(tick,config.sandbox?1200:60000);handle.unref?.();void tick();
 const mailHandle=setInterval(deliveryTick,2500);mailHandle.unref?.();void deliveryTick();
}
