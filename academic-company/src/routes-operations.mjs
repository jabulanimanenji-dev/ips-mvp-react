// IPS Academic Services company operations v2.
// One case, one visible conversation and document tray; Root can intervene without
// copying an account's password, signing as a client or exposing private vendor details.
import crypto from 'node:crypto';
import express from 'express';
import {publicDocument,normalizeFilename,validEmail,email} from './security.mjs';
import {SPECIALIST_AGREEMENT_VERSION} from './specialist-agreement.mjs';

export function registerOperationsRoutes(ctx){
 const {app,db,documentBucket,inspectAcademicUpload,config,rootEmail,notify,notifyQuotation,audit,authorize,throttle,wrap,now,uid}=ctx;
 const deny=res=>res.status(403).json({error:'You do not have access to this academic case.'});
 const staff=a=>a&&(['root','manager','staff'].includes(a.role));
 const intake=a=>a?.role==='root'||(staff(a)&&a.department==='client_relations');
 const delivery=a=>a?.role==='root'||(staff(a)&&['academic_delivery','quality_assurance'].includes(a.department));
 const assignedCase=(a,p)=>!!a&&(
  a.department==='client_relations'&&(p.coordinatorId===a.id||
   a.role==='manager'&&p.coordinatorManagerId===a.id)||
  a.department==='academic_delivery'&&(p.deliveryOwnerId===a.id||
   a.role==='manager'&&p.deliveryManagerId===a.id)||
  a.department==='quality_assurance'&&(p.qaOwnerId===a.id||
   a.role==='manager'&&p.qaManagerId===a.id));
 const scopedCaseFilter=a=>a.role==='root'?{}:
  a.department==='client_relations'?{$or:[{coordinatorId:a.id},
   ...(a.role==='manager'?[{coordinatorManagerId:a.id}]:[])]}:
  a.department==='academic_delivery'?{$or:[{deliveryOwnerId:a.id},
   ...(a.role==='manager'?[{deliveryManagerId:a.id}]:[])]}:
  a.department==='quality_assurance'?{$or:[{qaOwnerId:a.id},
   ...(a.role==='manager'?[{qaManagerId:a.id}]:[])]}:{id:'none'};
 const caseAccess=(a,p)=>a&&(a.role==='root'||a.role==='student'&&p.studentId===a.id||
   a.role==='specialist'&&p.specialistId===a.id||
   staff(a)&&assignedCase(a,p));
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
 const binaryDocument=req=>{
  let rawName='';
  try{rawName=decodeURIComponent(String(req.get('X-IPS-File-Name')||''))}
  catch{return {error:'Academic document filename encoding is invalid.'}}
  const filename=normalizeFilename(rawName),mime=String(req.get('X-IPS-File-Type')||'');
  const format=filename.toLowerCase().split('.').pop();
  const supported={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain'};
  const buffer=req.body;
  if(!Buffer.isBuffer(buffer)||buffer.length<12||buffer.length>20*1024*1024||
   supported[format]!==mime||!/^[A-Za-z0-9_.-]{1,100}$/.test(filename))
   return {error:'Choose a genuine PDF, DOCX or TXT document not exceeding 20 MB.'};
  if(mime==='application/pdf'&&buffer.subarray(0,5).toString()!=='%PDF-'||
    mime.includes('wordprocessingml')&&buffer.subarray(0,2).toString()!=='PK')
   return {error:'The academic document contents do not match its file type.'};
  return {filename,mime,buffer};
 };
 const storePrivateBlob=async({id,filename,mime,buffer,context})=>{
  const sha256=crypto.createHash('sha256').update(buffer).digest('hex');
  const blobId=await new Promise((resolve,reject)=>{
   const writer=documentBucket.openUploadStream(filename,{metadata:{
    academicFileId:id,sha256,mime,...context}});
   writer.once('error',reject);
   writer.once('finish',()=>resolve(writer.id));
   writer.end(buffer);
  });
  return {blobId,byteLength:buffer.length,sha256};
 };
 const streamPrivateBlob=(res,file)=>{
  if(file.blobId){
   if(Number.isSafeInteger(file.byteLength))res.set('Content-Length',file.byteLength);
   const reader=documentBucket.openDownloadStream(file.blobId);
   reader.on('error',()=>{
    if(!res.headersSent)res.status(503).json({error:'Private academic document storage is unavailable.'});
    else res.destroy();
   });
   reader.pipe(res);
  }else res.send(Buffer.from(file.fileData?.buffer||file.fileData));
 };
 const verifyScan=async(res,buffer)=>{
  const result=await inspectAcademicUpload(buffer);
  if(!result.allowed){res.status(result.http).json({error:result.error});return null}
  return result.status;
 };
 const metadata=x=>({id:x.id,commissionId:x.commissionId,filename:x.filename,mime:x.mime,
  purpose:x.purpose||x.kind||'deliverable',sha256:x.sha256,scanStatus:x.scanStatus||'legacy_unverified',createdAt:x.createdAt,
  uploadedBy:x.uploadedBy||'',revision:x.revision??0,approved:!!x.approved});
 const visibleFile=(a,p,f)=>{
  if(a.role==='root'||delivery(a))return true;
  if(a.role==='student'&&a.id===p.studentId)return (
   f.purpose==='reference'||f.kind==='client_reference'||
   ([p.releasedFileId,...(p.releasedFileHistory||[])].includes(f.id)&&['client_delivery','completed'].includes(p.status)));
  if(a.role==='specialist'&&a.id===p.specialistId)return true;
  return false;
 };
 const quoteMessageFilter=(a,q)=>a.role==='student'?{audience:{$in:['student','shared']}}:{};
 app.get('/api/operations/delivery-status',wrap(async(req,res)=>{
  if(!authorize(req,res,['root']))return;
  const statuses=['pending','sending','provider_accepted','synthetic_dispatched','delayed','delivered','bounced','complained','suppressed','failed','cancelled'];
  const [counts,exceptions]=await Promise.all([
   Promise.all(statuses.map(async status=>[status,
    await db.notificationDeliveries.countDocuments({status})])),
   db.notificationDeliveries.find({status:{$in:['failed','bounced','complained','suppressed']}},
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
   specialistAgreementVersion:SPECIALIST_AGREEMENT_VERSION,
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
 // Explicit department claim precedes private case access. Root remains an
 // override supervisor; staff never get blanket read access by department title.
 app.post('/api/operations/:id/claim',wrap(async(req,res)=>{
  if(!authorize(req,res,['manager','staff']))return;
  const a=req.actor;
  const policy={
   academic_delivery:{field:'deliveryOwnerId',managerField:'deliveryManagerId',
    statuses:['ready_for_assignment','specialist_assigned','root_in_progress',
     'correction_requested','student_revision_requested']},
   quality_assurance:{field:'qaOwnerId',managerField:'qaManagerId',
    statuses:['qa_pending','client_delivery','correction_requested']}
  }[a.department];
  if(!policy)return res.status(403).json({error:'This department cannot claim confidential academic jobs.'});
  const at=now(),empty={$or:[{[policy.field]:''},{[policy.field]:null},
   {[policy.field]:{$exists:false}}]};
  const assigned=await db.projects.findOneAndUpdate({id:req.params.id,
   status:{$in:policy.statuses},...empty},
   {$set:{[policy.field]:a.id,[policy.managerField]:a.role==='manager'?a.id:a.managerId||'',
    updatedAt:at},
    $push:{caseOwnershipHistory:{department:a.department,to:a.id,
     by:a.id,action:'claim',at}}},{returnDocument:'after'});
  if(!assigned)return res.status(409).json({error:'The job has another owner or cannot be claimed in its current state.'});
  await audit(req.actor,'academic_case_department_claimed',assigned.id,
   {department:a.department,ownerId:a.id});
  await notify(rootEmail,'IPS '+a.department+' accepted responsibility for '+assigned.id,'workforce');
  res.json({success:true,commissionId:assigned.id,department:a.department,ownerId:a.id});
 }));
 app.get('/api/operations/inbox',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','specialist','root','manager','staff']))return;
  const a=req.actor,page=Number(req.query.page||1),pageSize=Number(req.query.pageSize||20),
   term=String(req.query.search||'').trim(),status=String(req.query.status||'all');
  if(!Number.isSafeInteger(page)||page<1||page>10000||
   !Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100||term.length>100||
   (status!=='all'&&!/^[a-z_]{3,45}$/.test(status)))
   return res.status(400).json({error:'Choose a valid private inbox search, status and page.'});
  const qFilter=a.role==='student'?{studentId:a.id}:
   a.role==='root'||a.role==='manager'&&a.department==='client_relations'?{}:
   a.role==='staff'&&a.department==='client_relations'?
    {$or:[{assignedTo:a.id},{assignedTo:''},{assignedTo:null},
      {assignedTo:{$exists:false}}]}:{id:'none'};
  const cFilter=a.role==='student'?{studentId:a.id}:
   a.role==='specialist'?{specialistId:a.id}:
   a.role==='root'?{}:staff(a)?scopedCaseFilter(a):{id:'none'};
  const supportFilter=a.role==='root'||a.role==='manager'&&a.department==='client_relations'?{}:
   a.role==='staff'&&a.department==='client_relations'?
    {$or:[{assignedTo:a.id},{assignedTo:''},{assignedTo:null},
     {assignedTo:{$exists:false}}]}:
   a.role==='student'||a.role==='specialist'?{ownerId:a.id}:{id:'none'};
  const projections=(type,service,statusValue,updatedAt)=>({$project:{
   _id:0,type:{$literal:type},id:'$id',subject:'$subject',
   service:typeof service==='string'&&service.startsWith('$')?service:{$literal:service},
   status:typeof statusValue==='string'&&statusValue.startsWith('$')?statusValue:{$literal:statusValue},
   updatedAt:updatedAt||'$updatedAt'
  }});
  const pipeline=[
   {$match:qFilter},projections('quote','$serviceName','$status','$updatedAt'),
   {$unionWith:{coll:'academic_commissions',
    pipeline:[{$match:cFilter},projections('commission','$serviceName','$status','$updatedAt')]}},
   {$unionWith:{coll:'academic_support_cases',
    pipeline:[{$match:supportFilter},projections('support','Support','$status','$updatedAt')]}},
   {$unionWith:{coll:'academic_direct_messages',
    pipeline:[{$match:a.role==='root'?{}:{toId:a.id}},
     projections('direct','Direct company message','message','$createdAt')]}},
   {$unionWith:{coll:'academic_notifications',
    pipeline:[{$match:{accountId:a.id,read:false}},
     {$project:{_id:0,type:{$literal:'alert'},id:'$id',
      subject:'$message',service:{$literal:'Company update'},
      status:{$literal:'unread'},updatedAt:'$createdAt'}}]}}
  ];
  if(status!=='all')pipeline.push({$match:{status}});
  if(term){
   // Never compile user-controlled query regex directly.
   const escaped=term.replace(/[^A-Za-z0-9 ]/g,'\\$&');
   const pattern=new RegExp(escaped,'i');
   pipeline.push({$match:{$or:[
    {subject:pattern},{service:pattern},{id:pattern},{status:pattern},{type:pattern}]}});
  }
  pipeline.push({$sort:{updatedAt:-1,id:1}},
   {$facet:{items:[{$skip:(page-1)*pageSize},{$limit:pageSize}],
    totals:[{$count:'count'}]}});
  const result=await db.quotes.aggregate(pipeline,{allowDiskUse:true,maxTimeMS:15000}).toArray();
  const inbox=result[0]?.items||[],total=result[0]?.totals?.[0]?.count||0;
  res.json({inbox,page,pageSize,total,hasNext:page*pageSize<total,
   hasPrevious:page>1,query:term,statusFilter:status});
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
 app.post('/api/academic/quotes/:id/files-binary',
  express.raw({type:'application/octet-stream',limit:'21mb'}),wrap(async(req,res)=>{
  if(!authorize(req,res,['student','root','manager','staff']))return;
  if(await throttle.limited(req,'academic-quote-file',20))
   return res.status(429).json({error:'Please retry your document upload later.'});
  const q=await db.quotes.findOne({id:req.params.id});
  if(!q||!quoteAccess(req.actor,q))return deny(res);
  if(req.actor.role==='student'&&(!q.studentId||q.studentId!==req.actor.id))return deny(res);
  const checked=binaryDocument(req);
  if(checked.error)return res.status(400).json({error:checked.error});
  const a=req.actor,audience=a.role==='student'?'student':
   String(req.get('X-IPS-File-Audience')||'student');
  if(!['student','internal'].includes(audience))
   return res.status(400).json({error:'Choose the appropriate private enquiry audience.'});
  const id=uid('QF'),date=now();
  const scanStatus=await verifyScan(res,checked.buffer);
  if(!scanStatus)return;
  const blob=await storePrivateBlob({id,...checked,context:{kind:'enquiry_reference',quoteId:q.id}});
  const file={id,quoteId:q.id,studentId:q.studentId,filename:checked.filename,
   mime:checked.mime,purpose:'enquiry_reference',audience,...blob,scanStatus,
   uploadedBy:req.rootOperatorId||a.id,
   uploadedRole:req.rootOperatorId?'root':a.role,createdAt:date};
  try{await db.quoteFiles.insertOne(file)}
  catch(err){await documentBucket.delete(blob.blobId).catch(()=>{});throw err}
  await db.quotes.updateOne({id:q.id},{$set:{updatedAt:now()}});
  await notify(a.role==='student'?rootEmail:q.studentId,
   'Academic enquiry document uploaded for '+q.id,'quote_file');
  await audit(a,'academic_enquiry_document_uploaded',q.id,
   {fileId:id,audience,sha256:blob.sha256,byteLength:blob.byteLength});
  res.status(201).json({file:{id,filename:file.filename,mime:file.mime,
   audience,sha256:blob.sha256,byteLength:blob.byteLength,createdAt:date}});
 }));
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
  const scanStatus=await verifyScan(res,buffer);
  if(!scanStatus)return;
  const file={id:uid('QF'),quoteId:q.id,studentId:q.studentId,
   filename,mime,purpose:'enquiry_reference',audience,
   sha256:crypto.createHash('sha256').update(buffer).digest('hex'),fileData:buffer,scanStatus,
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
  streamPrivateBlob(res,file);
 }));
 app.post('/api/operations/:id/upload-reference-binary',
  express.raw({type:'application/octet-stream',limit:'21mb'}),wrap(async(req,res)=>{
  if(!authorize(req,res,['student','specialist','root']))return;
  if(await throttle.limited(req,'academic-case-reference',20))
   return res.status(429).json({error:'Please retry the academic document upload later.'});
  const p=await db.projects.findOne({id:req.params.id});
  if(!p||!caseAccess(req.actor,p))return deny(res);
  const a=req.actor;
  if(!(a.role==='root'||a.role==='student'&&p.studentId===a.id||
    a.role==='specialist'&&p.specialistId===a.id))
   return res.status(403).json({error:'Only the Client, assigned Specialist or Root may upload private case references.'});
  const checked=binaryDocument(req);
  if(checked.error)return res.status(400).json({error:checked.error});
  const id=uid('AF'),date=now();
  const scanStatus=await verifyScan(res,checked.buffer);
  if(!scanStatus)return;
  const blob=await storePrivateBlob({id,...checked,context:{
   kind:'client_reference',commissionId:p.id}});
  const file={id,commissionId:p.id,studentId:p.studentId,
   specialistId:p.specialistId,filename:checked.filename,mime:checked.mime,
   purpose:'reference',kind:'client_reference',...blob,scanStatus,
   createdAt:date,revision:p.revisionCount||0,uploadedBy:req.rootOperatorId||a.id};
  try{await db.files.insertOne(file)}
  catch(err){await documentBucket.delete(blob.blobId).catch(()=>{});throw err}
  await db.projects.updateOne({id:p.id},{$set:{updatedAt:now()}});
  await audit(a,'academic_reference_uploaded',p.id,
   {fileId:id,sha256:blob.sha256,byteLength:blob.byteLength});
  await notify(rootEmail,'New academic reference uploaded for '+p.id,'file');
  res.status(201).json({file:metadata(file),storage:'private_gridfs',
   byteLength:blob.byteLength});
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
  const scanStatus=await verifyScan(res,buffer);
  if(!scanStatus)return;
  const file={id:uid('AF'),commissionId:p.id,studentId:p.studentId,specialistId:p.specialistId,
   filename,mime,purpose,kind:purpose==='reference'?'client_reference':'academic_submission',
   sha256:crypto.createHash('sha256').update(buffer).digest('hex'),fileData:buffer,scanStatus,
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
     privateInstructions:instructions,activationStatus:'draft',
     agreementReference:'',clientDisclosureReference:'',updatedAt:now()}},{upsert:true});
  await db.projects.updateOne({id:p.id},{$set:{fulfilmentMode:'root',managedBy:rootEmail,updatedAt:now()}});
  await audit(req.actor,'root_private_external_fulfilment_recorded',p.id);
  res.json({success:true,rootOnly:true,message:'Root-only external sourcing record saved. IPS remains responsible for review, delivery and client correspondence.'});
 }));
 app.get('/api/operations/:id/outsourcing',wrap(async(req,res)=>{
  if(!authorize(req,res,['root']))return;
  const r=await db.rootOperations.findOne({commissionId:req.params.id});
  res.json({privateFulfilment:r?publicDocument(r):null});
 }));
 // Explicit Root-only authorization: nobody may represent a supplier as cleared
 // until Nyoro attests to an agreement, privacy disclosure and academic integrity.
 app.post('/api/operations/:id/outsourcing/authorize',wrap(async(req,res)=>{
  if(!authorize(req,res,['root']))return;
  const p=await db.projects.findOne({id:req.params.id});
  if(!p)return res.status(404).json({error:'Academic job not found.'});
  if(p.status!=='root_in_progress'||p.paymentStatus==='not_collected')
   return res.status(409).json({error:'Root must own an actually commissioned case first.'});
  const agreementReference=String(req.body?.agreementReference||'').trim(),
   clientDisclosureReference=String(req.body?.clientDisclosureReference||'').trim();
  if(agreementReference.length<12||agreementReference.length>350||
   clientDisclosureReference.length<12||clientDisclosureReference.length>350||
   req.body?.confidentialityChecked!==true||req.body?.academicIntegrityChecked!==true||
   req.body?.minimumNecessaryDataOnly!==true)
   return res.status(400).json({error:'Record agreement, lawful client disclosure and all privacy/integrity checks before supplier approval.'});
  const existing=await db.rootOperations.findOne({commissionId:p.id,
   mode:'private_external',providerReference:{$type:'string'}});
  if(!existing)return res.status(409).json({error:'Record the private outsourcing agreement and supplier first.'});
  await db.rootOperations.updateOne({commissionId:p.id,mode:'private_external'},{
   $set:{activationStatus:'authorized',agreementReference,clientDisclosureReference,
    confidentialityChecked:true,academicIntegrityChecked:true,minimumNecessaryDataOnly:true,
    authorizedBy:rootEmail,authorizedAt:now(),updatedAt:now()}});
  await audit(req.actor,'root_private_supplier_authorized',p.id,{
   agreementRecorded:true,privacyDisclosureRecorded:true});
  res.json({authorized:true,rootOnly:true});
 }));
 // The supplier workroom is separate from all Student, Specialist, manager and
 // employee file trays. Even the file metadata is Root-only.
 app.post('/api/operations/:id/external-files',wrap(async(req,res)=>{
  if(!authorize(req,res,['root']))return;
  const p=await db.projects.findOne({id:req.params.id});
  if(!p)return res.status(404).json({error:'Academic job not found.'});
  if(p.status!=='root_in_progress'||p.paymentStatus==='not_collected')
   return res.status(409).json({error:'Only an active Root-managed commissioned job may have supplier documents.'});
  const arrangement=await db.rootOperations.findOne({commissionId:p.id,mode:'private_external'});
  if(!arrangement)return res.status(409).json({error:'A private supplier workroom must be registered first.'});
  const kind=String(req.body?.kind||'');
  if(!['agreement','instructions','supplier_return','qa_reference'].includes(kind))
   return res.status(400).json({error:'Select a documented private supplier file type.'});
  if(kind==='supplier_return'&&arrangement.activationStatus!=='authorized')
   return res.status(409).json({error:'Supplier work cannot be accepted before confidentiality and agreement authorization.'});
  const checked=quickFile({...req.body,purpose:'reference'});
  if(checked.error)return res.status(400).json({error:checked.error});
  const {filename,mime,buffer}=checked;
  const scanStatus=await verifyScan(res,buffer);
  if(!scanStatus)return;
  const source={id:uid('XF'),commissionId:p.id,kind,filename,mime,
   providerReference:arrangement.providerReference,sha256:crypto.createHash('sha256').update(buffer).digest('hex'),
   fileData:buffer,scanStatus,uploadedBy:rootEmail,createdAt:now(),status:'private',
   createdInMode:'private_external'};
  await db.rootExternalFiles.insertOne(source);
  await audit(req.actor,'root_private_supplier_file_received',p.id,{
   fileId:source.id,kind,sha256:source.sha256});
  res.status(201).json({file:{id:source.id,commissionId:p.id,kind,filename,mime,
   sha256:source.sha256,createdAt:source.createdAt},rootOnly:true});
 }));
 app.get('/api/operations/:id/external-files',wrap(async(req,res)=>{
  if(!authorize(req,res,['root']))return;
  const rows=await db.rootExternalFiles.find({commissionId:req.params.id})
   .sort({createdAt:-1}).limit(250).toArray();
  res.json({files:rows.map(f=>({id:f.id,commissionId:f.commissionId,kind:f.kind,
   filename:f.filename,mime:f.mime,sha256:f.sha256,status:f.status,
   createdAt:f.createdAt,qaFileId:f.qaFileId||''})),rootOnly:true});
 }));
 app.get('/api/operations/external-files/:fileId',wrap(async(req,res)=>{
  if(!authorize(req,res,['root']))return;
  const f=await db.rootExternalFiles.findOne({id:req.params.fileId});
  if(!f)return res.status(404).json({error:'Private supplier file not found.'});
  await audit(req.actor,'root_private_supplier_file_downloaded',f.commissionId,{
   fileId:f.id,sha256:f.sha256});
  res.set('Content-Type',f.mime).set('Content-Disposition','attachment; filename="'+f.filename+'"')
   .set('Cache-Control','private,no-store').set('X-Content-Type-Options','nosniff')
   .set('X-Content-SHA256',f.sha256);
  res.send(Buffer.from(f.fileData?.buffer||f.fileData));
 }));
 app.post('/api/operations/:id/external-files/:fileId/submit-qa',wrap(async(req,res)=>{
  if(!authorize(req,res,['root']))return;
  const p=await db.projects.findOne({id:req.params.id});
  if(!p||p.status!=='root_in_progress'||p.fulfilmentMode!=='root'||
   p.paymentStatus==='not_collected')
   return res.status(409).json({error:'QA handoff requires an actual Root-managed paid commission.'});
  const arrangement=await db.rootOperations.findOne({commissionId:p.id,
   activationStatus:'authorized',mode:'private_external'});
  const source=await db.rootExternalFiles.findOne({id:req.params.fileId,
   commissionId:p.id,kind:'supplier_return',status:'private'});
  if(!arrangement||!source||source.providerReference!==arrangement.providerReference)
   return res.status(409).json({error:'Choose an authorized, unused supplier return from this same private arrangement.'});
  if(!config.sandbox&&source.scanStatus!=='clean')
   return res.status(409).json({error:'Supplier document requires security screening before academic release.'});
  const buffer=Buffer.from(source.fileData?.buffer||source.fileData);
  const sha256=crypto.createHash('sha256').update(buffer).digest('hex');
  if(sha256!==source.sha256)return res.status(409).json({error:'Supplier return checksum mismatch; QA release prohibited.'});
  const file={id:uid('AF'),commissionId:p.id,studentId:p.studentId,specialistId:'',
   filename:source.filename,mime:source.mime,purpose:'deliverable',kind:'academic_submission',
   sha256,fileData:buffer,scanStatus:source.scanStatus||'legacy_unverified',createdAt:now(),uploadedBy:rootEmail,
   revision:p.revisionCount||0,rootSubmission:true,privateExternalSourceId:source.id};
  await db.files.insertOne(file);
  const updated=await db.projects.findOneAndUpdate({id:p.id,status:'root_in_progress',
   fulfilmentMode:'root'},{$set:{pendingFileId:file.id,status:'qa_pending',updatedAt:now(),
   qaMode:'root_supervised_exception'}},{returnDocument:'after'});
  if(!updated){
   await db.files.deleteOne({id:file.id});
   return res.status(409).json({error:'The academic job changed while preparing the QA handoff.'});
  }
  await db.rootExternalFiles.updateOne({id:source.id,status:'private'},
   {$set:{status:'sent_to_qa',qaFileId:file.id,qaSentAt:now()}});
  await audit(req.actor,'root_supplier_return_accepted_for_qa',p.id,{
   privateSourceId:source.id,qaFileId:file.id,sha256});
  await notify(rootEmail,'Private Root-sourced academic material awaits governed QA on '+p.id,'quality');
  res.json({success:true,qaPending:true,fileId:file.id,sha256,
   releaseMode:'root_supervised_exception',rootOnly:true});
 }));
 app.post('/api/operations/direct-message/file',wrap(async(req,res)=>{
  if(!authorize(req,res,['root']))return;
  const target=await db.accounts.findOne({id:String(req.body?.recipientId||''),
   verified:true,status:'active',role:{$in:['student','specialist','manager','staff']}});
  if(!target)return res.status(404).json({error:'Choose a verified recipient.'});
  const checked=quickFile({...req.body,purpose:'reference'});
  if(checked.error)return res.status(400).json({error:checked.error});
  const {filename,mime,buffer}=checked;
  const scanStatus=await verifyScan(res,buffer);
  if(!scanStatus)return;
  const f={id:uid('DMF'),toId:target.id,fromId:rootEmail,filename,mime,
   sha256:crypto.createHash('sha256').update(buffer).digest('hex'),
   fileData:buffer,scanStatus,createdAt:now()};
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
