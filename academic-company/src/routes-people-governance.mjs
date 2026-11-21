// Governance of live IPS people without deleting Root or historical obligations.
const employee=a=>a&&['manager','staff'].includes(a.role);
const canRead=(actor,target)=>actor?.role==='root'||
 actor?.role==='manager'&&(
   target.role==='staff'&&target.managerId===actor.id||
   actor.department==='client_relations'&&target.role==='student'||
   actor.department==='specialist_network'&&target.role==='specialist');
const canManageStaff=(actor,target)=>employee(target)&&
 (actor?.role==='root'||actor?.role==='manager'&&
  target.role==='staff'&&target.managerId===actor.id);
const validReason=reason=>reason.length>=15&&reason.length<=900;

export function registerPeopleGovernanceRoutes(ctx){
 const {app,db,authorize,wrap,audit,now,notify,rootEmail}=ctx;
 const getTarget=async(req,res)=>{
  if(!authorize(req,res,['root','manager']))return null;
  const a=await db.accounts.findOne({id:req.params.id});
  if(!a){res.status(404).json({error:'No company user matches that identity.'});return null}
  if(a.role==='root'||a.id===rootEmail){
   res.status(403).json({error:'Nyoro Root Admin cannot be managed as an employee.'});
   return null;
  }
  return a;
 };
 app.get('/api/administration/people/:id/history',wrap(async(req,res)=>{
  const target=await getTarget(req,res);if(!target)return;
  if(!canRead(req.actor,target))
   return res.status(403).json({error:'This person is outside your assigned IPS management scope.'});
  const entries=await db.audit.find({ref:target.id}).sort({at:-1}).limit(60).toArray();
  res.json({person:{id:target.id,role:target.role,status:target.status,
    department:target.department||'',managerId:target.managerId||'',
    approved:!!target.approved,verified:!!target.verified},
   history:entries.map(x=>({id:x.id,action:x.action,actorRole:x.actorRole,
    at:x.at,ref:x.ref})),noPasswordsExposed:true});
 }));
 app.post('/api/administration/people/:id/revoke-sessions',wrap(async(req,res)=>{
  const target=await getTarget(req,res);if(!target)return;
  if(!canManageStaff(req.actor,target)&&req.actor.role!=='root')
   return res.status(403).json({error:'Only Root or this employee’s own manager can revoke sessions.'});
  const reason=String(req.body?.reason||'').trim();
  if(!validReason(reason))
   return res.status(400).json({error:'Provide an auditable written reason of 15–900 characters.'});
  await db.accounts.updateOne({id:target.id},{$inc:{sessionVersion:1},
   $set:{sessionsRevokedAt:now(),sessionsRevokedBy:req.actor.id}});
  await audit(req.actor,'academic_person_sessions_revoked',target.id,{reason});
  res.json({success:true,sessionsRevoked:true,noPasswordChanged:true});
 }));
 app.post('/api/administration/people/:id/reassign-manager',wrap(async(req,res)=>{
  const target=await getTarget(req,res);if(!target)return;
  if(req.actor.role!=='root'||target.role!=='staff')
   return res.status(403).json({error:'Only Nyoro can reassign IPS staff to another manager.'});
  const managerId=String(req.body?.managerId||''),
   reason=String(req.body?.reason||'').trim();
  if(!validReason(reason))return res.status(400).json({error:'Document the staff reassignment reason.'});
  const manager=await db.accounts.findOne({id:managerId,role:'manager',
   status:'active',verified:true,department:target.department});
  if(!manager)return res.status(409).json({error:'Select an active verified manager of the same IPS department.'});
  if(target.managerId===manager.id)return res.status(409).json({error:'This person already reports to the selected manager.'});
  const previous=target.managerId||'';
  await db.accounts.updateOne({id:target.id,role:'staff'},{$set:{
   managerId:manager.id,managerChangedBy:req.actor.id,managerChangedAt:now()},
   $inc:{sessionVersion:1}});
  await audit(req.actor,'academic_staff_manager_reassigned',target.id,
   {previousManagerId:previous,newManagerId:manager.id,reason});
  await notify(target.id,'IPS Administration updated your reporting manager. Please sign in again.','workforce');
  await notify(manager.id,'A staff member has been assigned to your IPS department team.','workforce');
  res.json({success:true,managerId:manager.id,previousManagerId:previous,sessionsRevoked:true});
 }));
 app.post('/api/administration/people/:id/offboard',wrap(async(req,res)=>{
  const target=await getTarget(req,res);if(!target)return;
  if(!canManageStaff(req.actor,target))
   return res.status(403).json({error:'Only Root or the staff member’s own manager can offboard this employee.'});
  if(target.status==='disabled')return res.status(409).json({error:'The employee has already been offboarded.'});
  const reason=String(req.body?.reason||'').trim();
  if(!validReason(reason))return res.status(400).json({error:'Explain the employee offboarding in writing.'});
  if(target.role==='manager'){
   const count=await db.accounts.countDocuments({role:'staff',managerId:target.id,
    status:{$nin:['disabled','suspended']}});
   if(count)return res.status(409).json({error:'Transfer active staff to another manager before offboarding this manager.'});
  }
  const unsettledQuotes=await db.quotes.countDocuments({assignedTo:target.id,
   status:{$nin:['accepted','declined','expired','cancelled','completed']}});
  const unresolvedSupport=await db.support.countDocuments({assignedTo:target.id,
   status:{$nin:['resolved','closed']}});
  if(unsettledQuotes||unresolvedSupport)
   return res.status(409).json({error:'Reassign active quotations and support cases before disabling this employee.',unsettledQuotes,unresolvedSupport});
  await db.accounts.updateOne({id:target.id,status:{$ne:'disabled'}},{$set:{
   status:'disabled',offboardedAt:now(),offboardedBy:req.actor.id,
   accountDisableReason:reason},$inc:{sessionVersion:1}});
  await audit(req.actor,'academic_employee_offboarded',target.id,{reason,
   historicalRecordsPreserved:true});
  res.json({success:true,disabled:true,sessionsRevoked:true,recordsPreserved:true});
 }));
}
