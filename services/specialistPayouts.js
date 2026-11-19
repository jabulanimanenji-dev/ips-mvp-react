import SpecialistPayout from '../models/SpecialistPayout.js';
import ServiceRequest from '../models/ServiceRequest.js';
import Writer from '../models/Writer.js';
import AuditLog from '../models/AuditLog.js';
import {hasAdminPermission} from '../shared/adminPermissions.js';

const currencyMinor=(value,currency)=>{
  const v=Number(value);
  if(!['PLN','EUR','USD'].includes(currency)||!Number.isFinite(v)||v<=0||v>100000||
    Math.abs(Math.round(v*100)-v*100)>0.000001)return null;
  return Math.round(v*100);
};
const safeText=value=>typeof value==='string'?value.trim():'';
const publicPayout=p=>({
  request_id:p.request_id,writer_id:p.writer_id,amount_minor:p.amount_minor,
  currency:p.currency,status:p.status,agreed_scope:p.agreed_scope,
  approved_at:p.approved_at,paid_at:p.paid_at,
  payment_reference:p.payment_reference||''
});
const canManage=req=>hasAdminPermission(req.adminAccess,'payments.manage');

export async function approveSpecialistPayout(input,{
  orderModel=ServiceRequest,writerModel=Writer,payoutModel=SpecialistPayout,auditModel=AuditLog,
  actor='admin'
}={}){
  const requestId=safeText(input?.request_id),scope=safeText(input?.agreed_scope);
  if(!/^SRV-[0-9A-F]{18}$/.test(requestId)||scope.length<10||scope.length>1000)
    return {status:400,error:'Select a completed paid engagement and describe the specialist payout agreement.'};
  const request=await orderModel.findOne({request_id:requestId,category:'Academic Support',
    payment_status:'paid',status:'Completed',provider_id:{$ne:''}}).lean();
  if(!request)return {status:409,error:'Only completed and paid academic engagements can have specialist payouts recorded.'};
  const provider=await writerModel.findOne({writer_id:request.provider_id,application_status:'approved'}).lean();
  if(!provider)return {status:409,error:'The assigned specialist identity could not be verified.'};
  const currency=String(request.quote?.currency||'').toUpperCase(),minor=currencyMinor(input?.amount,currency);
  if(!minor||minor>Math.round(Number(request.quote?.total||0)*100))
    return {status:400,error:'The approved payout must be positive, in the order currency, and no greater than the settled quotation.'};
  let payout;
  try{
    payout=await payoutModel.create({
      request_id:requestId,writer_id:request.provider_id,
      amount_minor:minor,currency,status:'approved',
      agreed_scope:scope,approved_by:actor,approved_at:new Date()
    });
  }catch(e){
    if(e?.code!==11000)throw e;
    const existing=await payoutModel.findOne({request_id:requestId}).lean();
    return {status:409,error:'A payout is already recorded for this engagement.',
      payout:existing?publicPayout(existing):null};
  }
  if(auditModel)await auditModel.create({
    order_id:requestId,actor_id:actor,actor_role:'admin',
    action:'specialist_payout_approved',
    details:{writer_id:request.provider_id,amount_minor:minor,currency}
  });
  return {status:201,payout:publicPayout(payout)};
}

export async function recordSpecialistBankTransfer(requestId,reference,{
  payoutModel=SpecialistPayout,orderModel=ServiceRequest,auditModel=AuditLog,actor='admin'
}={}){
  const ref=safeText(reference);
  if(!/^SRV-[0-9A-F]{18}$/.test(requestId)||ref.length<6||ref.length>160||/[\x00-\x1f]/.test(ref))
    return {status:400,error:'Record a valid unique bank-transfer confirmation reference (6–160 characters).'};
  const request=await orderModel.findOne({request_id:requestId,payment_status:'paid',status:'Completed'});
  if(!request)return {status:409,error:'The paid completed engagement is no longer eligible for settlement.'};
  const updated=await payoutModel.findOneAndUpdate({
    request_id:requestId,status:'approved'
  },{$set:{status:'paid',paid_at:new Date(),recorded_by:actor,payment_reference:ref}},
  {new:true,runValidators:true});
  if(!updated){
    const existing=await payoutModel.findOne({request_id:requestId});
    return {status:409,error:existing?.status==='paid'
      ?'This specialist payment has already been recorded.':'No approved payout exists.'};
  }
  if(auditModel)await auditModel.create({
    order_id:requestId,actor_id:actor,actor_role:'admin',
    action:'specialist_bank_transfer_recorded',
    details:{writer_id:updated.writer_id,amount_minor:updated.amount_minor,
      currency:updated.currency,reference:ref}
  });
  return {status:200,payout:publicPayout(updated)};
}

export function registerSpecialistPayoutRoutes(app,{requireSession}){
  app.get('/api/specialist-payouts/me',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='writer')return res.sendStatus(403);
    try{
      const payouts=await SpecialistPayout.find({writer_id:session.id})
        .sort({createdAt:-1}).limit(100).lean();
      res.set('Cache-Control','no-store');
      res.json({success:true,payouts:payouts.map(publicPayout),
        notice:'Paid means a bank transfer was recorded by IPS staff. Contact management if it has not arrived.'});
    }catch{return res.status(503).json({success:false,error:'Private specialist payment records are unavailable.'});}
  });
  app.get('/api/specialist-payouts/admin',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='admin'||!hasAdminPermission(req.adminAccess,'payments.view'))return res.sendStatus(403);
    try{
      const payouts=await SpecialistPayout.find().sort({createdAt:-1}).limit(150).lean();
      res.set('Cache-Control','no-store');
      res.json({success:true,payouts:payouts.map(publicPayout)});
    }catch{return res.status(503).json({success:false,error:'Specialist settlement ledger unavailable.'});}
  });
  app.post('/api/specialist-payouts/admin',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='admin'||!canManage(req))return res.sendStatus(403);
    try{
      const result=await approveSpecialistPayout(req.body,{actor:session.id});
      res.set('Cache-Control','no-store');
      res.status(result.status).json({success:!!result.payout&&result.status===201,...result});
    }catch{return res.status(503).json({success:false,error:'The payout agreement could not be saved.'});}
  });
  app.post('/api/specialist-payouts/admin/:id/record-bank-transfer',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='admin'||!canManage(req))return res.sendStatus(403);
    try{
      const result=await recordSpecialistBankTransfer(req.params.id,req.body?.reference,{actor:session.id});
      res.set('Cache-Control','no-store');
      res.status(result.status).json({success:result.status===200,...result});
    }catch{return res.status(503).json({success:false,error:'The bank-transfer confirmation could not be recorded.'});}
  });
}
