// IPS Academic Services: genuine scoped academic enquiries, cases, commissions and QA.
import crypto from 'node:crypto';
import express from 'express';
import {email,validEmail,validUsername,publicDocument,normalizeFilename,strongToken,validToken} from './security.mjs';
import {SERVICES,SERVICE_MAP,ACADEMIC_LEVELS,academicIntegrityNotice} from './catalogue.mjs';
import {SPECIALIST_AGREEMENT_VERSION} from './specialist-agreement.mjs';

export function registerAcademicRoutes(ctx){
 const {app,db,documentBucket,inspectAcademicUpload,config,env,security,throttle,sendEmail,rootEmail,notify,notifyQuotation,audit,authorize,department,wrap,now,uid}=ctx;
 const allowedChannels=['workspace','email','telegram'];
 const quoteView=q=>{
  const x=publicDocument(q);delete x.verifyHash;delete x.verifyUntil;delete x.internalEvaluation;
  delete x.ownershipHistory;delete x.assignedBy;delete x.ownerAssignedAt;
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
 const utcDate=()=>new Date().toISOString().slice(0,10);
 const reviewedOffer=input=>{
  const total=Number(input?.priceMinor),terms=String(input?.terms||'').trim(),
   deliverables=String(input?.deliverables||'').trim();
  const requested=String(input?.expires||'').trim();
  const expires=requested||new Date(Date.now()+14*86400000).toISOString().slice(0,10);
  if(!Number.isSafeInteger(total)||total<=0||total>100000000||
   terms.length<20||terms.length>2500||deliverables.length<15||deliverables.length>2000)
   return {error:'Provide a positive PLN price, complete academic deliverables and written terms.'};
  const expiryDate=new Date(expires+'T23:59:59.999Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(expires)||!Number.isFinite(expiryDate.getTime())||
   expiryDate.toISOString().slice(0,10)!==expires||
   expires<utcDate()||expiryDate.getTime()>Date.now()+366*86400000)
   return {error:'Choose a real quotation expiry date from today up to one year ahead (UTC date).'};
  return {priceMinor:total,currency:'PLN',terms,deliverables,expires};
 };
 const quoteBase=(input,valid,owner)=>({
  id:uid('IPS-Q'),studentId:owner?.id||'',username:owner?.username||String(input?.username||''),
  contactEmail:owner?.email||email(input?.email),
  serviceId:valid.serviceId,serviceName:valid.service.title,academicLevel:valid.level,
  subject:valid.subject,requirements:valid.brief,institutionGuidance:valid.instructions,deadline:valid.deadline,
  contactChannel:String(input?.contactChannel||'email'),telegramUsername:String(input?.telegramUsername||'').replace(/^@/,'').slice(0,40),
  integrityAcknowledged:true,status:owner?'received':'awaiting_contact_verification',
  createdAt:now(),updatedAt:now(),priceMinor:null,currency:'PLN',
  assignedDepartment:'client_relations',assignedTo:'',assignedBy:'',ownerAssignedAt:null,
  ownershipHistory:[],reviewedBy:'',scopeDecision:'pending',
  offerVersion:0,offerHistory:[],clarificationHistory:[],
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
  if(channel==='telegram')
   return res.status(409).json({error:'A Telegram username alone is not a verified reply destination. Create and verify your private IPS account to connect your Telegram bot chat.'});
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
  if(throttle.limited(req,'student-academic-quotes',config.sandbox?60:12))return res.status(429).json({error:'Please wait before sending another quotation.'});
  const valid=validateBrief(req.body);if(valid.error)return res.status(400).json({error:valid.error});
  const input={...req.body,username:req.actor.username,email:req.actor.email};
  const channel=String(input.contactChannel||'workspace');
  if(!allowedChannels.includes(channel))return res.status(400).json({error:'Choose an available IPS written communication channel.'});
  if(channel==='telegram'&&!req.actor.telegramLinked)
   return res.status(409).json({error:'Your Telegram chat must be verified through the IPS bot before this private reply option can be used.'});
  const q=quoteBase({...input,contactChannel:channel},valid,req.actor);
  if(req.rootOperatorId){q.rootAssistedBy=req.rootOperatorId;q.synthetic=true}
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
 // Atomic employee claim and controlled Root/Client Relations handoff make every
 // academic enquiry accountable without exposing it to unrelated departments.
 app.post('/api/academic/quotes/:id/claim',wrap(async(req,res)=>{
  if(!department(req,res,['client_relations']))return;
  const owner=req.actor.id,at=now();
  const q=await db.quotes.findOneAndUpdate({
   id:req.params.id,status:{$in:['received','clarify','scoped']},
   $or:[{assignedTo:''},{assignedTo:null},{assignedTo:{$exists:false}}]
  },{$set:{assignedTo:owner,assignedBy:owner,ownerAssignedAt:at,updatedAt:at},
     $push:{ownershipHistory:{to:owner,by:owner,at,action:'claim'}}},
    {returnDocument:'after'});
  if(!q)return res.status(409).json({error:'This enquiry is not unassigned or is no longer open for intake.'});
  await audit(req.actor,'academic_enquiry_claimed',q.id,{owner});
  if(owner!==rootEmail)await notify(rootEmail,'Client Relations claimed enquiry '+q.id,'intake');
  res.json({quote:quoteView(q)});
 }));
 app.post('/api/academic/quotes/:id/assign',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','manager']))return;
  if(req.actor.role==='manager'&&req.actor.department!=='client_relations')
   return res.status(403).json({error:'Only Client Relations management can allocate enquiries.'});
  const assigneeId=String(req.body?.assigneeId||''),reason=String(req.body?.reason||'').trim();
  if(reason.length<10||reason.length>900)return res.status(400).json({
   error:'Document a meaningful handoff reason before assigning this confidential enquiry.'});
  const target=await db.accounts.findOne({id:assigneeId,verified:true,status:'active',
   role:{$in:['manager','staff']},department:'client_relations'});
  if(!target)return res.status(400).json({error:'Choose an active, verified Client Relations employee.'});
  const before=await db.quotes.findOne({id:req.params.id,
   status:{$in:['received','clarify','scoped','offered','offer_delivery_failed']}});
  if(!before)return res.status(409).json({error:'Only open academic enquiries may be assigned.'});
  const at=now(),previous=before.assignedTo||'';
  const updated=await db.quotes.findOneAndUpdate({id:before.id,
   status:before.status,
   ...(before.assignedTo?{assignedTo:before.assignedTo}:
    {$or:[{assignedTo:''},{assignedTo:null},{assignedTo:{$exists:false}}]})
  },{$set:{assignedTo:target.id,assignedBy:req.actor.id,ownerAssignedAt:at,updatedAt:at},
    $push:{ownershipHistory:{from:previous,to:target.id,by:req.actor.id,reason,at,action:'assignment'}}},
    {returnDocument:'after'});
  if(!updated)return res.status(409).json({error:'The enquiry changed during handoff. Refresh and try again.'});
  await audit(req.actor,'academic_enquiry_reassigned',before.id,
   {from:previous,to:target.id,reason});
  await notify(target.id,'IPS assigned academic enquiry '+before.id+' to you','intake_assignment');
  if(previous&&previous!==target.id&&previous!==rootEmail)
   await notify(previous,'Academic enquiry '+before.id+' was reassigned','intake_assignment');
  res.json({quote:quoteView(updated)});
 }));
 app.get('/api/academic/quotes/:id/ownership',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','manager']))return;
  if(req.actor.role==='manager'&&req.actor.department!=='client_relations')
   return res.status(403).json({error:'Client Relations management is required.'});
  const q=await db.quotes.findOne({id:req.params.id},{projection:{
   id:1,assignedTo:1,assignedBy:1,ownerAssignedAt:1,ownershipHistory:1}});
  if(!q)return res.status(404).json({error:'Academic enquiry not found.'});
  res.json({reference:q.id,assignedTo:q.assignedTo||'',assignedBy:q.assignedBy||'',
   assignedAt:q.ownerAssignedAt||null,history:q.ownershipHistory||[]});
 }));
 app.get('/api/academic/quotes',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','root','manager','staff']))return;
  const a=req.actor;
  let filter=a.role==='student'?{studentId:a.id}:{};
  if(['manager','staff'].includes(a.role)&&!['client_relations','academic_delivery'].includes(a.department))
   return res.status(403).json({error:'Academic intake authority is required.'});
  if(a.role==='staff'&&a.department==='academic_delivery')filter={scopeDecision:'approved'};
  if(a.role==='staff'&&a.department==='client_relations')
   filter={$or:[{assignedTo:a.id},{assignedTo:''},{assignedTo:null},
    {assignedTo:{$exists:false}}]};

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
  await notifyQuotation(q,'IPS reviewed the academic scope of '+q.id,'quotation_scope');
  res.json({quote:quoteView(q)});
 }));
 app.post('/api/academic/quotes/:id/offer',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','manager']))return;
  if(req.actor.role==='manager'&&req.actor.department!=='client_relations')
   return res.status(403).json({error:'Only Client Relations management may issue a binding written quotation.'});
  const offer=reviewedOffer(req.body);
  if(offer.error)return res.status(400).json({error:offer.error});
  const at=now();
  const q=await db.quotes.findOneAndUpdate({id:req.params.id,status:'scoped',scopeDecision:'approved'},{
   $set:{status:'offered',...offer,offeredBy:req.actor.id,offeredAt:at,updatedAt:at},
   $inc:{offerVersion:1},
   $push:{offerHistory:{version:1,...offer,issuedAt:at,issuedBy:req.actor.id,
     note:'Initial reviewed academic quotation'}}
  },{returnDocument:'after'});
  if(!q)return res.status(409).json({error:'Academic scope approval is required before a final quotation.'});
  await audit(req.actor,'academic_written_offer_issued',q.id,{currency:'PLN'});
  await notifyQuotation(q,'Your reviewed academic quotation '+q.id+' is ready','quotation');
  res.json({quote:quoteView(q)});
 }));
 // When IPS requests clarification the Student has a direct, tracked route back
 // to human scope review; the quotation must not remain indefinitely stuck.
 app.post('/api/academic/quotes/:id/resubmit',wrap(async(req,res)=>{
  if(!authorize(req,res,['student']))return;
  const note=String(req.body?.clarification||'').trim();
  const requirements=String(req.body?.requirements||'').trim();
  if(note.length<20||note.length>3500||(requirements&&
   (requirements.length<25||requirements.length>6000)))
   return res.status(400).json({error:'Provide an academic clarification of 20–3,500 characters and a valid revised brief.'});
  const at=now();
  const q=await db.quotes.findOneAndUpdate({
   id:req.params.id,studentId:req.actor.id,status:'clarify'},{
   $set:{status:'received',scopeDecision:'pending',scopeNote:'',
    reviewedBy:'',updatedAt:at,...(requirements?{requirements}:{})},
   $inc:{scopeRevision:1},
   $push:{clarificationHistory:{message:note,at,by:req.actor.id}}
  },{returnDocument:'after'});
  if(!q)return res.status(409).json({error:'This academic enquiry is not awaiting your clarification.'});
  await db.quoteMessages.insertOne({id:uid('QM'),quoteId:q.id,actorId:req.actor.id,
   actorRole:'student',audience:'student',body:note,createdAt:at});
  await audit(req.actor,'academic_quotation_clarification_submitted',q.id);
  await notify(q.assignedTo||rootEmail,'Student supplied requested academic clarification for '+q.id,'intake');
  res.json({quote:quoteView(q)});
 }));
 // A revised offer retains every earlier written price, scope and set of terms.
 // Optimistic version checks ensure simultaneous managers cannot overwrite a quote.
 app.post('/api/academic/quotes/:id/revise-offer',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','manager']))return;
  if(req.actor.role==='manager'&&req.actor.department!=='client_relations')
   return res.status(403).json({error:'Only Client Relations management may revise a written quotation.'});
  const reason=String(req.body?.reason||'').trim();
  const offer=reviewedOffer(req.body);
  if(offer.error)return res.status(400).json({error:offer.error});
  if(reason.length<15||reason.length>1400)
   return res.status(400).json({error:'Document why the academic price, scope or terms must change.'});
  const current=await db.quotes.findOne({id:req.params.id,
   status:{$in:['offered','expired']},scopeDecision:'approved'});
  if(!current)return res.status(409).json({error:'Only a previously approved academic quotation can be revised.'});
  const version=current.offerVersion||1,next=version+1,at=now();
  const initial=current.offerHistory?.length?[]:[{version:1,priceMinor:current.priceMinor,
   currency:current.currency||'PLN',terms:current.terms||'',deliverables:current.deliverables||'',
   expires:current.expires||'',issuedAt:current.offeredAt||current.updatedAt,
   issuedBy:current.offeredBy||'',note:'Previous preserved academic offer'}];
  const q=await db.quotes.findOneAndUpdate({id:current.id,status:current.status,
   ...(current.offerVersion?{offerVersion:current.offerVersion}:{offerVersion:{$exists:false}})
  },{
   $set:{status:'offered',...offer,offerVersion:next,offeredBy:req.actor.id,
    offeredAt:at,updatedAt:at},
   $unset:{reminderSentAt:''},
   $push:{offerHistory:{$each:[...initial,{version:next,...offer,issuedAt:at,
    issuedBy:req.actor.id,note:reason}]}}
  },{returnDocument:'after'});
  if(!q)return res.status(409).json({error:'Another manager changed this quotation. Reload before revising.'});
  await audit(req.actor,'academic_written_offer_revised',q.id,{from:version,to:next,reason});
  await notifyQuotation(q,'A revised academic quotation '+q.id+' is ready for review','quotation');
  res.json({quote:quoteView(q)});
 }));
 app.post('/api/academic/quotes/:id/decision',wrap(async(req,res)=>{
  if(!authorize(req,res,['student']))return;
  const decision=String(req.body?.decision||'');
  if(!['accept','decline'].includes(decision))return res.status(400).json({error:'Choose accept or decline.'});
  const q=await db.quotes.findOneAndUpdate({id:req.params.id,studentId:req.actor.id,
   status:'offered',
   $or:[{expires:{$gte:utcDate()}},{expires:''},{expires:{$exists:false}}]
  },{$set:{status:decision==='accept'?'accepted':'declined',clientDecisionAt:now(),
   updatedAt:now(),
   ...(req.rootOperatorId?{rootEvaluationDecision:true,decisionActorId:req.rootOperatorId}:{} )}},
   {returnDocument:'after'});
  if(!q)return res.status(409).json({error:'Only a valid, unexpired reviewed quotation can be accepted or declined. Request a revised offer from IPS.'});
  if(decision==='accept')
   await db.quotes.updateOne({id:q.id,status:'accepted'},
    {$set:{acceptedOfferVersion:q.offerVersion||1}});
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
   await db.projects.updateOne({id:p.id,'milestones.name':'Commission/payment verification'},
    {$set:{'milestones.$.status':'synthetic_test_only','milestones.$.at':now()}});
   await audit(req.actor,'evaluation_synthetic_payment_witness',p.id);
   res.json({commission:commissionView(await db.projects.findOne({id:p.id})),synthetic:true});
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
  if(specialist.specialistAgreementVersion!==SPECIALIST_AGREEMENT_VERSION)
   return res.status(409).json({error:'This Specialist must accept the current confidentiality agreement before being assigned private academic work.'});
  if(!specialist.expertise?.includes(p.serviceId))
   return res.status(409).json({error:'The Specialist is not approved for this academic service.'});
  if(!['available','limited'].includes(specialist.availabilityStatus)||!specialist.maxConcurrentCases)
   return res.status(409).json({error:'This Specialist has not declared available capacity.'});
  const actual=await db.projects.countDocuments({specialistId:specialist.id,
   status:{$nin:['completed','cancelled','closed']}});
  await db.accounts.updateOne({id:specialist.id},{$max:{activeAssignments:actual}});
  // Atomic reservation prevents simultaneous managers assigning more jobs than the
  // Specialist declared. Failed commission updates release the reserved slot.
  const claim=await db.accounts.findOneAndUpdate({
   id:specialist.id,role:'specialist',status:'active',verified:true,approved:true,
   availabilityStatus:{$in:['available','limited']},
   $expr:{$lt:[{$ifNull:['$activeAssignments',0]},'$maxConcurrentCases']}
  },{$inc:{activeAssignments:1}},{returnDocument:'after'});
  if(!claim)return res.status(409).json({error:'Specialist capacity is full. Choose another available academic professional.'});
  let updated;
  try{
   updated=await db.projects.findOneAndUpdate({id:p.id,status:'ready_for_assignment',specialistId:''},
    {$set:{specialistId:specialist.id,status:'specialist_assigned',assignedBy:req.actor.id,updatedAt:now()}},
    {returnDocument:'after'});
  }catch(err){
   await db.accounts.updateOne({id:specialist.id,activeAssignments:{$gt:0}},
    {$inc:{activeAssignments:-1}});
   throw err;
  }
  if(!updated){
   await db.accounts.updateOne({id:specialist.id,activeAssignments:{$gt:0}},
    {$inc:{activeAssignments:-1}});
   return res.status(409).json({error:'Another manager changed this academic assignment.'});
  }
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
  const scan=await inspectAcademicUpload(buffer);
  if(!scan.allowed)return res.status(scan.http).json({error:scan.error});
  const file={id:uid('AF'),commissionId:p.id,studentId:p.studentId,specialistId:p.specialistId,
   filename,mime,sha256:crypto.createHash('sha256').update(buffer).digest('hex'),
   fileData:buffer,scanStatus:scan.status,createdAt:now(),kind:'specialist_submission',revision:p.revisionCount,
   uploadedBy:req.rootOperatorId||req.actor.id,
   ...(req.rootOperatorId?{rootAssisted:true}:{} )};
  await db.files.insertOne(file);
  const changed=await db.projects.findOneAndUpdate({id:p.id,status:p.status},
   {$set:{status:'qa_pending',pendingFileId:file.id,updatedAt:now()}},{returnDocument:'after'});
  if(!changed){await db.files.deleteOne({id:file.id});return res.status(409).json({error:'Commission changed during upload.'})}
  await audit(req.actor,'academic_deliverable_submitted',p.id,{fileId:file.id});
  await notify(rootEmail,'Academic QA review needed for '+p.id,'quality');
  res.status(201).json({success:true,submissionId:file.id,checksum:file.sha256});
 }));
 // New binary transport for real academic documents; legacy <=1 MB JSON
 // submissions remain readable for existing cases. File bytes are in GridFS,
 // not BSON documents, and never exposed before authorized QA release.
 app.post('/api/academic/commissions/:id/submission-binary',
  express.raw({type:'application/octet-stream',limit:'21mb'}),wrap(async(req,res)=>{
  if(!authorize(req,res,['specialist']))return;
  if(throttle.limited(req,'academic-binary-upload',20))
   return res.status(429).json({error:'Too many academic document uploads. Retry later.'});
  const p=await db.projects.findOne({id:req.params.id,specialistId:req.actor.id,
   status:{$in:['specialist_assigned','correction_requested','student_revision_requested']}});
  if(!p)return res.status(409).json({error:'No assigned academic work is ready for a document submission.'});
  let inputName='';
  try{inputName=decodeURIComponent(String(req.get('X-IPS-File-Name')||''))}
  catch{return res.status(400).json({error:'Academic filename encoding is invalid.'})}
  const filename=normalizeFilename(inputName),mime=String(req.get('X-IPS-File-Type')||'');
  const ext=filename.toLowerCase().match(/\.(pdf|docx|txt)$/)?.[1]||'';
  const formats={pdf:'application/pdf',
   docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   txt:'text/plain'};
  const buffer=req.body;
  if(formats[ext]!==mime||!/^[A-Za-z0-9_.-]{1,100}$/.test(filename)||
   !Buffer.isBuffer(buffer)||buffer.length<12||buffer.length>20*1024*1024)
   return res.status(400).json({error:'Select a genuine PDF, DOCX or TXT academic document, maximum 20 MB.'});
  if(mime==='application/pdf'&&buffer.subarray(0,5).toString()!=='%PDF-'||
   mime.includes('wordprocessingml')&&buffer.subarray(0,2).toString()!=='PK')
   return res.status(400).json({error:'Academic document type does not match its contents.'});
  const scan=await inspectAcademicUpload(buffer);
  if(!scan.allowed)return res.status(scan.http).json({error:scan.error});
  const sha256=crypto.createHash('sha256').update(buffer).digest('hex'),
   id=uid('AF'),date=now();
  const blobId=await new Promise((resolve,reject)=>{
   const upload=documentBucket.openUploadStream(filename,{metadata:{
    academicFileId:id,commissionId:p.id,sha256,mime,uploadedAt:date}});
   upload.once('error',reject);
   upload.once('finish',()=>resolve(upload.id));
   upload.end(buffer);
  });
  const file={id,commissionId:p.id,studentId:p.studentId,specialistId:p.specialistId,
   filename,mime,sha256,blobId,byteLength:buffer.length,scanStatus:scan.status,createdAt:date,
   kind:'specialist_submission',revision:p.revisionCount,uploadedBy:req.rootOperatorId||req.actor.id,
   ...(req.rootOperatorId?{rootAssisted:true}:{})};
  try{
   await db.files.insertOne(file);
   const changed=await db.projects.findOneAndUpdate({id:p.id,status:p.status},
    {$set:{status:'qa_pending',pendingFileId:id,updatedAt:now()}},{returnDocument:'after'});
   if(!changed){
    await db.files.deleteOne({id});
    await documentBucket.delete(blobId);
    return res.status(409).json({error:'The commission changed while the academic document was uploading.'});
   }
  }catch(err){
   await db.files.deleteOne({id}).catch(()=>{});
   await documentBucket.delete(blobId).catch(()=>{});
   throw err;
  }
  await audit(req.actor,'academic_gridfs_deliverable_submitted',p.id,
   {fileId:id,sha256,byteLength:buffer.length});
  await notify(rootEmail,'Academic QA review needed for '+p.id,'quality');
  res.status(201).json({success:true,submissionId:id,checksum:sha256,
   byteLength:buffer.length,storage:'private_gridfs'});
 }));
 app.post('/api/academic/commissions/:id/quality',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','manager']))return;
  if(req.actor.role==='manager'&&req.actor.department!=='quality_assurance')
   return res.status(403).json({error:'Only IPS Quality Assurance management can authorize release.'});
  const decision=String(req.body?.decision||''),note=String(req.body?.note||'').trim();
  if(!['approve','return_for_correction'].includes(decision)||note.length<15||note.length>2500)
   return res.status(400).json({error:'A documented academic quality decision and specific feedback are required.'});
  if(!config.sandbox&&decision==='approve'){
   const candidate=await db.projects.findOne({id:req.params.id,status:'qa_pending'});
   const released=candidate?.pendingFileId?await db.files.findOne({id:candidate.pendingFileId}):null;
   if(!released||released.scanStatus!=='clean')
    return res.status(409).json({error:'The academic document must pass verified security screening before QA release.'});
  }
  const p=await db.projects.findOneAndUpdate({id:req.params.id,status:'qa_pending',pendingFileId:{$ne:''}},
   {$set:{status:decision==='approve'?'client_delivery':'correction_requested',
    qaReviewer:req.actor.id,qaDecision:decision,qaNote:note,updatedAt:now()}},{returnDocument:'after'});
  if(!p)return res.status(409).json({error:'No submitted academic work awaits QA.'});
  // Nyoro may supervise emergency fulfilment, but must never mislabel a Root-authored
  // deliverable reviewed by that same operator as an independent academic QA review.
  const qaMode=p.fulfilmentMode==='root'&&req.actor.role==='root'?
   'root_supervised_exception':'independent_ips_review';
  await db.projects.updateOne({id:p.id},{$set:{qaMode}});
  if(decision==='approve')await db.projects.updateOne({id:p.id,status:'client_delivery'},
   {$set:{releasedFileId:p.pendingFileId}});
  await db.projects.updateOne({id:p.id,'milestones.name':'Academic quality assurance'},
   {$set:{'milestones.$.status':decision==='approve'?'complete':'pending',
    'milestones.$.at':now()}});
  if(decision==='return_for_correction')await db.projects.updateOne({id:p.id,'milestones.name':'Secure final delivery'},
   {$set:{'milestones.$.status':'pending'}});
  await notify(decision==='approve'?p.studentId:p.specialistId,
   'IPS academic quality review '+(decision==='approve'?'approved delivery':'requested corrections')+' on '+p.id,'quality');
  await audit(req.actor,'academic_qa_'+decision,p.id,{note,qaMode});
  res.json({commission:commissionView(await db.projects.findOne({id:p.id}))});
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
     studentDecisionNote:note,updatedAt:now(),...(req.rootOperatorId?{rootEvaluationDecision:true,decisionActorId:req.rootOperatorId}:{})},
    $inc:{revisionCount:decision==='request_revision'?1:0}},{returnDocument:'after'});
  if(!p)return res.status(409).json({error:'No academic delivery is awaiting your decision.'});
  if(decision==='accept'&&p.specialistId)
   await db.accounts.updateOne({id:p.specialistId,activeAssignments:{$gt:0}},
    {$inc:{activeAssignments:-1}});
  await db.projects.updateOne({id:p.id,'milestones.name':'Secure final delivery'},
   {$set:{'milestones.$.status':decision==='accept'?'complete':'pending',
    'milestones.$.at':now()}});
  if(decision==='request_revision')await db.projects.updateOne({id:p.id,'milestones.name':'Academic quality assurance'},
   {$set:{'milestones.$.status':'pending'}});
  await notify(p.specialistId,'Student '+decision+' on academic commission '+p.id,'client_decision');
  await audit(req.actor,'academic_client_'+decision,p.id);
  res.json({commission:commissionView(await db.projects.findOne({id:p.id}))});
 }));
 app.get('/api/academic/commissions/:id/files',wrap(async(req,res)=>{
  const p=await db.projects.findOne({id:req.params.id});
  if(!p||!canSee(req.actor,p))return denial(res);
  const rows=await db.files.find({commissionId:p.id}).sort({createdAt:-1}).toArray();
  // Failed QA submissions and Specialist working drafts are never released to Students.
  const accessible=studentOwner(req.actor,p)
   ?(['client_delivery','completed'].includes(p.status)?rows.filter(x=>x.id===p.releasedFileId):[])
   :rows;
  res.json({files:accessible.map(x=>({id:x.id,filename:x.filename,mime:x.mime,sha256:x.sha256,createdAt:x.createdAt,revision:x.revision}))});
 }));
 app.get('/api/academic/files/:id',wrap(async(req,res)=>{
  const file=await db.files.findOne({id:req.params.id});
  if(!file)return res.status(404).json({error:'No such academic document.'});
  const p=await db.projects.findOne({id:file.commissionId});
  if(!p||!canSee(req.actor,p))return denial(res);
  if(studentOwner(req.actor,p)&&!(file.purpose==='reference'||file.kind==='client_reference')&&
   (!['client_delivery','completed'].includes(p.status)||file.id!==p.releasedFileId))return denial(res);
  res.setHeader('Cache-Control','private,no-store');
  res.setHeader('Content-Type',file.mime);
  res.setHeader('Content-Disposition','attachment; filename="'+file.filename+'"');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Content-SHA256',file.sha256);
  if(file.blobId){
   if(Number.isSafeInteger(file.byteLength))res.setHeader('Content-Length',file.byteLength);
   const stream=documentBucket.openDownloadStream(file.blobId);
   stream.on('error',()=>{
    if(!res.headersSent)res.status(503).json({error:'Private academic document storage is unavailable.'});
    else res.destroy();
   });
   stream.pipe(res);
   return;
  }
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
  if(req.rootOperatorId){
   audience=String(req.body?.audience||'');
   if(!['student','specialist','shared'].includes(audience))
    return res.status(400).json({error:'Nyoro must choose an explicit recipient when assisting another workspace.'});
  }else if(a.role==='student')audience='student';
  else if(a.role==='specialist')audience='specialist';
  else{
   audience=String(req.body?.audience||'');
   if(!['student','specialist','shared'].includes(audience))return res.status(400).json({error:'IPS staff must select the intended private recipient.'});
   if(a.role==='staff'&&a.department==='quality_assurance'&&audience==='student')
    return res.status(403).json({error:'Quality staff may not bypass approved client delivery.'});
  }
  const item={id:uid('AM'),commissionId:p.id,
   actorId:req.rootOperatorId||a.id,actorRole:req.rootOperatorId?'root':a.role,
   ...(req.rootOperatorId?{assistedAccountId:a.id,rootAssisted:true}:{}),
   audience,body,createdAt:now(),channel:'ips_workspace'};
  await db.messages.insertOne(item);
  if(['student','specialist'].includes(a.role)&&!req.rootOperatorId)await notify(rootEmail,'Written academic coordination message for '+p.id,'communications');
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
