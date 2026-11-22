// IPS Academic Services: accessible written contact, privacy-rights requests
// and rejected Specialist appeals without an authenticated account.
// Contact is activated only after verified ownership of the reply email.
import {email,validEmail,strongToken,validToken,publicDocument} from './security.mjs';

export function registerPublicContactRoutes(ctx){
 const {app,db,config,security,throttle,sendEmail,notify,audit,authorize,
  wrap,now,uid,rootEmail}=ctx;
 const kinds={general:'client_relations',specialist_appeal:'specialist_network',
  privacy_request:'governance'};
 const nameFor={general:'General written enquiry',specialist_appeal:'Specialist application appeal',
  privacy_request:'Privacy and data rights request'};
 const permitted=(a,kind)=>!!a&&(a.role==='root'||
  ['manager','staff'].includes(a.role)&&kinds[kind]===a.department);
 const publicView=d=>({id:d.id,category:d.category,subject:d.subject,
  message:d.message,email:d.email,status:d.status,assignedTo:d.assignedTo||'',
  receivedAt:d.receivedAt||null,createdAt:d.createdAt,updatedAt:d.updatedAt,
  ...(d.replies?.length?{replies:d.replies}: {})});
 app.post('/api/public/contact',wrap(async(req,res)=>{
  if(await throttle.limited(req,'academic-public-contact',4))
   return res.status(429).json({error:'Too many requests. Try again after the current verification window.'});
  const mail=email(req.body?.email),category=String(req.body?.category||''),
   subject=String(req.body?.subject||'').trim(),message=String(req.body?.message||'').trim();
  if(!Object.hasOwn(kinds,category)||!validEmail(mail)||subject.length<8||subject.length>150||
   message.length<25||message.length>4500||req.body?.privacyConsent!==true)
   return res.status(400).json({error:'Provide a verifiable reply email, clear written subject, explanation and privacy consent.'});
  if(config.staging&&!config.allowedStagingEmails.includes(mail))
   return res.status(403).json({error:'Provider staging is limited to approved test email identities.'});
  const at=now(),token=strongToken();
  const d={id:uid('IPS-CONT'),category,email:mail,subject,message,
   status:'awaiting_verification',contactVerified:false,assignedTo:'',
   verificationHash:security.digest('public-contact:'+token),
   verificationUntil:new Date(Date.now()+20*60000),privacyConsentAt:at,
   createdAt:at,updatedAt:at,replies:[]};
  await db.publicContacts.insertOne(d);
  try{
   await sendEmail(mail,'Confirm your written IPS Academic Services request',
    'IPS received a written '+nameFor[category].toLowerCase()+
    '. Verify ownership of this email within 20 minutes before IPS staff can review it.\n'+
    'Verification: '+config.origin+'/#contactverify='+token+
    '&email='+encodeURIComponent(mail)+'&ref='+encodeURIComponent(d.id)+
    '\nReference: '+d.id+'\nDo not forward the verification link. IPS does not telephone customers.');
  }catch{
   await db.publicContacts.deleteOne({id:d.id,status:'awaiting_verification'});
   return res.status(503).json({error:'IPS could not issue the required email verification. No contact case was activated.'});
  }
  res.status(202).json({reference:d.id,verificationRequired:true,
   message:'Check your email for a one-use confirmation link. IPS can review and reply only after verification.'});
 }));
 app.post('/api/public/contact/verify',wrap(async(req,res)=>{
  if(await throttle.limited(req,'academic-public-contact-verify',15))
   return res.status(429).json({error:'Too many email verification attempts.'});
  const mail=email(req.body?.email),token=String(req.body?.token||''),
   reference=String(req.body?.reference||'');
  if(!validEmail(mail)||!validToken(token))
   return res.status(400).json({error:'Written contact verification link invalid or expired.'});
  const item=await db.publicContacts.findOneAndUpdate({
   id:reference,email:mail,status:'awaiting_verification',
   verificationHash:security.digest('public-contact:'+token),
   verificationUntil:{$gt:now()}},
   {$set:{contactVerified:true,status:'open',receivedAt:now(),updatedAt:now()},
    $unset:{verificationHash:'',verificationUntil:''}},{returnDocument:'after'});
  if(!item)return res.status(400).json({error:'This IPS contact link was already used or is no longer valid.'});
  const alert='Verified '+nameFor[item.category]+' '+item.id+' requires written IPS review.';
  await notify(rootEmail,alert,item.category==='privacy_request'?'privacy_request':'intake');
  const staff=await db.accounts.find({role:{$in:['manager','staff']},
   department:kinds[item.category],status:'active',verified:true},
   {projection:{id:1}}).toArray();
  for(const person of staff)await notify(person.id,alert,'written_contact');
  await audit({id:'verified_guest',role:'guest'},'academic_public_contact_verified',item.id,
   {category:item.category});
  res.json({verified:true,reference:item.id,
   message:'Your email is verified. IPS will review your written request and respond to the address you provided. No account or phone call is required.'});
 }));
 app.get('/api/administration/public-contacts',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','manager','staff']))return;
  const a=req.actor;
  if(a.role!=='root'&&!Object.values(kinds).includes(a.department))
   return res.status(403).json({error:'This department cannot inspect public written requests.'});
  const category=String(req.query.category||'');
  if(category&&!Object.hasOwn(kinds,category))
   return res.status(400).json({error:'Unknown contact category.'});
  const page=Number(req.query.page||1);
  if(!Number.isSafeInteger(page)||page<1||page>100000)
   return res.status(400).json({error:'Choose an existing page.'});
  const allowed=a.role==='root'?Object.keys(kinds):
   Object.keys(kinds).filter(k=>kinds[k]===a.department);
  if(category&&!allowed.includes(category))
   return res.status(403).json({error:'The requested written case belongs to another IPS department.'});
  const filter={category:{$in:category?[category]:allowed},contactVerified:true};
  const [rows,total]=await Promise.all([
   db.publicContacts.find(filter).sort({receivedAt:-1,id:1})
    .skip((page-1)*50).limit(50).toArray(),
   db.publicContacts.countDocuments(filter)]);
  res.json({cases:rows.map(publicView),total,page,pageSize:50,
   hasNext:page*50<total,hasPrevious:page>1});
 }));
 app.get('/api/administration/public-contacts/:id',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','manager','staff']))return;
  const item=await db.publicContacts.findOne({id:req.params.id,contactVerified:true});
  if(!item)return res.status(404).json({error:'No verified public correspondence matches this reference.'});
  if(!permitted(req.actor,item.category))
   return res.status(403).json({error:'Another company department owns this private written request.'});
  res.json({case:publicView(item)});
 }));
 app.post('/api/administration/public-contacts/:id/claim',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','manager','staff']))return;
  const item=await db.publicContacts.findOne({id:req.params.id,contactVerified:true,status:'open'});
  if(!item)return res.status(404).json({error:'Open verified written contact not found.'});
  if(!permitted(req.actor,item.category))
   return res.status(403).json({error:'You cannot claim another IPS department’s correspondence.'});
  const at=now();
  const claimed=await db.publicContacts.findOneAndUpdate({id:item.id,status:'open',
   $or:[{assignedTo:''},{assignedTo:null},{assignedTo:{$exists:false}}]},
   {$set:{assignedTo:req.actor.id,assignedAt:at,updatedAt:at},
    $push:{history:{action:'claimed',by:req.actor.id,at}}},{returnDocument:'after'});
  if(!claimed)return res.status(409).json({error:'Another IPS employee already claimed this request.'});
  await audit(req.actor,'academic_public_contact_claimed',item.id,{category:item.category});
  res.json({case:publicView(claimed)});
 }));
 app.post('/api/administration/public-contacts/:id/reply',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','manager','staff']))return;
  const item=await db.publicContacts.findOne({id:req.params.id,
   contactVerified:true,status:{$in:['open','replied']}});
  if(!item)return res.status(404).json({error:'Verified public correspondence is not available for reply.'});
  if(!permitted(req.actor,item.category))
   return res.status(403).json({error:'This written request belongs to another IPS department.'});
  if(req.actor.role!=='root'&&item.assignedTo!==req.actor.id)
   return res.status(409).json({error:'Claim this correspondence before replying in the name of IPS.'});
  const answer=String(req.body?.message||'').trim();
  if(answer.length<25||answer.length>2500)
   return res.status(400).json({error:'Write a substantive, respectful written reply between 25 and 2,500 characters.'});
  // The person specifically verified and selected this email for a written reply.
  // Avoid copying confidential academic documents into public email.
  const response=await sendEmail(item.email,'IPS Academic Services — written response '+item.id,
   'IPS Academic Services has responded to your verified written request '+item.id+
   '.\n\n'+answer+
   '\n\nPlease do not send passwords or confidential academic documents by email. IPS does not make phone calls.');
  const at=now();
  await db.publicContacts.updateOne({id:item.id,contactVerified:true},{
   $set:{status:'replied',lastReplyAt:at,updatedAt:at},
   $push:{replies:{id:uid('IPS-REPLY'),by:req.actor.id,message:answer,
    provider:response.provider,providerMessageId:response.id,at}}});
  await audit(req.actor,'academic_public_contact_replied',item.id,{category:item.category});
  res.json({success:true,providerAccepted:true,recipientRead:false});
 }));
}
