// IPS Academic Services: explicit, voluntary Specialist fee and assignment consent.
// A company offer does not reserve a capacity slot or create a paid job.
// Capacity is reserved atomically only when the Specialist accepts the scoped
// work and agreed fee; decline/expiry returns the job to allocation.
import {SPECIALIST_AGREEMENT_VERSION} from './specialist-agreement.mjs';

export function registerAssignmentOfferRoutes(ctx){
 const {app,db,authorize,wrap,audit,notify,now,uid,rootEmail}=ctx;
 const canOffer=a=>a?.role==='root'||a?.role==='manager'&&a.department==='academic_delivery';
 const requireOffer=(req,res)=>{
  if(!authorize(req,res,['root','manager']))return false;
  if(!canOffer(req.actor)){
   res.status(403).json({error:'Only IPS Academic Delivery management can propose Specialist work.'});return false;
  }
  return true;
 };
 const checkCandidate=async p=>{
  const a=await db.accounts.findOne({id:p.specialistId,role:'specialist',
   verified:true,approved:true,status:'active',
   specialistAgreementVersion:SPECIALIST_AGREEMENT_VERSION,
   expertise:p.serviceId,availabilityStatus:{$in:['available','limited']}});
  if(!a||!a.maxConcurrentCases)return null;
  const actual=await db.projects.countDocuments({specialistId:a.id,
   status:{$nin:['completed','cancelled','closed']}});
  if(Math.max(actual,a.activeAssignments||0)>=a.maxConcurrentCases)return null;
  return a;
 };
 app.get('/api/academic/assignment-offers',wrap(async(req,res)=>{
  if(!authorize(req,res,['specialist']))return;
  const items=await db.projects.find({status:'awaiting_specialist_acceptance',
   'assignmentOffer.specialistId':req.actor.id})
   .sort({'assignmentOffer.createdAt':-1}).limit(100).toArray();
  res.json({offers:items.map(p=>({
   id:p.id,serviceName:p.serviceName,serviceId:p.serviceId,subject:p.subject,
   deliverables:p.deliverables,deadline:p.deadline,
   feeMinor:p.assignmentOffer.feeMinor,currency:p.currency||'PLN',
   terms:p.assignmentOffer.terms,expiresAt:p.assignmentOffer.expiresAt,
   status:p.status,offeredAt:p.assignmentOffer.createdAt
  }))});
 }));
 app.post('/api/academic/commissions/:id/assignment-offer',wrap(async(req,res)=>{
  if(!requireOffer(req,res))return;
  const id=String(req.body?.specialistId||'');
  const feeMinor=Number(req.body?.feeMinor),
    terms=String(req.body?.terms||'').trim();
  if(!/^[A-Z0-9-]{7,80}$/.test(id)||!Number.isSafeInteger(feeMinor)||feeMinor<1||
   terms.length<20||terms.length>1600)
   return res.status(400).json({error:'Provide a qualified Specialist, a documented positive fee and complete assignment terms.'});
  const p=await db.projects.findOne({id:req.params.id,status:'ready_for_assignment',
   specialistId:'',paymentStatus:{$ne:'not_collected'}});
  if(!p)return res.status(409).json({error:'A genuinely commissioned, unassigned academic job is required before making an offer.'});
  if(feeMinor>p.priceMinor)
   return res.status(400).json({error:'The Specialist fee cannot exceed the documented client quotation.'});
  const candidate=await checkCandidate({specialistId:id,serviceId:p.serviceId});
  if(!candidate)return res.status(409).json({error:'This Specialist is not currently eligible or has insufficient capacity.'});
  const at=now(),expiresAt=new Date(Date.now()+48*3600000);
  const version=(p.assignmentVersion||0)+1;
  const offer={specialistId:id,feeMinor,terms,version,createdBy:req.actor.id,
   createdAt:at,expiresAt};
  const updated=await db.projects.findOneAndUpdate({id:p.id,status:'ready_for_assignment',
    specialistId:'',paymentStatus:{$ne:'not_collected'},assignmentVersion:p.assignmentVersion||{$exists:false}},
   {$set:{status:'awaiting_specialist_acceptance',assignmentOffer:offer,
    assignmentVersion:version,updatedAt:at}},{returnDocument:'after'});
  if(!updated)return res.status(409).json({error:'Another manager updated this commission. Refresh the allocation.'});
  await audit(req.actor,'academic_specialist_offer_issued',p.id,{specialistId:id,version,feeMinor});
  await notify(id,'IPS has offered scoped '+p.serviceName+' work '+p.id+
   '. Review the deadline, fee and terms in your Specialist workspace.','assignment_offer');
  res.status(201).json({offered:true,commissionId:p.id,status:updated.status,expiresAt});
 }));
 app.post('/api/academic/commissions/:id/assignment-decision',wrap(async(req,res)=>{
  if(!authorize(req,res,['specialist']))return;
  const decision=String(req.body?.decision||''),reason=String(req.body?.reason||'').trim();
  if(!['accept','decline'].includes(decision)||
   decision==='decline'&&(reason.length<12||reason.length>1000))
   return res.status(400).json({error:'Accept the stated terms or document why the work must be declined.'});
  const p=await db.projects.findOne({id:req.params.id,
   status:'awaiting_specialist_acceptance',
   'assignmentOffer.specialistId':req.actor.id});
  if(!p)return res.status(409).json({error:'No current assignment offer exists for your verified Specialist account.'});
  const offered=p.assignmentOffer;
  if(new Date(offered.expiresAt)<=now())
   return res.status(409).json({error:'This offer has expired. IPS Academic Delivery must review a new allocation.'});
  if(decision==='decline'){
   const at=now();
   const next=await db.projects.findOneAndUpdate({id:p.id,
    status:'awaiting_specialist_acceptance',assignmentVersion:offered.version,
    'assignmentOffer.specialistId':req.actor.id},
    {$set:{status:'ready_for_assignment',updatedAt:at},
     $push:{assignmentHistory:{specialistId:req.actor.id,version:offered.version,
      decision:'declined',reason,at}},
     $unset:{assignmentOffer:''}},{returnDocument:'after'});
   if(!next)return res.status(409).json({error:'The offer was already changed or answered.'});
   await audit(req.actor,'academic_specialist_offer_declined',p.id);
   await notify(rootEmail,'Specialist declined academic assignment offer '+p.id,'assignment');
   return res.json({status:'ready_for_assignment',accepted:false,commissionId:p.id});
  }
  const specialist=await checkCandidate({specialistId:req.actor.id,serviceId:p.serviceId});
  if(!specialist)return res.status(409).json({error:'Current service eligibility and capacity must be confirmed before acceptance.'});
  // Avoid allocating the same Specialist slot to two simultaneous approvals.
  await db.accounts.updateOne({id:specialist.id},{$max:{activeAssignments:
   await db.projects.countDocuments({specialistId:specialist.id,
    status:{$nin:['completed','cancelled','closed']}})}});
  const capacity=await db.accounts.findOneAndUpdate({
   id:specialist.id,role:'specialist',verified:true,approved:true,status:'active',
   specialistAgreementVersion:SPECIALIST_AGREEMENT_VERSION,
   availabilityStatus:{$in:['available','limited']},
   $expr:{$lt:[{$ifNull:['$activeAssignments',0]},'$maxConcurrentCases']}
  },{$inc:{activeAssignments:1}},{returnDocument:'after'});
  if(!capacity)return res.status(409).json({error:'All available capacity has been assigned. This offer cannot be accepted.'});
  let next;
  try{
   const at=now();
   next=await db.projects.findOneAndUpdate({id:p.id,
    status:'awaiting_specialist_acceptance',assignmentVersion:offered.version,
    'assignmentOffer.specialistId':req.actor.id,'assignmentOffer.expiresAt':{$gt:at}},
    {$set:{status:'specialist_assigned',specialistId:specialist.id,
     specialistFeeMinor:offered.feeMinor,assignmentTermsAcceptedAt:at,
     assignedBy:offered.createdBy,updatedAt:at},
     $push:{assignmentHistory:{specialistId:specialist.id,version:offered.version,
      decision:'accepted',feeMinor:offered.feeMinor,at}}},{returnDocument:'after'});
  }catch(err){
   await db.accounts.updateOne({id:specialist.id,activeAssignments:{$gt:0}},
    {$inc:{activeAssignments:-1}});throw err;
  }
  if(!next){
   await db.accounts.updateOne({id:specialist.id,activeAssignments:{$gt:0}},
    {$inc:{activeAssignments:-1}});
   return res.status(409).json({error:'Another actor changed the assignment. No capacity was allocated.'});
  }
  await db.compensation.updateOne({commissionId:p.id},{$setOnInsert:{
   id:uid('IPS-COMP'),commissionId:p.id,specialistId:specialist.id,
   proposedFeeMinor:offered.feeMinor,currency:p.currency||'PLN',
   status:'accepted',reason:offered.terms,proposedBy:offered.createdBy,
   acceptedAt:now(),respondedAt:now(),createdAt:now(),updatedAt:now()}},{upsert:true});
  await db.projects.updateOne({id:p.id,'milestones.name':'Specialist assignment'},
   {$set:{'milestones.$.status':'complete','milestones.$.at':now()}});
  await audit(req.actor,'academic_specialist_offer_accepted',p.id,
   {feeMinor:offered.feeMinor,version:offered.version});
  await notify(rootEmail,'Specialist accepted the scoped assignment and fee for '+p.id,'assignment');
  await notify(p.studentId,'An IPS Specialist has accepted your commissioned academic work '+p.id,'assignment');
  res.json({accepted:true,status:next.status,commissionId:p.id});
 }));
}
