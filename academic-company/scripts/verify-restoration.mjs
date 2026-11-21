// Independent disaster recovery proof: restored academic MongoDB on port 27018,
// signed-in academic roles and exact private academic file checksum.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import mongoose from 'mongoose';
import {setTimeout as sleep} from 'node:timers/promises';
const base='http://127.0.0.1:18124';
const uri='mongodb://127.0.0.1:27018/ips_academic_sandbox';
const env={...process.env,NODE_ENV:'test',IPS_ACADEMIC_MODE:'evaluation',
 MONGODB_URI:uri,PORT:'18124',PUBLIC_APP_URL:base,
 ROOT_EMAIL:'nyoro.ips-academic-test@example.org',ROOT_PASSWORD:'AcademicRootTest2026!',
 SESSION_SECRET:'isolated-academic-independent-restore-2026-strong-signature-secret-abcdef',
 RESEND_API_KEY:'',FROM_EMAIL:'',IPS_ACADEMIC_TEST_SETTLEMENT:'false'};
const api=spawn(process.execPath,['src/app.mjs'],{env,stdio:['ignore','pipe','pipe']});let logs='',conn;
for(const stream of [api.stdout,api.stderr])stream.on('data',d=>logs=(logs+String(d)).slice(-1600));
async function request(path,{method='GET',body,cookie}={}){
 const r=await fetch(base+'/api'+path,{method,headers:{...(body?{'Origin':base,'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},
  body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(13000)});
 const text=await r.text();let json;try{json=JSON.parse(text)}catch{json={raw:text}};
 return {status:r.status,json,cookie:(r.headers.get('set-cookie')||'').split(';')[0]};
}
try{
 for(let i=0;i<70;i++){try{const r=await request('/health');if(r.status===200&&r.json.ready)break}catch{}if(i===69)throw Error('Restored academic app cannot boot: '+logs);await sleep(250)}
 conn=await mongoose.createConnection(uri).asPromise();const db=conn.db;
 const [student,specialist,project]=await Promise.all([
  db.collection('academic_accounts').findOne({role:'student',username:{$regex:'^PrivateScholar'}}),
  db.collection('academic_accounts').findOne({role:'specialist',name:'Evaluation Academic Nursing Editor'}),
  db.collection('academic_commissions').findOne({status:'completed'})
 ]);
 assert.ok(student&&specialist&&project,'Restored identities or academic commission missing');
 const login=async(mail,pwd)=>{
  const r=await request('/auth/login',{method:'POST',body:{email:mail,password:pwd}});
  assert.equal(r.status,200,'Restored account cannot sign in: '+JSON.stringify(r.json));return r.cookie;
 };
 const studentCookie=await login(student.email,'RecoveredAcademic2027!');
 const specialistCookie=await login(specialist.email,'SpecialistAcademic2026!');
 const rootCookie=await login(env.ROOT_EMAIL,env.ROOT_PASSWORD);
 const p=await request('/academic/commissions/'+project.id,{cookie:studentCookie});
 assert.equal(p.status,200);assert.equal(p.json.commission.serviceId,'academic-editing');
 const list=await request('/academic/commissions/'+project.id+'/files',{cookie:studentCookie});
 assert.equal(list.status,200);assert.ok(list.json.files.length>=2,'Restored academic file revisions absent');
 const chosen=list.json.files[0];
 const downloaded=await fetch(base+'/api/academic/files/'+chosen.id,{headers:{Cookie:studentCookie}});
 assert.equal(downloaded.status,200);const bytes=Buffer.from(await downloaded.arrayBuffer());
 const digest=crypto.createHash('sha256').update(bytes).digest('hex');
 assert.equal(digest,chosen.sha256);
 assert.equal(downloaded.headers.get('x-content-sha256'),digest);
 const specialistView=await request('/academic/commissions',{cookie:specialistCookie});
 assert.ok(specialistView.json.commissions.some(x=>x.id===project.id));
 const rootAudit=await request('/administration/audit',{cookie:rootCookie});
 assert.equal(rootAudit.status,200);assert.ok(rootAudit.json.events.length>10);
 const index=await db.collection('academic_accounts').indexes();assert.ok(index.some(i=>i.name==='email_1'));
 const outsider=await request('/academic/commissions/'+project.id);
 assert.equal(outsider.status,403);
 console.log('IPS_ACADEMIC_INDEPENDENT_RESTORE_GREEN restored client, specialist and Root sessions, real academic deliverable SHA-256, indices, audit and boundaries');
}catch(err){console.error('IPS_ACADEMIC_RESTORE_FAIL',String(err),logs);process.exitCode=1}
finally{try{await conn?.close()}catch{}api.kill('SIGTERM')}
