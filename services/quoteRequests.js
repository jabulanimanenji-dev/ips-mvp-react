import crypto from 'node:crypto';
import mongoose from 'mongoose';
import ContactEnquiry from '../models/ContactEnquiry.js';
import Client from '../models/Client.js';
import {validatePrivateQuote} from '../shared/privacyIdentity.js';
import {issueEmailChallenge,confirmEmailChallenge,verificationAvailable} from './accountVerification.js';
import {publicContactConfig} from './contactChannels.js';
import {enqueueContactEmailJobs} from './contactEmailQueue.js';

const hashes=new Map(),WINDOW_MS=15*60000;
function limited(req,scope='quote-submission',maxRequests=4){
  const hash=crypto.createHash('sha256').update(scope+'|'+String(req.ip||req.socket?.remoteAddress||'unknown')).digest('hex');
  const now=Date.now();
  const last=hashes.get(hash);
  if(hashes.size>1500){
    for(const [k,v] of hashes)if(now>v.until)hashes.delete(k);
    if(hashes.size>1500)hashes.clear();
  }
  const record=!last||now>last.until?{count:0,until:now+WINDOW_MS}:last;
  record.count++;hashes.set(hash,record);
  return record.count>maxRequests;
}
const sameOrigin=req=>{
  const origin=req.get('origin');
  if(!origin)return true;
  try{const url=new URL(origin);
    return (url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))&&url.host===req.get('host');
  }catch{return false;}
};
const quoteReference=()=> 'IPS-Q-'+crypto.randomBytes(9).toString('hex').toUpperCase();
const contactStatus=lead=>({
  quote_id:lead.enquiry_id,
  contact_status:lead.contact_verified?'verified':'awaiting_verification',
  preferred_channel:lead.preferred_channel
});
export function registerPrivateQuoteRoutes(app,{readSession,requireSession}){
  app.get('/api/quote-requests/config',(_req,res)=>{
    const channels=publicContactConfig();
    res.set('Cache-Control','no-store');
    return res.json({success:true,accepting_requests:mongoose.connection.readyState===1,
      email:verificationAvailable(),workspace:true,
      whatsapp:Boolean(channels.whatsapp?.available),
      telegram:Boolean(channels.telegram?.available),
      signal:false,no_calls:true,
      notice:'IPS reviews written requests only. External messenger notifications cannot guarantee end-to-end confidentiality.'});
  });
  app.post('/api/quote-requests',async(req,res)=>{
    if(!sameOrigin(req))return res.status(403).json({success:false,error:'Submit from the IPS website.'});
    if(mongoose.connection.readyState!==1)return res.status(503).json({success:false,error:'Private quote requests are temporarily unavailable.'});
    if(limited(req))return res.status(429).json({success:false,error:'Too many requests. Please try later.'});
    let account=null;
    const session=readSession(req);
    if(session?.role==='client'&&session.email_verified===true)
      account=await Client.findOne({client_id:session.id,email_verified_at:{$ne:null}}).select('client_id username email email_verified_at').lean();
    const preferred=String(req.body?.preferred_channel||'');
    if(preferred==='email'&&!verificationAvailable())
      return res.status(503).json({success:false,error:'Verified email quotations are not yet available.'});
    const channels=publicContactConfig();
    if(preferred==='telegram'&&!channels.telegram?.available)
      return res.status(503).json({success:false,error:'Telegram quoting is not yet connected. Choose another available method.'});
    if(preferred==='whatsapp'&&!channels.whatsapp?.available)
      return res.status(503).json({success:false,error:'WhatsApp quoting is not yet connected. Choose another available method.'});
    const validation=validatePrivateQuote({...req.body,username:account?.username||req.body?.username},{signedIn:Boolean(account),
      verifiedChannels:[]});
    if(validation.error)return res.status(400).json({success:false,error:validation.error});
    const c=validation.value,now=new Date();
    try{
      const lead=await ContactEnquiry.create({
        enquiry_id:quoteReference(),client_id:account?.client_id||'',
        name:'',username:c.username,request_type:'quote',
        email:c.email,phone:c.phone,telegram_username:c.telegram_username,
        preferred_channel:c.preferred_channel,
        service:c.service,discipline:c.subject,study_level:c.level,preferred_deadline:c.deadline,
        subject:c.service,contact_consent:true,consent_at:now,
        contact_verified:c.contact_verified,
        verification_status:c.verification_status,
        contact_verified_at:c.contact_verified?now:undefined,
        status:'new',source:'academic-quote',
        ...(c.contact_verified?{}:{purge_at:new Date(now.getTime()+30*86400000)}),
        messages:[{direction:'inbound',channel:'website',body:c.message,delivery_status:'received',created_at:now}],
        last_activity_at:now
      });
      if(c.preferred_channel==='email'){
        try{await issueEmailChallenge(lead);}
        catch(error){return res.status(503).json({success:false,quote_id:lead.enquiry_id,verification_required:true,
          error:'Your request was saved, but we could not send a verification code. Please contact IPS support using your quote reference.'});}
      }else if(c.contact_verified){
        try{await enqueueContactEmailJobs(lead);}catch(error){console.error('IPS quote notification queue unavailable:',error?.name||'error');}
      }
      res.set('Cache-Control','no-store');
      return res.status(c.contact_verified?201:202).json({
        success:true,...contactStatus(lead),verification_required:c.preferred_channel==='email',
        requires_chat_start:['telegram','whatsapp'].includes(c.preferred_channel),
        message:c.contact_verified?
          'Request received. IPS will review it. No work or payment is authorized.':
          c.preferred_channel==='email'?
            'Quote reference saved. Verify your email code to submit the request for review.':
            'Quote saved. Open your selected messaging app and send the quote reference to IPS to verify the conversation.'
      });
    }catch(error){console.error('Quote storage failed:',error?.name||'error');return res.status(503).json({success:false,error:'We could not securely save your request.'});}
  });
  app.post('/api/quote-requests/verify-email',async(req,res)=>{
    if(limited(req,'verification',8))return res.status(429).json({success:false,error:'Please try again later.'});
    const id=String(req.body?.quote_id||'');
    const code=String(req.body?.code||'');
    if(!/^IPS-Q-[A-F0-9]{18}$/.test(id)||!/^\d{8}$/.test(code))
      return res.status(400).json({success:false,error:'Enter a valid quotation reference and eight-digit code.'});
    try{
      const lead=await ContactEnquiry.findOne({enquiry_id:id,request_type:'quote',
        preferred_channel:'email',contact_verified:false})
        .select('+verification_hash +verification_expires_at +verification_attempts +verification_sent_at');
      if(!lead)return res.status(400).json({success:false,error:'Verification is unavailable or already completed.'});
      const result=await confirmEmailChallenge(lead,code);
      if(result.error)return res.status(result.status||400).json({success:false,error:result.error});
      lead.contact_verified=true;lead.verification_status='verified';lead.contact_verified_at=new Date();
      lead.purge_at=undefined;
      await lead.save();
      try{await enqueueContactEmailJobs(lead);}catch(error){console.error('IPS verified quote notification unavailable:',error?.name||'error');}
      res.set('Cache-Control','no-store');
      return res.json({success:true,quote_id:id,message:'Your email is verified and IPS can review your request.'});
    }catch{return res.status(503).json({success:false,error:'Verification is temporarily unavailable.'});}
  });

  // Private workspace quotation messages are accessible solely to the verified
  // account that created them. A public reference is never an access credential.
  app.get('/api/quote-requests/me',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='client')return res.sendStatus(403);
    try{
      const rows=await ContactEnquiry.find({
        request_type:'quote',client_id:session.id,contact_verified:true,contact_consent:true
      }).select('enquiry_id username service discipline study_level preferred_deadline subject status preferred_channel service_request_id review_started_at next_update_at messages createdAt updatedAt')
        .sort({createdAt:-1}).limit(50).lean();
      res.set('Cache-Control','no-store');
      res.json({success:true,quotes:rows});
    }catch{return res.status(503).json({success:false,error:'Your private quotations could not be loaded.'});}
  });
  app.post('/api/quote-requests/:id/workspace-reply',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='client')return res.sendStatus(403);
    if(limited(req,'workspace-replies',30))return res.status(429).json({success:false,error:'Please wait before sending another message.'});
    const body=String(req.body?.message||'').trim();
    if(body.length<3||body.length>2400)return res.status(400).json({success:false,error:'Your message must be 3–2400 characters.'});
    try{
      const row=await ContactEnquiry.findOneAndUpdate({
        enquiry_id:req.params.id,request_type:'quote',client_id:session.id,
        contact_verified:true,contact_consent:true,status:{$ne:'closed'}
      },{$push:{messages:{direction:'inbound',channel:'website',body,author:session.id,delivery_status:'received',created_at:new Date()}},
        $set:{status:'in_progress',last_activity_at:new Date()}},{new:true,runValidators:true}).select('enquiry_id messages status');
      if(!row)return res.status(404).json({success:false,error:'Private quotation unavailable or closed.'});
      res.set('Cache-Control','no-store');
      res.json({success:true,quote:{enquiry_id:row.enquiry_id,messages:row.messages,status:row.status}});
    }catch{return res.status(503).json({success:false,error:'Your message could not be saved.'});}
  });
  app.post('/api/quote-requests/admin/:id/workspace-reply',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='admin')return res.sendStatus(403);
    const body=String(req.body?.message||'').trim();
    if(body.length<3||body.length>2400)return res.status(400).json({success:false,error:'Reply must contain 3–2400 characters.'});
    try{
      const row=await ContactEnquiry.findOneAndUpdate({
        enquiry_id:req.params.id,request_type:'quote',client_id:{$ne:''},
        preferred_channel:'workspace',contact_verified:true,status:{$ne:'closed'}
      },{$push:{messages:{direction:'outbound',channel:'website',body,author:session.id,delivery_status:'sent',created_at:new Date()}},
        $set:{status:'waiting_for_customer',last_activity_at:new Date(),last_customer_update_at:new Date()},
        $unset:{next_update_at:''}},{new:true,runValidators:true}).select('enquiry_id messages status');
      if(!row)return res.status(409).json({success:false,error:'This request does not have a verified private workspace destination.'});
      res.set('Cache-Control','no-store');
      res.json({success:true,quote:{enquiry_id:row.enquiry_id,messages:row.messages,status:row.status}});
    }catch{return res.status(503).json({success:false,error:'Private workspace reply could not be saved.'});}
  });
}
export function quoteReferenceFromMessage(body){
  const match=/\bIPS-Q-[A-F0-9]{18}\b/i.exec(String(body||''));
  return match?match[0].toUpperCase():null;
}
export async function confirmQuoteMessengerContact(event,{model=ContactEnquiry}={}){
  const id=quoteReferenceFromMessage(event?.body);
  if(!id||!['telegram','whatsapp'].includes(event?.channel))return false;
  const filter={enquiry_id:id,request_type:'quote',preferred_channel:event.channel,contact_verified:false};
  if(event.channel==='telegram'){
    if(!event.telegram_username)return false;
    filter.telegram_username=String(event.telegram_username).replace(/^@/,'').trim();
  }else filter.phone='+'+String(event.external_id||'').replace(/^\+/,'');
  const fields={contact_verified:true,verification_status:'verified',contact_verified_at:new Date()};
  if(event.contact_id)fields.contact_thread_id=String(event.contact_id);
  const result=await model.updateOne(filter,{$set:fields,$unset:{purge_at:''}});
  return Boolean(result.modifiedCount);
}
