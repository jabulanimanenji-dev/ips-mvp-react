// IPS COMPANY — clean-room operating runtime. No imports from legacy IPS services or models.
// Production must use its own MongoDB database; sandbox payments cannot exist in production.
import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const env=process.env;
const sandbox=env.IPS_CLEANROOM_MODE==='sandbox';
const dbName=sandbox?'ips_company_cleanroom_sandbox':'ips_company_2026';
const origin=String(env.PUBLIC_APP_URL||'http://127.0.0.1:8080').replace(/\/$/,'');
if(!env.MONGODB_URI||!env.SESSION_SECRET||env.SESSION_SECRET.length<40)throw Error('New IPS needs isolated MongoDB and a strong session signing secret.');
if(!env.ROOT_EMAIL||!env.ROOT_PASSWORD||env.ROOT_PASSWORD.length<12)throw Error('New IPS needs environment-owned Root Admin credentials.');
if(!sandbox&&(!origin.startsWith('https://')||env.NODE_ENV!=='production'))throw Error('Company production requires verified HTTPS and NODE_ENV=production.');
if(!sandbox&&/^(ips|ips_database|ips_test)/.test(dbName))throw Error('Refusing legacy MongoDB target.');
const app=express();
app.disable('x-powered-by');
if(!sandbox)app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:{directives:{"default-src":["'self'"],"script-src":["'self'"],"style-src":["'self'"],"img-src":["'self'","data:"],"connect-src":["'self'"]}}}));
app.use(express.json({limit:'3mb'}));
app.use((req,res,next)=>{
  if(!['GET','HEAD','OPTIONS'].includes(req.method)){
    const supplied=req.get('origin');
    if(supplied&&supplied!==origin)return res.status(403).json({error:'Foreign origin refused.'});
  }
  res.set('X-IPS-Release','company-cleanroom-v1');
  next();
});
await mongoose.connect(env.MONGODB_URI,{dbName,serverSelectionTimeoutMS:12000});
const db=mongoose.connection.db;
const accounts=db.collection('company_accounts');
const quotes=db.collection('company_quotes');
const projects=db.collection('company_projects');
const tickets=db.collection('company_support');
const messages=db.collection('company_messages');
const files=db.collection('company_files');
const notices=db.collection('company_notifications');
const audit=db.collection('company_audit');
const outgoing=db.collection('company_mail_outbox');
await Promise.all([
 accounts.createIndex({email:1},{unique:true}),
 accounts.createIndex({username_key:1},{unique:true,partialFilterExpression:{username_key:{$type:'string'}}}),
 quotes.createIndex({owner_id:1,created_at:-1}),
 projects.createIndex({client_id:1,created_at:-1}),
 tickets.createIndex({owner_id:1,created_at:-1}),
 messages.createIndex({project_id:1,created_at:1}),
 files.createIndex({project_id:1}),
 notices.createIndex({account_id:1,created_at:-1}),
 audit.createIndex({at:-1})
]);
const now=()=>new Date();
const uid=prefix=>prefix+'-'+crypto.randomBytes(9).toString('hex').toUpperCase();
const mail=x=>String(x||'').trim().toLowerCase();
const validEmail=x=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)&&x.length<=254;
const validPass=x=>typeof x==='string'&&x.length>=8&&x.length<=128&&/[A-Z]/.test(x)&&/[0-9]/.test(x)&&/[^A-Za-z0-9]/.test(x);
const passHash=x=>{const salt=crypto.randomBytes(16).toString('hex');return 'scrypt$'+salt+'$'+crypto.scryptSync(x,salt,64).toString('hex');};
const passMatch=(x,s)=>{if(typeof s!=='string'||!s.startsWith('scrypt$'))return false;const [alg,salt,hash]=s.split('$');if(alg!=='scrypt'||!/^[0-9a-f]{32}$/.test(salt)||!/^[0-9a-f]{128}$/.test(hash))return false;const actual=crypto.scryptSync(String(x),salt,64);return crypto.timingSafeEqual(actual,Buffer.from(hash,'hex'));};
const digest=x=>crypto.createHmac('sha256',env.SESSION_SECRET).update(x).digest('hex');
const cleanAccount=a=>a?({id:a.id,role:a.role,username:a.username||'',name:a.name||'',email:a.email,verified:!!a.verified,approved:!!a.approved,status:a.status,department:a.department||'',manager_id:a.manager_id||''}):null;
const scrub=d=>{const o={...d};delete o._id;delete o.pass_hash;delete o.verify_hash;delete o.reset_hash;delete o.token_hash;delete o.file_buffer;return o;};
const run=async(fn,res)=>{try{await fn()}catch(e){console.error('IPS operation failed:',e?.name||'Error');if(!res.headersSent)res.status(500).json({error:'The company could not complete this operation.'});}};
const event=async(actor,action,ref)=>audit.insertOne({at:now(),actor:actor?.id||'system',role:actor?.role||'system',action,ref:String(ref||'')});
const notify=async(accountId,text,kind='work')=>{if(accountId)await notices.insertOne({id:uid('NT'),account_id:accountId,kind,text,read:false,created_at:now()})};
const rootEmail=mail(env.ROOT_EMAIL);
async function sendEmail(to,subject,text){
 if(sandbox){await outgoing.insertOne({to,subject,text,created_at:now()});return;}
 if(!env.RESEND_API_KEY||!env.FROM_EMAIL)throw Error('Production email delivery not configured.');
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:env.FROM_EMAIL,to:[to],subject,text}),signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('Email provider refused request');
}
const sign=payload=>{const body=Buffer.from(JSON.stringify({...payload,exp:Date.now()+12*3600000})).toString('base64url');return body+'.'+crypto.createHmac('sha256',env.SESSION_SECRET).update(body).digest('base64url')};
const cookie=(res,token)=>res.set('Set-Cookie','ips_company_session='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200'+(sandbox?'':'; Secure'));
const clear=(res)=>res.set('Set-Cookie','ips_company_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'+(sandbox?'':'; Secure'));
async function identity(req){
 const v=(req.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('ips_company_session='))?.slice(20);
 if(!v)return null;const [body,sig]=v.split('.');if(!body||!sig)return null;
 const expected=crypto.createHmac('sha256',env.SESSION_SECRET).update(body).digest('base64url');
 if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;
 let payload;try{payload=JSON.parse(Buffer.from(body,'base64url').toString())}catch{return null}
 if(!payload?.exp||payload.exp<Date.now())return null;
 if(payload.role==='root')return payload.id===rootEmail?{id:rootEmail,role:'root',name:'Nyoro',status:'active',verified:true,approved:true}:null;
 const a=await accounts.findOne({id:payload.id});
 if(!a||a.session_version!==payload.version||a.status!=='active'||!a.verified||(!['client','specialist','manager','staff'].includes(a.role)))return null;
 if(a.role==='specialist'&&!a.approved)return null;
 return cleanAccount(a);
}
app.use('/api',async(req,res,next)=>{if(req.path==='/health')return next();try{req.actor=await identity(req);next()}catch{res.status(503).json({error:'Account access temporarily unavailable.'})}});
const deny=(res,status=403)=>res.status(status).json({error:status===401?'Sign in to IPS first.':'You are not authorized for this company action.'});
const requires=(req,res,roles)=>{if(!req.actor){deny(res,401);return false}if(!roles.includes(req.actor.role)){deny(res);return false}return true};
const leader=a=>a?.role==='root'||a?.role==='manager';
const clientOf=(a,p)=>a?.role==='client'&&a.id===p.client_id;
const specialistOf=(a,p)=>a?.role==='specialist'&&a.id===p.specialist_id;
const projectAccess=(a,p)=>!!a&&(a.role==='root'||clientOf(a,p)||specialistOf(a,p)||(['manager','staff'].includes(a.role)&&['delivery','quality'].includes(a.department)));
const requireAdmin=(req,res)=>requires(req,res,['root','manager','staff']);
const publicAccountFields={_id:0,pass_hash:0,verify_hash:0,reset_hash:0,verify_until:0,reset_until:0};
const throttle=new Map();
function limited(req,res,key,limit=12){const id=(req.ip||'remote')+'|'+key;const time=Date.now(),old=throttle.get(id),b=old&&old.until>time?old:{n:0,until:time+900000};b.n++;throttle.set(id,b);if(throttle.size>5000)for(const [k,v] of throttle)if(v.until<time)throttle.delete(k);if(b.n>limit){res.status(429).json({error:'Too many requests. Try again later.'});return true}return false;}
app.get('/api/health',async(req,res)=>res.json({ready:mongoose.connection.readyState===1,product:'IPS COMPANY',release:'cleanroom-v1',environment:sandbox?'ISOLATED_EVALUATION':'PRODUCTION',payments:'disabled',database:mongoose.connection.readyState===1?'connected':'unavailable'}));
app.post('/api/auth/signup',async(req,res)=>run(async()=>{
 if(limited(req,res,'signup',6))return;
 const role=String(req.body?.role||''),username=String(req.body?.username||'').trim(),name=String(req.body?.full_name||'').trim(),email=mail(req.body?.email),password=String(req.body?.password||'');
 if(!['client','specialist'].includes(role)||!validEmail(email)||!validPass(password)||!req.body?.privacy_consent)return res.status(400).json({error:'Enter a valid email, strong password, and privacy consent.'});
 if(role==='client'&&!/^[a-zA-Z0-9_.-]{3,32}$/.test(username))return res.status(400).json({error:'Use a private username of 3–32 letters, numbers, dots, dashes or underscores.'});
 if(role==='specialist'&&(name.length<3||name.length>120))return res.status(400).json({error:'Specialists must provide their full professional name.'});
 if(email===rootEmail||await accounts.findOne({$or:[{email},...(role==='client'?[{username_key:username.toLowerCase()}]:[])]}))return res.status(409).json({error:'This email or username already belongs to an IPS account.'});
 const token=crypto.randomBytes(32).toString('base64url'),account={id:uid('ACC'),role,email,username:role==='client'?username:'',username_key:role==='client'?username.toLowerCase():undefined,name:role==='specialist'?name:'',pass_hash:passHash(password),verified:false,approved:false,status:'pending',department:'',manager_id:'',verify_hash:digest('verify:'+token),verify_until:new Date(Date.now()+20*60000),session_version:1,created_at:now()};
 await accounts.insertOne(account);
 try{await sendEmail(email,'Verify your IPS account','Open the private one-use link (20 minutes): '+origin+'/#verify='+encodeURIComponent(token)+'&email='+encodeURIComponent(email)+'\n\nNo staff member can verify your mailbox for you.');}
 catch{await accounts.deleteOne({id:account.id,verified:false});return res.status(503).json({error:'Verification email could not be sent. No account was activated.'})}
 await event(account,'account_registration',role);
 res.status(202).json({success:true,verification_required:true});
},res));
app.post('/api/auth/verify',async(req,res)=>run(async()=>{
 if(limited(req,res,'verify',12))return;
 const email=mail(req.body?.email),token=String(req.body?.token||'');
 if(!validEmail(email)||!/^[a-zA-Z0-9_-]{43}$/.test(token))return res.status(400).json({error:'Invalid verification link.'});
 const a=await accounts.findOneAndUpdate({email,verified:false,verify_hash:digest('verify:'+token),verify_until:{$gt:now()}},{$set:{verified:true,status:'active'},$unset:{verify_hash:'',verify_until:''}},{returnDocument:'after'});
 if(!a)return res.status(400).json({error:'Verification link expired or already used.'});
 await event(a,'mailbox_verified',a.id);
 if(a.role==='specialist')return res.json({success:true,review_required:true});
 cookie(res,sign({id:a.id,role:a.role,version:a.session_version}));
 res.json({success:true,account:cleanAccount(a)});
},res));
app.post('/api/auth/login',async(req,res)=>run(async()=>{
 if(limited(req,res,'login',12))return;
 const email=mail(req.body?.email),password=String(req.body?.password||'');
 if(email===rootEmail&&crypto.timingSafeEqual(Buffer.from(digest(password)),Buffer.from(digest(env.ROOT_PASSWORD)))){
   cookie(res,sign({id:rootEmail,role:'root',version:1}));await event({id:rootEmail,role:'root'},'root_signin');return res.json({success:true,account:{id:rootEmail,role:'root',name:'Nyoro',verified:true}});
 }
 const a=await accounts.findOne({email});
 if(!a||!passMatch(password,a.pass_hash))return res.status(401).json({error:'Invalid sign-in credentials.'});
 if(!a.verified)return res.status(403).json({error:'Verify your mailbox before signing in.'});
 if(a.role==='specialist'&&!a.approved)return res.status(403).json({error:'IPS has not yet approved this specialist.'});
 if(a.status!=='active')return res.status(403).json({error:'This account is not active.'});
 cookie(res,sign({id:a.id,role:a.role,version:a.session_version}));await event(a,'account_signin',a.id);
 res.json({success:true,account:cleanAccount(a)});
},res));
app.post('/api/auth/logout',(req,res)=>{clear(res);res.json({success:true})});
app.get('/api/me',(req,res)=>req.actor?res.json({account:req.actor}):deny(res,401));
app.post('/api/auth/recovery/request',async(req,res)=>run(async()=>{
 if(limited(req,res,'reset',8))return;
 const email=mail(req.body?.email);if(!validEmail(email))return res.json({accepted:true});
 const a=await accounts.findOne({email,verified:true,status:'active'});
 if(a){const token=crypto.randomBytes(32).toString('base64url');const hash=digest('reset:'+token);
  await accounts.updateOne({id:a.id},{$set:{reset_hash:hash,reset_until:new Date(Date.now()+20*60000)}});
  try{await sendEmail(email,'Reset your IPS password','Use this private one-time link (20 minutes): '+origin+'/#reset='+encodeURIComponent(token)+'&email='+encodeURIComponent(email));}
  catch{await accounts.updateOne({id:a.id,reset_hash:hash},{$unset:{reset_hash:'',reset_until:''}});}
 }
 res.status(202).json({accepted:true,message:'If the verified account exists, a private recovery link will be emailed.'});
},res));
app.post('/api/auth/recovery/complete',async(req,res)=>run(async()=>{
 const email=mail(req.body?.email),token=String(req.body?.token||''),password=String(req.body?.password||'');
 if(!validPass(password)||!/^[A-Za-z0-9_-]{43}$/.test(token))return res.status(400).json({error:'Invalid reset link or password.'});
 const a=await accounts.findOneAndUpdate({email,verified:true,status:'active',reset_hash:digest('reset:'+token),reset_until:{$gt:now()}},{$set:{pass_hash:passHash(password)},$inc:{session_version:1},$unset:{reset_hash:'',reset_until:''}},{returnDocument:'after'});
 if(!a)return res.status(400).json({error:'Reset link expired or already used.'});
 await event(a,'password_recovery',a.id);
 if(a.role==='specialist'&&!a.approved)return res.json({success:true,approved:false});
 cookie(res,sign({id:a.id,role:a.role,version:a.session_version}));res.json({success:true,account:cleanAccount(a)});
},res));
app.get('/api/people',async(req,res)=>run(async()=>{
 if(!requireAdmin(req,res))return;
 const actor=req.actor;
 if(actor.role==='staff'&&!['client_relations','specialists'].includes(actor.department))return deny(res);
 if(actor.role==='manager'&&!['client_relations','specialists','governance'].includes(actor.department)){
   const own=await accounts.find({$or:[{id:actor.id},{manager_id:actor.id}]},{projection:publicAccountFields}).limit(100).toArray();
   return res.json({people:own.map(scrub)});
 }
 const filter=actor.role==='root'?{}:actor.role==='manager'?{$or:[{id:actor.id},{manager_id:actor.id},{role:'client'},{role:'specialist'}]}:actor.department==='client_relations'?{role:'client'}:{role:'specialist'};
 const rows=await accounts.find(filter,{projection:publicAccountFields}).limit(500).toArray();
 res.json({people:rows.map(scrub)});
},res));
app.post('/api/people/invite',async(req,res)=>run(async()=>{
 if(!requires(req,res,['root','manager']))return;
 const role=req.actor.role==='root'?'manager':'staff',email=mail(req.body?.email),name=String(req.body?.name||'').trim(),department=req.actor.role==='root'?String(req.body?.department||''):req.actor.department;
 const departments=['client_relations','delivery','specialists','communications','quality','finance','governance'];
 if(!validEmail(email)||name.length<3||!departments.includes(department)||await accounts.findOne({email}))return res.status(400).json({error:'A valid new employee, department and email are required.'});
 const token=crypto.randomBytes(32).toString('base64url');
 const a={id:uid('EMP'),role,email,name,verified:false,approved:true,status:'invited',department,manager_id:role==='staff'?req.actor.id:'',verify_hash:digest('invite:'+token),verify_until:new Date(Date.now()+24*3600000),session_version:1,created_at:now()};
 await accounts.insertOne(a);
 try{await sendEmail(email,'IPS private company invitation','IPS invited you as '+role+'. Set your own password using this link (24 hours): '+origin+'/#invite='+encodeURIComponent(token)+'&email='+encodeURIComponent(email));}
 catch{await accounts.deleteOne({id:a.id,status:'invited'});return res.status(503).json({error:'Invitation delivery failed.'})}
 await event(req.actor,'employee_invited',a.id);res.status(201).json({success:true,role,account:cleanAccount(a)});
},res));
app.post('/api/people/accept',async(req,res)=>run(async()=>{
 const email=mail(req.body?.email),token=String(req.body?.token||''),password=String(req.body?.password||'');
 if(!validPass(password)||!/^[A-Za-z0-9_-]{43}$/.test(token))return res.status(400).json({error:'Invalid invitation or password.'});
 const a=await accounts.findOneAndUpdate({email,status:'invited',verify_hash:digest('invite:'+token),verify_until:{$gt:now()}},{$set:{verified:true,status:'active',pass_hash:passHash(password)},$unset:{verify_hash:'',verify_until:''}},{returnDocument:'after'});
 if(!a)return res.status(400).json({error:'Invitation expired or was already used.'});
 cookie(res,sign({id:a.id,role:a.role,version:a.session_version}));await event(a,'employee_joined',a.id);res.json({success:true,account:cleanAccount(a)});
},res));
app.post('/api/people/:id/review',async(req,res)=>run(async()=>{
 if(!requires(req,res,['root','manager']))return;
 const target=await accounts.findOne({id:req.params.id});
 if(!target)return res.status(404).json({error:'Account not found.'});
 const action=String(req.body?.action||'');
 if(action==='approve'&&target.role==='specialist'&&(req.actor.role==='root'||req.actor.department==='specialists')){
   const updated=await accounts.updateOne({id:target.id,verified:true,status:'active'},{$set:{approved:true}});
   if(!updated.matchedCount)return res.status(409).json({error:'Specialist must verify email and be active before approval.'});
 }else if(action==='suspend'&&(req.actor.role==='root'||(req.actor.role==='manager'&&target.role==='staff'&&target.manager_id===req.actor.id))){
   await accounts.updateOne({id:target.id},{$set:{status:'suspended'},$inc:{session_version:1}});
 }else if(action==='reactivate'&&(req.actor.role==='root'||(req.actor.role==='manager'&&target.role==='staff'&&target.manager_id===req.actor.id))){
   await accounts.updateOne({id:target.id,verified:true},{$set:{status:'active'}});
 }else return deny(res);
 await event(req.actor,'account_'+action,target.id);res.json({success:true});
},res));
// Administrators can request a recovery email, but cannot select passwords
// or inspect recovery tokens. Only Root, and a manager over their direct staff,
// may initiate this action.
app.post('/api/people/:id/send-reset',async(req,res)=>run(async()=>{
 if(!requireAdmin(req,res))return;
 const target=await accounts.findOne({id:req.params.id,verified:true,status:'active'});
 if(!target)return res.status(404).json({error:'Verified active account not found.'});
 const actor=req.actor;
 const allowed=actor.role==='root'
   ||(actor.role==='manager'&&target.role==='staff'&&target.manager_id===actor.id)
   ||(['manager','staff'].includes(actor.role)&&(
      (actor.department==='client_relations'&&target.role==='client')||
      (actor.department==='specialists'&&target.role==='specialist')
   ));
 if(!allowed)return deny(res);
 const token=crypto.randomBytes(32).toString('base64url'),hash=digest('reset:'+token);
 await accounts.updateOne({id:target.id},{$set:{reset_hash:hash,reset_until:new Date(Date.now()+20*60000)}});
 try{await sendEmail(target.email,'Private IPS password assistance','An authorized IPS administrator requested a secure recovery link for your account. If this was not requested by you, ignore it. Link expires in 20 minutes: '+origin+'/#reset='+encodeURIComponent(token)+'&email='+encodeURIComponent(target.email))}
 catch{await accounts.updateOne({id:target.id,reset_hash:hash},{$unset:{reset_hash:'',reset_until:''}});return res.status(503).json({error:'Password recovery delivery unavailable.'})}
 await event(req.actor,'recovery_assistance_sent',target.id);res.status(202).json({success:true});
},res));
app.post('/api/quotes',async(req,res)=>run(async()=>{
 if(!requires(req,res,['client']))return;
 const summary=String(req.body?.summary||'').trim(),service=String(req.body?.service||'').trim(),deadline=String(req.body?.deadline||'').trim();
 if(summary.length<20||summary.length>5000||service.length<3||service.length>100)return res.status(400).json({error:'Describe your needs and requested service clearly.'});
 const quote={id:uid('Q'),owner_id:req.actor.id,username:req.actor.username,service,summary,deadline,status:'new',amount_minor:null,currency:'PLN',created_at:now(),updated_at:now()};
 await quotes.insertOne(quote);await event(req.actor,'quote_requested',quote.id);await notify(rootEmail,'New private quotation '+quote.id,'intake');
 res.status(201).json({quote:scrub(quote)});
},res));
// A guest can request a written quote using only a pseudonym and a mailbox
// that they themselves confirm. Work and payment still require a verified account.
app.post('/api/guest-quotes',async(req,res)=>run(async()=>{
 if(limited(req,res,'guest_quote',5))return;
 const username=String(req.body?.username||'').trim(),email=mail(req.body?.email),
 service=String(req.body?.service||'').trim(),summary=String(req.body?.summary||'').trim();
 if(!/^[A-Za-z0-9_.-]{3,32}$/.test(username)||!validEmail(email)||service.length<3||service.length>100||summary.length<20||summary.length>5000||req.body?.privacy_consent!==true)
   return res.status(400).json({error:'Provide a private username, verifiable email, clear requirements and consent.'});
 const token=crypto.randomBytes(32).toString('base64url');
 const quote={id:uid('Q'),owner_id:'',username,contact_email:email,service,summary,contact_channel:'email',status:'awaiting_email_proof',
   verify_hash:digest('guest:'+token),verify_until:new Date(Date.now()+20*60000),
   amount_minor:null,currency:'PLN',created_at:now(),updated_at:now()};
 await quotes.insertOne(quote);
 try{await sendEmail(email,'Verify your private IPS quote request','Verify this request within 20 minutes: '+origin+'/#guestverify='+encodeURIComponent(token)+'&email='+encodeURIComponent(email)+'&quote='+encodeURIComponent(quote.id));}
 catch{await quotes.deleteOne({id:quote.id,status:'awaiting_email_proof'});return res.status(503).json({error:'Quote verification email unavailable.'})}
 await event({id:'guest',role:'guest'},'guest_quote_submitted',quote.id);
 res.status(202).json({success:true,quote_id:quote.id,verification_required:true});
},res));
app.post('/api/guest-quotes/verify',async(req,res)=>run(async()=>{
 if(limited(req,res,'guest_verify',10))return;
 const email=mail(req.body?.email),token=String(req.body?.token||''),id=String(req.body?.quote_id||'');
 if(!validEmail(email)||!/^[A-Za-z0-9_-]{43}$/.test(token))return res.status(400).json({error:'Invalid verification.'});
 const q=await quotes.findOneAndUpdate({id,contact_email:email,status:'awaiting_email_proof',verify_hash:digest('guest:'+token),verify_until:{$gt:now()}},
  {$set:{status:'new',contact_verified:true,updated_at:now()},$unset:{verify_hash:'',verify_until:''}},{returnDocument:'after'});
 if(!q)return res.status(400).json({error:'Verification link expired or already used.'});
 await notify(rootEmail,'A verified guest quote needs a written reply '+q.id,'intake');
 await event({id:'guest',role:'guest'},'guest_quote_verified',q.id);
 res.json({success:true,quote_id:q.id});
},res));
app.post('/api/guest-quotes/claim',async(req,res)=>run(async()=>{
 if(!requires(req,res,['client']))return;
 const q=await quotes.findOneAndUpdate({id:String(req.body?.quote_id||''),contact_email:req.actor.email,contact_verified:true,owner_id:''},
  {$set:{owner_id:req.actor.id,updated_at:now()}},{returnDocument:'after'});
 if(!q)return res.status(404).json({error:'No verified quote for this account email and reference.'});
 await event(req.actor,'guest_quote_claimed',q.id);res.json({success:true,quote:scrub(q)});
},res));
app.get('/api/quotes',async(req,res)=>run(async()=>{
 if(!req.actor)return deny(res,401);
 const filter=req.actor.role==='client'?{owner_id:req.actor.id}:['root','manager','staff'].includes(req.actor.role)?{}:{id:'none'};
 if(req.actor.role==='manager'&&!['client_relations','delivery'].includes(req.actor.department))return deny(res);
 if(req.actor.role==='staff'&&req.actor.department!=='client_relations')return deny(res);
 res.json({quotes:(await quotes.find(filter,{projection:{_id:0}}).sort({created_at:-1}).limit(100).toArray())});
},res));
app.post('/api/quotes/:id/offer',async(req,res)=>run(async()=>{
 if(!requires(req,res,['root','manager']))return;
 if(req.actor.role==='manager'&&req.actor.department!=='client_relations')return deny(res);
 const amount=Number(req.body?.amount_minor),notes=String(req.body?.notes||'').trim();
 if(!Number.isSafeInteger(amount)||amount<=0||amount>100000000||notes.length>2000)return res.status(400).json({error:'Enter a valid written quotation amount in minor PLN units.'});
 const q=await quotes.findOneAndUpdate({id:req.params.id,status:'new'},{$set:{status:'offered',amount_minor:amount,notes,reviewed_by:req.actor.id,updated_at:now()}},{returnDocument:'after'});
 if(!q)return res.status(409).json({error:'Quotation is no longer waiting for a response.'});
 if(q.contact_email){try{await sendEmail(q.contact_email,'Your private IPS quotation '+q.id,'IPS has reviewed your request '+q.id+'. Written amount: '+(q.amount_minor/100)+' PLN. '+q.notes+'\n\nCreate a verified IPS client account using this same email and claim quote '+q.id+' to proceed securely. No payment is currently collected.');}
 catch{await quotes.updateOne({id:q.id,status:'offered'},{$set:{status:'delivery_retry',updated_at:now()}});return res.status(503).json({error:'Quotation email delivery failed; the case is held for retry.'})}}
 await notify(q.owner_id,'IPS has issued your private quotation '+q.id);await event(req.actor,'quote_offered',q.id);
 res.json({quote:scrub(q)});
},res));
app.post('/api/quotes/:id/accept',async(req,res)=>run(async()=>{
 if(!requires(req,res,['client']))return;
 const q=await quotes.findOneAndUpdate({id:req.params.id,owner_id:req.actor.id,status:'offered'},{$set:{status:'accepted',updated_at:now()}},{returnDocument:'after'});
 if(!q)return res.status(409).json({error:'Quotation is not awaiting your acceptance.'});
 const p={id:uid('PR'),quote_id:q.id,client_id:q.owner_id,specialist_id:'',service:q.service,summary:q.summary,amount_minor:q.amount_minor,currency:q.currency,status:'awaiting_payment',payment_status:'pending',revisions:0,created_at:now(),updated_at:now()};
 await projects.insertOne(p);await event(req.actor,'quote_accepted',q.id);await notify(rootEmail,'Approved quote awaiting verified payment: '+q.id,'finance');
 res.json({project:scrub(p),payments_enabled:false});
},res));
const safeProject=p=>scrub(p);
app.get('/api/projects',async(req,res)=>run(async()=>{
 if(!req.actor)return deny(res,401);
 let filter={};
 if(req.actor.role==='client')filter={client_id:req.actor.id};
 if(req.actor.role==='specialist')filter={specialist_id:req.actor.id};
 if(['manager','staff'].includes(req.actor.role)&&!['delivery','quality','client_relations'].includes(req.actor.department))return deny(res);
 res.json({projects:(await projects.find(filter,{projection:{_id:0}}).sort({created_at:-1}).limit(100).toArray()).map(safeProject)});
},res));
app.post('/api/projects/:id/assign',async(req,res)=>run(async()=>{
 if(!requireAdmin(req,res)||!leader(req.actor))return;
 if(req.actor.role==='manager'&&req.actor.department!=='delivery')return deny(res);
 const specialist=await accounts.findOne({id:String(req.body?.specialist_id||''),role:'specialist',status:'active',approved:true,verified:true});
 if(!specialist)return res.status(400).json({error:'Choose a verified approved active IPS specialist.'});
 const p=await projects.findOneAndUpdate({id:req.params.id,status:'awaiting_assignment',payment_status:'paid'},{$set:{status:'assigned',specialist_id:specialist.id,updated_at:now()}},{returnDocument:'after'});
 if(!p)return res.status(409).json({error:'Project is not paid and ready for assignment.'});
 await notify(specialist.id,'IPS assigned you project '+p.id);await notify(p.client_id,'A specialist has been assigned to your project '+p.id);
 await event(req.actor,'project_assigned',p.id);res.json({project:safeProject(p)});
},res));
app.post('/api/projects/:id/deliver',async(req,res)=>run(async()=>{
 if(!requires(req,res,['specialist']))return;
 const p=await projects.findOne({id:req.params.id,specialist_id:req.actor.id,status:{$in:['assigned','revision_requested']}});
 if(!p)return res.status(409).json({error:'No active assigned delivery is available.'});
 const name=String(req.body?.filename||'').replace(/[^\w.-]/g,'_').slice(0,100),mime=String(req.body?.mime||''),content=String(req.body?.data||'');
 if(!/^[\w.-]{1,100}$/.test(name)||!['application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(mime)||content.length>1400000||!/^[A-Za-z0-9+/]+={0,2}$/.test(content))return res.status(400).json({error:'Upload a valid PDF, DOCX or text file within 1 MB.'});
 const bytes=Buffer.from(content,'base64');if(!bytes.length||bytes.length>1048576)return res.status(400).json({error:'File size is invalid.'});
 const id=uid('FILE');
 await files.insertOne({id,project_id:p.id,owner_id:p.client_id,filename:name,mime,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),file_buffer:bytes,version:p.revisions+1,created_at:now()});
 const changed=await projects.updateOne({id:p.id,status:p.status},{$set:{status:'qa_pending',pending_file_id:id,updated_at:now()}});
 if(!changed.modifiedCount){await files.deleteOne({id});return res.status(409).json({error:'The project changed while uploading.'})}
 await event(req.actor,'deliverable_submitted',p.id);await notify(rootEmail,'Quality review needed for '+p.id,'quality');res.json({success:true,file_id:id,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
},res));
app.post('/api/projects/:id/quality',async(req,res)=>run(async()=>{
 if(!requireAdmin(req,res))return;
 if(req.actor.role!=='root'&&req.actor.department!=='quality')return deny(res);
 const decision=String(req.body?.decision||'');
 if(!['approve','reject'].includes(decision))return res.status(400).json({error:'Select approve or reject.'});
 const p=await projects.findOneAndUpdate({id:req.params.id,status:'qa_pending'},{$set:{status:decision==='approve'?'delivered':'revision_requested',updated_at:now()}},{returnDocument:'after'});
 if(!p)return res.status(409).json({error:'Project does not await quality review.'});
 await event(req.actor,'quality_'+decision,p.id);await notify(decision==='approve'?p.client_id:p.specialist_id,'Quality '+decision+' for project '+p.id,'quality');
 res.json({project:safeProject(p)});
},res));
app.post('/api/projects/:id/client-action',async(req,res)=>run(async()=>{
 if(!requires(req,res,['client']))return;
 const action=String(req.body?.action||'');
 if(!['accept','revision'].includes(action))return res.status(400).json({error:'Choose acceptance or revision.'});
 const status=action==='accept'?'completed':'revision_requested';
 const p=await projects.findOneAndUpdate({id:req.params.id,client_id:req.actor.id,status:'delivered'},{$set:{status,updated_at:now()},$inc:{revisions:action==='revision'?1:0}},{returnDocument:'after'});
 if(!p)return res.status(409).json({error:'Project is not awaiting client review.'});
 await event(req.actor,'client_'+action,p.id);await notify(p.specialist_id,'Client '+action+' on project '+p.id);res.json({project:safeProject(p)});
},res));
app.get('/api/files/:id',async(req,res)=>run(async()=>{
 if(!req.actor)return deny(res,401);
 const f=await files.findOne({id:req.params.id});if(!f)return res.status(404).json({error:'File not found.'});
 const p=await projects.findOne({id:f.project_id});if(!p||!projectAccess(req.actor,p))return deny(res);
 if(clientOf(req.actor,p)&&!['delivered','completed'].includes(p.status))return deny(res);
 res.set({'Content-Type':f.mime,'Content-Disposition':'attachment; filename="'+f.filename+'"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-File-SHA256':f.sha256});
 res.send(Buffer.from(f.file_buffer?.buffer||f.file_buffer));
},res));
app.get('/api/projects/:id/messages',async(req,res)=>run(async()=>{
 const p=await projects.findOne({id:req.params.id});if(!p||!projectAccess(req.actor,p))return deny(res);
 res.json({messages:await messages.find({project_id:p.id},{projection:{_id:0}}).sort({created_at:1}).limit(250).toArray()});
},res));
app.post('/api/projects/:id/messages',async(req,res)=>run(async()=>{
 const p=await projects.findOne({id:req.params.id});if(!p||!projectAccess(req.actor,p))return deny(res);
 const body=String(req.body?.body||'').trim();if(body.length<1||body.length>3000)return res.status(400).json({error:'Message must be 1–3000 characters.'});
 const m={id:uid('MSG'),project_id:p.id,sender_id:req.actor.id,sender_role:req.actor.role,body,created_at:now()};
 await messages.insertOne(m);await notify(req.actor.id===p.client_id?p.specialist_id:p.client_id,'New private project message '+p.id);
 await event(req.actor,'private_message_sent',p.id);res.status(201).json({message:m});
},res));
app.post('/api/support',async(req,res)=>run(async()=>{
 if(!requires(req,res,['client','specialist']))return;
 const subject=String(req.body?.subject||'').trim(),body=String(req.body?.body||'').trim();
 if(subject.length<4||body.length<10||body.length>5000)return res.status(400).json({error:'Provide a subject and a meaningful written message.'});
 const t={id:uid('SUP'),owner_id:req.actor.id,owner_role:req.actor.role,subject,status:'open',assigned_to:'',created_at:now(),updated_at:now(),replies:[{actor:req.actor.id,role:req.actor.role,body,at:now()}]};
 await tickets.insertOne(t);await event(req.actor,'support_opened',t.id);await notify(rootEmail,'Support case requires ownership '+t.id,'support');res.status(201).json({ticket:scrub(t)});
},res));
app.get('/api/support',async(req,res)=>run(async()=>{
 if(!req.actor)return deny(res,401);
 const filter=['client','specialist'].includes(req.actor.role)?{owner_id:req.actor.id}:req.actor.role==='root'?{}:req.actor.department==='client_relations'?{}:{id:'none'};
 res.json({tickets:(await tickets.find(filter,{projection:{_id:0}}).sort({updated_at:-1}).limit(100).toArray())});
},res));
app.post('/api/support/:id/reply',async(req,res)=>run(async()=>{
 if(!req.actor)return deny(res,401);
 const t=await tickets.findOne({id:req.params.id});if(!t)return res.status(404).json({error:'Support case not found.'});
 const actor=req.actor;
 if(!(actor.id===t.owner_id||actor.role==='root'||(['manager','staff'].includes(actor.role)&&actor.department==='client_relations')))return deny(res);
 const body=String(req.body?.body||'').trim();if(body.length<1||body.length>3000)return res.status(400).json({error:'Write a short response.'});
 if(t.status==='closed')return res.status(409).json({error:'Closed support cases cannot receive messages.'});
 const update={$push:{replies:{actor:actor.id,role:actor.role,body,at:now()}},$set:{updated_at:now()}};
 if(actor.role==='root'||actor.department==='client_relations')update.$set.assigned_to=actor.id;
 await tickets.updateOne({id:t.id,status:{$ne:'closed'}},update);
 await notify(actor.id===t.owner_id?t.assigned_to:t.owner_id,'Support case updated '+t.id);
 await event(actor,'support_replied',t.id);res.json({success:true});
},res));
app.post('/api/support/:id/close',async(req,res)=>run(async()=>{
 if(!req.actor)return deny(res,401);
 const t=await tickets.findOne({id:req.params.id});if(!t)return res.status(404).json({error:'Support case not found.'});
 if(!(req.actor.id===t.owner_id||req.actor.role==='root'||(['manager','staff'].includes(req.actor.role)&&req.actor.department==='client_relations')))return deny(res);
 await tickets.updateOne({id:t.id,status:'open'},{$set:{status:'closed',updated_at:now()}});await event(req.actor,'support_closed',t.id);res.json({success:true});
},res));
app.get('/api/notifications',async(req,res)=>run(async()=>{
 if(!req.actor)return deny(res,401);
 res.json({notifications:(await notices.find({account_id:req.actor.id},{projection:{_id:0}}).sort({created_at:-1}).limit(50).toArray())});
},res));
app.get('/api/dashboard',async(req,res)=>run(async()=>{
 if(!req.actor)return deny(res,401);
 const a=req.actor;
 const canSeeAll=a.role==='root';
 const quoteFilter=canSeeAll?{}:a.role==='client'?{owner_id:a.id}:a.department==='client_relations'?{}:{id:'none'};
 const projectFilter=canSeeAll?{}:a.role==='client'?{client_id:a.id}:a.role==='specialist'?{specialist_id:a.id}:['delivery','quality'].includes(a.department)?{}:{id:'none'};
 const ticketFilter=canSeeAll?{}:['client','specialist'].includes(a.role)?{owner_id:a.id}:a.department==='client_relations'?{}:{id:'none'};
 const [q,p,t,u]=await Promise.all([
  quotes.countDocuments(quoteFilter),projects.countDocuments(projectFilter),tickets.countDocuments(ticketFilter),
  notices.countDocuments({account_id:a.id,read:false})
 ]);
 res.json({account:a,stats:{quotes:q,projects:p,support:t,unread:u},payments_enabled:false,product:'International Project Services'});
},res));
// Test-only payment witness. This cannot be enabled by a production deployment setting.
if(sandbox&&env.NODE_ENV==='test'&&env.IPS_TEST_PAYMENTS==='true')app.post('/api/sandbox/settle/:id',async(req,res)=>run(async()=>{
 if(!requires(req,res,['root']))return;
 const p=await projects.findOneAndUpdate({id:req.params.id,status:'awaiting_payment',payment_status:'pending'},{$set:{status:'awaiting_assignment',payment_status:'paid',sandbox_paid:true,updated_at:now()}},{returnDocument:'after'});
 if(!p)return res.status(409).json({error:'No eligible sandbox project.'});
 await event(req.actor,'sandbox_payment_simulated',p.id);res.json({project:safeProject(p),synthetic:true});
},res));
let running=false;
async function automaticTick(){
 if(running)return;running=true;
 try{
  const cutoff=new Date(Date.now()-10*60000);
  for(const q of await quotes.find({status:'new',created_at:{$lt:cutoff}}).limit(80).toArray()){
    await notices.updateOne({account_id:rootEmail,kind:'unclaimed',quote_id:q.id},{$setOnInsert:{id:uid('NT'),account_id:rootEmail,kind:'unclaimed',quote_id:q.id,text:'Quote awaiting review '+q.id,read:false,created_at:now()}},{upsert:true});
  }
  const overdue=new Date(Date.now()-86400000);
  for(const p of await projects.find({status:{$in:['assigned','revision_requested','qa_pending']},updated_at:{$lt:overdue}}).limit(80).toArray()){
    await notices.updateOne({account_id:rootEmail,kind:'overdue',project_id:p.id},{$setOnInsert:{id:uid('NT'),account_id:rootEmail,kind:'overdue',project_id:p.id,text:'Project requires intervention '+p.id,read:false,created_at:now()}},{upsert:true});
  }
 }catch(e){console.error('IPS automatic queue error:',e?.name||'Error')}finally{running=false}
}
const poll=setInterval(automaticTick,60000);poll.unref?.();void automaticTick();
const publicDir=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
app.use(express.static(publicDir,{index:false,maxAge:0}));
app.get('*',(req,res)=>res.sendFile(path.join(publicDir,'index.html')));
const port=Number(env.PORT||8080);
app.listen(port,'0.0.0.0',()=>console.log('IPS cleanroom company API listening',port,'database',dbName,'mode',sandbox?'sandbox':'production'));
