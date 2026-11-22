// IPS Academic Services — truthful non-settlement billing and work accounting.
// No endpoint in this module can create a paid invoice, a receipt, a refund,
// a settled transaction, or an executed Specialist payout.
export const billingView=b=>({id:b.id,commissionId:b.commissionId,quoteId:b.quoteId,
 studentId:b.studentId,currency:b.currency,amountMinor:b.amountMinor,
 state:b.state,paymentStatus:'not_collected',receiptIssued:false,
 invoiceNumber:null,createdAt:b.createdAt,updatedAt:b.updatedAt});
export const workView=w=>({id:w.id,commissionId:w.commissionId,specialistId:w.specialistId,
 minutes:w.minutes,workDate:w.workDate,summary:w.summary,status:w.status,
 decisionNote:w.decisionNote||'',createdAt:w.createdAt,updatedAt:w.updatedAt});
const eligibleWork=new Set(['specialist_assigned','qa_pending','correction_requested',
 'student_revision_requested','client_delivery','completed']);
export async function ensureBillingRecord(db,p,now,uid){
 if(!p?.id||!p?.quoteId||!p?.studentId||!Number.isSafeInteger(p.priceMinor)||
  p.priceMinor<1||p.currency!=='PLN')throw Error('Accepted scoped quotation is required for billing preparation.');
 await db.billing.updateOne({commissionId:p.id},{$setOnInsert:{
  id:uid('IPS-B'),commissionId:p.id,quoteId:p.quoteId,studentId:p.studentId,
  amountMinor:p.priceMinor,currency:p.currency,
  state:'payment_provider_pending',paymentStatus:'not_collected',
  receiptIssued:false,invoiceNumber:null,createdAt:now(),updatedAt:now()
 }},{upsert:true});
 return db.billing.findOne({commissionId:p.id});
}
export function registerFinanceRoutes(ctx){
 const {app,db,authorize,wrap,audit,now,uid,notify,rootEmail,config}=ctx;
 const finance=a=>!!a&&(a.role==='root'||
  ['manager','staff'].includes(a.role)&&a.department==='finance');
 const financeDecider=a=>!!a&&(a.role==='root'||
  a.role==='manager'&&a.department==='finance');
 const staffGuard=(req,res,decide=false)=>{
  if(!authorize(req,res,['root','manager','staff']))return false;
  if(!(decide?financeDecider(req.actor):finance(req.actor))){
   res.status(403).json({error:'IPS Finance authority is required.'});return false;
  }
  return true;
 };
 const summary=c=>({commissionId:c.commissionId,specialistId:c.specialistId,
  proposedFeeMinor:c.proposedFeeMinor,currency:c.currency,status:c.status,
  proposedBy:c.proposedBy,acceptedAt:c.acceptedAt||null,updatedAt:c.updatedAt});
 const disputeView=d=>({id:d.id,commissionId:d.commissionId,studentId:d.studentId,
  status:d.status,reason:d.reason,assignedTo:d.assignedTo||'',decisionNote:d.decisionNote||'',
  openedAt:d.openedAt,updatedAt:d.updatedAt});
 app.get('/api/finance/my-billing',wrap(async(req,res)=>{
  if(!authorize(req,res,['student']))return;
  const items=await db.billing.find({studentId:req.actor.id})
   .sort({createdAt:-1}).limit(100).toArray();
  res.json({records:items.map(billingView),paymentsEnabled:false,
   noReceipts:true,message:'Payments are not available. These are accepted-quotation billing preparations, not paid invoices.'});
 }));
 app.get('/api/finance/overview',wrap(async(req,res)=>{
  if(!staffGuard(req,res))return;
  const [bills,logs,comp,disputes,summaryRows]=await Promise.all([
   db.billing.find().sort({createdAt:-1}).limit(150).toArray(),
   db.workLogs.find().sort({createdAt:-1}).limit(150).toArray(),
   db.compensation.find().sort({updatedAt:-1}).limit(150).toArray(),
   db.billingDisputes.find().sort({updatedAt:-1}).limit(100).toArray(),
   db.billing.aggregate([{$match:{state:{$ne:'cancelled_before_payment'}}},
    {$group:{_id:null,count:{$sum:1},amountMinor:{$sum:'$amountMinor'}}}]).toArray()]);
  res.json({billing:bills.map(billingView),workLogs:logs.map(workView),
   compensation:comp.map(summary),disputes:disputes.map(disputeView),
   totals:{awaitingPaymentIntegration:summaryRows[0]?.count||0,
    acceptedQuoteValueMinor:summaryRows[0]?.amountMinor||0,
    collectedAmountMinor:0,issuedReceipts:0,executedPayoutMinor:0},
   sample:{billingShown:bills.length,billingTotal:await db.billing.countDocuments(),
    workLogsShown:logs.length,workLogsTotal:await db.workLogs.countDocuments(),
    disputesShown:disputes.length,disputesTotal:await db.billingDisputes.countDocuments()},
   currency:'PLN',paymentsEnabled:false});
 }));
 app.get('/api/finance/work-logs',wrap(async(req,res)=>{
  if(!authorize(req,res,['specialist','root','manager','staff']))return;
  if(req.actor.role!=='specialist'&&!finance(req.actor))
   return res.status(403).json({error:'Your role cannot access work accounting.'});
  const filter=req.actor.role==='specialist'?{specialistId:req.actor.id}:{};
  const logs=await db.workLogs.find(filter).sort({createdAt:-1}).limit(200).toArray();
  res.json({logs:logs.map(workView),payoutsEnabled:false});
 }));
 app.post('/api/finance/work-logs',wrap(async(req,res)=>{
  if(!authorize(req,res,['specialist']))return;
  const p=await db.projects.findOne({id:String(req.body?.commissionId||''),
   specialistId:req.actor.id,status:{$in:[...eligibleWork]}});
  if(!p||p.paymentStatus==='not_collected')
   return res.status(403).json({error:'Only your genuinely assigned, eligible academic commission can have a work log.'});
  const minutes=Number(req.body?.minutes),
   summaryText=String(req.body?.summary||'').trim(),
   workDate=String(req.body?.workDate||'').trim(),
   requestId=String(req.body?.requestId||'');
  const day=new Date(workDate+'T12:00:00.000Z');
  if(!Number.isSafeInteger(minutes)||minutes<5||minutes>960||
   summaryText.length<20||summaryText.length>1300||
   !/^\d{4}-\d{2}-\d{2}$/.test(workDate)||!Number.isFinite(day.getTime())||
   day.toISOString().slice(0,10)!==workDate||day.getTime()>Date.now()+86400000||
   !/^[A-Za-z0-9_-]{12,100}$/.test(requestId))
   return res.status(400).json({error:'Provide a real work date, 5–960 minutes, meaningful work summary and unique request identifier.'});
  const item={id:uid('IPS-W'),requestId,specialistId:req.actor.id,
   commissionId:p.id,minutes,workDate,summary:summaryText,status:'submitted',
   createdAt:now(),updatedAt:now()};
  try{await db.workLogs.insertOne(item)}
  catch(err){
   if(err?.code!==11000)throw err;
   const existing=await db.workLogs.findOne({specialistId:req.actor.id,requestId});
   if(!existing)return res.status(409).json({error:'A different IPS work log already uses that request identifier.'});
   return res.status(200).json({log:workView(existing),duplicate:true});
  }
  await audit(req.actor,'specialist_time_record_submitted',item.id,
   {commissionId:p.id,minutes});
  await notify(rootEmail,'A Specialist work record awaits IPS Finance review: '+item.id,'finance');
  res.status(201).json({log:workView(item),payoutsEnabled:false});
 }));
 app.post('/api/finance/work-logs/:id/decision',wrap(async(req,res)=>{
  if(!staffGuard(req,res,true))return;
  const decision=String(req.body?.decision||''),note=String(req.body?.note||'').trim();
  if(!['approve','reject'].includes(decision)||note.length<12||note.length>700)
   return res.status(400).json({error:'Choose approve or reject and document the reason.'});
  const log=await db.workLogs.findOneAndUpdate({id:req.params.id,status:'submitted'},
   {$set:{status:decision==='approve'?'approved':'rejected',decisionNote:note,
    decidedBy:req.actor.id,decidedAt:now(),updatedAt:now()}},{returnDocument:'after'});
  if(!log)return res.status(409).json({error:'The work record has already been reviewed or does not exist.'});
  await audit(req.actor,'specialist_time_record_'+decision,log.id,{commissionId:log.commissionId});
  await notify(log.specialistId,'IPS reviewed your academic work record '+log.id,'finance');
  res.json({log:workView(log),payoutExecuted:false});
 }));
 app.get('/api/finance/compensation/:commissionId',wrap(async(req,res)=>{
  if(!authorize(req,res,['specialist','root','manager','staff']))return;
  const item=await db.compensation.findOne({commissionId:req.params.commissionId});
  if(!item)return res.status(404).json({error:'No compensation proposal exists for this commission.'});
  if(!finance(req.actor)&&!(req.actor.role==='specialist'&&item.specialistId===req.actor.id))
   return res.status(403).json({error:'The compensation proposal is not assigned to your account.'});
  res.json({proposal:summary(item),payoutExecuted:false});
 }));
 app.post('/api/finance/compensation/:commissionId/propose',wrap(async(req,res)=>{
  if(!staffGuard(req,res,true))return;
  const p=await db.projects.findOne({id:req.params.commissionId,
   specialistId:{$ne:''},status:{$in:[...eligibleWork]}});
  if(!p||p.paymentStatus==='not_collected')
   return res.status(409).json({error:'Only a genuinely assigned academic job may have proposed Specialist compensation.'});
  if(p.assignmentTermsAcceptedAt)
   return res.status(409).json({error:'The Specialist already accepted fee and assignment terms; Finance cannot replace that agreement.'});
  const amount=Number(req.body?.feeMinor),reason=String(req.body?.reason||'').trim();
  if(!Number.isSafeInteger(amount)||amount<1||amount>p.priceMinor||
   reason.length<15||reason.length>700)
   return res.status(400).json({error:'Propose a documented positive Specialist fee that does not exceed the quoted client amount.'});
  const existing=await db.compensation.findOne({commissionId:p.id});
  if(existing&&['accepted','declined'].includes(existing.status))
   return res.status(409).json({error:'Previously agreed or declined Specialist terms cannot be silently replaced.'});
  const at=now();
  let item;
  try{item=await db.compensation.findOneAndUpdate({commissionId:p.id,
   status:{$nin:['accepted','declined']}},{$set:{
   specialistId:p.specialistId,proposedFeeMinor:amount,currency:p.currency,
   status:'proposed',reason,proposedBy:req.actor.id,updatedAt:at},
   $setOnInsert:{id:uid('IPS-COMP'),commissionId:p.id,createdAt:at}},
   {upsert:true,returnDocument:'after'});}
  catch(err){if(err?.code===11000)return res.status(409).json({
    error:'Another IPS Finance manager changed these compensation terms. Reload before deciding.'});throw err}
  await audit(req.actor,'specialist_compensation_proposed',p.id,{feeMinor:amount});
  await notify(p.specialistId,'An IPS Specialist compensation proposal awaits your acknowledgement for '+p.id,'finance');
  res.json({proposal:summary(item),payoutExecuted:false});
 }));
 app.post('/api/finance/compensation/:commissionId/respond',wrap(async(req,res)=>{
  if(!authorize(req,res,['specialist']))return;
  const decision=String(req.body?.decision||'');
  if(!['accept','decline'].includes(decision))
   return res.status(400).json({error:'Choose accept or decline for the proposed Specialist terms.'});
  const proposal=await db.compensation.findOneAndUpdate({
   commissionId:req.params.commissionId,specialistId:req.actor.id,status:'proposed'},
   {$set:{status:decision==='accept'?'accepted':'declined',
    respondedAt:now(),updatedAt:now()}},{returnDocument:'after'});
  if(!proposal)return res.status(409).json({error:'No pending compensation proposal exists for your assignment.'});
  await audit(req.actor,'specialist_compensation_'+decision,proposal.commissionId);
  await notify(rootEmail,'Specialist reviewed an IPS compensation proposal for '+proposal.commissionId,'finance');
  res.json({proposal:summary(proposal),payoutExecuted:false});
 }));
 app.post('/api/finance/disputes',wrap(async(req,res)=>{
  if(!authorize(req,res,['student']))return;
  const commission=await db.projects.findOne({id:String(req.body?.commissionId||''),
   studentId:req.actor.id});
  if(!commission)return res.status(403).json({error:'Only your own academic billing case can be disputed.'});
  const reason=String(req.body?.reason||'').trim();
  if(reason.length<25||reason.length>2000)
   return res.status(400).json({error:'Explain your academic billing concern in writing (25–2,000 characters).'});
  const item={id:uid('IPS-FDIS'),commissionId:commission.id,studentId:req.actor.id,
   reason,status:'open',assignedTo:'',openedAt:now(),updatedAt:now()};
  await db.billingDisputes.insertOne(item);
  await audit(req.actor,'academic_billing_dispute_opened',item.id,{commissionId:commission.id});
  await notify(rootEmail,'Written academic billing concern requires review: '+item.id,'finance');
  res.status(201).json({dispute:disputeView(item),noSettlementAvailable:true});
 }));
 app.get('/api/finance/disputes',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','root','manager','staff']))return;
  if(req.actor.role!=='student'&&!finance(req.actor))
   return res.status(403).json({error:'IPS Finance authority is required.'});
  const filter=req.actor.role==='student'?{studentId:req.actor.id}:{};
  const items=await db.billingDisputes.find(filter).sort({openedAt:-1}).limit(100).toArray();
  res.json({disputes:items.map(disputeView),refundsEnabled:false});
 }));
 app.post('/api/finance/disputes/:id/review',wrap(async(req,res)=>{
  if(!staffGuard(req,res,true))return;
  const decision=String(req.body?.decision||''),
   note=String(req.body?.note||'').trim();
  if(!['reviewing','resolved_without_settlement'].includes(decision)||
   note.length<15||note.length>1200)
   return res.status(400).json({error:'Choose a documented Finance review outcome; settlement is unavailable.'});
  const item=await db.billingDisputes.findOneAndUpdate({id:req.params.id,
   status:{$in:['open','reviewing']}},{$set:{status:decision,
    assignedTo:req.actor.id,decisionNote:note,updatedAt:now()}},{returnDocument:'after'});
  if(!item)return res.status(409).json({error:'This billing concern is closed or not found.'});
  await audit(req.actor,'academic_billing_dispute_reviewed',item.id,{decision});
  await notify(item.studentId,'IPS Finance updated your billing concern '+item.id,'finance');
  res.json({dispute:disputeView(item),refundsEnabled:false});
 }));
}
