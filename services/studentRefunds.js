import crypto from 'node:crypto';
import StudentRefund from '../models/StudentRefund.js';
import StudentPayment from '../models/StudentPayment.js';
import ServiceRequest from '../models/ServiceRequest.js';
import AuditLog from '../models/AuditLog.js';
import {hasAdminPermission} from '../shared/adminPermissions.js';

const refundStatuses=new Set(['pending','requires_action','succeeded','failed','canceled']);
const clean=str=>typeof str==='string'?str.trim():'';
const safeError=()=>({status:502,error:'The payment provider could not confirm the refund. IPS will review its state before another attempt.'});
function safeView(refund){
  return {refund_id:refund.refund_id,request_id:refund.request_id,amount_minor:refund.amount_minor,
    currency:refund.currency,status:refund.status,requested_at:refund.requested_at,
    completed_at:refund.completed_at,provider_status:refund.provider_status,
    failure:refund.failure? 'Provider reported a problem':'',reason:refund.reason};
}
export async function reconcileStudentRefund(paymentId,{
  refundModel=StudentRefund,paymentModel=StudentPayment,orderModel=ServiceRequest
}={}){
  const payment=await paymentModel.findOne({payment_id:paymentId}).lean();
  if(!payment)return false;
  const settled=await refundModel.aggregate([
    {$match:{payment_id:paymentId,status:'succeeded'}},
    {$group:{_id:null,amount:{$sum:'$amount_minor'}}}
  ]);
  const refunded=Math.min(Number(settled[0]?.amount||0),Number(payment.amount_minor));
  const paymentStatus=refunded>=payment.amount_minor?'refunded':'paid';
  await paymentModel.updateOne({payment_id:paymentId},{
    $set:{refunded_minor:refunded,status:paymentStatus}
  });
  await orderModel.updateOne({request_id:payment.request_id,client_id:payment.client_id},
    {$set:{payment_status:refunded>=payment.amount_minor?'refunded':refunded?'partially_refunded':'paid'}});
  return true;
}
export async function applyRefundProviderResult(refundId,provider,{
  refundModel=StudentRefund,paymentModel=StudentPayment,orderModel=ServiceRequest
}={}){
  const state=String(provider?.status||'');
  if(typeof provider?.id!=='string'||!/^re_[A-Za-z0-9_]+$/.test(provider.id)||!refundStatuses.has(state))
    return {error:'Invalid payment provider refund confirmation.'};
  const refund=await refundModel.findOne({refund_id:refundId});
  if(!refund)return {error:'Refund record unavailable.'};
  if(Number(provider.amount)!==Number(refund.amount_minor)||
    String(provider.currency||'').toLowerCase()!==String(refund.currency).toLowerCase())
    return {error:'Provider refund amount or currency does not match the approved request.'};
  const payment=await paymentModel.findOne({payment_id:refund.payment_id}).lean();
  if(!payment||String(provider.payment_intent||'')!==String(payment.provider_payment_intent||''))
    return {error:'Provider refund does not match the verified original payment.'};
  if(refund.status==='succeeded'){
    // Signed event replays also repair an interrupted MongoDB reconciliation.
    await reconcileStudentRefund(refund.payment_id,{refundModel,paymentModel,orderModel});
    return {result:safeView(refund),already:true};
  }
  if(refund.status==='failed'&&state!=='succeeded')return {result:safeView(refund),already:true};
  const target=state==='succeeded'?'succeeded':state==='failed'||state==='canceled'?'failed':
    state==='requires_action'?'requires_action':'processing';
  const updates={$set:{status:target,provider_refund_id:provider.id,provider_status:state}};
  if(target==='succeeded')updates.$set.completed_at=new Date();
  if(target==='failed')updates.$set.failure=clean(provider.failure_reason||'Refund failed').slice(0,300);
  const changed=await refundModel.findOneAndUpdate({
    refund_id:refundId,status:{$ne:'succeeded'}
  },updates,{new:true,runValidators:true});
  if(!changed)return {error:'Refund was not changed.'};
  if(['succeeded','failed'].includes(target)){
    await paymentModel.updateOne({payment_id:refund.payment_id,refund_lock:refundId},
      {$set:{refund_lock:''}});
  }
  if(target==='succeeded')await reconcileStudentRefund(refund.payment_id,{refundModel,paymentModel,orderModel});
  return {result:safeView(changed)};
}

