// IPS Academic Services: genuine scoped academic enquiries, cases, commissions and QA.
import crypto from 'node:crypto';
import {email,validEmail,validUsername,publicDocument,normalizeFilename,strongToken,validToken} from './security.mjs';
import {SERVICES,SERVICE_MAP,ACADEMIC_LEVELS,academicIntegrityNotice} from './catalogue.mjs';

export function registerAcademicRoutes(ctx){
 const {app,db,config,env,security,throttle,sendEmail,rootEmail,notify,audit,authorize,department,wrap,now,uid}=ctx;
 const allowedChannels=['workspace','email','telegram'];
 const quoteView=q=>{
  const x=publicDocument(q);delete x.verifyHash;delete x.verifyUntil;delete x.internalEvaluation;
  return x;
 };
 const commissionView=p=>publicDocument(p);
 const studentOwner=(a,p)=>a?.role==='student'&&a.id===p.studentId;
 const specialistOwner=(a,p)=>a?.role==='specialist'&&a.id===p.specialistId;
 const adminOf=(a,p)=>!!a&&(a.role==='root'||(['manager','staff'].includes(a.role)&&['academic_delivery','quality_assurance','client_relations'].includes(a.department)));
 const canSee=(a,p)=>!!a&&(studentOwner(a,p)||specialistOwner(a,p)||adminOf(a,p));
 const denial=(res)=>res.status(403).json({error:'You do not have access to this private academic record.'});
 const validateBrief=input=>{
  const serviceId=String(input?.serviceId||''),service=SERVICE_MAP.get(serviceId);
  const level=String(input?.academicLevel||''),subject=String(input?.subject||'').trim();
  const brief=String(input?.requirements||'').trim(),deadline=String(input?.deadline||'').trim();
  const instructions=String(input?.institutionGuidance||'').trim();
  if(!service)return {error:'Select one of the real IPS academic services.'};
  if(!ACADEMIC_LEVELS.includes(level))return {error:'Choose the correct academic level.'};
  if(subject.length<3||subject.length>140)return {error:'Enter an academic subject or research discipline.'};
  if(brief.length<25||brief.length>6000)return {error:'Describe the academic assistance needed in at least 25 characters.'};
  if(instructions.length>3000||deadline.length>60)return {error:'Instructions or deadline are too long.'};
  if(input?.integrityAcknowledged!==true)return {error:'Confirm that your request complies with academic integrity requirements.'};
  return {service,serviceId,level,subject,brief,deadline,instructions};
 };
 const quoteBase=(input,valid,owner)=>({
  id:uid('IPS-Q'),studentId:owner?.id||'',username:owner?.username||String(input?.username||''),
  contactEmail:owner?.email||email(input?.email),
  serviceId:valid.serviceId,serviceName:valid.service.title,academicLevel:valid.level,
  subject:valid.subject,requirements:valid.brief,institutionGuidance:valid.instructions,deadline:valid.deadline,
  contactChannel:String(input?.contactChannel||'email'),telegramUsername:String(input?.telegramUsername||'').replace(/^@/,'').slice(0,40),
  integrityAcknowledged:true,status:owner?'received':'awaiting_contact_verification',
  createdAt:now(),updatedAt:now(),priceMinor:null,currency:'PLN',
  assignedDepartment:'client_relations',assignedTo:'',reviewedBy:'',scopeDecision:'pending',
  autoAcknowledged:!!owner
 });
 app.post('/api/academic/guest-quote',wrap(async(req,res)=>{
  if(throttle.limited(req,'academic-guest-intake',5))return res.status(429).json({error:'Too many academic requests.'});
  const input=req.body||{},contactEmail=email(input.email),uname=String(input.username||'').trim();
  const valid=validateBrief(input);if(valid.error)return res.status(400).json({error:valid.error});
  if(!validEmail(contactEmail)||!validUsername(uname)||input.privacyConsent!==true)
   return res.status(400).json({error:'Provide a private username, verifiable email and consent.'});
  const channel=String(input.contactChannel||'email');
  if(!allowedChannels.includes(channel)||channel==='workspace')
   return res.status(400).json({error:'Guest quotations require an email or verified Telegram reply destination.'});
  if(channel==='telegram'&&!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(String(input.telegramUsername||'').replace(/^@/,'')))
   return res.status(400).json({error:'A valid Telegram username is required.'});
  const item=quoteBase(input,valid,null),token=strongToken();
  item.verifyHash=security.digest('academic-quote:'+token);
  item.verifyUntil=new Date(Date.now()+20*60000);
  await db.quotes.insertOne(item);
  try{
   await sendEmail(contactEmail,'Confirm your confidential IPS Academic Services quotation request',
    'Your private academic enquiry '+item.id+' was received, but IPS must verify your email ownership before processing it.\n'+
    'Verify within 20 minutes: '+config.origin+'/#guestconfirm='+token+'&email='+encodeURIComponent(contactEmail)+'&ref='+encodeURIComponent(item.id)+
    '\n\nIPS never calls clients. Your chosen reply preference: '+channel+'.\n'+academicIntegrityNotice);
  }catch{await db.quotes.deleteOne({id:item.id,status:'awaiting_contact_verification'});
   return res.status(503).json({error:'IPS could not send your confirmation email. No quotation was activated.'})}
  await audit({id:'guest',role:'guest'},'academic_guest_enquiry',item.id,{serviceId:valid.serviceId});
  res.status(202).json({success:true,reference:item.id,confirmationRequired:true});
 }));
 app.post('/api/academic/guest-confirm',wrap(async(req,res)=>{
  if(throttle.limited(req,'academic-guest-confirm',12))return res.status(429).json({error:'Too many confirmation attempts.'});
  const token=String(req.body?.token||''),mail=email(req.body?.email),ref=String(req.body?.reference||'');
  if(!validToken(token)||!validEmail(mail))return res.status(400).json({error:'Invalid confirmation.'});
  const quote=await db.quotes.findOneAndUpdate({id:ref,contactEmail:mail,status:'awaiting_contact_verification',
   verifyHash:security.digest('academic-quote:'+token),verifyUntil:{$gt:now()}},
   {$set:{status:'received',contactVerified:true,updatedAt:now()},
    $unset:{verifyHash:'',verifyUntil:''}},{returnDocument:'after'});
  if(!quote)return res.status(400).json({error:'The private enquiry confirmation expired or was already used.'});
  await notify(rootEmail,'Verified guest academic enquiry '+quote.id+' awaits review','intake');
  await audit({id:'guest',role:'guest'},'academic_guest_enquiry_verified',quote.id);
  res.json({success:true,reference:quote.id,message:'Your enquiry is verified and awaiting IPS written review.'});
 }));
 app.post('/api/academic/quotes',wrap(async(req,res)=>{
  if(!authorize(req,res,['student']))return;
  if(throttle.limited(req,'student-academic-quotes',12))return res.status(429).json({error:'Please wait before sending another quotation.'});
  const valid=validateBrief(req.body);if(valid.error)return res.status(400).json({error:valid.error});
  const input={...req.body,username:req.actor.username,email:req.actor.email};
  const channel=String(input.contactChannel||'workspace');
  if(!allowedChannels.includes(channel))return res.status(400).json({error:'Choose an available IPS written communication channel.'});
  if(channel==='telegram'&&!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(String(input.telegramUsername||'').replace(/^@/,'')))
   return res.status(400).json({error:'Enter a valid Telegram username.'});
  const q=quoteBase(input,valid,req.actor);
  await db.quotes.insertOne(q);
  await audit(req.actor,'academic_quote_created',q.id,{serviceId:q.serviceId});
  await notify(rootEmail,'New academic quotation '+q.id+' requires scope review','intake');
  await notify(req.actor.id,'IPS received your '+q.serviceName+' enquiry '+q.id,'intake');
  res.status(201).json({success:true,quote:quoteView(q)});
 }));
 app.post('/api/academic/quotes/claim',wrap(async(req,res)=>{
  if(!authorize(req,res,['student']))return;
  const ref=String(req.body?.reference||'');
  const q=await db.quotes.findOneAndUpdate({id:ref,contactEmail:req.actor.email,
   studentId:'',contactVerified:true,status:{$in:['received','scoped','offered']}},
   {$set:{studentId:req.actor.id,username:req.actor.username,updatedAt:now()}},{returnDocument:'after'});
  if(!q)return res.status(404).json({error:'There is no verified academic quotation under this email and reference.'});
  await audit(req.actor,'academic_guest_quotation_claimed',q.id);
  res.json({success:true,quote:quoteView(q)});
 }));
 app.get('/api/academic/quotes',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','root','manager','staff']))return;
  const a=req.actor;
  let filter=a.role==='student'?{studentId:a.id}:{};
  if(['manager','staff'].includes(a.role)&&!['client_relations','academic_delivery'].includes(a.department))
   return res.status(403).json({error:'Academic intake authority is required.'});
  if(a.role==='staff'&&a.department==='academic_delivery')filter={scopeDecision:'approved'};
  const rows=await db.quotes.find(filter).sort({createdAt:-1}).limit(100).toArray();
  res.json({quotes:rows.map(quoteView)});
 }));
 app.post('/api/academic/quotes/:id/scope',wrap(async(req,res)=>{
  if(!department(req,res,['client_relations','academic_delivery']))return;
  if(req.actor.role==='staff')return res.status(403).json({error:'A manager must approve academic scope.'});
  const decision=String(req.body?.decision||''),note=String(req.body?.note||'').trim();
  if(!['approved','clarify','declined'].includes(decision)||note.length<10||note.length>1700)
   return res.status(400).json({error:'Document an academic eligibility decision and meaningful explanation.'});
  const q=await db.quotes.findOneAndUpdate({id:req.params.id,status:'received'},
   {$set:{status:decision==='approved'?'scoped':decision,scopeDecision:decision,
     scopeNote:note,reviewedBy:req.actor.id,updatedAt:now()}},{returnDocument:'after'});
  if(!q)return res.status(409).json({error:'This academic enquiry is not waiting for initial review.'});
  await audit(req.actor,'academic_scope_'+decision,q.id);
  await notify(q.studentId,'IPS reviewed the academic scope of '+q.id);
  res.json({quote:quoteView(q)});
 }));
 app.post('/api/academic/quotes/:id/offer',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','manager']))return;
  if(req.actor.role==='manager'&&req.actor.department!=='client_relations')
   return res.status(403).json({error:'Only Client Relations management may issue a binding written quotation.'});
  const total=Number(req.body?.priceMinor),terms=String(req.body?.terms||'').trim(),
   scope=String(req.body?.deliverables||'').trim(),expires=String(req.body?.expires||'').trim();
  if(!Number.isSafeInteger(total)||total<=0||total>100000000||terms.length<20||terms.length>2500||scope.length<15||scope.length>2000)
   return res.status(400).json({error:'Provide a real, positive PLN price and complete academic scope and quotation terms.'});
  const q=await db.quotes.findOneAndUpdate({id:req.params.id,status:'scoped',scopeDecision:'approved'},
   {$set:{status:'offered',priceMinor:total,currency:'PLN',terms,deliverables:scope,expires,
     offeredBy:req.actor.id,updatedAt:now()}},{returnDocument:'after'});
  if(!q)return res.status(409).json({error:'Academic scope approval is required before a final quotation.'});
  try{
   await sendEmail(q.contactEmail,'IPS Academic Services — your reviewed quotation '+q.id,
    'IPS has reviewed your '+q.serviceName+' enquiry ('+q.id+').\n'+
    'Reviewed scope: '+scope+'\nPrice: '+(total/100).toFixed(2)+' PLN\n'+
    'Terms: '+terms+'\nTo accept, sign in to IPS with the same verified email. No payments can be collected yet.');
  }catch{
   await db.quotes.updateOne({id:q.id,status:'offered'},{$set:{status:'offer_delivery_failed',updatedAt:now()}});
   await notify(rootEmail,'Quotation '+q.id+' email delivery failed; retry required','communication_failure');
   return res.status(503).json({error:'Quotation was approved but outbound email delivery failed. Retry is required.'});
  }
  await audit(req.actor,'academic_written_offer_issued',q.id,{currency:'PLN'});
  await notify(q.studentId,'Your reviewed academic quotation '+q.id+' is ready','quotation');
  res.json({quote:quoteView(q)});
 }));
 app.post('/api/academic/quotes/:id/decision',wrap(async(req,res)=>{
  if(!authorize(req,res,['student']))return;
  const decision=String(req.body?.decision||'');
  if(!['accept','decline'].includes(decision))return res.status(400).json({error:'Choose accept or decline.'});
  const q=await db.quotes.findOneAndUpdate({id:req.params.id,studentId:req.actor.id,status:'offered'},
   {$set:{status:decision==='accept'?'accepted':'declined',clientDecisionAt:now(),updatedAt:now()}},{returnDocument:'after'});
  if(!q)return res.status(409).json({error:'Only your outstanding reviewed quotation can be accepted or declined.'});
  await audit(req.actor,'academic_quote_'+decision,q.id);
  if(decision==='decline')return res.json({success:true,quote:quoteView(q)});
  const project={id:uid('IPS-A'),quoteId:q.id,studentId:q.studentId,specialistId:'',
   serviceId:q.serviceId,serviceName:q.serviceName,academicLevel:q.academicLevel,
   subject:q.subject,requirements:q.requirements,deliverables:q.deliverables,
   deadline:q.deadline,priceMinor:q.priceMinor,currency:q.currency,
   status:'awaiting_payment_integration',paymentStatus:'not_collected',
   milestones:[{name:'Academic scope and quotation',status:'complete',at:now()},
    {name:'Commission/payment verification',status:'blocked',at:now()},
    {name:'Specialist assignment',status:'pending',at:now()},
    {name:'Academic quality assurance',status:'pending',at:now()},
    {name:'Secure final delivery',status:'pending',at:now()}],
   revisionCount:0,assignedBy:'',qaReviewer:'',createdAt:now(),updatedAt:now()};
  try{await db.projects.insertOne(project)}
  catch(e){if(e.code===11000){const existing=await db.projects.findOne({quoteId:q.id});
    return res.json({success:true,commission:commissionView(existing),paymentsEnabled:false})}throw e}
  await notify(rootEmail,'Accepted academic quotation '+q.id+' awaits commissioned payment capability','finance');
  res.json({success:true,commission:commissionView(project),paymentsEnabled:false});
 }));
 const listAllowed=a=>a.role==='root'||a.role==='student'||a.role==='specialist'
  ||(['manager','staff'].includes(a.role)&&['client_relations','academic_delivery','quality_assurance'].includes(a.department));
 app.get('/api/academic/commissions',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','specialist','root','manager','staff']))return;
  const a=req.actor;
  if(!listAllowed(a))return res.status(403).json({error:'No authority to inspect academic commissions.'});
  const filter=a.role==='student'?{studentId:a.id}:a.role==='specialist'?{specialistId:a.id}:{};
  const items=await db.projects.find(filter).sort({createdAt:-1}).limit(120).toArray();
  res.json({commissions:items.map(commissionView)});
 }));
 app.get('/api/academic/commissions/:id',wrap(async(req,res)=>{
  const p=await db.projects.findOne({id:req.params.id});
  if(!p)return res.status(404).json({error:'Academic commission not found.'});
  if(!canSee(req.actor,p))return denial(res);
  res.json({commission:commissionView(p)});
 }));
 if(config.sandbox&&env.IPS_ACADEMIC_TEST_SETTLEMENT==='true'){
  app.post('/api/evaluation/confirm-synthetic-payment/:id',wrap(async(req,res)=>{
   if(!authorize(req,res,['root']))return;
   const p=await db.projects.findOneAndUpdate({id:req.params.id,
    status:'awaiting_payment_integration',paymentStatus:'not_collected'},
    {$set:{status:'ready_for_assignment',paymentStatus:'synthetic_test_only',
      evaluationPayment:true,updatedAt:now()}},{returnDocument:'after'});
   if(!p)return res.status(409).json({error:'No eligible isolated test academic commission.'});
   await audit(req.actor,'evaluation_synthetic_payment_witness',p.id);
   res.json({commission:commissionView(p),synthetic:true});
  }));
 }
 app.post('/api/academic/commissions/:id/assign',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','manager']))return;
  if(req.actor.role==='manager'&&req.actor.department!=='academic_delivery')
   return res.status(403).json({error:'Only IPS Academic Delivery management assigns specialists.'});
  const specialist=await db.accounts.findOne({id:String(req.body?.specialistId||''),
   role:'specialist',verified:true,approved:true,status:'active'});
  if(!specialist)return res.status(400).json({error:'Select a verified and approved IPS academic Specialist.'});
  const p=await db.projects.findOne({id:req.params.id,status:'ready_for_assignment'});
  if(!p)return res.status(409).json({error:'The commission cannot be assigned until verified payment readiness.'});
  if(!specialist.expertise?.includes(p.serviceId))return res.status(409).json({error:'The specialist has not been approved for this academic discipline.'});
  const updated=await db.projects.findOneAndUpdate({id:p.id,status:'ready_for_assignment',specialistId:''},
   {$set:{specialistId:specialist.id,status:'specialist_assigned',assignedBy:req.actor.id,updatedAt:now()},
    $setOnInsert:{}},{returnDocument:'after'});
  if(!updated)return res.status(409).json({error:'Another manager changed this academic assignment.'});
  await db.projects.updateOne({id:p.id,'milestones.name':'Specialist assignment'},
   {$set:{'milestones.$.status':'complete','milestones.$.at':now()}});
  await notify(specialist.id,'IPS assigned an academic '+p.serviceName+' commission '+p.id,'assignment');
  await notify(p.studentId,'Your academic commission '+p.id+' was assigned to an IPS Specialist','assignment');
  await audit(req.actor,'academic_specialist_assigned',p.id,{serviceId:p.serviceId});
  res.json({commission:commissionView(updated)});
 }));
 app.post('/api/academic/commissions/:id/submission',wrap(async(req,res)=>{
  if(!authorize(req,res,['specialist']))return;
  const p=await db.projects.findOne({id:req.params.id,specialistId:req.actor.id,
   status:{$in:['specialist_assigned','correction_requested','student_revision_requested']}});
  if(!p)return res.status(409).json({error:'No assigned academic work is ready for submission.'});
  const filename=normalizeFilename(req.body?.filename),mime=String(req.body?.mime||''),
   data=String(req.body?.data||'');
  const mimes=['text/plain','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if(!/^[\w.-]{1,100}$/.test(filename)||!mimes.includes(mime)||data.length>1500000||
   !/^[A-Za-z0-9+/]+={0,2}$/.test(data))return res.status(400).json({error:'Upload a permitted academic TXT, PDF or DOCX under 1 MB.'});
  const buffer=Buffer.from(data,'base64');
  if(buffer.length<12||buffer.length>1048576)return res.status(400).json({error:'Academic file size invalid.'});
  if(mime==='application/pdf'&&buffer.subarray(0,5).toString()!=='%PDF-')
   return res.status(400).json({error:'File contents do not match PDF format.'});
  if(mime.includes('wordprocessingml')&&buffer.subarray(0,2).toString()!=='PK')
   return res.status(400).json({error:'File contents do not match DOCX format.'});
  const file={id:uid('AF'),commissionId:p.id,studentId:p.studentId,specialistId:p.specialistId,
   filename,mime,sha256:crypto.createHash('sha256').update(buffer).digest('hex'),
   fileData:buffer,createdAt:now(),kind:'specialist_submission',revision:p.revisionCount};
  await db.files.insertOne(file);
  const changed=await db.projects.findOneAndUpdate({id:p.id,status:p.status},
   {$set:{status:'qa_pending',pendingFileId:file.id,updatedAt:now()}},{returnDocument:'after'});
  if(!changed){await db.files.deleteOne({id:file.id});return res.status(409).json({error:'Commission changed during upload.'})}
  await audit(req.actor,'academic_deliverable_submitted',p.id,{fileId:file.id});
  await notify(rootEmail,'Academic QA review needed for '+p.id,'quality');
  res.status(201).json({success:true,submissionId:file.id,checksum:file.sha256});
 }));
 app.post('/api/academic/commissions/:id/quality',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','manager']))return;
  if(req.actor.role==='manager'&&req.actor.department!=='quality_assurance')
   return res.status(403).json({error:'Only IPS Quality Assurance management can authorize release.'});
  const decision=String(req.body?.decision||''),note=String(req.body?.note||'').trim();
  if(!['approve','return_for_correction'].includes(decision)||note.length<15||note.length>2500)
   return res.status(400).json({error:'A documented academic quality decision and specific feedback are required.'});
  const p=await db.projects.findOneAndUpdate({id:req.params.id,status:'qa_pending',pendingFileId:{$ne:''}},
   {$set:{status:decision==='approve'?'client_delivery':'correction_requested',
    qaReviewer:req.actor.id,qaDecision:decision,qaNote:note,updatedAt:now()}},{returnDocument:'after'});
  if(!p)return res.status(409).json({error:'No submitted academic work awaits QA.'});
  if(decision==='approve')await db.projects.updateOne({id:p.id,'milestones.name':'Academic quality assurance'},
   {$set:{'milestones.$.status':'complete','milestones.$.at':now()}});
  await notify(decision==='approve'?p.studentId:p.specialistId,
   'IPS academic quality review '+(decision==='approve'?'approved delivery':'requested corrections')+' on '+p.id,'quality');
  await audit(req.actor,'academic_qa_'+decision,p.id,{note});
  res.json({commission:commissionView(p)});
 }));
 app.post('/api/academic/commissions/:id/student-decision',wrap(async(req,res)=>{
  if(!authorize(req,res,['student']))return;
  const decision=String(req.body?.decision||'');
  if(!['accept','request_revision'].includes(decision))return res.status(400).json({error:'Choose acceptance or request a revision.'});
  const note=String(req.body?.note||'').trim();
  if(decision==='request_revision'&&(note.length<15||note.length>1700))
   return res.status(400).json({error:'Describe the academic revision needed.'});
  const p=await db.projects.findOneAndUpdate({id:req.params.id,studentId:req.actor.id,status:'client_delivery'},
   {$set:{status:decision==='accept'?'completed':'student_revision_requested',
     studentDecisionNote:note,updatedAt:now()},
    $inc:{revisionCount:decision==='request_revision'?1:0}},{returnDocument:'after'});
  if(!p)return res.status(409).json({error:'No academic delivery is awaiting your decision.'});
  await notify(p.specialistId,'Student '+decision+' on academic commission '+p.id,'client_decision');
  await audit(req.actor,'academic_client_'+decision,p.id);
  res.json({commission:commissionView(p)});
 }));
 app.get('/api/academic/commissions/:id/files',wrap(async(req,res)=>{
  const p=await db.projects.findOne({id:req.params.id});
  if(!p||!canSee(req.actor,p))return denial(res);
  const rows=await db.files.find({commissionId:p.id}).sort({createdAt:-1}).toArray();
  const accessible=studentOwner(req.actor,p)&&!['client_delivery','completed'].includes(p.status)?[]:rows;
  res.json({files:accessible.map(x=>({id:x.id,filename:x.filename,mime:x.mime,sha256:x.sha256,createdAt:x.createdAt,revision:x.revision}))});
 }));
 app.get('/api/academic/files/:id',wrap(async(req,res)=>{
  const file=await db.files.findOne({id:req.params.id});
  if(!file)return res.status(404).json({error:'No such academic document.'});
  const p=await db.projects.findOne({id:file.commissionId});
  if(!p||!canSee(req.actor,p))return denial(res);
  if(studentOwner(req.actor,p)&&!['client_delivery','completed'].includes(p.status))return denial(res);
  res.setHeader('Cache-Control','private,no-store');
  res.setHeader('Content-Type',file.mime);
  res.setHeader('Content-Disposition','attachment; filename="'+file.filename+'"');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Content-SHA256',file.sha256);
  res.send(Buffer.from(file.fileData?.buffer||file.fileData));
 }));
 // Written central relay: clients and specialists send to IPS; the company forwards deliberately.
 const messageFilter=(a,p)=>a.role==='root'||adminOf(a,p)?{}:
   a.role==='student'?{audience:{$in:['student','shared']}}:
   a.role==='specialist'?{audience:{$in:['specialist','shared']}}:{id:'none'};
 app.get('/api/academic/commissions/:id/messages',wrap(async(req,res)=>{
  const p=await db.projects.findOne({id:req.params.id});
  if(!p||!canSee(req.actor,p))return denial(res);
  const rows=await db.messages.find({commissionId:p.id,...messageFilter(req.actor,p)})
   .sort({createdAt:1}).limit(200).toArray();
  res.json({messages:rows.map(publicDocument),centralRelay:true});
 }));
 app.post('/api/academic/commissions/:id/messages',wrap(async(req,res)=>{
  const p=await db.projects.findOne({id:req.params.id});
  if(!p||!canSee(req.actor,p))return denial(res);
  const body=String(req.body?.body||'').trim(),a=req.actor;
  if(body.length<2||body.length>3500)return res.status(400).json({error:'Write a clear confidential message, no more than 3,500 characters.'});
  let audience;
  if(a.role==='student')audience='student';
  else if(a.role==='specialist')audience='specialist';
  else{
   audience=String(req.body?.audience||'');
   if(!['student','specialist','shared'].includes(audience))return res.status(400).json({error:'IPS staff must select the intended private recipient.'});
   if(a.role==='staff'&&a.department==='quality_assurance'&&audience==='student')
    return res.status(403).json({error:'Quality staff may not bypass approved client delivery.'});
  }
  const item={id:uid('AM'),commissionId:p.id,actorId:a.id,actorRole:a.role,
   audience,body,createdAt:now(),channel:'ips_workspace'};
  await db.messages.insertOne(item);
  if(['student','specialist'].includes(a.role))await notify(rootEmail,'Written academic coordination message for '+p.id,'communications');
  else if(audience==='student')await notify(p.studentId,'IPS replied to your academic commission '+p.id,'communications');
  else if(audience==='specialist')await notify(p.specialistId,'IPS replied about your assignment '+p.id,'communications');
  else{await notify(p.studentId,'IPS updated your academic case '+p.id,'communications');
       await notify(p.specialistId,'IPS updated assigned work '+p.id,'communications')}
  await audit(a,'academic_central_message_recorded',p.id,{audience});
  res.status(201).json({message:publicDocument(item)});
 }));
 app.get('/api/academic/dashboard',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','specialist','root','manager','staff']))return;
  const a=req.actor,root=a.role==='root',dept=a.department||'';
  const quoteFilter=root||(['manager','staff'].includes(a.role)&&dept==='client_relations')?{}:
   a.role==='student'?{studentId:a.id}:{id:'unavailable'};
  const projectFilter=root||(['manager','staff'].includes(a.role)&&['academic_delivery','quality_assurance'].includes(dept))?{}:
   a.role==='student'?{studentId:a.id}:a.role==='specialist'?{specialistId:a.id}:{id:'unavailable'};
  const ticketFilter=root||(['manager','staff'].includes(a.role)&&dept==='client_relations')?{}:
   ['student','specialist'].includes(a.role)?{ownerId:a.id}:{id:'unavailable'};
  const [q,p,t,alerts,pendingQA]=await Promise.all([
   db.quotes.countDocuments(quoteFilter),db.projects.countDocuments(projectFilter),
   db.support.countDocuments(ticketFilter),db.notifications.countDocuments({accountId:a.id,read:false}),
   (root||dept==='quality_assurance')?db.projects.countDocuments({status:'qa_pending'}):Promise.resolve(0)]);
  res.json({account:a,metrics:{enquiries:q,academicCommissions:p,support:t,alerts,pendingQA},
    academicServices:SERVICES.length,paymentsEnabled:false,
    company:'IPS Academic Services'});
 }));
}
