import crypto from 'node:crypto';
import Admin from '../models/Admin.js';
import Client from '../models/Client.js';
import ContactEnquiry from '../models/ContactEnquiry.js';
import SupportTicket from '../models/SupportTicket.js';
import CompanyCaseAction from '../models/CompanyCaseAction.js';
import AuditLog from '../models/AuditLog.js';
import {sendBusinessEmail} from './businessEmailTransport.js';
import {requestPasswordRecovery,recoveryReady} from './passwordRecovery.js';
import {emailValid,normalizeEmail} from '../shared/privacyIdentity.js';
import {hasAdminPermission} from '../shared/adminPermissions.js';
import {COMPANY_DEPARTMENTS,isCompanyDepartment,mayManageTeamMember,
  permittedCompanyPermissions,managerTeamTitle,companyStaffPasswordValid} from '../shared/companyGovernance.js';
import {isIpsQaFixtureAdmin,isIpsQaFixtureClient} from '../shared/ipsCompanyScope.js';

const emailRegex=/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const actorAllowed=(req,res,requireSession)=>{
  const session=requireSession(req,res);
  if(!session)return null;
  if(session.role!=='admin'||!req.adminAccess||
    !(req.adminAccess.isRoot||req.adminAccess.companyRole==='manager')){
    res.status(403).json({success:false,error:'Only the company owner or an authorized department manager may govern staff.'});return null;
  }
  return req.adminAccess;
};
export const invitationDigest=(token,secret)=>
  crypto.createHmac('sha256',secret).update('IPS-STAFF-INVITE|'+token).digest('hex');
const appBase=env=>{
  try{const u=new URL(env.PUBLIC_APP_URL||'');
    if((u.protocol==='https:'||(env.NODE_ENV!=='production'&&u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname)))&&
      !u.username&&!u.password&&!u.search&&!u.hash&&(u.pathname==='/'||u.pathname===''))return u.origin;
  }catch{}
  return null;
};
export const staffInvitationReady=(env=process.env)=>Boolean(
  env.EMAIL_VERIFICATION_SECRET?.length>=32&&env.CONTACT_RESEND_API_KEY&&appBase(env)
);
const safeAccount=a=>({id:a.id,name:a.name,email:a.email,company_role:a.company_role||'legacy',
  department:a.department||'',manager_id:a.manager_id||'',status:a.status||'Active',
  permissions:(a.permissions||[]).filter(x=>x!=='*'),last_login_at:a.last_login_at||null,
  createdAt:a.createdAt,invite_sent_at:a.invite_sent_at||null});
const validationReason=(name,email)=>String(name||'').trim().length<2||String(name||'').length>120||
  !emailValid(normalizeEmail(email))?'Provide a staff name and a valid work email.':null;
async function log({actor,action,details}){
  await AuditLog.create({order_id:'IPS-STAFF',actor_id:actor,actor_role:'admin',action,details});
}
function staffEmailText({name,department,role,link}){
  return 'Hello '+name+',\n\n'+
    'IPS Academic Services has invited you to join the '+managerTeamTitle(department)+
    ' department as '+(role==='manager'?'department manager':'team member')+'.\n\n'+
    'Set your own password through this private, one-time link (valid for 48 hours):\n'+link+
    '\n\nIf you did not expect this invitation, do not open it. Never share your link or password with company staff.\n\n'+
    'IPS Academic Services';
}
const invalid=(res,error,status=400)=>res.status(status).json({success:false,error});
const production=()=>process.env.NODE_ENV==='production'&&String(process.env.IPS_EVALUATION_MODE||'')!=='true';

