// IPS Academic Services — new company runtime.
// Does not import any historical IPS application or rejected generic-project modules.
import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SERVICES,CATEGORIES,DEPARTMENTS,ACADEMIC_LEVELS,academicIntegrityNotice} from './catalogue.mjs';
import {SPECIALIST_AGREEMENT} from './specialist-agreement.mjs';
import {email,validEmail,hashPassword,publicAccount,ensureRuntime,createSecurity,Throttle,now,uid} from './security.mjs';
import {registerIdentityRoutes} from './routes-identity.mjs';
import {registerAcademicRoutes} from './routes-academic.mjs';
import {registerSupportRoutes,beginCompanyAutomation} from './routes-support.mjs';
import {registerOperationsRoutes} from './routes-operations.mjs';
import {registerTelegramRoutes,telegramConfigured} from './routes-telegram.mjs';
import {inspectAcademicFile,scanConfiguration} from './document-scan.mjs';

const env=process.env;
const config=ensureRuntime(env);
const security=createSecurity(env,config);
const throttle=new Throttle();
const app=express();
app.disable('x-powered-by');
if(config.prod)app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:{directives:{
 "default-src":["'self'"],"script-src":["'self'"],"style-src":["'self'"],
 "img-src":["'self'","data:","https://images.unsplash.com"],"connect-src":["'self'"],
 "font-src":["'self'"],"frame-ancestors":["'none'"]
}}}));
app.use(express.json({limit:'8mb'}));
app.use((req,res,next)=>{
 res.setHeader('X-IPS-Product','IPS Academic Services');
 res.setHeader('Cache-Control','no-store');
 if(!['GET','HEAD','OPTIONS'].includes(req.method)){
  const supplied=req.get('origin');
  if(supplied&&supplied!==config.origin)return res.status(403).json({error:'Submit academic requests from the official IPS site.'});
 }
 next();
});
await mongoose.connect(env.MONGODB_URI,{dbName:config.dbName,serverSelectionTimeoutMS:12000});
const raw=mongoose.connection.db;
// The native MongoDB GridFS bucket supports private academic files beyond the 16 MB document limit.
const documentBucket=new mongoose.mongo.GridFSBucket(raw,{bucketName:'academic_document_blobs'});
const db={
 accounts:raw.collection('academic_accounts'),
 rootCredentials:raw.collection('academic_root_credentials'),
 quotes:raw.collection('academic_quotations'),
 projects:raw.collection('academic_commissions'),
 files:raw.collection('academic_private_files'),
 messages:raw.collection('academic_case_messages'),
 support:raw.collection('academic_support_cases'),
 notifications:raw.collection('academic_notifications'),
 notificationDeliveries:raw.collection('academic_notification_deliveries'),
 audit:raw.collection('academic_audit_events'),
 outbox:raw.collection('academic_evaluation_mail'),
 quoteMessages:raw.collection('academic_quote_messages'),
 quoteFiles:raw.collection('academic_quote_files'),
 directMessages:raw.collection('academic_direct_messages'),
 directFiles:raw.collection('academic_direct_files'),
 rootOperations:raw.collection('academic_root_operations'),
 rootExternalFiles:raw.collection('academic_root_external_files')
};
await Promise.all([
 db.accounts.createIndex({email:1},{unique:true}),
 db.rootCredentials.createIndex({id:1},{unique:true}),
 db.accounts.createIndex({usernameKey:1},{unique:true,partialFilterExpression:{usernameKey:{$type:'string'}}}),
 db.quotes.createIndex({studentId:1,createdAt:-1}),
 db.quotes.createIndex({contactEmail:1}),
 db.projects.createIndex({studentId:1,createdAt:-1}),
 db.projects.createIndex({specialistId:1}),
 db.projects.createIndex({quoteId:1},{unique:true}),
 db.files.createIndex({commissionId:1,createdAt:-1}),
 db.messages.createIndex({commissionId:1,createdAt:1}),
 db.support.createIndex({ownerId:1,updatedAt:-1}),
 db.audit.createIndex({at:-1}),
 db.notifications.createIndex({accountId:1,createdAt:-1}),
 db.notificationDeliveries.createIndex({status:1,nextAttemptAt:1,createdAt:1}),
 db.outbox.createIndex({idempotencyKey:1},{unique:true,sparse:true}),
 db.quoteMessages.createIndex({quoteId:1,createdAt:1}),
 db.quoteFiles.createIndex({quoteId:1,createdAt:-1}),
 db.directMessages.createIndex({toId:1,createdAt:-1}),
 db.rootOperations.createIndex({commissionId:1},{unique:true}),
 db.rootExternalFiles.createIndex({commissionId:1,createdAt:-1})
]);
const rootEmail=email(env.ROOT_EMAIL);
// The immutable Root identity is intentionally not a user-directory account.
// Its credential is durable so email recovery survives deployments and restores.
await db.rootCredentials.updateOne({id:rootEmail},{$setOnInsert:{
 id:rootEmail,passwordHash:hashPassword(env.ROOT_PASSWORD),sessionVersion:1,
 createdAt:now(),updatedAt:now()
}},{upsert:true});
async function sendEmail(to,subject,text,deliveryKey=''){
 // Only queued notices use a stable provider idempotency key. Verification and
 // password-recovery challenges continue to carry their own single-use tokens.
 const idempotencyKey=String(deliveryKey||'');
 if(idempotencyKey&&!/^[A-Za-z0-9_-]{1,128}$/.test(idempotencyKey))
  throw Error('Invalid outgoing delivery identity.');
 if(config.sandbox){
  const row={id:uid('MAIL'),to:email(to),subject,text,createdAt:now(),synthetic:true,
   ...(idempotencyKey?{idempotencyKey}:{})};
  if(idempotencyKey){
   await db.outbox.updateOne({idempotencyKey},{$setOnInsert:row},{upsert:true});
   const saved=await db.outbox.findOne({idempotencyKey});
   return {provider:'sandbox',id:saved.id,synthetic:true};
  }
  await db.outbox.insertOne(row);
  return {provider:'sandbox',id:row.id,synthetic:true};
 }
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const r=await fetch('https://api.resend.com/emails',{method:'POST',
   headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json',
    ...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})},
   body:JSON.stringify({from:env.FROM_EMAIL,to:[to],subject,text}),signal:controller.signal});
  if(!r.ok)throw Error('Academic email provider returned '+r.status);
  const response=await r.json().catch(()=>null);
  if(typeof response?.id!=='string'||!response.id)
   throw Error('Academic email provider did not confirm acceptance identity.');
  return {provider:'resend',id:response.id,providerAccepted:true};
 }finally{clearTimeout(timeout)}
}
// A Telegram API response confirms provider acceptance, never human receipt.
async function sendTelegram(chatId,message,deliveryKey=''){
 if(!Number.isSafeInteger(Number(chatId))||Number(chatId)<=0)throw Error('Telegram chat is not verified.');
 const text=String(message||'');
 if(!text||text.length>4000)throw Error('Telegram notice invalid.');
 if(config.sandbox){
  const item={id:uid('TG'),to:'telegram:'+chatId,subject:'IPS Telegram notification',
   text,provider:'telegram-sandbox',synthetic:true,createdAt:now(),
   ...(deliveryKey?{idempotencyKey:deliveryKey}:{})};
  if(deliveryKey){
   await db.outbox.updateOne({idempotencyKey:deliveryKey},{$setOnInsert:item},{upsert:true});
   const original=await db.outbox.findOne({idempotencyKey:deliveryKey});
   return {provider:'telegram-sandbox',id:original.id,synthetic:true};
  }
  await db.outbox.insertOne(item);
  return {provider:'telegram-sandbox',id:item.id,synthetic:true};
 }
 if(!telegramConfigured(env))throw Error('Telegram provider is not configured.');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
 try{
  const r=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/sendMessage',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({chat_id:Number(chatId),text,disable_web_page_preview:true}),
   signal:controller.signal});
  if(!r.ok)throw Error('Telegram provider rejected outgoing message.');
  const answer=await r.json().catch(()=>null);
  if(answer?.ok!==true||!Number.isSafeInteger(answer?.result?.message_id))
   throw Error('Telegram provider did not confirm accepting the message.');
  return {provider:'telegram',id:String(answer.result.message_id),providerAccepted:true};
 }finally{clearTimeout(timeout)}
}
async function audit(actor,action,ref='',details={}){
 const assisted=actor?.rootAssistedBy===rootEmail;
 await db.audit.insertOne({id:uid('AUD'),at:now(),
  actorId:assisted?rootEmail:actor?.id||'system',
  actorRole:assisted?'root':actor?.role||'system',
  action,ref:String(ref),details:assisted?{...details,rootAssisted:true,selectedAccountId:actor.id,selectedRole:actor.role}:details});
}
// Every non-transactional notice uses the same durable delivery queue. Provider acceptance
// is not a read receipt; no academic subject, name, price, file or message is emailed.
async function queuePrivateNotice(to,kind,notificationId,accountId=''){
 const recipient=email(to);
 if(!validEmail(recipient))throw Error('A verified email address is required for private notices.');
 await db.notificationDeliveries.insertOne({
  id:uid('OUT'),notificationId,accountId,to:recipient,
  subject:'IPS Academic Services — new private update',
  text:'A private IPS Academic Services update is ready in your secure workspace.\n'+
       'Sign in: '+config.origin+'\n\nFor security, this email contains no academic case details.',
  kind,status:'pending',attempts:0,nextAttemptAt:now(),createdAt:now()
 });
}
async function queueTelegramNotice(accountId,chatId,kind,notificationId){
 await db.notificationDeliveries.insertOne({id:uid('OUT'),notificationId,
  accountId,channel:'telegram',chatId:Number(chatId),
  text:'A private IPS Academic Services update is ready in your secure workspace.\\n'+
       'Sign in: '+config.origin+'\\nNo academic case details are sent in Telegram.',
  kind,status:'pending',attempts:0,nextAttemptAt:now(),createdAt:now()});
}
async function notify(accountId,message,kind='academic_work',options={}){
 if(!accountId)return;
 const item={id:uid('NT'),accountId,message,kind,read:false,createdAt:now()};
 await db.notifications.insertOne(item);
 const owner=await db.accounts.findOne({id:accountId,verified:true,status:'active'},
  {projection:{email:1,contactPreference:1,telegramChatId:1,telegramVerifiedAt:1,telegramConnectionStatus:1}});
 // Quote-specific consent overrides account-level notification defaults, but only for
 // that verified quote owner. All unrelated messages keep the chosen profile preference.
 const channel=options.channel||owner?.contactPreference;
 if(owner?.email&&channel==='email')
  await queuePrivateNotice(owner.email,kind,item.id,accountId);
 else if(channel==='telegram'&&owner?.telegramChatId&&owner?.telegramVerifiedAt&&
  owner?.telegramConnectionStatus==='confirmed')
  await queueTelegramNotice(accountId,owner.telegramChatId,kind,item.id);
 else if(channel==='telegram')
  await db.notifications.updateOne({accountId:rootEmail,kind:'communication_failure',ref:item.id},
   {$setOnInsert:{id:uid('NT'),accountId:rootEmail,kind:'communication_failure',
    ref:item.id,message:'IPS account '+accountId+
     ' selected Telegram without a confirmed private bot destination; secure workspace update retained.',
    read:false,createdAt:now()}},{upsert:true});
}
async function notifyQuotation(q,message,kind='quotation'){
 // A quote's explicit written contact selection is authoritative for quote updates.
 // Claimed quotes notify their verified owner; verified guests receive only generic
 // email notices, and never academic detail, price, terms or private correspondence.
 if(q.studentId){
  await notify(q.studentId,message,kind,{channel:q.contactChannel||'workspace'});
 }else if(q.contactVerified&&q.contactChannel==='email'){
  await queuePrivateNotice(q.contactEmail,kind,uid('GUEST-NOTICE'));
 }
 if(q.contactChannel==='telegram'&&!q.studentId){
  // A Telegram username alone is not a verified bot chat destination. Do not
  // misrepresent this as delivered, nor silently substitute unsolicited email.
  await db.quotes.updateOne({id:q.id},{$set:{outboundStatus:'telegram_not_connected',updatedAt:now()}});
  await db.notifications.updateOne({accountId:rootEmail,kind:'communication_failure',ref:q.id},
   {$setOnInsert:{id:uid('NT'),accountId:rootEmail,kind:'communication_failure',
    ref:q.id,message:'Telegram delivery not connected for academic enquiry '+q.id+
     '. Use the authenticated IPS workspace until the approved channel is available.',
    read:false,createdAt:now()}},{upsert:true});
 }
}
async function resolveActor(req){
 const token=security.read(req);
 if(!token)return null;
 if(token.role==='root'){
  if(token.id!==rootEmail)return null;
  const root=await db.rootCredentials.findOne({id:rootEmail,sessionVersion:token.version},
   {projection:{id:1}});
  return root?{id:rootEmail,email:rootEmail,name:'Nyoro',role:'root',status:'active',
   verified:true,department:'',approved:true}:null;
 }
 const row=await db.accounts.findOne({id:token.id,status:'active',verified:true,sessionVersion:token.version});
 if(!row||!['student','specialist','manager','staff'].includes(row.role))return null;
 if(row.role==='specialist'&&row.approved!==true)return null;
 return publicAccount(row);
}
function authorize(req,res,roles){
 if(!req.actor){res.status(401).json({error:'Please sign in to your private IPS Academic Services workspace.'});return false}
 if(roles&&!roles.includes(req.actor.role)){res.status(403).json({error:'This academic company action is outside your assigned authority.'});return false}
 return true;
}
function department(req,res,allowed){
 if(!authorize(req,res,['root','manager','staff']))return false;
 if(req.actor.role==='root')return true;
 if(!allowed.includes(req.actor.department)){res.status(403).json({error:'Another IPS department is responsible for this action.'});return false}
 return true;
}
function wrap(handler){return async(req,res)=>{try{await handler(req,res)}catch(e){
 console.error('IPS Academic Services operation failed',e?.name||'Error');
 if(!res.headersSent)res.status(500).json({error:'IPS could not complete the operation. Your previous state remains available.'});
}}}
const inspectAcademicUpload=buffer=>inspectAcademicFile(buffer,{env,sandbox:config.sandbox});
const ctx={app,db,documentBucket,inspectAcademicUpload,env,config,security,throttle,sendEmail,sendTelegram,rootEmail,notify,notifyQuotation,audit,authorize,department,wrap,now,uid};
app.get('/api/health',wrap(async(_req,res)=>res.json({
 ready:mongoose.connection.readyState===1,
 product:'IPS Academic Services',identity:'academic-services-only',release:'academic-company-2026-v1',
 environment:config.sandbox?'ISOLATED_ACADEMIC_REVIEW':'PRODUCTION',
 payments:'integration-pending',
 documentScreening:scanConfiguration(env).host?'configured_not_proven':
  (config.sandbox?'synthetic_not_scanned':'unavailable'),
 database:mongoose.connection.readyState===1?'connected':'unavailable'
})));
app.get('/api/catalogue',(_req,res)=>res.json({
 company:'IPS Academic Services',categories:CATEGORIES,services:SERVICES,
 levels:ACADEMIC_LEVELS,departments:Object.entries(DEPARTMENTS).map(([id,name])=>({id,name})),
 academicIntegrityNotice,noPhoneCalls:true,specialistAgreement:SPECIALIST_AGREEMENT,
 telegramBotUsername:telegramConfigured(env)?env.IPS_TELEGRAM_BOT_USERNAME:''
}));
// Root's assisted workspaces reuse the genuine Student and Specialist APIs without changing
// the Root session. Every delegated mutation is attributed to Nyoro, never the client.
app.use('/api',async(req,res,next)=>{
 if(req.path==='/health'||req.path==='/catalogue')return next();
 try{
  req.actor=await resolveActor(req);
  const targetId=String(req.get('X-IPS-Root-Workspace-Target')||'');
  if(!targetId)return next();
  if(req.actor?.role!=='root')return res.status(403).json({error:'Only Nyoro Root Admin can open assisted academic workspaces.'});
  if(!/^(?:STU|SPC)-[A-Z0-9-]{4,55}$/.test(targetId))
   return res.status(400).json({error:'Choose a real Student or Specialist workspace from the IPS directory.'});
  if(!(/^(?:\/academic\/|\/support(?:\/|$)|\/notifications(?:\/|$))/.test(req.path)||
   /^\/operations\/inbox$/.test(req.path)||/^\/operations\/[^/]+\/(?:files|upload|upload-reference-binary)$/.test(req.path)||
   (['GET','HEAD'].includes(req.method)&&(/^\/operations\/direct-message$/.test(req.path)||
    /^\/operations\/direct-message\/[^/]+\/thread$/.test(req.path)))))
   return res.status(403).json({error:'Root assisted workspaces cannot change identity, authentication or administration.'});
  const permittedRead=['GET','HEAD'].includes(req.method);
  const rootOfficialMessage=req.method==='POST'&&(
   /^\/academic\/commissions\/[^/]+\/messages$/.test(req.path)||
   /^\/academic\/quotes\/[^/]+\/messages$/.test(req.path));
  const evaluationAction=req.method==='POST'&&config.sandbox&&
   (/^\/academic\/quotes$/.test(req.path)||
    /^\/academic\/quotes\/[^/]+\/files-binary$/.test(req.path)||/^\/support$/.test(req.path)||
    /^\/support\/[^/]+\/reply$/.test(req.path)||
    /^\/academic\/quotes\/[^/]+\/decision$/.test(req.path)||
    /^\/academic\/commissions\/[^/]+\/(?:submission|submission-binary|student-decision)$/.test(req.path)||
    /^\/operations\/[^/]+\/(?:upload|upload-reference-binary)$/.test(req.path));
  if(!permittedRead&&!rootOfficialMessage&&!evaluationAction)
   return res.status(403).json({error:'Root can inspect and coordinate here. Identity, consent, personal settings and client acceptance cannot be forged.'});
  const target=await db.accounts.findOne({id:targetId,role:{$in:['student','specialist']},
   verified:true,status:'active',...(targetId.startsWith('SPC')?{approved:true}:{})});
  if(!target)return res.status(404).json({error:'Selected academic workspace is inactive or unavailable.'});
  if(evaluationAction&&target.synthetic!==true)return res.status(403).json({error:'Assisted Student/Specialist simulations require fictional review identities.'});
  req.rootOperatorId=rootEmail;
  req.actor={...publicAccount(target),rootAssistedBy:rootEmail,rootEvaluation:config.sandbox&&target.synthetic===true};
  if(rootOfficialMessage)req.rootOfficialMessage=true;
  next();
 }catch{res.status(503).json({error:'Root workspace authorization could not be verified.'})}
});
app.get('/api/session',wrap(async(req,res)=>{
 if(!req.actor)return res.status(401).json({error:'Not signed in.'});
 res.json({account:req.actor});
}));
registerIdentityRoutes(ctx);
registerAcademicRoutes(ctx);
registerSupportRoutes(ctx);
registerOperationsRoutes(ctx);
registerTelegramRoutes(ctx);
beginCompanyAutomation(ctx);
const dist=path.join(path.dirname(fileURLToPath(import.meta.url)),'../public');
app.use(express.static(dist,{index:false,maxAge:0}));
app.get('*',(req,res)=>res.sendFile(path.join(dist,'index.html')));
const port=Number(env.PORT||8080);
app.listen(port,'0.0.0.0',()=>console.log('IPS ACADEMIC SERVICES runtime',config.sandbox?'ISOLATED ACADEMIC REVIEW':'production',port));
