import crypto from 'node:crypto';
import ContactEnquiry from '../models/ContactEnquiry.js';
import ChannelContact from '../models/ChannelContact.js';
import Client from '../models/Client.js';
import ServiceRequest from '../models/ServiceRequest.js';
import AuditLog from '../models/AuditLog.js';
import {getStudentOffer} from '../shared/studentOffers.js';
import {hasAdminPermission} from '../shared/adminPermissions.js';

const referencePattern=/^IPS-Q-[A-F0-9]{18}$/;
const rateBuckets=new Map();
function claimRateLimited(req){
  const now=Date.now();
  const key=crypto.createHash('sha256').update(String(req.ip||req.socket?.remoteAddress||'unknown')).digest('hex');
  if(rateBuckets.size>1000){for(const [k,v] of rateBuckets)if(v.until<=now)rateBuckets.delete(k);}
  const row=rateBuckets.get(key);
  const v=row&&row.until>now?row:{count:0,until:now+15*60000};
  v.count++;rateBuckets.set(key,v);
  return v.count>12;
}

// A reference alone is NEVER authentication. The visitor must prove the same
// verified email as the quote, or link the precise verified messenger conversation.
export async function mayClaimQuote(lead,customer,{
  contactModel=ChannelContact
}={}){
  if(!lead||!customer||lead.request_type!=='quote'||
    !lead.contact_verified||!lead.contact_consent||lead.status==='closed')return false;
  if(lead.client_id&&lead.client_id!==customer.client_id)return false;
  if(lead.client_id===customer.client_id)return true;
  if(lead.preferred_channel==='email')
    return Boolean(lead.email&&lead.email.toLowerCase()===customer.email?.toLowerCase()&&customer.email_verified_at);
  if(!['telegram','whatsapp'].includes(lead.preferred_channel)||!lead.contact_thread_id)return false;
  return Boolean(await contactModel.exists({
    _id:lead.contact_thread_id,client_id:customer.client_id,
    channel:lead.preferred_channel,status:'open',verified_at:{$ne:null}
  }));
}

export async function claimQuoteForAccount(ref,customer,{
  leadModel=ContactEnquiry,contactModel=ChannelContact
}={}){
  if(!referencePattern.test(ref)||!customer?.email_verified_at||customer.status!=='Active')
    return null;
  const lead=await leadModel.findOne({enquiry_id:ref,request_type:'quote'});
  if(!await mayClaimQuote(lead,customer,{contactModel}))return null;
  return leadModel.findOneAndUpdate({
    _id:lead._id,request_type:'quote',contact_verified:true,contact_consent:true,
    status:{$ne:'closed'},$or:[{client_id:''},{client_id:customer.client_id}]
  },{$set:{client_id:customer.client_id},$unset:{purge_at:''}},{new:true});
}

