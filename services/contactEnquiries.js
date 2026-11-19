import crypto from 'node:crypto';
import mongoose from 'mongoose';
import ContactEnquiry from '../models/ContactEnquiry.js';
import { canSendContactEmail,sendEmailReply } from './businessEmailTransport.js';
import { enqueueContactEmailJobs } from './contactEmailQueue.js';
import ContactEmailJob from '../models/ContactEmailJob.js';
import {usernameValid,normalizeUsername,normalizeEmail} from '../shared/privacyIdentity.js';
import {verificationAvailable,issueEmailChallenge,confirmEmailChallenge} from './accountVerification.js';
export { canSendContactEmail,sendEmailReply } from './businessEmailTransport.js';

export const PUBLIC_REPLY_METHODS=Object.freeze(['email','whatsapp','telegram']);
const isText=x=>typeof x==='string';
const within=(x,min,max)=>isText(x)&&x.trim().length>=min&&x.trim().length<=max;
export const validEmail=x=>isText(x)&&x.length<=254&&/^[^\s@\x00-\x1f]+@[^\s@\x00-\x1f]+\.[a-zA-Z]{2,}$/i.test(x);
export const validTelephone=x=>isText(x)&&/^\+[1-9][0-9]{7,14}$/.test(x);
export const normalizePhone=x=>isText(x)?x.trim().replace(/[\s().-]/g,''):'';

