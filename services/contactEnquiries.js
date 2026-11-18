import crypto from 'node:crypto';
import mongoose from 'mongoose';
import ContactEnquiry from '../models/ContactEnquiry.js';
import { canSendContactEmail,sendEmailReply } from './businessEmailTransport.js';
import { enqueueContactEmailJobs } from './contactEmailQueue.js';
export { canSendContactEmail,sendEmailReply } from './businessEmailTransport.js';

export const PUBLIC_REPLY_METHODS=Object.freeze(['email','phone','whatsapp','telegram']);
const isText=x=>typeof x==='string';
const within=(x,min,max)=>isText(x)&&x.trim().length>=min&&x.trim().length<=max;
export const validEmail=x=>isText(x)&&x.length<=254&&/^[^\s@\x00-\x1f]+@[^\s@\x00-\x1f]+\.[a-zA-Z]{2,}$/i.test(x);
export const validTelephone=x=>isText(x)&&/^\+[1-9][0-9]{7,14}$/.test(x);
export const normalizePhone=x=>isText(x)?x.trim().replace(/[\s().-]/g,''):'';

export function validatePublicEnquiry(data){
  if(!data || typeof data!=='object'||Array.isArray(data))return {error:'An enquiry is required.'};
  const name=String(data.name||'').trim().slice(0,101);
  const email=String(data.email||'').trim().toLowerCase().slice(0,255);
  const phone=normalizePhone(String(data.phone||'').slice(0,40));
  const subject=String(data.subject||'').trim().slice(0,141);
  const message=String(data.message||'').trim().slice(0,3001);
  const method=data.preferred_channel;
  if(!within(name,2,100)||!within(subject,4,140)||!within(message,15,3000))
    return {error:'Provide your name, subject and a clear message (at least 15 characters).'};
  if(!PUBLIC_REPLY_METHODS.includes(method))return {error:'Choose a supported contact method.'};
  if(email&&!validEmail(email))return {error:'Enter a valid email address.'};
  if(phone&&!validTelephone(phone))return {error:'Enter a phone number with a country code such as +48…'};
  if(method==='email'&&!email)return {error:'Email address is required for email replies.'};
  if(['phone','whatsapp'].includes(method)&&!phone)return {error:'Phone number is required for a callback or WhatsApp.'};
  // Bots may not initiate conversations. A phone/email alternative ensures a usable callback.
  if(method==='telegram'&&!email&&!phone)return {error:'Add an email address or telephone number as an alternative to Telegram.'};
  if(data.contact_consent!==true)return {error:'You must consent to be contacted about this enquiry.'};
  if(String(data.website||'').trim())return {error:'We could not process this request.'};
  return {value:{name,email,phone,subject,message,preferred_channel:method,contact_consent:true}};
}

const windowMs=15*60*1000;
const counts=new Map();
const maxKeys=5000;
function requestLimited(req){
  const now=Date.now();
  const key=crypto.createHash('sha256').update(String(req.ip||req.socket?.remoteAddress||'unknown')).digest('hex');
  if(counts.size>=maxKeys){
    for(const [k,record] of counts){if(record.until<=now)counts.delete(k);}
    if(counts.size>=maxKeys)counts.clear(); // never retain IP information long-term
  }
  const existing=counts.get(key);
  const record=!existing||existing.until<=now ? {count:0,until:now+windowMs}:existing;
  record.count++;counts.set(key,record);
  return record.count>4;
}
function matchesOrigin(req){
  const origin=req.get('origin');
  if(!origin)return true; // non-browser clients may omit Origin; rate limits still apply
  try{
    const parsed=new URL(origin);
    return parsed.protocol==='https:'&&parsed.host===req.get('host') ||
      parsed.protocol==='http:'&&/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(parsed.host)&&parsed.host===req.get('host');
  }catch{return false;}
}
const safeBody=s=>String(s||'').trim().slice(0,3000);
const createId=()=> 'ENQ-'+crypto.randomBytes(9).toString('hex').toUpperCase();

