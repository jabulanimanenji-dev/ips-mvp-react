// New IPS clean-room demonstration fixture. NEVER RUN ON LIVE CUSTOMER DATABASES.
import crypto from 'node:crypto';
import {MongoClient} from 'mongodb';
const env=process.env;
if(env.IPS_CLEANROOM_MODE!=='sandbox'||env.NODE_ENV!=='test'||env.IPS_TEST_PAYMENTS!=='false')
 throw Error('Fixture creation refuses production and payment-enabled environments.');
const uri=new URL(String(env.MONGODB_URI||''));
if(!['127.0.0.1','localhost'].includes(uri.hostname)||!uri.pathname.includes('ips_company_cleanroom_sandbox'))
 throw Error('Fixture must have its own localhost MongoDB');
const required=['IPS_EVAL_CLIENT_PASSWORD','IPS_EVAL_SPECIALIST_PASSWORD','IPS_EVAL_MANAGER_PASSWORD','IPS_EVAL_STAFF_PASSWORD'];
if(required.some(n=>!env[n]||env[n].length<12))throw Error('Missing strong owner-held synthetic review credentials');
const hash=x=>{const salt=crypto.randomBytes(16).toString('hex');return 'scrypt$'+salt+'$'+crypto.scryptSync(x,salt,64).toString('hex')};
const now=new Date();
const dbConn=new MongoClient(env.MONGODB_URI);await dbConn.connect();
const db=dbConn.db('ips_company_cleanroom_sandbox');
const accounts=db.collection('company_accounts'),quotes=db.collection('company_quotes'),projects=db.collection('company_projects'),
 tickets=db.collection('company_support'),messages=db.collection('company_messages'),notices=db.collection('company_notifications'),
 files=db.collection('company_files');
try{
 const person=(id,role,email,name,password,extra={})=>({id,role,email,name,username:'',verified:true,approved:role==='specialist',status:'active',session_version:1,created_at:now,pass_hash:hash(password),...extra});
 const c=person('ACC-REVIEW-CLIENT','client','client.review@example.org','',env.IPS_EVAL_CLIENT_PASSWORD,{username:'QuietResearcher',username_key:'quietresearcher'});
 const w=person('ACC-REVIEW-SPECIALIST','specialist','specialist.review@example.org','Evaluation Academic Specialist',env.IPS_EVAL_SPECIALIST_PASSWORD);
 const m=person('EMP-REVIEW-MANAGER','manager','manager.review@example.org','Evaluation Client Relations Manager',env.IPS_EVAL_MANAGER_PASSWORD,{department:'client_relations',manager_id:''});
 const s=person('EMP-REVIEW-STAFF','staff','staff.review@example.org','Evaluation Client Relations Employee',env.IPS_EVAL_STAFF_PASSWORD,{department:'client_relations',manager_id:m.id});
 for(const a of [c,w,m,s])await accounts.updateOne({id:a.id},{$setOnInsert:a},{upsert:true});
 await quotes.updateOne({id:'Q-REVIEW-COMPLETE'},{$setOnInsert:{
   id:'Q-REVIEW-COMPLETE',owner_id:c.id,username:c.username,service:'Research Methods Consultation',
   summary:'SYNTHETIC EVALUATION: privately reviewed guidance on an independently authored research methodology.',deadline:'2026-12-31',
   status:'accepted',amount_minor:25000,currency:'PLN',notes:'Review-only illustrative written quotation, not a live client charge.',
   reviewed_by:env.ROOT_EMAIL,created_at:now,updated_at:now
 }},{upsert:true});
 await quotes.updateOne({id:'Q-REVIEW-OPEN'},{$setOnInsert:{
   id:'Q-REVIEW-OPEN',owner_id:c.id,username:c.username,service:'Data Analysis Consultation',
   summary:'SYNTHETIC EVALUATION: request professional feedback on interpreting an original descriptive statistics report.',
   status:'new',amount_minor:null,currency:'PLN',created_at:now,updated_at:now
 }},{upsert:true});
 const p={id:'PR-REVIEW-COMPLETE',quote_id:'Q-REVIEW-COMPLETE',client_id:c.id,specialist_id:w.id,
   service:'Research Methods Consultation',summary:'SYNTHETIC EVALUATION: completed research methodology consultation. No real student submission or settlement.',
   amount_minor:25000,currency:'PLN',status:'completed',payment_status:'paid',sandbox_paid:true,
   revisions:1,pending_file_id:'FILE-REVIEW-FINAL',created_at:now,updated_at:now};
 await projects.updateOne({id:p.id},{$setOnInsert:p},{upsert:true});
 const sample=Buffer.from('IPS ISOLATED EVALUATION ONLY.\nSynthetic methodology feedback: improve clarity, explain sampling decisions and document limitations.\nNo real payment or customer delivery happened.\n');
 await files.updateOne({id:'FILE-REVIEW-FINAL'},{$setOnInsert:{
   id:'FILE-REVIEW-FINAL',project_id:p.id,owner_id:c.id,filename:'evaluation-feedback.txt',mime:'text/plain',
   sha256:crypto.createHash('sha256').update(sample).digest('hex'),
   file_buffer:sample,version:2,created_at:now
 }},{upsert:true});
 await messages.updateOne({id:'MSG-REVIEW-CLIENT'},{$setOnInsert:{
   id:'MSG-REVIEW-CLIENT',project_id:p.id,sender_id:c.id,sender_role:'client',
   body:'EVALUATION ONLY: Thank you. Please confirm that the revised feedback covers sampling limitations.',created_at:now
 }},{upsert:true});
 await messages.updateOne({id:'MSG-REVIEW-SPECIALIST'},{$setOnInsert:{
   id:'MSG-REVIEW-SPECIALIST',project_id:p.id,sender_id:w.id,sender_role:'specialist',
   body:'EVALUATION ONLY: The final document includes comments about sampling and limitations.',created_at:now
 }},{upsert:true});
 await tickets.updateOne({id:'SUP-REVIEW'},{$setOnInsert:{
   id:'SUP-REVIEW',owner_id:c.id,owner_role:'client',subject:'Synthetic private support case',
   status:'open',assigned_to:s.id,created_at:now,updated_at:now,
   replies:[{actor:c.id,role:'client',body:'EVALUATION ONLY: please confirm the privacy of my consultation file.',at:now}]
 }},{upsert:true});
 for(const a of [c,w,m,s])await notices.updateOne({id:'NT-REVIEW-'+a.role},{$setOnInsert:{
   id:'NT-REVIEW-'+a.role,account_id:a.id,kind:'evaluation',text:'EVALUATION ONLY: This account and its records are fictional. Do not enter real customer information.',
   read:false,created_at:now
 }},{upsert:true});
 console.log('IPS_CLEANROOM_EVALUATION_SEED_GREEN four synthetic non-Root accounts, paid-fixture-only project and private file');
}finally{await dbConn.close();}
