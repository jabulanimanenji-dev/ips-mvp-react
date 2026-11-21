import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Client from '../models/Client.js';
import Admin from '../models/Admin.js';
import SupportTicket from '../models/SupportTicket.js';
import Notification from '../models/Notification.js';
import {permittedCompanyPermissions} from '../shared/companyGovernance.js';

// Genuine signed HTTP checks on disposable MongoDB and local API only.
// NEVER use with the production service or a customer-owned database.
const uri=String(process.env.MONGODB_URI||'');
const parsed=new URL(uri);
if(process.env.NODE_ENV!=='development'||!['127.0.0.1','localhost'].includes(parsed.hostname)||
  parsed.port!=='27017'||parsed.pathname!=='/ips_ci'||
  (process.env.IPS_TEST_BASE_URL&&!/^http:\/\/127\.0\.0\.1:8080\/?$/.test(process.env.IPS_TEST_BASE_URL)))
  throw Error('Adversarial workload requires isolated CI MongoDB and 127.0.0.1:8080 only');
const base='http://127.0.0.1:8080';
const suffix=crypto.randomBytes(6).toString('hex');
const id='SUP-CONCURRENCY-'+suffix;
const managerA='ADM-CI-RACE-REL-'+suffix,managerB='ADM-CI-RACE-COM-'+suffix,staff='ADM-CI-RACE-STAFF-'+suffix;
const passphrase='IsolatedAccountPassword38!';
const hash=password=>{
  const salt=crypto.randomBytes(16).toString('hex');
  return 'scrypt$'+salt+'$'+crypto.scryptSync(password,salt,64).toString('hex');
};
async function call(url,{method='GET',cookie='',body}={}){
  const response=await fetch(base+url,{method,headers:{
    ...(cookie?{cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(16000)});
  const data=await response.json().catch(()=>({}));
  return {status:response.status,data,cookie:(response.headers.get('set-cookie')||'').split(';')[0]};
}
async function signIn(route,email,password=passphrase){
  const result=await call(route,{method:'POST',body:{email,password}});
  assert.equal(result.status,200,route+' login failed');
  assert.ok(result.cookie.startsWith('ips_session='));
  return result.cookie;
}
let linked=false;
try{
  await mongoose.connect(uri);
  linked=true;
  const client=await Client.findOne({client_id:'CID-TEST-ALICE'}).lean();
  assert.ok(client?.email_verified_at,'Existing end-to-end client identity missing');
  await Admin.insertMany([
    {id:managerA,name:'Concurrency Client Relations Manager',email:'race-rel-'+suffix+'@example.org',
      password:hash(passphrase),role:'admin',company_role:'manager',department:'client_relations',
      status:'Active',email_verified_at:new Date(),must_change_password:false,
      permissions:permittedCompanyPermissions('client_relations','manager')},
    {id:managerB,name:'Concurrency Communications Manager',email:'race-com-'+suffix+'@example.org',
      password:hash(passphrase),role:'admin',company_role:'manager',department:'communications',
      status:'Active',email_verified_at:new Date(),must_change_password:false,
      permissions:permittedCompanyPermissions('communications','manager')},
    {id:staff,name:'Concurrency Client Relations Employee',email:'race-staff-'+suffix+'@example.org',
      password:hash(passphrase),role:'admin',company_role:'staff',department:'client_relations',
      manager_id:managerA,status:'Active',email_verified_at:new Date(),must_change_password:false,
      permissions:permittedCompanyPermissions('client_relations','staff')}
  ]);
  await SupportTicket.create({ticket_id:id,client_id:client.client_id,
    client_name:client.username,client_email:client.email,
    subject:'Concurrency and privacy test — isolated CI',category:'account',
    status:'Open',assigned_admin:'',messages:[{sender_id:client.client_id,
      sender_role:'client',body:'Please help me with a private research support request.'}]});
  await mongoose.disconnect(); linked=false;
  const [root,owner,mgrA,mgrB,employee]=await Promise.all([
    signIn('/api/admin/login',process.env.ADMIN_EMAIL,process.env.ADMIN_PASSWORD),
    signIn('/api/client/login',client.email,'ExampleTestPassword123!'),
    signIn('/api/admin/login','race-rel-'+suffix+'@example.org'),
    signIn('/api/admin/login','race-com-'+suffix+'@example.org'),
    signIn('/api/admin/login','race-staff-'+suffix+'@example.org')
  ]);
  const anonPaths=['/api/support-tickets','/api/admin/finance/operating-ledger',
    '/api/admin/company-team/roster','/api/admin/company-cases',
    '/api/admin/inbox','/api/notifications/client/CID-TEST-ALICE',
    '/api/student-payments/admin','/api/quote-requests/me',
    '/api/admin/me'];
  const checked=await Promise.all(anonPaths.map(url=>call(url)));
  assert.ok(checked.every(x=>[401,403,404].includes(x.status)),
    'One or more private IPS endpoints leaked to anonymous browser: '+
    JSON.stringify(checked.map((x,i)=>({route:anonPaths[i],code:x.status}))));
  console.log('IPS_ADVERSARIAL_ANONYMOUS_DENIED '+anonPaths.length+' protected routes');
  assert.equal((await call('/api/admin/finance/operating-ledger',{cookie:mgrA})).status,403);
  assert.equal((await call('/api/admin/company-team/roster',{cookie:employee})).status,403);
  assert.equal((await call('/api/notifications/client/CID-TEST-ALICE',{cookie:mgrB})).status,403);
  assert.equal((await call('/api/support-tickets',{cookie:mgrB})).status,200);
  const patch=(cookie,body)=>call('/api/support-tickets/'+id,{cookie,method:'PATCH',body});
  // Two real management actors race to claim the SAME case. MongoDB must
  // commit only one assignment, not silently take the second owner's work.
  const claims=await Promise.all([
    patch(root,{assigned_admin:managerA}),
    patch(root,{assigned_admin:managerB})
  ]);
  assert.deepEqual(claims.map(x=>x.status).sort((a,b)=>a-b),[200,409],
    'Concurrent root assignments must produce one winner and one explicit conflict');
  const winning=claims.find(x=>x.status===200).data.ticket.assigned_admin;
  const losing=winning===managerA?managerB:managerA;
  const activeCookie=winning===managerA?mgrA:mgrB;
  const passiveCookie=winning===managerA?mgrB:mgrA;
  assert.ok([managerA,managerB].includes(winning));
  const after=await call('/api/support-tickets',{cookie:passiveCookie});
  assert.equal(after.status,200);
  assert.ok(!after.data.tickets.some(x=>x.ticket_id===id),
    'Unrelated manager must not see a ticket assigned to the winner');
  const denied=await patch(passiveCookie,{priority:'urgent'});
  assert.equal(denied.status,403);
  const wrongReply=await call('/api/support-tickets/'+id+'/messages',{
    cookie:passiveCookie,method:'POST',body:{message:'I must never see or reply to the other team case.'}});
  assert.equal(wrongReply.status,403);
  console.log('IPS_ADVERSARIAL_ASSIGNMENT_ATOMIC_GREEN 2 concurrent Root claims, 1 owner, explicit 409, losing department isolated');
  if(winning===managerB){
    const transfer=await patch(root,{assigned_admin:managerA});
    assert.equal(transfer.status,200);
  }
  const delegated=await patch(mgrA,{assigned_admin:staff});
  assert.equal(delegated.status,200,JSON.stringify(delegated.data));
  const ownerInbox=await call('/api/support-tickets',{cookie:employee});
  assert.equal(ownerInbox.status,200);
  assert.ok(ownerInbox.data.tickets.some(x=>x.ticket_id===id));
  // Concurrent replies from the verified client must not be overwritten by
  // Mongoose's concurrent array modifications.
  const n=12;
  const messages=Array.from({length:n},(_,i)=>'Private CI concurrent reply '+i+' / '+suffix);
  const replies=await Promise.all(messages.map(message=>
    call('/api/support-tickets/'+id+'/messages',{method:'POST',cookie:owner,body:{message}})));
  assert.ok(replies.every(x=>x.status===200),
    'Verified client concurrent replies all require success codes');
  const afterMessages=await call('/api/support-tickets',{cookie:owner});
  assert.equal(afterMessages.status,200);
  const persisted=afterMessages.data.tickets.find(x=>x.ticket_id===id);
  assert.ok(persisted,'Owner must retain their customer ticket');
  const actual=new Set(persisted.messages.map(x=>x.body));
  for(const message of messages)assert.ok(actual.has(message),'Lost concurrent customer reply '+message);
  assert.equal(persisted.messages.length,n+1,'Concurrent client replies must preserve exact original and all new messages');
  const final=await call('/api/support-tickets',{cookie:employee});
  assert.equal(final.status,200);
  assert.ok(final.data.tickets.some(x=>x.ticket_id===id));
  console.log('IPS_ADVERSARIAL_CONCURRENT_CLIENT_REPLIES_GREEN '+n+' simultaneous signed messages survived with exact text and no privacy break');
  const close=await patch(employee,{status:'Closed'});
  assert.equal(close.status,200);
  const postClose=await call('/api/support-tickets/'+id+'/messages',{
    cookie:owner,method:'POST',body:{message:'This closed ticket must reject new updates.'}});
  assert.equal(postClose.status,409);
  assert.equal((await call('/api/support-tickets',{cookie:mgrB})).data.tickets.some(x=>x.ticket_id===id),false);
  console.log('IPS_ADVERSARIAL_CLOSED_CASE_GREEN closed cases reject new messages, other departments remain isolated');
}finally{
  if(!linked){await mongoose.connect(uri).then(()=>linked=true).catch(()=>{});}
  if(linked){
    await Promise.allSettled([
      SupportTicket.deleteMany({ticket_id:id}),
      Notification.deleteMany({order_id:id}),
      Admin.deleteMany({id:{$in:[managerA,managerB,staff]}})
    ]);
    await mongoose.disconnect();
  }
}