export function registerEnquiryRoutes(app,{requireSession}){
  app.get('/api/contact-enquiries/config',(_req,res)=>{
    res.set('Cache-Control','no-store');
    res.json({success:true,accepting_requests:mongoose.connection.readyState===1,email_replies_configured:canSendContactEmail(process.env),
      notice:'An enquiry stores your contact details for an IPS reply. No payment or account is required.'});
  });
  app.post('/api/contact-enquiries',async(req,res)=>{
    if(!matchesOrigin(req))return res.status(403).json({success:false,error:'Submit from the IPS website.'});
    if(mongoose.connection.readyState!==1)return res.status(503).json({success:false,error:'Enquiries are temporarily unavailable. Contact IPS on WhatsApp instead.'});
    if(requestLimited(req))return res.status(429).json({success:false,error:'Too many requests. Please try again later.'});
    const checked=validatePublicEnquiry(req.body);
    if(checked.error)return res.status(400).json({success:false,error:checked.error});
    try{
      // Public enquiries never trust caller-supplied client_id or role.
      const c=checked.value;
      const id=createId(), now=new Date();
      const lead=await ContactEnquiry.create({
        enquiry_id:id,name:c.name,email:c.email,phone:c.phone,
        preferred_channel:c.preferred_channel,subject:c.subject,contact_consent:true,consent_at:now,
        messages:[{direction:'inbound',channel:'website',body:c.message,delivery_status:'received',created_at:now}],
        last_activity_at:now
      });
      // The enquiry is already durable. A mail-provider or outbox failure must
      // not make the client retry and accidentally submit a second enquiry.
      let email_notification='disabled';
      try{
        const result=await enqueueContactEmailJobs(lead);
        email_notification=result.enabled?'queued':'disabled';
      }catch(error){
        email_notification='unavailable';
        console.error('IPS email outbox enqueue failed:',error?.name||'error');
      }
      res.set('Cache-Control','no-store');
      return res.status(201).json({success:true,enquiry_id:id,email_notification,
        message:'Your enquiry was saved by IPS. Keep this reference for follow-up.'});
    }catch(error){console.error('Public enquiry storage failed:',error?.name||'error');return res.status(503).json({success:false,error:'Your enquiry was not saved. Please use WhatsApp instead.'});}
  });
  app.get('/api/contact-enquiries/admin',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='admin')return res.sendStatus(403);
    try{
      const leads=await ContactEnquiry.find().sort({last_activity_at:-1}).limit(120).lean();
      res.set('Cache-Control','no-store');return res.json({success:true,enquiries:leads});
    }catch{return res.status(503).json({success:false,error:'Could not load the enquiry inbox.'});}
  });
  app.patch('/api/contact-enquiries/admin/:id',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='admin')return res.sendStatus(403);
    const status=req.body?.status, note=req.body?.admin_note;
    if(status!==undefined&&!['new','in_progress','waiting_for_customer','closed'].includes(status))
      return res.status(400).json({success:false,error:'Invalid status.'});
    if(note!==undefined&&(!isText(note)||note.length>1600))return res.sendStatus(400);
    if(status===undefined&&note===undefined)return res.sendStatus(400);
    const updates={last_activity_at:new Date()};
    if(status!==undefined)updates.status=status;
    if(note!==undefined)updates.admin_note=note;
    const lead=await ContactEnquiry.findOneAndUpdate({enquiry_id:req.params.id},{$set:updates},{new:true,runValidators:true});
    if(!lead)return res.sendStatus(404);
    res.json({success:true,enquiry:lead});
  });
  app.post('/api/contact-enquiries/admin/:id/email-reply',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='admin')return res.sendStatus(403);
    const body=safeBody(req.body?.message);
    if(body.length<3||body.length>2400)return res.status(400).json({success:false,error:'Reply must contain 3–2400 characters.'});
    if(!canSendContactEmail(process.env))return res.status(503).json({success:false,error:'Verified email delivery has not been configured.'});
    // Reserve a reply slot to avoid accidental double-click / parallel sends.
    const lock=crypto.randomUUID();
    const lead=await ContactEnquiry.findOneAndUpdate({
      enquiry_id:req.params.id,email:{$ne:''},status:{$ne:'closed'},pending_reply:{$exists:false}},
      {$set:{pending_reply:lock}},{new:true});
    if(!lead)return res.status(409).json({success:false,error:'Enquiry unavailable, closed, missing an email, or another reply is being sent.'});
    try{
      const messageId=await sendEmailReply({to:lead.email,subject:lead.subject,body,reference:lead.enquiry_id});
      await ContactEnquiry.updateOne({_id:lead._id,pending_reply:lock},
        {$unset:{pending_reply:''},$set:{status:'waiting_for_customer',last_activity_at:new Date()},
          $push:{messages:{direction:'outbound',channel:'email',body,author:session.id,delivery_status:'sent',provider_id:messageId,created_at:new Date()}}});
      res.json({success:true,message:'Email accepted by the provider.',provider_id:messageId});
    }catch(error){
      await ContactEnquiry.updateOne({_id:lead._id,pending_reply:lock},{$unset:{pending_reply:''}});
      res.status(error.status||502).json({success:false,error:'Reply was not confirmed. Check email provider before retrying.'});
    }
  });
}
