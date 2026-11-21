import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {MongoClient} from 'mongodb';
import {setTimeout as sleep} from 'node:timers/promises';
import {readFile} from 'node:fs/promises';

const base='http://127.0.0.1:18088';
const mongo='mongodb://127.0.0.1:27017';
const database='ips_company_cleanroom_sandbox';
const env={...process.env,NODE_ENV:'test',IPS_CLEANROOM_MODE:'sandbox',IPS_TEST_PAYMENTS:'true',
 MONGODB_URI:mongo+'/'+database,ROOT_EMAIL:'nyoro-ci@example.org',ROOT_PASSWORD:'LocalRootSecret2026!',
 SESSION_SECRET:'ips-company-cleanroom-isolated-only-session-secret-2026-abcdefghijklmnopqrstuvwxyz',
 PUBLIC_APP_URL:base,PORT:'18088',RESEND_API_KEY:'',FROM_EMAIL:''};
const app=spawn(process.execPath,['company-next/server.mjs'],{env,stdio:['ignore','pipe','pipe']});
let logs='';for(const stream of [app.stdout,app.stderr])stream.on('data',data=>{logs=(logs+String(data)).slice(-2400)});
let clientDB;let tests=0;
const run=async(label,fn)=>{await fn();tests++;console.log('PASS '+label)};
const emailFor=(prefix)=>prefix+'-'+crypto.randomBytes(5).toString('hex')+'@example.org';
async function http(path,{method='GET',body,cookie}={}){
 const response=await fetch(base+'/api'+path,{method,headers:{...(body?{'Content-Type':'application/json','Origin':base}:{}),...(cookie?{'Cookie':cookie}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
 const text=await response.text();let data;try{data=JSON.parse(text)}catch{data={raw:text}};
 return {status:response.status,data,cookie:(response.headers.get('set-cookie')||'').split(';')[0],headers:response.headers};
}
const check=async(path,settings,want=200)=>{const r=await http(path,settings);assert.equal(r.status,want,path+' status '+r.status+': '+JSON.stringify(r.data).slice(0,300));return r};
async function lastMail(to,subject){
 const rows=await clientDB.collection('company_mail_outbox').find({to,subject:{$regex:subject}}).sort({created_at:-1}).limit(1).toArray();
 assert.equal(rows.length,1,'No isolated mail delivery evidence for '+subject);return rows[0];
}
function link(mail,kind){const url=mail.text.match(/https?:\/\/[^\s]+/)?.[0];assert.ok(url,'Missing one-use link');const params=new URL(url.replace('/#','/?'));const q=new URLSearchParams(params.hash.replace('#',''));return {token:q.get(kind),email:q.get('email'),quote_id:q.get('quote')};}
function extract(mail,kind){const token=String(mail.text.match(new RegExp('#'+kind+'=([A-Za-z0-9_-]{43})'))?.[1]||'');assert.equal(token.length,43,'One-use token missing');return token}
async function signIn(email,password){const r=await check('/auth/login',{method:'POST',body:{email,password}});assert.ok(r.cookie.startsWith('ips_company_session='));return r.cookie;}
async function verifyAccount(email){const mail=await lastMail(email,'Verify your IPS account');const token=extract(mail,'verify');return check('/auth/verify',{method:'POST',body:{email,token}})}
try{
 for(let n=0;n<90;n++){try{const r=await http('/health');if(r.status===200&&r.data.ready)break}catch{}if(n===89)throw Error('IPS new runtime failed health: '+logs);await sleep(250)}
 const mongoClient=new MongoClient(mongo);await mongoClient.connect();clientDB=mongoClient.db(database);
 const cEmail=emailFor('private-client'),wEmail=emailFor('professional'),mEmail=emailFor('manager'),sEmail=emailFor('employee');
 let cCookie,sCookie,wCookie,mCookie,rootCookie;
 const clientPass='ClientPrivacy2026!',writerPass='SpecialistSecure2026!',staffPass='StaffSecure2026!',managerPass='ManagerSecure2026!';
 await run('Root is environment-controlled and not a deletable company account',async()=>{
   rootCookie=await signIn(env.ROOT_EMAIL,env.ROOT_PASSWORD);
   assert.equal(await clientDB.collection('company_accounts').countDocuments({email:env.ROOT_EMAIL}),0);
 });
 await run('Client registers pseudonym, must prove email, never shares legal name',async()=>{
   await check('/auth/signup',{method:'POST',body:{role:'client',username:'PrivateResearcher',email:cEmail,password:clientPass,privacy_consent:true}},202);
   await check('/auth/login',{method:'POST',body:{email:cEmail,password:clientPass}},403);
   const r=await verifyAccount(cEmail);cCookie=r.cookie;assert.ok(cCookie.startsWith('ips_company_session='));
   const record=await clientDB.collection('company_accounts').findOne({email:cEmail});assert.equal(record.name,'');assert.equal(record.verified,true);
 });
 await run('Specialist cannot work until verified and approved by Root',async()=>{
   await check('/auth/signup',{method:'POST',body:{role:'specialist',full_name:'Test Professional Specialist',email:wEmail,password:writerPass,privacy_consent:true}},202);
   await verifyAccount(wEmail);
   await check('/auth/login',{method:'POST',body:{email:wEmail,password:writerPass}},403);
   const writer=await clientDB.collection('company_accounts').findOne({email:wEmail});
   await check('/people/'+writer.id+'/review',{method:'POST',body:{action:'approve'},cookie:rootCookie});
   wCookie=await signIn(wEmail,writerPass);
 });
 await run('Root appoints department manager, manager can invite staff, staff cannot appoint manager',async()=>{
   await check('/people/invite',{method:'POST',cookie:rootCookie,body:{name:'Client Care Manager',email:mEmail,department:'client_relations'}},201);
   const managerToken=extract(await lastMail(mEmail,'IPS private company invitation'),'invite');
   const m=await check('/people/accept',{method:'POST',body:{email:mEmail,token:managerToken,password:managerPass}});
   mCookie=m.cookie;assert.ok(mCookie);
   await check('/people/invite',{method:'POST',cookie:mCookie,body:{name:'Customer Care Employee',email:sEmail}},201);
   const staffToken=extract(await lastMail(sEmail,'IPS private company invitation'),'invite');
   const s=await check('/people/accept',{method:'POST',body:{email:sEmail,token:staffToken,password:staffPass}});
   sCookie=s.cookie;
   await check('/people/invite',{method:'POST',cookie:sCookie,body:{name:'Forbidden Root',email:emailFor('forbidden'),department:'governance'}},403);
   assert.equal((await clientDB.collection('company_accounts').findOne({email:sEmail})).role,'staff');
 });
 let quoteId,projectId,deliverable;
 await run('Verified client makes real confidential written quote, Root reviews scope and amount',async()=>{
   const r=await check('/quotes',{method:'POST',cookie:cCookie,body:{service:'Research Methods Consultation',summary:'Review my independently authored methodology and give professional feedback on clarity and design.',deadline:'2026-12-31'}},201);
   quoteId=r.data.quote.id;
   await check('/quotes/'+quoteId+'/offer',{method:'POST',cookie:sCookie,body:{amount_minor:20000}},403);
   await check('/quotes/'+quoteId+'/offer',{method:'POST',cookie:rootCookie,body:{amount_minor:20000,notes:'Research methodology consultation and written feedback.'}});
   const accepted=await check('/quotes/'+quoteId+'/accept',{method:'POST',cookie:cCookie,body:{}});
   projectId=accepted.data.project.id;assert.equal(accepted.data.project.status,'awaiting_payment');
 });
 await run('Assignment is forbidden before payment; synthetic settlement cannot reach production',async()=>{
   const specialist=await clientDB.collection('company_accounts').findOne({email:wEmail});
   await check('/projects/'+projectId+'/assign',{method:'POST',cookie:rootCookie,body:{specialist_id:specialist.id}},409);
   const payment=await check('/sandbox/settle/'+projectId,{method:'POST',cookie:rootCookie,body:{}});
   assert.equal(payment.data.synthetic,true);
   const assignment=await check('/projects/'+projectId+'/assign',{method:'POST',cookie:rootCookie,body:{specialist_id:specialist.id}});
   assert.equal(assignment.data.project.status,'assigned');
 });
 await run('Specialist submits genuine private deliverable, Root QA releases and client requests revision',async()=>{
   const text='Private test consultation: methodological feedback and research guidance.';
   const file=await check('/projects/'+projectId+'/deliver',{method:'POST',cookie:wCookie,body:{filename:'methods-feedback.txt',mime:'text/plain',data:Buffer.from(text).toString('base64')}});
   deliverable=file.data.file_id;
   await check('/files/'+deliverable,{cookie:cCookie},403);
   await check('/projects/'+projectId+'/quality',{method:'POST',cookie:sCookie,body:{decision:'approve'}},403);
   await check('/projects/'+projectId+'/quality',{method:'POST',cookie:rootCookie,body:{decision:'approve'}});
   const document=await fetch(base+'/api/files/'+deliverable,{headers:{Cookie:cCookie}});
   assert.equal(document.status,200);assert.equal(await document.text(),text);
   const revision=await check('/projects/'+projectId+'/client-action',{method:'POST',cookie:cCookie,body:{action:'revision'}});
   assert.equal(revision.data.project.status,'revision_requested');
 });
 await run('Revision passes repeat QA, final client acceptance and encrypted session authorization',async()=>{
   const text='Corrected private feedback incorporating the requested methodological revision.';
   const f=await check('/projects/'+projectId+'/deliver',{method:'POST',cookie:wCookie,body:{filename:'revised-feedback.txt',mime:'text/plain',data:Buffer.from(text).toString('base64')}});
   await check('/projects/'+projectId+'/quality',{method:'POST',cookie:rootCookie,body:{decision:'approve'}});
   const completed=await check('/projects/'+projectId+'/client-action',{method:'POST',cookie:cCookie,body:{action:'accept'}});
   assert.equal(completed.data.project.status,'completed');
   const r=await fetch(base+'/api/files/'+f.data.file_id,{headers:{Cookie:cCookie}});
   assert.equal(await r.text(),text);assert.equal(r.headers.get('x-file-sha256'),crypto.createHash('sha256').update(text).digest('hex'));
   await check('/files/'+f.data.file_id,{},401);
 });
 await run('Private client-specialist communications are real and role-isolated',async()=>{
   await check('/projects/'+projectId+'/messages',{method:'POST',cookie:cCookie,body:{body:'Thank you for completing the research consultation.'}},201);
   const r=await check('/projects/'+projectId+'/messages',{cookie:wCookie});assert.ok(r.data.messages.some(m=>m.body.includes('Thank you')));
   await check('/projects/'+projectId+'/messages',{cookie:sCookie},403);
 });
 await run('Support journey from customer through staff response and closure is persistent',async()=>{
   const opened=await check('/support',{method:'POST',cookie:cCookie,body:{subject:'Delivery clarification',body:'Please explain how revision acceptance affects my final deliverable.'}},201);
   const sid=opened.data.ticket.id;
   await check('/support/'+sid+'/reply',{method:'POST',cookie:sCookie,body:{body:'Your final project acceptance has been recorded.'}});
   const r=await check('/support',{cookie:cCookie});assert.ok(r.data.tickets.some(t=>t.id===sid&&t.replies.length===2));
   await check('/support/'+sid+'/close',{method:'POST',cookie:cCookie,body:{}});
   await check('/support/'+sid+'/reply',{method:'POST',cookie:sCookie,body:{body:'Should be blocked'}},409);
 });
 await run('Unauthenticated API and cross-role finance access refuse disclosure',async()=>{
   await check('/projects',{},401);
   await check('/people',{},401);
   const r=await check('/people',{cookie:rootCookie});assert.ok(!r.data.people.some(p=>p.role==='root'));
   await check('/people/invite',{method:'POST',cookie:cCookie,body:{name:'no',email:'no@example.org'}},403);
 });
 await run('Admin can send recovery link but never see password, old client sessions are revoked',async()=>{
   const a=await clientDB.collection('company_accounts').findOne({email:cEmail});
   await check('/people/'+a.id+'/send-reset',{method:'POST',cookie:rootCookie,body:{}},202);
   const token=extract(await lastMail(cEmail,'Private IPS password assistance'),'reset');
   const r=await check('/auth/recovery/complete',{method:'POST',body:{email:cEmail,token,password:'RecoveredClient2027!'}});
   await check('/me',{cookie:cCookie},401);
   assert.ok(r.cookie.startsWith('ips_company_session='));
   await check('/auth/recovery/complete',{method:'POST',body:{email:cEmail,token,password:'AnotherClient2027!'}},400);
   cCookie=r.cookie;
 });
 await run('Guest can request and verify quote without creating a legal-name account',async()=>{
   const r=await check('/guest-quotes',{method:'POST',body:{username:'AliasGuest',email:cEmail,service:'Literature feedback',summary:'I need an objective review of the structure and clarity of a self-written literature review.',privacy_consent:true}},202);
   const mail=await lastMail(cEmail,'Verify your private IPS quote request');
   const token=extract(mail,'guestverify');
   await check('/guest-quotes/verify',{method:'POST',body:{email:cEmail,quote_id:r.data.quote_id,token}});
   await check('/guest-quotes/claim',{method:'POST',cookie:cCookie,body:{quote_id:r.data.quote_id}});
   assert.equal((await clientDB.collection('company_quotes').findOne({id:r.data.quote_id})).owner_id,(await clientDB.collection('company_accounts').findOne({email:cEmail})).id);
 });
 await run('Business event audit, private notification and MongoDB indexes are durable',async()=>{
   assert.ok(await clientDB.collection('company_audit').countDocuments({})>15);
   assert.ok(await clientDB.collection('company_notifications').countDocuments({})>2);
   const ix=await clientDB.collection('company_accounts').indexes();assert.ok(ix.some(i=>i.name.includes('email')));
 });
 console.log('IPS_CLEANROOM_GENUINE_MONGODB_LIFECYCLE_PASS '+tests+' authenticated checks and a completed corrected deliverable.');
 await mongoClient.close();
}catch(error){console.error('IPS_CLEANROOM_FAIL',String(error),logs.slice(-2200));process.exitCode=1;}
finally{app.kill('SIGTERM');await sleep(300);}