export async function processStudentRefundEvent(event,options={}){
  if(!['refund.created','refund.updated','refund.failed'].includes(event?.type))return false;
  const refund=event.data?.object;
  if(refund?.object!=='refund'||typeof refund.id!=='string')throw Error('Malformed signed refund event.');
  const model=options.refundModel||StudentRefund;
  const own=refund.metadata?.ips_refund_id
    ?await model.findOne({refund_id:String(refund.metadata.ips_refund_id)})
    :await model.findOne({provider_refund_id:refund.id});
  if(!own)return true; // unrelated Stripe payment: never mutate an IPS order
  const result=await applyRefundProviderResult(own.refund_id,refund,options);
  if(result.error)throw Error(result.error);
  return true;
}
export async function issueStudentRefund({request_id,reason,amount_minor},{env=process.env,
  refundModel=StudentRefund,paymentModel=StudentPayment,orderModel=ServiceRequest,
  auditModel=AuditLog,request=fetch,actor='admin'
}={}){
  const id=clean(request_id),explanation=clean(reason);
  if(!/^SRV-[0-9A-F]{18}$/.test(id)||explanation.length<15||explanation.length>1600)
    return {status:400,error:'Choose an IPS project and provide a written 15–1600 character refund justification.'};
  if(!env.STRIPE_SECRET_KEY||!env.STRIPE_WEBHOOK_SECRET)
    return {status:503,error:'The live payment provider is not configured for refunds.'};
  const order=await orderModel.findOne({request_id:id,category:'Academic Support',
    payment_status:{$in:['paid','partially_refunded']}}).lean();
  if(!order)return {status:409,error:'Only verified settled student-support payments may be refunded.'};
  const payment=await paymentModel.findOne({request_id:id,status:'paid',
    provider:'stripe',provider_payment_intent:{$ne:''}}).sort({createdAt:-1}).lean();
  if(!payment)return {status:409,error:'A verified Stripe payment with a real PaymentIntent is required.'};
  const amount=amount_minor===undefined||amount_minor===null
    ?Math.max(0,payment.amount_minor-Number(payment.refunded_minor||0))
    :Number(amount_minor);
  if(!Number.isSafeInteger(amount)||amount<1||
     amount>payment.amount_minor-Number(payment.refunded_minor||0))
    return {status:400,error:'Refund value must be positive and cannot exceed the remaining settled charge.'};
  const refundId=crypto.randomUUID();
  const locked=await paymentModel.findOneAndUpdate({
    payment_id:payment.payment_id,status:'paid',
    $or:[{refund_lock:''},{refund_lock:{$exists:false}}]
  },{$set:{refund_lock:refundId}},{new:true});
  if(!locked)return {status:409,error:'A refund for this payment is already being processed or reviewed.'};
  let record;
  try{
    record=await refundModel.create({refund_id:refundId,request_id:id,payment_id:payment.payment_id,
      client_id:order.client_id,amount_minor:amount,currency:payment.currency,
      status:'requested',reason:explanation,requested_by:actor});
  }catch(error){
    await paymentModel.updateOne({payment_id:payment.payment_id,refund_lock:refundId},
      {$set:{refund_lock:''}});
    throw error;
  }
  const params=new URLSearchParams();
  params.set('payment_intent',payment.provider_payment_intent);
  params.set('amount',String(amount));
  params.set('reason','requested_by_customer');
  params.set('metadata[ips_refund_id]',refundId);
  params.set('metadata[request_id]',id);
  try{
    const response=await request('https://api.stripe.com/v1/refunds',{
      method:'POST',headers:{
        Authorization:'Bearer '+env.STRIPE_SECRET_KEY,
        'Content-Type':'application/x-www-form-urlencoded',
        'Idempotency-Key':'ips-refund-'+refundId
      },body:params,signal:AbortSignal.timeout(15000)
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok){
      // An explicit provider 4xx rejection can be safely unblocked. A 5xx
      // outcome is uncertain: require reconciliation before retrying.
      if(response.status>=400&&response.status<500){
        await refundModel.updateOne({refund_id:refundId},
          {$set:{status:'failed',failure:'Provider rejected the refund request.'}});
        await paymentModel.updateOne({payment_id:payment.payment_id,refund_lock:refundId},
          {$set:{refund_lock:''}});
      }
      return safeError();
    }
    const outcome=await applyRefundProviderResult(refundId,result,{refundModel,paymentModel,orderModel});
    if(outcome.error)return safeError();
    if(auditModel)await auditModel.create({
      order_id:id,actor_id:actor,actor_role:'admin',action:'stripe_refund_submitted',
      details:{refund_id:refundId,amount_minor:amount,currency:payment.currency,status:outcome.result.status}
    });
    return {status:202,refund:outcome.result};
  }catch(error){
    // Network timeout is ambiguous. Keep lock and refund record for manual
    // provider reconciliation rather than risking a second refund.
    await refundModel.updateOne({refund_id:refundId,status:'requested'},
      {$set:{status:'processing',failure:'Provider result requires manual reconciliation.'}});
    return safeError();
  }
}
export function registerStudentRefundRoutes(app,{requireSession}){
  app.get('/api/student-refunds/me',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='client')return res.sendStatus(403);
    try{
      const rows=await StudentRefund.find({client_id:session.id}).sort({createdAt:-1}).limit(100).lean();
      res.set('Cache-Control','no-store');
      res.json({success:true,refunds:rows.map(safeView)});
    }catch{return res.status(503).json({success:false,error:'Your refund records are unavailable.'});}
  });
  app.get('/api/student-refunds/admin',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='admin'||!hasAdminPermission(req.adminAccess,'payments.view'))return res.sendStatus(403);
    try{
      const rows=await StudentRefund.find().sort({createdAt:-1}).limit(100).lean();
      res.set('Cache-Control','no-store');res.json({success:true,refunds:rows.map(safeView)});
    }catch{return res.status(503).json({success:false,error:'IPS refund ledger unavailable.'});}
  });
  app.post('/api/student-refunds/admin',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='admin'||!hasAdminPermission(req.adminAccess,'payments.manage'))return res.sendStatus(403);
    try{
      const outcome=await issueStudentRefund(req.body,{actor:session.id});
      res.set('Cache-Control','no-store');
      res.status(outcome.status).json({success:outcome.status===202,...outcome});
    }catch{return res.status(503).json({success:false,error:'IPS could not safely submit the refund.'});}
  });
}