export async function createProjectFromClaimedQuote(lead,customer,{
  serviceModel=ServiceRequest,auditModel=AuditLog,actor='system'
}={}){
  if(!lead||!customer||lead.client_id!==customer.client_id||
    !lead.contact_verified||!lead.contact_consent||lead.status==='closed'||
    !customer.email_verified_at||customer.status!=='Active')return null;
  const offer=getStudentOffer(lead.service);
  if(!offer)return null;
  const brief=lead.messages?.find(m=>m.direction==='inbound')?.body?.trim()||'';
  if(brief.length<10)return null;
  const ref=lead.enquiry_id;
  if(!referencePattern.test(ref))return null;
  const now=new Date();
  const deadline=/^\d{4}-\d{2}-\d{2}$/.test(String(lead.preferred_deadline||''))
    ?new Date(lead.preferred_deadline+'T12:00:00.000Z'):undefined;
  const requestId='SRV-'+crypto.randomBytes(9).toString('hex').toUpperCase();
  const record={
    request_id:requestId,source:'quote_intake',source_quote_id:ref,
    family:'professional',category:'Academic Support',service_slug:offer.id,
    client_id:customer.client_id,client_name:customer.username||'Private customer',
    client_email:customer.email,title:(offer.title+' — '+(lead.discipline||'Academic consultation')).slice(0,180),
    description:brief.slice(0,10000),delivery_mode:'remote',
    ...(deadline&&!Number.isNaN(deadline.getTime())?{deadline}:{}),
    intake_answers:{academic_level:lead.study_level||'',subject:lead.discipline||'',
      service:offer.id,quote_reference:ref},
    status:'New Request',payment_status:'unpaid',
    status_history:[{status:'New Request',actor_id:actor,actor_role:'admin',
      reason:'Managed project opened from verified, linked quotation '+ref,changed_at:now}]
  };
  let request;
  try{
    request=await serviceModel.findOneAndUpdate({source_quote_id:ref},
      {$setOnInsert:record},{upsert:true,new:true,runValidators:true,setDefaultsOnInsert:true});
  }catch(error){
    if(error?.code!==11000)throw error;
    request=await serviceModel.findOne({source_quote_id:ref});
  }
  if(!request)return null;
  if(auditModel)await auditModel.create({
    order_id:request.request_id,actor_id:actor,actor_role:'admin',
    action:'verified_quote_project_opened',
    details:{source_quote_id:ref,client_id:customer.client_id,service:offer.id}
  });
  return request;
}

export function registerQuoteHandoffRoutes(app,{requireSession}){
  app.post('/api/quote-requests/claim',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='client')return res.sendStatus(403);
    if(claimRateLimited(req))return res.status(429).json({success:false,error:'Too many attempts. Try again later.'});
    const ref=String(req.body?.quote_id||'').trim().toUpperCase();
    if(!referencePattern.test(ref))return res.status(400).json({success:false,error:'Enter a valid IPS quotation reference.'});
    try{
      const customer=await Client.findOne({client_id:session.id,email_verified_at:{$ne:null},status:'Active'})
        .select('client_id email email_verified_at username status').lean();
      const linked=await claimQuoteForAccount(ref,customer);
      if(!linked)return res.status(404).json({success:false,error:'No verified quotation can be linked to this account. Check that the selected email or messaging account is verified.'});
      res.set('Cache-Control','no-store');
      return res.json({success:true,quote_id:ref,service_request_id:linked.service_request_id||'',
        message:'This private quotation is linked to your verified IPS account.'});
    }catch{return res.status(503).json({success:false,error:'Unable to link the private quotation securely.'});}
  });
  app.post('/api/quote-requests/admin/:id/create-project',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='admin'||!hasAdminPermission(req.adminAccess,'services.manage'))
      return res.status(403).json({success:false,error:'A service manager must authorize project creation.'});
    const ref=String(req.params.id||'').toUpperCase();
    if(!referencePattern.test(ref))return res.sendStatus(404);
    try{
      const lead=await ContactEnquiry.findOne({enquiry_id:ref,request_type:'quote',
        client_id:{$ne:''},contact_verified:true,contact_consent:true,status:{$ne:'closed'}});
      if(!lead)return res.status(409).json({success:false,error:'A verified client account must claim this quotation before IPS can open a managed project.'});
      const customer=await Client.findOne({client_id:lead.client_id,email_verified_at:{$ne:null},status:'Active'})
        .select('client_id username email email_verified_at status').lean();
      const request=await createProjectFromClaimedQuote(lead,customer,{actor:session.id});
      if(!request)return res.status(409).json({success:false,error:'The quotation does not have a valid verified customer or academic service.'});
      await ContactEnquiry.updateOne({enquiry_id:ref,client_id:customer.client_id},
        {$set:{service_request_id:request.request_id,status:'in_progress',last_activity_at:new Date()}});
      res.set('Cache-Control','no-store');
      return res.status(200).json({success:true,request_id:request.request_id,
        message:'Managed project created. IPS must issue an itemized quote before work or payment.'});
    }catch(error){
      console.error('Verified quote handoff failed:',error?.name||'error');
      return res.status(503).json({success:false,error:'The managed project could not be opened. No payment was authorized.'});
    }
  });
}