export function validatePublicEnquiry(data){
  if(!data || typeof data!=='object'||Array.isArray(data))return {error:'An enquiry is required.'};
  const username=normalizeUsername(data.username||data.name||'').slice(0,33);
  const email=normalizeEmail(data.email).slice(0,255);
  const phone=normalizePhone(String(data.phone||'').slice(0,40));
  const subject=String(data.subject||'').trim().slice(0,141);
  const message=String(data.message||'').trim().slice(0,3001);
  const method=data.preferred_channel;
  if(!usernameValid(username)||!within(subject,4,140)||!within(message,15,3000))
    return {error:'Choose a username (3–32 characters), a subject and a clear message.'};
  if(!PUBLIC_REPLY_METHODS.includes(method))return {error:'Choose a supported contact method.'};
  if(email&&!validEmail(email))return {error:'Enter a valid email address.'};
  if(phone&&!validTelephone(phone))return {error:'Enter a phone number with a country code such as +48…'};
  if(method==='email'&&!email)return {error:'Email address is required for email replies.'};
  if(method==='whatsapp'&&!phone)return {error:'A WhatsApp number is required for written WhatsApp messages.'};
  if(method==='telegram'&&!/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(String(data.telegram_username||'').replace(/^@/,'')))return {error:'Enter a Telegram username and start the IPS bot chat.'};
  if(data.contact_consent!==true)return {error:'You must consent to be contacted about this enquiry.'};
  if(String(data.website||'').trim())return {error:'We could not process this request.'};
  return {value:{username,email:method==='email'?email:'',phone:method==='whatsapp'?phone:'',telegram_username:method==='telegram'?String(data.telegram_username).replace(/^@/,'').toLowerCase():'',subject,message,preferred_channel:method,contact_consent:true}};
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
    if(mongoose.connection.readyState!==1)return res.status(503).json({success:false,error:'Written enquiries are temporarily unavailable.'});
    if(requestLimited(req))return res.status(429).json({success:false,error:'Too many requests. Please try again later.'});
    const checked=validatePublicEnquiry(req.body);
    if(checked.error)return res.status(400).json({success:false,error:checked.error});
    if(checked.value.preferred_channel==='email'&&!verificationAvailable())return res.status(503).json({success:false,error:'Verified email enquiries are temporarily unavailable.'});
    try{
      // Public enquiries never trust caller-supplied client_id or role.
      const c=checked.value;
      const id=createId(), now=new Date();
      const lead=await ContactEnquiry.create({
        enquiry_id:id,name:'',username:c.username,email:c.email,phone:c.phone,
        telegram_username:c.telegram_username,request_type:'general',purge_at:new Date(now.getTime()+30*86400000),
        preferred_channel:c.preferred_channel,subject:c.subject,contact_consent:true,consent_at:now,
        contact_verified:false,verification_status:'awaiting_verification',
        messages:[{direction:'inbound',channel:'website',body:c.message,delivery_status:'received',created_at:now}],
        last_activity_at:now
      });
      if(c.preferred_channel==='email'){
        try{await issueEmailChallenge(lead);}
        catch(error){return res.status(503).json({success:false,enquiry_id:id,verification_required:true,
          error:'Enquiry saved, but the verification email failed. Contact IPS with this reference.'});}
      }
      res.set('Cache-Control','no-store');
      return res.status(202).json({success:true,enquiry_id:id,
        verification_required:c.preferred_channel==='email',
        requires_chat_start:c.preferred_channel!=='email',
        message:'Enquiry saved, but IPS needs to verify your selected written contact channel before responding.'});
    }catch(error){console.error('Public enquiry storage failed:',error?.name||'error');return res.status(503).json({success:false,error:'Your enquiry was not saved. Please use WhatsApp instead.'});}
  });
  app.post('/api/contact-enquiries/verify-email',async(req,res)=>{
    const id=String(req.body?.enquiry_id||''),code=String(req.body?.code||'');
    if(!/^ENQ-[A-F0-9]{18}$/.test(id)||!/^\d{8}$/.test(code))
      return res.status(400).json({success:false,error:'Enter a valid enquiry reference and code.'});
    try{
      const lead=await ContactEnquiry.findOne({enquiry_id:id,request_type:'general',preferred_channel:'email',contact_verified:false})
        .select('+verification_hash +verification_expires_at +verification_attempts +verification_sent_at');
      if(!lead)return res.status(400).json({success:false,error:'Verification is unavailable.'});
      const outcome=await confirmEmailChallenge(lead,code);
      if(outcome.error)return res.status(outcome.status).json({success:false,error:outcome.error});
      lead.contact_verified=true;lead.contact_verified_at=new Date();lead.verification_status='verified';lead.purge_at=undefined;
      await lead.save();
      try{await enqueueContactEmailJobs(lead);}catch{}
      res.set('Cache-Control','no-store');
      return res.json({success:true,enquiry_id:id});
    }catch{return res.status(503).json({success:false,error:'Could not verify this request.'});}
  });
  // Lightweight staff attention pulse. Counts are computed from authoritative
  // MongoDB state, not client timers or guessed SLA promises.
  app.get('/api/contact-enquiries/admin/attention',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='admin')return res.sendStatus(403);
    try{
      const now=new Date();
      const [overdue_updates,new_requests,unassigned_requests]=await Promise.all([
        ContactEnquiry.countDocuments({next_update_at:{$lte:now},status:{$in:['new','in_progress']},
          contact_consent:true,contact_verified:true}),
        ContactEnquiry.countDocuments({status:'new',contact_verified:true,contact_consent:true}),
        ContactEnquiry.countDocuments({status:{$in:['new','in_progress']},assigned_admin_id:{$in:['',null]},
          contact_verified:true,contact_consent:true})
      ]);
      res.set('Cache-Control','no-store');
      res.json({success:true,overdue_updates,new_requests,unassigned_requests,as_of:now.toISOString()});
    }catch{return res.status(503).json({success:false,error:'The private review queue could not be checked.'});}
  });
  app.get('/api/contact-enquiries/admin',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='admin')return res.sendStatus(403);
    try{
      const leads=await ContactEnquiry.find().sort({last_activity_at:-1}).limit(120).lean();
      res.set('Cache-Control','no-store');return res.json({success:true,enquiries:leads});
    }catch{return res.status(503).json({success:false,error:'Could not load the enquiry inbox.'});}
  });
  app.post('/api/contact-enquiries/admin/:id/claim',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='admin')return res.sendStatus(403);
    try{
      const now=new Date();
      const lead=await ContactEnquiry.findOneAndUpdate({
        enquiry_id:req.params.id,assigned_admin_id:{$in:['',null]},status:{$in:['new','in_progress']},
        contact_verified:true,contact_consent:true
      },{$set:{assigned_admin_id:session.id,assigned_at:now,status:'in_progress',
        review_started_at:now,last_activity_at:now}},{new:true});
      if(!lead){
        const previous=await ContactEnquiry.findOne({enquiry_id:req.params.id})
          .select('assigned_admin_id').lean();
        if(previous?.assigned_admin_id===session.id)return res.json({success:true,already_assigned:true,enquiry:previous});
        return res.status(409).json({success:false,error:'This enquiry is not verified, has been closed, or is already owned by another reviewer.'});
      }
      res.set('Cache-Control','no-store');
      res.json({success:true,enquiry:lead});
    }catch{return res.status(503).json({success:false,error:'Unable to claim this private review.'});}
  });
  app.patch('/api/contact-enquiries/admin/:id',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='admin')return res.sendStatus(403);
    const status=req.body?.status, note=req.body?.admin_note, next=req.body?.next_update_at;
    if(status!==undefined&&!['new','in_progress','waiting_for_customer','closed'].includes(status))
      return res.status(400).json({success:false,error:'Invalid status.'});
    if(note!==undefined&&(!isText(note)||note.length>1600))return res.sendStatus(400);
    if(status===undefined&&note===undefined&&next===undefined)return res.sendStatus(400);
    const now=new Date(),updates={last_activity_at:now},unset={};
    if(status!==undefined){
      updates.status=status;
      if(status==='in_progress')updates.review_started_at=now;
      if(status==='closed')unset.next_update_at='';
    }
    if(note!==undefined)updates.admin_note=note;
    if(next!==undefined&&status!=='closed'){
      if(next===null||next==='')unset.next_update_at='';
      else {
        const due=typeof next==='string'?new Date(next):new Date(NaN);
        if(!Number.isFinite(due.getTime())||due<=now||due.getTime()>now.getTime()+90*86400000)
          return res.status(400).json({success:false,error:'Choose a future written-update deadline within 90 days.'});
        updates.next_update_at=due;
      }
    }
    const operation={$set:updates};
    if(Object.keys(unset).length)operation.$unset=unset;
    const lead=await ContactEnquiry.findOneAndUpdate({enquiry_id:req.params.id},operation,{new:true,runValidators:true});
    if(!lead)return res.sendStatus(404);
    res.set('Cache-Control','no-store');
    res.json({success:true,enquiry:lead});
  });
  app.get('/api/contact-enquiries/admin/:id/email-status',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='admin')return res.sendStatus(403);
    try{
      const lead=await ContactEnquiry.findOne({enquiry_id:req.params.id}).select('enquiry_id').lean();
      if(!lead)return res.sendStatus(404);
      const jobs=await ContactEmailJob.find({enquiry_id:lead.enquiry_id})
        .select('kind recipient status attempts provider_accepted_at delivery_updated_at last_error')
        .sort({createdAt:1}).lean();
      res.set('Cache-Control','no-store');
      return res.json({success:true,notifications:jobs});
    }catch{
      return res.status(503).json({success:false,error:'Unable to load email delivery statuses.'});
    }
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
      enquiry_id:req.params.id,email:{$ne:''},preferred_channel:'email',contact_verified:true,status:{$ne:'closed'},pending_reply:{$exists:false}},
      {$set:{pending_reply:lock}},{new:true});
    if(!lead)return res.status(409).json({success:false,error:'Enquiry unavailable, closed, missing an email, or another reply is being sent.'});
    try{
      const messageId=await sendEmailReply({to:lead.email,subject:lead.subject,body,reference:lead.enquiry_id});
      await ContactEnquiry.updateOne({_id:lead._id,pending_reply:lock},
        {$unset:{pending_reply:'',next_update_at:''},$set:{status:'waiting_for_customer',last_activity_at:new Date(),last_customer_update_at:new Date()},
          $push:{messages:{direction:'outbound',channel:'email',body,author:session.id,delivery_status:'sent',provider_id:messageId,created_at:new Date()}}});
      res.json({success:true,message:'Email accepted by the provider.',provider_id:messageId});
    }catch(error){
      await ContactEnquiry.updateOne({_id:lead._id,pending_reply:lock},{$unset:{pending_reply:''}});
      res.status(error.status||502).json({success:false,error:'Reply was not confirmed. Check email provider before retrying.'});
    }
  });
}
