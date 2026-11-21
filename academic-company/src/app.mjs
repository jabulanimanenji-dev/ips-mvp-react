// IPS Academic Services — new company runtime.
// Does not import any historical IPS application or rejected generic-project modules.
import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SERVICES,CATEGORIES,DEPARTMENTS,ACADEMIC_LEVELS,academicIntegrityNotice} from './catalogue.mjs';
import {email,publicAccount,ensureRuntime,createSecurity,Throttle,now,uid} from './security.mjs';
import {registerIdentityRoutes} from './routes-identity.mjs';
import {registerAcademicRoutes} from './routes-academic.mjs';
import {registerSupportRoutes,beginCompanyAutomation} from './routes-support.mjs';

const env=process.env;
const config=ensureRuntime(env);
const security=createSecurity(env,config);
const throttle=new Throttle();
const app=express();
app.disable('x-powered-by');
if(config.prod)app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:{directives:{
 "default-src":["'self'"],"script-src":["'self'"],"style-src":["'self'"],
 "img-src":["'self'","data:"],"connect-src":["'self'"],
 "font-src":["'self'"],"frame-ancestors":["'none'"]
}}}));
app.use(express.json({limit:'3mb'}));
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
const db={
 accounts:raw.collection('academic_accounts'),
 quotes:raw.collection('academic_quotations'),
 projects:raw.collection('academic_commissions'),
 files:raw.collection('academic_private_files'),
 messages:raw.collection('academic_case_messages'),
 support:raw.collection('academic_support_cases'),
 notifications:raw.collection('academic_notifications'),
 audit:raw.collection('academic_audit_events'),
 outbox:raw.collection('academic_evaluation_mail')
};
await Promise.all([
 db.accounts.createIndex({email:1},{unique:true}),
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
 db.notifications.createIndex({accountId:1,createdAt:-1})
]);
const rootEmail=email(env.ROOT_EMAIL);
async function sendEmail(to,subject,text){
 if(config.sandbox){
  await db.outbox.insertOne({id:uid('MAIL'),to:email(to),subject,text,createdAt:now(),synthetic:true});
  return;
 }
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const r=await fetch('https://api.resend.com/emails',{method:'POST',
   headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({from:env.FROM_EMAIL,to:[to],subject,text}),signal:controller.signal});
  if(!r.ok)throw Error('Academic confirmation provider returned '+r.status);
 }finally{clearTimeout(timeout)}
}
async function audit(actor,action,ref='',details={}){
 await db.audit.insertOne({id:uid('AUD'),at:now(),actorId:actor?.id||'system',
  actorRole:actor?.role||'system',action,ref:String(ref),details});
}
async function notify(accountId,message,kind='academic_work'){
 if(accountId)await db.notifications.insertOne({id:uid('NT'),accountId,
  message,kind,read:false,createdAt:now()});
}
async function resolveActor(req){
 const token=security.read(req);
 if(!token)return null;
 if(token.role==='root'){
  return token.id===rootEmail?{id:rootEmail,email:rootEmail,name:'Nyoro',role:'root',status:'active',verified:true,department:'',approved:true}:null;
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
const ctx={app,db,env,config,security,throttle,sendEmail,rootEmail,notify,audit,authorize,department,wrap,now,uid};
app.get('/api/health',wrap(async(_req,res)=>res.json({
 ready:mongoose.connection.readyState===1,
 product:'IPS Academic Services',identity:'academic-services-only',release:'academic-company-2026-v1',
 environment:config.sandbox?'ISOLATED_ACADEMIC_REVIEW':'PRODUCTION',
 payments:'integration-pending',database:mongoose.connection.readyState===1?'connected':'unavailable'
})));
app.get('/api/catalogue',(_req,res)=>res.json({
 company:'IPS Academic Services',categories:CATEGORIES,services:SERVICES,
 levels:ACADEMIC_LEVELS,departments:Object.entries(DEPARTMENTS).map(([id,name])=>({id,name})),
 academicIntegrityNotice,noPhoneCalls:true
}));
app.use('/api',async(req,res,next)=>{
 if(req.path==='/health'||req.path==='/catalogue')return next();
 try{req.actor=await resolveActor(req);next()}
 catch{res.status(503).json({error:'Identity verification is temporarily unavailable.'})}
});
app.get('/api/session',wrap(async(req,res)=>{
 if(!req.actor)return res.status(401).json({error:'Not signed in.'});
 res.json({account:req.actor});
}));
registerIdentityRoutes(ctx);
registerAcademicRoutes(ctx);
registerSupportRoutes(ctx);
beginCompanyAutomation(ctx);
const dist=path.join(path.dirname(fileURLToPath(import.meta.url)),'../public');
app.use(express.static(dist,{index:false,maxAge:0}));
app.get('*',(req,res)=>res.sendFile(path.join(dist,'index.html')));
const port=Number(env.PORT||8080);
app.listen(port,'0.0.0.0',()=>console.log('IPS ACADEMIC SERVICES runtime',config.sandbox?'ISOLATED ACADEMIC REVIEW':'production',port));
