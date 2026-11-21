import ServiceRequest from '../models/ServiceRequest.js';
import StudentPayment from '../models/StudentPayment.js';
import StudentRefund from '../models/StudentRefund.js';
import SpecialistPayout from '../models/SpecialistPayout.js';
import {hasAdminPermission} from '../shared/adminPermissions.js';
import {isIpsQaFixtureClient} from '../shared/ipsCompanyScope.js';

const production=env=>env.NODE_ENV==='production'&&env.IPS_EVALUATION_MODE!=='true';
const baseQuery={category:'Academic Support',source:'quote_intake'};
const totals=doc=>({
  request_id:doc.request_id,
  quote_total:Number(doc.quote?.total||0),
  currency:String(doc.quote?.currency||'PLN').toUpperCase(),
  quote_version:Number(doc.quote?.version||0),
  quote_accepted:Boolean(doc.quote?.accepted),
  project_status:doc.status,payment_status:doc.payment_status,
  updated_at:doc.updatedAt||doc.createdAt
});
const moneyRecord=payment=>({
  request_id:payment.request_id,amount_minor:payment.amount_minor,
  refunded_minor:payment.refunded_minor||0,currency:payment.currency,
  status:payment.status,created_at:payment.createdAt,paid_at:payment.paid_at||null
});
const payoutRecord=p=>({
  request_id:p.request_id,writer_id:p.writer_id,
  amount_minor:p.amount_minor,currency:p.currency,status:p.status,
  approved_at:p.approved_at,paid_at:p.paid_at||null
});
const refundRecord=r=>({
  request_id:r.request_id,refund_id:r.refund_id,
  amount_minor:r.amount_minor,currency:r.currency,status:r.status,
  requested_at:r.requested_at,completed_at:r.completed_at||null
});

export function registerCompanyFinanceRoutes(app,{requireSession,env=process.env}={}){
  app.get('/api/admin/finance/operating-ledger',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='admin'||!hasAdminPermission(req.adminAccess,'payments.view'))
      return res.status(403).json({success:false,error:'Financial authority is required.'});
    try{
      const [quotes,payments,payouts,refunds,quoteCount,acceptedCount,manualReview,payoutsPending,refundsPending]=await Promise.all([
        ServiceRequest.find(baseQuery).select('request_id quote.total quote.currency quote.version quote.accepted status payment_status updatedAt createdAt client_id')
          .sort({updatedAt:-1}).limit(100).lean(),
        StudentPayment.find().select('request_id amount_minor refunded_minor currency status createdAt paid_at')
          .sort({createdAt:-1}).limit(100).lean(),
        SpecialistPayout.find().select('request_id writer_id amount_minor currency status approved_at paid_at')
          .sort({createdAt:-1}).limit(100).lean(),
        StudentRefund.find().select('request_id refund_id amount_minor currency status requested_at completed_at')
          .sort({createdAt:-1}).limit(100).lean(),
        ServiceRequest.countDocuments(baseQuery),
        ServiceRequest.countDocuments({...baseQuery,'quote.accepted':true}),
        StudentPayment.countDocuments({status:'review_required'}),
        SpecialistPayout.countDocuments({status:'approved'}),
        StudentRefund.countDocuments({status:{$in:['requested','processing','requires_action']}})
      ]);
      const valid=production(env)?quotes.filter(q=>!isIpsQaFixtureClient({client_id:q.client_id})):quotes;
      const financialCases=valid.map(totals);
      res.set('Cache-Control','private, no-store');
      return res.json({success:true,as_of:new Date().toISOString(),
        counts:{quote_requests:quoteCount,client_accepted_quotes:acceptedCount,
          payments_requiring_review:manualReview,approved_payouts_pending:payoutsPending,
          refunds_pending:refundsPending},
        // Every list is a recent ledger window, never represented as complete accounting.
        window_limit:100,financial_cases:financialCases,
        payments:payments.map(moneyRecord),payouts:payouts.map(payoutRecord),
        refunds:refunds.map(refundRecord),
        provider_pending:true,
        notice:'A quote is not revenue, an accepted quote is not settlement, and a recorded payout requires actual financial evidence.'});
    }catch(error){
      console.error('IPS company finance ledger unavailable:',error?.name||'error');
      return res.status(503).json({success:false,error:'The protected finance ledger is temporarily unavailable.'});
    }
  });
}
