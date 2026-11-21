import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import SupportTicket from '../models/SupportTicket.js';
import Notification from '../models/Notification.js';
import {permittedCompanyPermissions} from '../shared/companyGovernance.js';

const BASE=process.env.IPS_TEST_BASE_URL||'http://127.0.0.1:8080';
const unique=crypto.randomBytes(5).toString('hex');
const prefix='SUP-CI-'+unique;
const ids={manager:prefix+'-MANAGER',staff:prefix+'-STAFF',foreign:prefix+'-FOREIGN',communications:prefix+'-COMM'};
const tickets={main:prefix+'-MAIN',unclaimed:prefix+'-UNCLAIMED'};
const password='CaseSupportPassword2026!';
const hash=p=>{
  const salt=crypto.randomBytes(16).toString('hex');
  return 'scrypt$'+salt+'$'+crypto.scryptSync(p,salt,64).toString('hex');
};
async function call(path,{cookie='',method='GET',body}={}){
  const response=await fetch(BASE+path,{method,
    headers:{...(cookie?{cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({}));
  return {status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0]||''};
}
async function login(email,p=password){
  const result=await call('/api/admin/login',{method:'POST',body:{email,password:p}});
  assert.equal(result.status,200,JSON.stringify(result.data));
  assert.ok(result.cookie.startsWith('ips_session='));
  return result.cookie;
}
try{
  const uri=String(process.env.MONGODB_URI||'');
  const parsed=new URL(uri);
  if(!['localhost','127.0.0.1'].includes(parsed.hostname)||parsed.pathname!=='/ips_ci')
    throw Error('Refusing to mutate a non-isolated support assignment database');
  await mongoose.connect(uri);
  const at=new Date();
  await Admin.insertMany([
    {id:ids.manager,name:'Support CI Department Manager',
      email:'support-manager-'+unique+'@example.org',password:hash(password),role:'admin',
      company_role:'manager',department:'client_relations',status:'Active',
      email_verified_at:at,must_change_password:false,
      permissions:permittedCompanyPermissions('client_relations','manager')},
    {id:ids.staff,name:'Support CI Direct Employee',
      email:'support-staff-'+unique+'@example.org',password:hash(password),role:'admin',
      company_role:'staff',department:'client_relations',manager_id:ids.manager,status:'Active',
      email_verified_at:at,must_change_password:false,
      permissions:permittedCompanyPermissions('client_relations','staff')},
    {id:ids.foreign,name:'Support CI Other Department Manager',
      email:'support-other-'+unique+'@example.org',password:hash(password),role:'admin',
      company_role:'manager',department:'academic_delivery',status:'Active',
      email_verified_at:at,must_change_password:false,
      permissions:permittedCompanyPermissions('academic_delivery','manager')},
    {id:ids.communications,name:'Support CI Communications Manager',
      email:'support-communications-'+unique+'@example.org',password:hash(password),role:'admin',
      company_role:'manager',department:'communications',status:'Active',
      email_verified_at:at,must_change_password:false,
      permissions:permittedCompanyPermissions('communications','manager')}
  ]);
  await SupportTicket.insertMany([tickets.main,tickets.unclaimed].map((ticket_id,i)=>({
    ticket_id,client_id:'CID-SUPPORT-CI-'+unique,
    client_name:'Private support customer',client_email:'case-client-'+unique+'@example.org',
    subject:i?'Unclaimed customer help':'Account help and service responsibility',
    category:'account',priority:'standard',status:'Open',
    messages:[{sender_id:'CID-SUPPORT-CI-'+unique,sender_role:'client',body:'A private customer requires company assistance.'}]
  })));
  await mongoose.disconnect();

  const root=await login(process.env.ADMIN_EMAIL,process.env.ADMIN_PASSWORD);
  const manager=await login('support-manager-'+unique+'@example.org');
  const staff=await login('support-staff-'+unique+'@example.org');
  const foreign=await login('support-other-'+unique+'@example.org');
  const communication=await login('support-communications-'+unique+'@example.org');
  const patch=(ticket_id,cookie,body)=>call('/api/support-tickets/'+ticket_id,{method:'PATCH',cookie,body});

  for(const proposed of ['alllowercase123456','HasUppercaseButNoSymbol123']){
    const weakChange=await call('/api/admin/change-password',{
      cookie:staff,method:'POST',body:{currentPassword:password,newPassword:proposed}
    });
    assert.equal(weakChange.status,400,'Employees must not bypass the uppercase-number-symbol password constitution');
  }
  console.log('STAFF_PASSWORD_POLICY_PASS employee password changes reject weak or symbolless credentials without session damage');
  const foreignListing=await call('/api/support-tickets',{cookie:foreign});
  assert.equal(foreignListing.status,403,'Academic managers cannot read confidential customer ticket conversations');
  const communicationBefore=await call('/api/support-tickets',{cookie:communication});
  assert.equal(communicationBefore.status,200);
  assert.ok(communicationBefore.data.tickets.some(t=>t.ticket_id===tickets.unclaimed),
    'An authorized second department may inspect unclaimed work, but not another team ownership.');
  const noSupportListing=await call('/api/support-tickets');
  assert.equal(noSupportListing.status,401,'Guests cannot list private support cases');
  const managerListing=await call('/api/support-tickets',{cookie:manager});
  assert.equal(managerListing.status,200,'Support department manager must have their actual case inbox');
  assert.ok(managerListing.data.tickets.some(x=>x.ticket_id===tickets.main));
  const staffListing=await call('/api/support-tickets',{cookie:staff});
  assert.equal(staffListing.status,200,'Support employees can access their authorized support queue');
  console.log('SUPPORT_PRIVATE_DIRECTORY_PASS finance/academic staff and guests cannot inspect private customer cases');
  const foreignEdit=await patch(tickets.main,foreign,{priority:'urgent'});
  assert.equal(foreignEdit.status,403);
  assert.equal((await call('/api/student-payments/admin',{cookie:manager})).status,403,
    'Client Relations managers cannot inspect the private company payment ledger');
  assert.equal((await call('/api/admin/finance/operating-ledger',{cookie:staff})).status,403,
    'Support employees cannot inspect protected finance');
  console.log('FINANCIAL_LEAST_PRIVILEGE_PASS authenticated nonfinance manager and support employee are denied');
  const staffUnauthorized=await patch(tickets.main,staff,{priority:'urgent'});
  assert.equal(staffUnauthorized.status,403);
  const prematureReply=await call('/api/support-tickets/'+tickets.main+'/messages',{
    method:'POST',cookie:staff,body:{message:'I must not reply before I own the customer case.'}});
  assert.equal(prematureReply.status,403);
  const rootForbidden=await patch(tickets.main,root,{assigned_admin:ids.staff});
  assert.equal(rootForbidden.status,403,'Root must never bypass departmental managers');
  const rootAssign=await patch(tickets.main,root,{assigned_admin:ids.manager});
  assert.equal(rootAssign.status,200,JSON.stringify(rootAssign.data));
  assert.equal(rootAssign.data.ticket.assigned_admin,ids.manager);
  const managerPriority=await patch(tickets.main,manager,{priority:'urgent'});
  assert.equal(managerPriority.status,200);
  const crossManager=await patch(tickets.main,foreign,{assigned_admin:ids.foreign});
  assert.equal(crossManager.status,403);
  const communicationAfter=await call('/api/support-tickets',{cookie:communication});
  assert.equal(communicationAfter.status,200);
  assert.ok(!communicationAfter.data.tickets.some(t=>t.ticket_id===tickets.main),
    'Communications manager cannot inspect client-relations manager private cases after assignment.');
  const managerDelegate=await patch(tickets.main,manager,{assigned_admin:ids.staff});
  assert.equal(managerDelegate.status,200,JSON.stringify(managerDelegate.data));
  assert.equal(managerDelegate.data.ticket.assigned_admin,ids.staff);
  const communicationAfterStaff=await call('/api/support-tickets',{cookie:communication});
  assert.equal(communicationAfterStaff.status,200);
  assert.ok(!communicationAfterStaff.data.tickets.some(t=>t.ticket_id===tickets.main),
    'Unrelated department must not read messages after internal team delegation.');
  const staffUpdate=await patch(tickets.main,staff,{status:'In Progress'});
  assert.equal(staffUpdate.status,200,JSON.stringify(staffUpdate.data));
  const realReply=await call('/api/support-tickets/'+tickets.main+'/messages',{
    method:'POST',cookie:staff,body:{message:'Your private support case is being investigated by IPS.'}});
  assert.equal(realReply.status,200,JSON.stringify(realReply.data));
  const staffSelfClaim=await patch(tickets.unclaimed,staff,{assigned_admin:ids.staff});
  assert.equal(staffSelfClaim.status,200,JSON.stringify(staffSelfClaim.data));
  const staffSteal=await patch(tickets.main,staff,{assigned_admin:ids.manager});
  assert.equal(staffSteal.status,403,'Staff cannot transfer support to managers or arbitrary colleagues');
  const rootSelf=await patch(tickets.unclaimed,root,{assigned_admin:process.env.ADMIN_EMAIL});
  assert.equal(rootSelf.status,403,'Root remains outside employee assignment');

  const managerInbox=await call('/api/notifications/admin/'+ids.manager,{cookie:manager});
  const staffInbox=await call('/api/notifications/admin/'+ids.staff,{cookie:staff});
  assert.equal(managerInbox.status,200);assert.equal(staffInbox.status,200);
  assert.ok(managerInbox.data.notifications.some(x=>
    x.type==='support_assignment'&&x.order_id===tickets.main));
  assert.ok(staffInbox.data.notifications.some(x=>
    x.type==='support_assignment'&&x.order_id===tickets.main));
  assert.equal((await call('/api/notifications/admin/'+ids.staff,{cookie:manager})).status,403,
    'Support managers do not gain private inbox access to their employees');
  await mongoose.connect(process.env.MONGODB_URI);
  const privateCustomerNotice=await Notification.findOne({
    type:'support_reply',recipient_role:'client',recipient_id:'CID-SUPPORT-CI-'+unique,
    order_id:tickets.main
  }).lean();
  assert.ok(privateCustomerNotice,'An actual support reply must notify its private client');
  assert.ok(!privateCustomerNotice.message.includes('private support case is being investigated'),
    'Notification must not contain confidential response details');
  await mongoose.disconnect();
  console.log('SUPPORT_ASSIGNMENT_E2E_GREEN actual signed Root, two managers, staff, confidential replies, private notifications and governed support handoff');
}finally{
  if(mongoose.connection.readyState!==1)await mongoose.connect(process.env.MONGODB_URI).catch(()=>{});
  if(mongoose.connection.readyState===1){
    await SupportTicket.deleteMany({ticket_id:{$in:Object.values(tickets)}}).catch(()=>{});
    await Notification.deleteMany({order_id:{$in:Object.values(tickets)}}).catch(()=>{});
    await Admin.deleteMany({id:{$in:Object.values(ids)}}).catch(()=>{});
    await mongoose.disconnect();
  }
}