export function registerCompanyOperatingSystem(app,{
  requireSession,hashPassword,validAdminPassword,adminModel=Admin,
  clientModel=Client,send=sendBusinessEmail,env=process.env
}={}){
  app.get('/api/admin/company-team/roster',async(req,res)=>{
    const actor=actorAllowed(req,res,requireSession);if(!actor)return;
    try{
      const query=actor.isRoot?{}:{company_role:'staff',department:actor.department,manager_id:actor.adminId};
      const members=await adminModel.find(query).sort({createdAt:-1}).select('-password -invite_token_hash').lean();
      const filtered=production()?members.filter(a=>!isIpsQaFixtureAdmin(a)):members;
      const ids=filtered.map(x=>x.id);
      const [taskCounts,quoteCounts,ticketCounts]=ids.length?await Promise.all([
        CompanyCaseAction.aggregate([{$match:{assigned_to:{$in:ids},entry_kind:'task',task_status:'open'}},
          {$group:{_id:'$assigned_to',count:{$sum:1}}}]),
        ContactEnquiry.aggregate([{$match:{assigned_admin_id:{$in:ids},status:{$nin:['closed','cancelled']}}},
          {$group:{_id:'$assigned_admin_id',count:{$sum:1}}}]),
        SupportTicket.aggregate([{$match:{assigned_admin:{$in:ids},status:{$nin:['Resolved','Closed']}}},
          {$group:{_id:'$assigned_admin',count:{$sum:1}}}])
      ]):[[],[],[]];
      const countMap=rows=>new Map(rows.map(x=>[String(x._id),x.count]));
      const [tasks,quotes,tickets]=[taskCounts,quoteCounts,ticketCounts].map(countMap);
      const withLoad=filtered.map(x=>({...safeAccount(x),
        workload:{tasks:tasks.get(x.id)||0,enquiries:quotes.get(x.id)||0,support:tickets.get(x.id)||0}}));
      res.set('Cache-Control','private, no-store');
      res.json({success:true,members:withLoad,
        departments:actor.isRoot?Object.fromEntries(Object.entries(COMPANY_DEPARTMENTS).map(([key,v])=>[key,v.label])):
          {[actor.department]:managerTeamTitle(actor.department)},
        self:{id:actor.adminId,role:actor.isRoot?'root':actor.companyRole,department:actor.department||'',manager_id:actor.managerId||null},
        management_level:actor.isRoot?'root':'manager'});
    }catch{return invalid(res,'Team directory is unavailable.',503);}
  });

  app.post('/api/admin/company-team/invite',async(req,res)=>{
    const actor=actorAllowed(req,res,requireSession);if(!actor)return;
    const {name,department}=req.body||{};
    const email=normalizeEmail(req.body?.email);
    const targetRole=actor.isRoot?'manager':'staff';
    const targetDepartment=actor.isRoot?String(department||''):actor.department;
    const problem=validationReason(name,email);
    if(problem)return invalid(res,problem);
    if(!isCompanyDepartment(targetDepartment))return invalid(res,'Choose a valid IPS department.');
    if(!actor.isRoot&&department&&department!==actor.department)
      return invalid(res,'A manager cannot invite staff outside their assigned department.',403);
    if(req.body?.company_role&&req.body.company_role!==targetRole)
      return invalid(res,'Only the owner appoints department managers; managers invite staff under themselves.',403);
    if(req.body?.manager_id&&(actor.isRoot||req.body.manager_id!==actor.adminId))
      return invalid(res,'A staff member must report to the inviting manager.',403);
    if(!staffInvitationReady(env))return invalid(res,'Staff invitation email delivery is not ready.',503);
    const available=permittedCompanyPermissions(targetDepartment,targetRole);
    const requested=req.body?.permissions;
    if(requested!==undefined&&(!Array.isArray(requested)||requested.some(x=>!available.includes(x))))
      return invalid(res,'You cannot delegate permission beyond the selected department.');
    const permissions=Array.isArray(requested)?available.filter(x=>requested.includes(x)):available;
    if(!permissions.includes('platform.access')||!permissions.includes('dashboard.view'))
      return invalid(res,'Workspace access and the dashboard are mandatory.');
    if(await adminModel.exists({email}))return invalid(res,'This staff email is already registered.',409);
    const token=crypto.randomBytes(32).toString('base64url');
    const hash=invitationDigest(token,env.EMAIL_VERIFICATION_SECRET);
    const newId='ADM-'+crypto.randomBytes(9).toString('hex').toUpperCase();
    let member;
    try{
      member=await adminModel.create({id:newId,name:String(name).trim(),email,
        password:hashPassword(crypto.randomBytes(36).toString('base64url')),
        role:'moderator',company_role:targetRole,department:targetDepartment,
        manager_id:actor.isRoot?'':actor.adminId,permissions,status:'Invited',
        must_change_password:true,invite_token_hash:hash,
        invite_expires_at:new Date(Date.now()+48*3600000),invite_sent_at:new Date(),
        created_by:actor.adminId,session_version:1});
      const link=appBase(env)+'/ips-staff-onboarding#id='+encodeURIComponent(newId)+'&token='+token;
      await send({to:email,subject:'Your private IPS staff invitation',
        body:staffEmailText({name:String(name).trim(),department:targetDepartment,role:targetRole,link}),env});
      await log({actor:actor.adminId,action:'company_staff_invited',
        details:{staff_id:newId,department:targetDepartment,company_role:targetRole}});
      res.set('Cache-Control','private, no-store');
      return res.status(201).json({success:true,member:safeAccount(member),
        message:'Invitation delivered to the staff member. They choose their own password.'});
    }catch(error){
      // An undelivered invite must not later be accepted; never expose secret.
      if(member){await adminModel.updateOne({id:newId,status:'Invited'},{$set:{status:'Locked'},
        $unset:{invite_token_hash:1,invite_expires_at:1}}).catch(()=>{});}
      return invalid(res,'Could not deliver the invitation. The pending account was locked; retry after checking email configuration.',503);
    }
  });

  app.post('/api/admin/company-team/accept',async(req,res)=>{
    const id=String(req.body?.id||'').trim();
    const token=String(req.body?.token||'');
    const password=String(req.body?.password||'');
    if(!/^ADM-[A-F0-9]{18}$/.test(id)||!/^[a-zA-Z0-9_-]{43}$/.test(token)||
      !validAdminPassword(password)||!companyStaffPasswordValid(password))return invalid(res,'Enter a password with at least 10 characters, an uppercase letter, a number and a symbol.',400);
    if(!env.EMAIL_VERIFICATION_SECRET||env.EMAIL_VERIFICATION_SECRET.length<32)return invalid(res,'Invitations unavailable.',503);
    const digest=invitationDigest(token,env.EMAIL_VERIFICATION_SECRET);
    const account=await adminModel.findOneAndUpdate({
      id,status:'Invited',invite_token_hash:digest,invite_expires_at:{$gt:new Date()}
    },{$set:{password:hashPassword(password),status:'Active',must_change_password:false,
      email_verified_at:new Date(),joined_at:new Date(),session_version:2},
      $unset:{invite_token_hash:1,invite_expires_at:1,invite_sent_at:1}
    },{new:true,runValidators:true});
    if(!account)return invalid(res,'This invitation is invalid, expired or already used.',400);
    await log({actor:account.id,action:'company_staff_activated',
      details:{staff_id:account.id,department:account.department,company_role:account.company_role}});
    res.set('Cache-Control','no-store');
    res.json({success:true,message:'Your IPS company account is activated. Sign in using your work email and password.'});
  });

  app.post('/api/admin/company-team/legacy/:id/adopt',async(req,res)=>{
    const actor=actorAllowed(req,res,requireSession);if(!actor)return;
    if(!actor.isRoot)return invalid(res,'Only the company owner can assign existing legacy staff to managers.',403);
    const target=await adminModel.findOne({id:req.params.id});
    if(!target||target.company_role||target.status!=='Active'||target.id===actor.adminId)
      return invalid(res,'Only an existing active, unassigned legacy administrator can be adopted.',409);
    const manager=await adminModel.findOne({id:String(req.body?.manager_id||''),company_role:'manager',status:'Active'});
    if(!manager||!isCompanyDepartment(manager.department))
      return invalid(res,'Choose an active department manager.',400);
    const allowed=permittedCompanyPermissions(manager.department,'staff');
    target.company_role='staff';target.department=manager.department;target.manager_id=manager.id;
    target.role='moderator';target.custom_role_id='';
    target.permissions=allowed;target.session_version=Number(target.session_version||1)+1;
    await target.save();
    await log({actor:actor.adminId,action:'company_legacy_staff_assigned',
      details:{staff_id:target.id,manager_id:manager.id,department:target.department}});
    return res.json({success:true,member:safeAccount(target),sessionsRevoked:true});
  });

  app.patch('/api/admin/company-team/members/:id',async(req,res)=>{
    const actor=actorAllowed(req,res,requireSession);if(!actor)return;
    if(actor.adminId===req.params.id||actor.isRoot&&req.params.id===actor.email)
      return invalid(res,'You cannot modify your own company authority or status.',409);
    const target=await adminModel.findOne({id:req.params.id});
    if(!target||!mayManageTeamMember(actor,target))return invalid(res,'This team member is outside your delegated authority.',403);
    const allowed=permittedCompanyPermissions(target.department,target.company_role);
    const updates=req.body||{};
    if(updates.permissions!==undefined){
      if(!Array.isArray(updates.permissions)||updates.permissions.some(x=>!allowed.includes(x)))
        return invalid(res,'Cannot grant permission outside the department.',403);
      const capped=allowed.filter(x=>updates.permissions.includes(x)&&
        (actor.isRoot||actor.permissions.includes(x)));
      if(!capped.includes('platform.access')||!capped.includes('dashboard.view'))
        return invalid(res,'Core workspace access is required.');
      target.permissions=capped;
    }
    if(updates.status!==undefined){
      if(!['Active','Suspended'].includes(updates.status))
        return invalid(res,'Use governed offboarding for archives. Other statuses are not available here.');
      if(target.status==='Invited')return invalid(res,'An invitation must be accepted before changing active status.');
      target.status=updates.status;
      target.suspended_reason=updates.status==='Suspended'?
        String(updates.reason||'Suspended by authorized company manager').slice(0,500):'';
    }
    if(updates.name!==undefined)target.name=String(updates.name||'').trim().slice(0,120);
    target.session_version=Number(target.session_version||1)+1;
    await target.save();
    await log({actor:actor.adminId,action:'company_staff_updated',
      details:{staff_id:target.id,status:target.status,department:target.department}});
    res.set('Cache-Control','private, no-store');
    res.json({success:true,member:safeAccount(target),sessionsRevoked:true});
  });

  app.post('/api/admin/company-team/members/:id/offboard',async(req,res)=>{
    const actor=actorAllowed(req,res,requireSession);if(!actor)return;
    const memberId=String(req.params.id||'');
    if(memberId===actor.adminId||memberId===actor.email)return invalid(res,'The current company owner or acting manager cannot offboard themselves.',409);
    const target=await adminModel.findOne({id:memberId});
    if(!target||!mayManageTeamMember(actor,target))return invalid(res,'Cannot offboard an administrator outside your team.',403);
    const replacementId=String(req.body?.replacement_id||'');
    if(replacementId===memberId)return invalid(res,'A replacement cannot be the outgoing team member.');
    const replacement=replacementId?await adminModel.findOne({id:replacementId,status:'Active'}).lean():null;
    if(replacementId&&(!replacement||replacement.department!==target.department||
      (actor.isRoot?replacement.company_role!=='manager':replacement.company_role!=='staff'||replacement.manager_id!==actor.adminId)))
      return invalid(res,'Choose an active approved replacement from the same department.');
    const [actions,quotes,support,staffReports]=await Promise.all([
      CompanyCaseAction.countDocuments({assigned_to:memberId,entry_kind:'task',task_status:'open'}),
      ContactEnquiry.countDocuments({assigned_admin_id:memberId,status:{$nin:['closed','cancelled']}}),
      SupportTicket.countDocuments({assigned_admin:memberId,status:{$nin:['Closed','Resolved']}}),
      adminModel.countDocuments({manager_id:memberId,status:{$ne:'Archived'}})
    ]);
    const outstanding=actions+quotes+support+staffReports;
    if(outstanding&&!replacement)return res.status(409).json({success:false,
      error:'Transfer assigned cases, open follow-ups and any direct reports before offboarding.',
      outstanding:{tasks:actions,enquiries:quotes,support,staff:staffReports}});
    if(replacement){
      await CompanyCaseAction.updateMany({assigned_to:memberId,entry_kind:'task',task_status:'open'},
        {$set:{assigned_to:replacement.id}});
      await ContactEnquiry.updateMany({assigned_admin_id:memberId,status:{$nin:['closed','cancelled']}},
        {$set:{assigned_admin_id:replacement.id}});
      await SupportTicket.updateMany({assigned_admin:memberId,status:{$nin:['Closed','Resolved']}},
        {$set:{assigned_admin:replacement.id}});
      if(actor.isRoot&&target.company_role==='manager')
        await adminModel.updateMany({manager_id:memberId,status:{$ne:'Archived'}},{$set:{manager_id:replacement.id}});
    }
    target.status='Archived';
    target.suspended_reason=String(req.body?.reason||'Company-authorized offboarding').slice(0,500);
    target.session_version=Number(target.session_version||1)+1;
    target.invite_token_hash=undefined;target.invite_expires_at=undefined;
    await target.save();
    await log({actor:actor.adminId,action:'company_staff_offboarded',
      details:{staff_id:memberId,replacement_id:replacementId||null,transferred:{tasks:actions,enquiries:quotes,support,staff:staffReports}}});
    res.set('Cache-Control','private, no-store');
    res.json({success:true,archived:true,replacement_id:replacementId||null,sessionsRevoked:true});
  });

  app.post('/api/admin/clients/:id/password-recovery',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    const access=req.adminAccess;
    if(session.role!=='admin'||!access||!hasAdminPermission(access,'clients.recovery'))
      return invalid(res,'Client password recovery permission required.',403);
    const id=String(req.params.id||'');
    const reason=String(req.body?.reason||'').trim();
    if(!/^CID-[A-Za-z0-9_-]{5,60}$/.test(id)||reason.length<10||reason.length>500)
      return invalid(res,'A valid client reference and a meaningful support reason are required.');
    if(!recoveryReady(env))return invalid(res,'Verified email password recovery is not available.',503);
    try{
      const client=await clientModel.findOne({client_id:id}).select('client_id email email_verified_at status');
      if(!client||client.status!=='Active'||!client.email_verified_at||
        (production()&&isIpsQaFixtureClient(client)))
        return invalid(res,'Only active email-verified IPS clients can receive recovery links.',409);
      const result=await requestPasswordRecovery(client.email,{env,model:clientModel,send});
      if(result.unavailable)return invalid(res,'Secure recovery is unavailable.',503);
      if(result.alreadySent)return invalid(res,'A recovery link was requested recently. Please do not resend within 60 seconds.',429);
      if(!result.delivered)return invalid(res,'The email provider did not accept the recovery message. No valid reset link remains.',503);
      await log({actor:access.adminId,action:'company_client_password_recovery_initiated',
        details:{client_id:id,reason,delivery:'verified_account_email_only'}});
      res.set('Cache-Control','private, no-store');
      res.status(202).json({success:true,message:'If eligible, a one-time recovery link has been sent to the verified customer email. Staff cannot see or change the password.'});
    }catch{return invalid(res,'Client password recovery is temporarily unavailable.',503);}
  });
}
