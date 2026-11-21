// IPS Academic Services company operations v2.
// One case, one visible conversation and document tray; Root can intervene without
// copying an account's password, signing as a client or exposing private vendor details.
import crypto from 'node:crypto';
import {publicDocument,normalizeFilename,validEmail,email} from './security.mjs';

export function registerOperationsRoutes(ctx){
 const {app,db,rootEmail,notify,notifyQuotation,audit,authorize,wrap,now,uid}=ctx;
 const deny=res=>res.status(403).json({error:'You do not have access to this academic case.'});
 const staff=a=>a&&(['root','manager','staff'].includes(a.role));
 const intake=a=>a?.role==='root'||(staff(a)&&a.department==='client_relations');
 const delivery=a=>a?.role==='root'||(staff(a)&&['academic_delivery','quality_assurance'].includes(a.department));
 const caseAccess=(a,p)=>a&&(a.role==='root'||a.role==='student'&&p.studentId===a.id||
   a.role==='specialist'&&p.specialistId===a.id||
   staff(a)&&['client_relations','academic_delivery','quality_assurance'].includes(a.department));
 const quoteAccess=(a,q)=>!!a&&(a.role==='root'||
  a.role==='student'&&q.studentId===a.id||
  a.role==='manager'&&a.department==='client_relations'||
  a.role==='staff'&&a.department==='client_relations'&&
   (!q.assignedTo||q.assignedTo===a.id));
 const quickFile=input=>{
  const filename=normalizeFilename(input?.filename),mime=String(input?.mime||''),
    data=String(input?.data||''),purpose=String(input?.purpose||'');
  const approved={'.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt':'text/plain'};
  const ext=Object.keys(approved).find(x=>filename.toLowerCase().endsWith(x));
  if(!ext||approved[ext]!==mime||!['reference','deliverable'].includes(purpose)||
    !/^[a-zA-Z0-9_.-]{1,100}$/.test(filename)||data.length<16||data.length>7100000||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(data))
   return {error:'Choose a valid PDF, DOCX or TXT file under 5 MB.'};
  const buffer=Buffer.from(data,'base64');
  if(buffer.length<12||buffer.length>5*1024*1024)return {error:'File exceeds the 5 MB per-document limit.'};
  if(mime==='application/pdf'&&buffer.subarray(0,5).toString()!=='%PDF-')return {error:'PDF contents are invalid.'};
  if(mime.includes('wordprocessingml')&&buffer.subarray(0,2).toString()!=='PK')return {error:'DOCX contents are invalid.'};
  return {filename,mime,purpose,buffer};
 };
 const metadata=x=>({id:x.id,commissionId:x.commissionId,filename:x.filename,mime:x.mime,
  purpose:x.purpose||x.kind||'deliverable',sha256:x.sha256,createdAt:x.createdAt,
  uploadedBy:x.uploadedBy||'',revision:x.revision??0,approved:!!x.approved});
 const visibleFile=(a,p,f)=>{
  if(a.role==='root'||delivery(a))return true;
  if(a.role==='student'&&a.id===p.studentId)return (
   f.purpose==='reference'||f.kind==='client_reference'||
   (f.id===p.releasedFileId&&['client_delivery','completed'].includes(p.status)));
  if(a.role==='specialist'&&a.id===p.specialistId)return true;
  return false;
 };
 const quoteMessageFilter=(a,q)=>a.role==='student'?{audience:{$in:['student','shared']}}:{};
 app.get('/api/operations/delivery-status',wrap(async(req,res)=>{
  if(!authorize(req,res,['root']))return;
  const statuses=['pending','sending','provider_accepted','synthetic_dispatched','delivered','failed'];
  const [counts,exceptions]=await Promise.all([
   Promise.all(statuses.map(async status=>[status,
    await db.notificationDeliveries.countDocuments({status})])),
   db.notificationDeliveries.find({status:'failed'},
    {projection:{_id:0,id:1,kind:1,status:1,attempts:1,createdAt:1,lastError:1}})
    .sort({createdAt:-1}).limit(40).toArray()
  ]);
  res.json({counts:Object.fromEntries(counts),exceptions});
 }));
 app.post('/api/operations/delivery/:id/retry',wrap(async(req,res)=>{
  if(!authorize(req,res,['root']))return;
  const job=await db.notificationDeliveries.findOneAndUpdate({
   id:req.params.id,status:'failed'},{
    $set:{status:'pending',attempts:0,nextAttemptAt:now()},
    $unset:{lockedAt:'',lastError:''}
   },{returnDocument:'after'});
  if(!job)return res.status(409).json({error:'This delivery is not in the failed exception queue.'});
  await audit(req.actor,'academic_notification_retry_requested',job.id,{kind:job.kind});
  res.json({success:true,status:'pending'});
 }));
 app.get('/api/operations/available-specialists',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','manager','staff']))return;
  if(req.actor.role!=='root'&&req.actor.department!=='academic_delivery')
   return res.status(403).json({error:'Academic Delivery authority is required.'});
  const service=String(req.query.service||'');
  const rows=await db.accounts.find({role:'specialist',verified:true,approved:true,
   status:'active',availabilityStatus:{$in:['available','limited']},
   ...(service?{expertise:service}:{})}).sort({name:1}).limit(100).toArray();
  const eligible=await Promise.all(rows.map(async a=>{
   const active=await db.projects.countDocuments({specialistId:a.id,
    status:{$nin:['completed','cancelled','closed']}});
   const occupied=Math.max(active,a.activeAssignments||0);
   const capacity=a.maxConcurrentCases||0;
   return capacity>occupied?{id:a.id,name:a.name,expertise:a.expertise||[],
    availabilityStatus:a.availabilityStatus,maxConcurrentCases:capacity,
    activeAssignments:occupied,availableSlots:capacity-occupied,
    turnaroundDays:a.turnaroundDays||0}:null;
  }));
  res.json({specialists:eligible.filter(Boolean)});
 }));
 app.get('/api/operations/inbox',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','specialist','root','manager','staff']))return;
  const a=req.actor;
  const qFilter=a.role==='student'?{studentId:a.id}:
   (a.role==='root'||intake(a))?{}:{id:'none'};
  const cFilter=a.role==='student'?{studentId:a.id}:a.role==='specialist'?{specialistId:a.id}:
   (a.role==='root'||delivery(a)||intake(a))?{}:{id:'none'};
  const [quotes,commissions,cases,dm,alerts]=await Promise.all([
   db.quotes.find(qFilter).sort({updatedAt:-1}).limit(60).toArray(),
   db.projects.find(cFilter).sort({updatedAt:-1}).limit(80).toArray(),
   db.support.find(a.role==='root'||intake(a)?{}:{ownerId:a.id}).sort({updatedAt:-1}).limit(40).toArray(),
   db.directMessages.find(a.role==='root'?{}:{toId:a.id}).sort({createdAt:-1}).limit(40).toArray(),
   db.notifications.find({accountId:a.id,read:false}).sort({createdAt:-1}).limit(35).toArray()]);
  res.json({inbox:[
   ...quotes.map(q=>({type:'quote',id:q.id,subject:q.subject,service:q.serviceName,
    status:q.status,updatedAt:q.updatedAt})),
   ...commissions.map(p=>({type:'commission',id:p.id,subject:p.subject,service:p.serviceName,
    status:p.status,updatedAt:p.updatedAt,assigned:!!p.specialistId})),
   ...cases.map(t=>({type:'support',id:t.id,subject:t.subject,service:'Support',
    status:t.status,updatedAt:t.updatedAt})),
   ...dm.map(m=>({type:'direct',id:m.id,subject:m.subject||'IPS message',
    service:'Direct company message',status:'message',updatedAt:m.createdAt})),
   ...alerts.map(n=>({type:'alert',id:n.id,subject:n.message,
    service:'Company update',status:'unread',updatedAt:n.createdAt}))
  ].sort((x,y)=>new Date(y.updatedAt)-new Date(x.updatedAt))});
 }));
 app.get('/api/academic/quotes/:id/messages',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','root','manager','staff']))return;
  const q=await db.quotes.findOne({id:req.params.id});
  if(!q||!quoteAccess(req.actor,q))return deny(res);
  const rows=await db.quoteMessages.find({quoteId:q.id,...quoteMessageFilter(req.actor,q)})
   .sort({createdAt:1}).limit(250).toArray();
  res.json({messages:rows.map(publicDocument),quoteId:q.id});
 }));
 app.post('/api/academic/quotes/:id/messages',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','root','manager','staff']))return;
  const q=await db.quotes.findOne({id:req.params.id});
  if(!q||!quoteAccess(req.actor,q))return deny(res);
  const body=String(req.body?.body||'').trim(),a=req.actor;
  if(body.length<2||body.length>3500)return res.status(400).json({error:'Write a message between 2 and 3,500 characters.'});
  const audience=a.role==='student'?'student':String(req.body?.audience||'student');
  if(!['student','internal'].includes(audience))return res.status(400).json({error:'Choose Student or internal company correspondence.'});
  const msg={id:uid('QM'),quoteId:q.id,actorId:req.rootOperatorId||a.id,
   actorRole:req.rootOperatorId?'root':a.role,body,audience,createdAt:now(),
   ...(req.rootOperatorId?{assistedAccountId:a.id,rootAssisted:true}:{})};
  await db.quoteMessages.insertOne(msg);
  await db.quotes.updateOne({id:q.id},{$set:{updatedAt:now()}});
  if(a.role==='student')await notify(rootEmail,'Student replied to academic enquiry '+q.id,'quote_message');
  else if(audience==='student'){
   await notifyQuotation(q,'IPS replied to your academic enquiry '+q.id,'quote_message');
  }
  await audit(a,'academic_quote_message',q.id,{audience});
  res.status(201).json({message:publicDocument(msg)});
 }));
 // Academic enquiry documents are available before commission/payment, subject to the same
 // ownership boundary as quotations. Guest enquiries require a verified registered account.
 app.post('/api/academic/quotes/:id/files',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','root','manager','staff']))return;
  const q=await db.quotes.findOne({id:req.params.id});
  if(!q||!quoteAccess(req.actor,q))return deny(res);
  if(req.actor.role==='student'&&(!q.studentId||q.studentId!==req.actor.id))
   return deny(res);
  const checked=quickFile({...req.body,purpose:'reference'});
  if(checked.error)return res.status(400).json({error:checked.error});
  const a=req.actor;
  const audience=a.role==='student'?'student':String(req.body?.audience||'student');
  if(!['student','internal'].includes(audience))return res.status(400).json({error:'Choose a valid quotation document audience.'});
  const {filename,mime,buffer}=checked;
  const file={id:uid('QF'),quoteId:q.id,studentId:q.studentId,
   filename,mime,purpose:'enquiry_reference',audience,
   sha256:crypto.createHash('sha256').update(buffer).digest('hex'),fileData:buffer,
   uploadedBy:req.rootOperatorId||a.id,uploadedRole:req.rootOperatorId?'root':a.role,createdAt:now()};
  await db.quoteFiles.insertOne(file);
  await db.quotes.updateOne({id:q.id},{$set:{updatedAt:now()}});
  await notify(a.role==='student'?rootEmail:q.studentId,
   'Academic enquiry document uploaded for '+q.id,'quote_file');
  await audit(a,'academic_enquiry_document_uploaded',q.id,{fileId:file.id,audience,sha256:file.sha256});
  res.status(201).json({file:{id:file.id,filename:file.filename,mime:file.mime,
   sha256:file.sha256,audience:file.audience,createdAt:file.createdAt}});
 }));
 app.get('/api/academic/quotes/:id/files',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','root','manager','staff']))return;
  const q=await db.quotes.findOne({id:req.params.id});
  if(!q||!quoteAccess(req.actor,q))return deny(res);
  const a=req.actor,filter={quoteId:q.id,...(a.role==='student'?{audience:'student'}:{})};
  const rows=await db.quoteFiles.find(filter).sort({createdAt:-1}).limit(100).toArray();
  res.json({files:rows.map(x=>({id:x.id,filename:x.filename,mime:x.mime,
    audience:x.audience,sha256:x.sha256,createdAt:x.createdAt,uploadedRole:x.uploadedRole}))});
 }));
 app.get('/api/academic/quote-files/:id',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','root','manager','staff']))return;
  const file=await db.quoteFiles.findOne({id:req.params.id});
  if(!file)return res.status(404).json({error:'Quotation document not found.'});
  const q=await db.quotes.findOne({id:file.quoteId});
  if(!q||!quoteAccess(req.actor,q)||req.actor.role==='student'&&file.audience!=='student')return deny(res);
  res.set('Content-Type',file.mime).set('Content-Disposition','attachment; filename="'+file.filename+'"')
   .set('Cache-Control','private,no-store').set('X-Content-Type-Options','nosniff')
   .set('X-Content-SHA256',file.sha256);
  res.send(Buffer.from(file.fileData?.buffer||file.fileData));
 }));
 app.post('/api/operations/:id/upload',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','student','specialist','manager','staff']))return;
  const p=await db.projects.findOne({id:req.params.id});
  if(!p||!caseAccess(req.actor,p))return deny(res);
  const checked=quickFile(req.body||{});
  if(checked.error)return res.status(400).json({error:checked.error});
  const {filename,mime,purpose,buffer}=checked,a=req.actor;
  if(purpose==='reference'){
   if(!(a.role==='root'||a.role==='student'&&p.studentId===a.id||
    a.role==='specialist'&&p.specialistId===a.id))
    return res.status(403).json({error:'Only the client, assigned Specialist or Root may upload reference material.'});
  }else{
   if(!(a.role==='root'||(a.role==='specialist'&&a.id===p.specialistId)))
    return res.status(403).json({error:'Only the assigned academic Specialist or Nyoro Root may submit deliverables.'});
   if(!['specialist_assigned','root_in_progress','correction_requested','student_revision_requested'].includes(p.status))
    return res.status(409).json({error:'This academic case is not ready for a new deliverable.'});
  }
  const file={id:uid('AF'),commissionId:p.id,studentId:p.studentId,specialistId:p.specialistId,
   filename,mime,purpose,kind:purpose==='reference'?'client_reference':'academic_submission',
   sha256:crypto.createHash('sha256').update(buffer).digest('hex'),fileData:buffer,
   createdAt:now(),uploadedBy:req.rootOperatorId||a.id,revision:p.revisionCount||0,
   rootSubmission:a.role==='root'};
  await db.files.insertOne(file);
  if(purpose==='deliverable'){
   const updated=await db.projects.updateOne({id:p.id,status:p.status},
    {$set:{pendingFileId:file.id,status:'qa_pending',updatedAt:now()}});
   if(!updated.modifiedCount){await db.files.deleteOne({id:file.id});return res.status(409).json({error:'The academic case changed while uploading. Try again.'})}
   await notify(rootEmail,'Academic deliverable submitted for QA on '+p.id,'quality');
  }else await db.projects.updateOne({id:p.id},{$set:{updatedAt:now()}});
  await audit(a,'academic_'+purpose+'_uploaded',p.id,{fileId:file.id,sha256:file.sha256,
   operator:req.rootOperatorId||a.id});
  if(purpose==='reference')await notify(rootEmail,'New academic reference on '+p.id,'file');
  res.status(201).json({file:metadata(file),needsQa:purpose==='deliverable'});
 }));
 app.get('/api/operations/:id/files',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','student','specialist','manager','staff']))return;
  const p=await db.projects.findOne({id:req.params.id});
  if(!p||!caseAccess(req.actor,p))return deny(res);
  const rows=await db.files.find({commissionId:p.id}).sort({createdAt:-1}).toArray();
  res.json({files:rows.filter(f=>visibleFile(req.actor,p,f)).map(metadata)});
 }));
 app.post('/api/operations/:id/takeover',wrap(async(req,res)=>{
  if(!authorize(req,res,['root']))return;
  const note=String(req.body?.reason||'').trim();
  if(note.length<12||note.length>1200)return res.status(400).json({error:'Record a short reason for taking over this academic job.'});
  const eligible=['ready_for_assignment','specialist_assigned','root_in_progress','correction_requested','student_revision_requested'];
  const p=await db.projects.findOne({id:req.params.id});
  if(!p)return res.status(404).json({error:'Academic job not found.'});
  if(p.paymentStatus==='not_collected'||p.status==='awaiting_payment_integration')
   return res.status(409).json({error:'Root may review this job but cannot start a paid commission before the payment gate.'});
  if(!eligible.includes(p.status))return res.status(409).json({error:'This job is in QA, delivery or completed status. Reopen it through an authorized case change.'});
  const before=p.specialistId||'';
  const u=await db.projects.findOneAndUpdate({id:p.id,status:p.status},
   {$set:{status:'root_in_progress',specialistId:'',managedBy:rootEmail,
     fulfilmentMode:'root',updatedAt:now()}},{returnDocument:'after'});
  if(!u)return res.status(409).json({error:'The case changed while Root took responsibility.'});
  // Reassignment immediately releases the former Specialist's reserved capacity.
  if(before)await db.accounts.updateOne({id:before,activeAssignments:{$gt:0}},
   {$inc:{activeAssignments:-1}});
  await db.projects.updateOne({id:p.id,'milestones.name':'Specialist assignment'},
   {$set:{'milestones.$.status':'complete','milestones.$.at':now()}});
  await db.rootOperations.updateOne({commissionId:p.id},
   {$set:{mode:'root',managedBy:rootEmail,reason:note,priorSpecialistId:before,
      updatedAt:now()}},{upsert:true});
  await audit(req.actor,'root_academic_job_takeover',p.id,{reason:note,priorSpecialist:before});
  if(before)await notify(before,'IPS Root Administration has reassigned academic job '+p.id,'assignment');
  await notify(p.studentId,'IPS is directly coordinating your academic work '+p.id,'assignment');
  res.json({commission:publicDocument(await db.projects.findOne({id:p.id})),rootInCharge:true});
 }));
 app.post('/api/operations/:id/outsourcing',wrap(async(req,res)=>{
  if(!authorize(req,res,['root']))return;
  const p=await db.projects.findOne({id:req.params.id});
  if(!p)return res.status(404).json({error:'Academic job not found.'});
  if(!['root_in_progress','ready_for_assignment'].includes(p.status))
   return res.status(409).json({error:'Take responsibility for this case before recording private external fulfilment.'});
  if(p.paymentStatus==='not_collected')return res.status(409).json({error:'A paid commission must pass its payment gate first.'});
  const provider=String(req.body?.provider||'').trim(),
    instructions=String(req.body?.instructions||'').trim();
  if(provider.length<3||provider.length>200||instructions.length<12||instructions.length>3000)
   return res.status(400).json({error:'Enter a meaningful private provider reference and outsourcing brief.'});
  await db.rootOperations.updateOne({commissionId:p.id},
   {$set:{mode:'private_external',managedBy:rootEmail,providerReference:provider,
     privateInstructions:instructions,updatedAt:now()}},{upsert:true});
  await db.projects.updateOne({id:p.id},{$set:{fulfilmentMode:'root',managedBy:rootEmail,updatedAt:now()}});
  await audit(req.actor,'root_private_external_fulfilment_recorded',p.id);
  res.json({success:true,rootOnly:true,message:'Root-only external sourcing record saved. IPS remains responsible for review, delivery and client correspondence.'});
 }));
 app.get('/api/operations/:id/outsourcing',wrap(async(req,res)=>{
  if(!authorize(req,res,['root']))return;
  const r=await db.rootOperations.findOne({commissionId:req.params.id});
  res.json({privateFulfilment:r?publicDocument(r):null});
 }));
 app.post('/api/operations/direct-message/file',wrap(async(req,res)=>{
  if(!authorize(req,res,['root']))return;
  const target=await db.accounts.findOne({id:String(req.body?.recipientId||''),
   verified:true,status:'active',role:{$in:['student','specialist','manager','staff']}});
  if(!target)return res.status(404).json({error:'Choose a verified recipient.'});
  const checked=quickFile({...req.body,purpose:'reference'});
  if(checked.error)return res.status(400).json({error:checked.error});
  const {filename,mime,buffer}=checked;
  const f={id:uid('DMF'),toId:target.id,fromId:rootEmail,filename,mime,
   sha256:crypto.createHash('sha256').update(buffer).digest('hex'),
   fileData:buffer,createdAt:now()};
  await db.directFiles.insertOne(f);
  const note={id:uid('DM'),toId:target.id,fromId:rootEmail,fromRole:'root',recipientRole:target.role,
   body:'IPS has shared a private academic document: '+filename,subject:'Secure academic document',
   attachmentId:f.id,createdAt:now()};
  await db.directMessages.insertOne(note);
  await notify(target.id,'IPS sent a private academic document '+filename,'direct_file');
  await audit(req.actor,'root_direct_file_sent',target.id,{fileId:f.id,sha256:f.sha256});
  res.status(201).json({file:{id:f.id,filename,mime,sha256:f.sha256,toId:f.toId,createdAt:f.createdAt}});
 }));
 app.get('/api/operations/direct-file/:id',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','student','specialist','manager','staff']))return;
  const f=await db.directFiles.findOne({id:req.params.id});
  if(!f||req.actor.role!=='root'&&f.toId!==req.actor.id)return deny(res);
  res.set('Content-Type',f.mime).set('Content-Disposition','attachment; filename="'+f.filename+'"')
   .set('Cache-Control','private,no-store').set('X-Content-Type-Options','nosniff')
   .set('X-Content-SHA256',f.sha256);
  res.send(Buffer.from(f.fileData?.buffer||f.fileData));
 }));
 app.get('/api/operations/direct-message/:id/thread',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','student','specialist','manager','staff']))return;
  const seed=await db.directMessages.findOne({id:req.params.id});
  if(!seed||req.actor.role!=='root'&&seed.toId!==req.actor.id&&seed.fromId!==req.actor.id)return deny(res);
  const threadId=seed.threadId||seed.id;
  const rows=await db.directMessages.find({$or:[{id:threadId},{threadId}]})
    .sort({createdAt:1}).limit(200).toArray();
  const relevant=rows.filter(m=>req.actor.role==='root'||m.toId===req.actor.id||m.fromId===req.actor.id);
  res.json({messages:relevant.map(publicDocument),threadId});
 }));
 app.post('/api/operations/direct-message/:id/reply',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','student','specialist','manager','staff']))return;
  const seed=await db.directMessages.findOne({id:req.params.id});
  if(!seed)return res.status(404).json({error:'Conversation not found.'});
  if(req.actor.role!=='root'&&seed.toId!==req.actor.id)return deny(res);
  const body=String(req.body?.body||'').trim();
  if(body.length<2||body.length>3500)return res.status(400).json({error:'Write a private reply.'});
  const threadId=seed.threadId||seed.id;
  const recipient=req.actor.role==='root'?(seed.fromId===rootEmail?seed.toId:seed.fromId):rootEmail;
  const m={id:uid('DM'),threadId,fromId:req.actor.id,fromRole:req.actor.role,
    toId:recipient,body,subject:'IPS private message',createdAt:now()};
  await db.directMessages.insertOne(m);
  await notify(recipient,'A new written reply is available in your private IPS inbox','direct_message');
  await audit(req.actor,'academic_direct_message_replied',threadId,{recipient});
  res.status(201).json({message:publicDocument(m)});
 }));
 app.post('/api/operations/direct-message',wrap(async(req,res)=>{
  if(!authorize(req,res,['root']))return;
  const target=await db.accounts.findOne({id:String(req.body?.recipientId||''),
   role:{$in:['student','specialist','manager','staff']},verified:true,status:'active'});
  if(!target)return res.status(404).json({error:'Choose a verified active IPS recipient.'});
  const body=String(req.body?.body||'').trim();
  if(body.length<2||body.length>3500)return res.status(400).json({error:'Write a clear company message.'});
  const item={id:uid('DM'),toId:target.id,fromId:rootEmail,fromRole:'root',
   recipientRole:target.role,body,subject:'Message from IPS',createdAt:now()};
  await db.directMessages.insertOne(item);
  await notify(target.id,'A message from IPS is available in your workspace','direct_message');
  // Email-preferring accounts receive an automatic generic notification through the
  // retryable queue; workspace/Telegram preferences do not trigger unsolicited email.
  await audit(req.actor,'root_direct_academic_message',target.id,{messageId:item.id});
  res.status(201).json({message:publicDocument(item)});
 }));
 app.get('/api/operations/direct-message',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','student','specialist','manager','staff']))return;
  const filter=req.actor.role==='root'?{}:{toId:req.actor.id};
  const rows=await db.directMessages.find(filter).sort({createdAt:-1}).limit(100).toArray();
  res.json({messages:rows.map(publicDocument)});
 }));
}
