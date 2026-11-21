// Student, Specialist and IPS staff identity: new academic-services implementation.
import {email,username,validEmail,validUsername,validPassword,hashPassword,checkPassword,publicAccount,publicDocument,strongToken,validToken} from './security.mjs';
import {SERVICE_MAP,DEPARTMENTS} from './catalogue.mjs';
import {SPECIALIST_AGREEMENT} from './specialist-agreement.mjs';

export function registerIdentityRoutes(ctx){
 const {app,db,env,config,security,throttle,sendEmail,rootEmail,notify,audit,authorize,department,wrap,now,uid}=ctx;
 const requestedAt=()=>new Date(Date.now()+20*60000);
 const rootMatch=async p=>{
  const root=await db.rootCredentials.findOne({id:rootEmail},
   {projection:{passwordHash:1,sessionVersion:1}});
  return root&&checkPassword(String(p||''),root.passwordHash)?root:null;
 };
 const readonlyUser=a=>publicDocument(publicAccount(a));
 const normalizeName=x=>String(x||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
 const signedAgreement=(name,body)=>body?.specialistAgreementAccepted===true&&
  body?.specialistAgreementVersion===SPECIALIST_AGREEMENT.version&&
  normalizeName(body?.specialistSignature)===normalizeName(name);

 async function mailChallenge(a,reason='verify'){
  const token=strongToken(),hash=security.digest(reason+':'+token),deadline=requestedAt();
  const keys=reason==='verify'?{challengeHash:hash,challengeUntil:deadline}:{recoveryHash:hash,recoveryUntil:deadline};
  await db.accounts.updateOne({id:a.id},{$set:keys});
  const fragment=reason==='verify'?'verify':'recover';
  try{
   await sendEmail(a.email,reason==='verify'?'Confirm your IPS Academic Services email':'Your private IPS password recovery',
     (reason==='verify'?'Confirm that you own this email address. ':'Use this one-time password recovery link. ')+
     'Open within 20 minutes: '+config.origin+'/#'+fragment+'='+token+'&email='+encodeURIComponent(a.email)+
     '\n\nIPS communicates in writing. Never share your token with an administrator.');
  }catch(e){
   await db.accounts.updateOne({id:a.id,...(reason==='verify'?{challengeHash:hash}:{recoveryHash:hash})},
    {$unset:reason==='verify'?{challengeHash:'',challengeUntil:''}:{recoveryHash:'',recoveryUntil:''}});
   throw e;
  }
 }
 app.get('/api/specialist/agreement',(_req,res)=>res.json(SPECIALIST_AGREEMENT));
 app.post('/api/specialist/agreement/accept',wrap(async(req,res)=>{
  if(!authorize(req,res,['specialist']))return;
  const a=await db.accounts.findOne({id:req.actor.id,role:'specialist',verified:true,status:'active'});
  if(!a)return res.status(403).json({error:'Active Specialist access is required.'});
  if(!signedAgreement(a.name,req.body))
   return res.status(400).json({error:'Read the current confidentiality agreement and type your verified professional name to accept it.'});
  await db.accounts.updateOne({id:a.id,role:'specialist'},{$set:{
   specialistAgreementVersion:SPECIALIST_AGREEMENT.version,
   specialistAgreementSha256:SPECIALIST_AGREEMENT.sha256,
   specialistAgreementSignature:a.name,
   specialistAgreementAcceptedAt:now(),updatedAt:now()}});
  await audit(req.actor,'academic_specialist_agreement_accepted',a.id,
   {version:SPECIALIST_AGREEMENT.version,sha256:SPECIALIST_AGREEMENT.sha256});
  res.json({success:true,agreementVersion:SPECIALIST_AGREEMENT.version});
 }));
 app.post('/api/auth/register',wrap(async(req,res)=>{
  if(await throttle.limited(req,'academic-register',7))return res.status(429).json({error:'Too many requests. Please retry later.'});
  const role=String(req.body?.role||''),mail=email(req.body?.email),password=String(req.body?.password||'');
  const uname=username(req.body?.username),fullName=String(req.body?.fullName||'').trim();
  if(config.staging&&!config.allowedStagingEmails.includes(mail))
   return res.status(403).json({error:'This isolated IPS provider-testing environment admits only approved testing identities.'});
  if(!['student','specialist'].includes(role)||!validEmail(mail)||!validPassword(password)||req.body?.confirmPassword!==password||req.body?.privacyConsent!==true)
   return res.status(400).json({error:'Choose a valid academic account, real email, strong password and privacy consent.'});
  if(role==='student'&&!validUsername(uname))return res.status(400).json({error:'Choose a private username with 3–32 permitted characters.'});
  if(role==='specialist'&&(fullName.length<3||fullName.length>120))return res.status(400).json({error:'A Specialist must supply their real professional full name.'});
  const expertise=role==='specialist'?Array.isArray(req.body.expertise)?
   [...new Set(req.body.expertise.filter(id=>SERVICE_MAP.has(id)))].slice(0,12):[]:[];
  if(role==='specialist'&&!expertise.length)return res.status(400).json({error:'Choose the actual academic services you can professionally support.'});
  if(role==='specialist'&&(String(req.body?.qualification||'').trim().length<3||
   !signedAgreement(fullName,req.body)))
   return res.status(400).json({error:'Provide a professional qualification and explicitly sign the current IPS Specialist confidentiality agreement with your full name.'});
  if(mail===rootEmail||await db.accounts.findOne({$or:[{email:mail},...(role==='student'?[{usernameKey:uname.toLowerCase()}]:[])]}))
   return res.status(409).json({error:'The email or username is already registered.'});
  const item={id:uid(role==='student'?'STU':'SPC'),role,email:mail,username:role==='student'?uname:'',
   ...(role==='student'?{usernameKey:uname.toLowerCase()}:{}),name:role==='specialist'?fullName:'',
   expertise,passwordHash:hashPassword(password),verified:false,approved:false,status:'pending_verification',
   sessionVersion:1,department:'',managerId:'',contactPreference:'workspace',
   ...(role==='specialist'?{specialistAgreementVersion:SPECIALIST_AGREEMENT.version,
     specialistAgreementSha256:SPECIALIST_AGREEMENT.sha256,
     specialistAgreementSignature:fullName,specialistAgreementAcceptedAt:now()}:{}),
   ...(role==='specialist'?{availabilityStatus:'unavailable',maxConcurrentCases:0,
     activeAssignments:0,turnaroundDays:0}:{}),
   privacyConsentAt:now(),createdAt:now(),lastLoginAt:null,
   ...(role==='specialist'?{qualification:String(req.body.qualification||'').slice(0,300),
     experience:String(req.body.experience||'').slice(0,200)}:{})};
  try{await db.accounts.insertOne(item)}catch(e){if(e.code===11000)return res.status(409).json({error:'Email or username already registered.'});throw e}
  try{await mailChallenge(item,'verify')}
  catch{await db.accounts.deleteOne({id:item.id,status:'pending_verification'});return res.status(503).json({error:'We could not deliver your verification email. The account was not activated.'})}
  await audit(item,'academic_registration_requested',item.id,{role});
  res.status(202).json({success:true,verificationRequired:true,message:'IPS emailed a private verification link. No account can sign in before verification.'});
 }));
 app.post('/api/auth/verify',wrap(async(req,res)=>{
  if(await throttle.limited(req,'academic-verify',15))return res.status(429).json({error:'Please wait before trying again.'});
  const mail=email(req.body?.email),token=String(req.body?.token||'');
  if(!validEmail(mail)||!validToken(token))return res.status(400).json({error:'Verification link invalid or expired.'});
  const found=await db.accounts.findOneAndUpdate({email:mail,verified:false,status:'pending_verification',
    challengeHash:security.digest('verify:'+token),challengeUntil:{$gt:now()}},
   {$set:{verified:true,status:'active'},$unset:{challengeHash:'',challengeUntil:''}},
   {returnDocument:'after'});
  if(!found)return res.status(400).json({error:'Verification link expired, used or invalid.'});
  if(found.role==='specialist'){
   await db.accounts.updateOne({id:found.id},{$set:{status:'pending_review'}});
   await notify(rootEmail,'New verified academic specialist application '+found.id,'recruitment');
   await audit(found,'specialist_email_verified',found.id);
   return res.json({success:true,reviewRequired:true,message:'Email verified. IPS will review your qualifications before specialist access.'});
  }
  security.set(res,{role:found.role,id:found.id,version:found.sessionVersion});
  await audit(found,'student_email_verified',found.id);
  res.json({success:true,account:readonlyUser(found)});
 }));
 app.post('/api/auth/resend-verification',wrap(async(req,res)=>{
  if(await throttle.limited(req,'academic-resend',4))return res.status(429).json({error:'Please wait before requesting another link.'});
  const mail=email(req.body?.email);
  if(!validEmail(mail))return res.status(400).json({error:'Enter a valid email address.'});
  const a=await db.accounts.findOne({email:mail,verified:false,status:'pending_verification'});
  if(a){try{await mailChallenge(a,'verify')}catch{return res.status(503).json({error:'Verification delivery temporarily unavailable.'})}}
  res.status(202).json({accepted:true,message:'If verification is pending, IPS has sent a new one-use link.'});
 }));
 app.post('/api/auth/login',wrap(async(req,res)=>{
  if(await throttle.limited(req,'academic-login',13))return res.status(429).json({error:'Too many login attempts.'});
  const mail=email(req.body?.email),password=String(req.body?.password||'');
  if(mail===rootEmail){
   const root=await rootMatch(password);
   if(!root)return res.status(401).json({error:'Invalid credentials.'});
   security.set(res,{id:rootEmail,role:'root',version:root.sessionVersion});
   await audit({id:rootEmail,role:'root'},'nyoro_root_signin');
   return res.json({account:{id:rootEmail,email:rootEmail,name:'Nyoro',
    role:'root',status:'active',verified:true,approved:true}});
  }
  const a=await db.accounts.findOne({email:mail});
  if(!a||!checkPassword(password,a.passwordHash))return res.status(401).json({error:'Invalid credentials.'});
  if(!a.verified)return res.status(403).json({error:'Please verify your email before logging in.'});
  if(a.role==='specialist'&&!a.approved)return res.status(403).json({error:'Your IPS Specialist application is awaiting approval.'});
  if(a.status!=='active')return res.status(403).json({error:'Account access is not active.'});
  const firstLogin=!a.lastLoginAt;
  await db.accounts.updateOne({id:a.id},{$set:{lastLoginAt:now()}});
  security.set(res,{id:a.id,role:a.role,version:a.sessionVersion});
  await audit(a,'academic_account_signin',a.id);
  res.json({account:{...readonlyUser(a),firstLogin}});
 }));
 app.post('/api/auth/logout',(_req,res)=>{security.clear(res);res.json({success:true})});
 app.post('/api/auth/recovery/request',wrap(async(req,res)=>{
  if(await throttle.limited(req,'academic-recover',6))return res.status(429).json({error:'Please wait before requesting another link.'});
  const mail=email(req.body?.email);
  if(validEmail(mail)&&mail===rootEmail){
   const token=strongToken(),digest=security.digest('root-recover:'+token);
   await db.rootCredentials.updateOne({id:rootEmail},
    {$set:{recoveryHash:digest,recoveryUntil:requestedAt()}});
   try{
    await sendEmail(rootEmail,'Nyoro IPS Root Admin password recovery',
     'A one-use password recovery was requested for IPS Root Administration.\n'+
     'Open this private link within 20 minutes: '+config.origin+
     '/#recover='+token+'&email='+encodeURIComponent(rootEmail)+
     '\n\nIf this was not you, ignore the message. IPS will never ask for your password.');
   }catch{
    await db.rootCredentials.updateOne({id:rootEmail,recoveryHash:digest},
     {$unset:{recoveryHash:'',recoveryUntil:''}});
    return res.status(503).json({error:'IPS could not send a secure account recovery email.'});
   }
   await audit({id:'anonymous',role:'system'},'nyoro_root_recovery_requested');
  }else if(validEmail(mail)){
   const a=await db.accounts.findOne({email:mail,verified:true,status:{$in:['active','pending_review']}});
   if(a){try{await mailChallenge(a,'recover')}catch{return res.status(503).json({error:'Recovery email delivery is unavailable.'})}}
  }
  res.status(202).json({accepted:true,message:'If a verified account exists, IPS sent a one-use password recovery email.'});
 }));
 app.post('/api/auth/recovery/complete',wrap(async(req,res)=>{
  if(await throttle.limited(req,'academic-complete',12))return res.status(429).json({error:'Too many attempts.'});
  const mail=email(req.body?.email),token=String(req.body?.token||''),password=String(req.body?.password||'');
  if(!validEmail(mail)||!validToken(token)||!validPassword(password)||req.body?.confirmPassword!==password)
   return res.status(400).json({error:'Your password confirmation does not match or your recovery link is invalid.'});
  if(mail===rootEmail){
   if(password.length<12)return res.status(400).json({error:'Root Administration requires a password of at least 12 characters.'});
   const root=await db.rootCredentials.findOneAndUpdate({
    id:rootEmail,recoveryHash:security.digest('root-recover:'+token),
    recoveryUntil:{$gt:now()}
   },{$set:{passwordHash:hashPassword(password),updatedAt:now()},
     $inc:{sessionVersion:1},$unset:{recoveryHash:'',recoveryUntil:''}},
    {returnDocument:'after'});
   if(!root)return res.status(400).json({error:'This Root recovery link has expired or was used.'});
   await audit({id:rootEmail,role:'root'},'nyoro_root_password_recovered');
   security.set(res,{id:rootEmail,role:'root',version:root.sessionVersion});
   return res.json({success:true,account:{id:rootEmail,email:rootEmail,name:'Nyoro',
    role:'root',status:'active',verified:true,approved:true}});
  }
  const a=await db.accounts.findOneAndUpdate({email:mail,verified:true,status:{$in:['active','pending_review']},
    recoveryHash:security.digest('recover:'+token),recoveryUntil:{$gt:now()}},
   {$set:{passwordHash:hashPassword(password)},$inc:{sessionVersion:1},
    $unset:{recoveryHash:'',recoveryUntil:''}},{returnDocument:'after'});
  if(!a)return res.status(400).json({error:'This recovery link has expired or was used.'});
  await audit(a,'academic_password_recovered',a.id);
  if(a.role==='specialist'&&!a.approved)return res.json({success:true,reviewRequired:true});
  security.set(res,{id:a.id,role:a.role,version:a.sessionVersion});
  res.json({success:true,account:readonlyUser(a)});
 }));
 app.patch('/api/profile',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','specialist']))return;
  const allowed=['workspace','email','telegram','whatsapp'];
  const channel=String(req.body?.contactPreference||'');
  if(!allowed.includes(channel))return res.status(400).json({error:'Choose an available written channel.'});
  if(channel==='telegram'){
   const linked=await db.accounts.findOne({id:req.actor.id,verified:true,status:'active',
    telegramChatId:{$exists:true},telegramVerifiedAt:{$exists:true},
    telegramConnectionStatus:'confirmed'});
   if(!linked)return res.status(409).json({error:'Connect your private Telegram chat to IPS first. A username alone cannot receive verified bot updates.'});
  }
  if(channel==='whatsapp'&&!env.IPS_WHATSAPP_ENABLED)return res.status(409).json({error:'WhatsApp is not yet a verified available IPS channel.'});
  const updates={contactPreference:channel,updatedAt:now()};
  await db.accounts.updateOne({id:req.actor.id},{$set:updates});
  await audit(req.actor,'written_contact_preference_changed',req.actor.id,{channel});
  res.json({success:true,contactPreference:channel});
 }));
 // A Specialist declares actual capacity before the company may assign paid work.
 app.get('/api/specialist/availability',wrap(async(req,res)=>{
  if(!authorize(req,res,['specialist']))return;
  const a=await db.accounts.findOne({id:req.actor.id,role:'specialist',verified:true,approved:true,status:'active'});
  if(!a)return res.status(403).json({error:'Approved Specialist access is required.'});
  res.json({availabilityStatus:a.availabilityStatus||'unavailable',
   maxConcurrentCases:a.maxConcurrentCases||0,activeAssignments:a.activeAssignments||0,
   turnaroundDays:a.turnaroundDays||0,updatedAt:a.availabilityUpdatedAt||null});
 }));
 app.patch('/api/specialist/availability',wrap(async(req,res)=>{
  if(!authorize(req,res,['specialist']))return;
  const status=String(req.body?.availabilityStatus||'');
  const max=Number(req.body?.maxConcurrentCases),days=Number(req.body?.turnaroundDays);
  if(!['available','limited','unavailable'].includes(status)||
   !Number.isSafeInteger(max)||max<0||max>8||
   !Number.isSafeInteger(days)||days<0||days>60||
   (status!=='unavailable'&&(max<1||days<1)))
   return res.status(400).json({error:'Set availability, a maximum of 1–8 concurrent jobs, and a realistic 1–60 day turnaround.'});
  const a=await db.accounts.findOne({id:req.actor.id,role:'specialist',verified:true,approved:true,status:'active'});
  if(!a)return res.status(403).json({error:'Only an approved, active Specialist can declare capacity.'});
  const active=await db.projects.countDocuments({specialistId:a.id,
   status:{$nin:['completed','cancelled','closed']}});
  const reserved=Math.max(active,a.activeAssignments||0);
  if(status!=='unavailable'&&max<reserved)
   return res.status(409).json({error:'Capacity cannot be reduced below currently assigned academic work.'});
  await db.accounts.updateOne({id:a.id,status:'active'},{
   $set:{availabilityStatus:status,maxConcurrentCases:status==='unavailable'?0:max,
    turnaroundDays:status==='unavailable'?0:days,availabilityUpdatedAt:now()},
   $max:{activeAssignments:reserved}});
  await audit(req.actor,'academic_specialist_availability_updated',a.id,{
   status,capacity:status==='unavailable'?0:max,turnaroundDays:status==='unavailable'?0:days});
  res.json({success:true,availabilityStatus:status,maxConcurrentCases:status==='unavailable'?0:max,
   activeAssignments:reserved,turnaroundDays:status==='unavailable'?0:days});
 }));
 app.get('/api/administration/people',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','manager','staff']))return;
  const a=req.actor;
  let filter={};
  if(a.role==='manager'){
   if(a.department==='client_relations')filter={$or:[{role:'student'},{id:a.id},{managerId:a.id}]};
   else if(a.department==='specialist_network')filter={$or:[{role:'specialist'},{id:a.id},{managerId:a.id}]};
   else filter={$or:[{id:a.id},{managerId:a.id}]};
  }
  if(a.role==='staff'){
   if(a.department==='client_relations')filter={role:'student'};
   else if(a.department==='specialist_network')filter={role:'specialist'};
   else return res.status(403).json({error:'This department has no authority over the people directory.'});
  }
  // Privilege filters are always composed with the search, never replaced by it.
  // Stable server-side paging ensures Nyoro can manage accounts past the first
  // 300 records without returning an unbounded confidential people directory.
  const allowedRoles=['student','specialist','manager','staff'];
  const allowedStatuses=['active','pending_review','suspended','disabled','rejected','invited'];
  const requestedRole=String(req.query.role||'');
  const requestedStatus=String(req.query.status||'');
  const search=String(req.query.search||'').trim();
  const page=Number(req.query.page||1);
  const pageSize=Number(req.query.pageSize||100);
  if((requestedRole&&!allowedRoles.includes(requestedRole))||
    (requestedStatus&&requestedStatus!=='all'&&!allowedStatuses.includes(requestedStatus))||
    search.length>80||!Number.isSafeInteger(page)||page<1||page>100000||
    !Number.isSafeInteger(pageSize)||pageSize<1||pageSize>300)
   return res.status(400).json({error:'Choose a valid company directory search, status and page.'});
  const conditions=[filter];
  if(requestedRole)conditions.push({role:requestedRole});
  if(requestedStatus&&requestedStatus!=='all')conditions.push({status:requestedStatus});
  if(search){
   const escaped=search.replace(/[.*+?^\x24{}()|[\]\\]/g,'\\\x24&');
   const re=new RegExp(escaped,'i');
   conditions.push({$or:[{name:re},{username:re},{email:re},{id:re}]});
  }
  const scoped={$and:conditions};
  const [rows,total]=await Promise.all([
   db.accounts.find(scoped).sort({createdAt:-1,id:1})
    .skip((page-1)*pageSize).limit(pageSize).toArray(),
   db.accounts.countDocuments(scoped)]);
  res.json({people:rows.map(readonlyUser),page,pageSize,total,
   hasNext:page*pageSize<total,hasPrevious:page>1});
 }));
 app.post('/api/administration/invite',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','manager']))return;
  const role=req.actor.role==='root'?'manager':'staff',mail=email(req.body?.email),name=String(req.body?.name||'').trim();
  const dep=role==='manager'?String(req.body?.department||''):req.actor.department;
  if(!validEmail(mail)||name.length<3||name.length>120||!Object.hasOwn(DEPARTMENTS,dep)||mail===rootEmail)
   return res.status(400).json({error:'Provide a valid professional email, name and IPS department.'});
  if(await db.accounts.findOne({email:mail}))return res.status(409).json({error:'This email already belongs to an IPS account.'});
  const t=strongToken(),a={id:uid('EMP'),role,email:mail,name,username:'',verified:false,approved:true,
   status:'invited',department:dep,managerId:role==='staff'?req.actor.id:'',
   invitationHash:security.digest('invitation:'+t),invitationUntil:new Date(Date.now()+24*3600000),
   sessionVersion:1,createdAt:now()};
  await db.accounts.insertOne(a);
  try{await sendEmail(mail,'Your IPS Academic Services department invitation',
   'You have been invited to IPS Academic Services as '+role+' in '+DEPARTMENTS[dep]+
   '. Only you may choose your password. This private link expires in 24 hours: '+
    config.origin+'/#invite='+t+'&email='+encodeURIComponent(mail))}
  catch{await db.accounts.deleteOne({id:a.id,status:'invited'});return res.status(503).json({error:'Invitation email delivery was not confirmed.'})}
  await audit(req.actor,'academic_employee_invited',a.id,{role,department:dep});
  res.status(201).json({success:true,employee:readonlyUser(a)});
 }));
 app.post('/api/auth/invitation/accept',wrap(async(req,res)=>{
  const mail=email(req.body?.email),token=String(req.body?.token||''),password=String(req.body?.password||'');
  if(!validEmail(mail)||!validToken(token)||!validPassword(password)||req.body?.confirmPassword!==password)return res.status(400).json({error:'Invitation or confirmed password is invalid.'});
  const a=await db.accounts.findOneAndUpdate({email:mail,status:'invited',
    invitationHash:security.digest('invitation:'+token),invitationUntil:{$gt:now()}},
   {$set:{verified:true,status:'active',passwordHash:hashPassword(password)},
    $unset:{invitationHash:'',invitationUntil:''}},{returnDocument:'after'});
  if(!a)return res.status(400).json({error:'The one-use invitation has expired or already been accepted.'});
  await audit(a,'academic_employee_joined',a.id);
  security.set(res,{id:a.id,role:a.role,version:a.sessionVersion});
  res.json({success:true,account:readonlyUser(a)});
 }));
 app.post('/api/administration/people/:id/decision',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','manager']))return;
  const target=await db.accounts.findOne({id:req.params.id});
  if(!target)return res.status(404).json({error:'No such IPS academic account.'});
  const decision=String(req.body?.decision||'');
  if(target.role==='root'||target.id===rootEmail)return res.status(403).json({error:'Nyoro Root Admin is not a manageable employee record.'});
  if(['approve_specialist','reject_specialist'].includes(decision)){
   if(target.role!=='specialist'||target.status!=='pending_review'||!target.verified)
    return res.status(409).json({error:'The Specialist application is not awaiting a verified review.'});
   if(req.actor.role!=='root'&&req.actor.department!=='specialist_network')
    return res.status(403).json({error:'Specialist Network permission required.'});
   const reviewNote=String(req.body?.reviewNote||'').trim();
   if(reviewNote.length<25||reviewNote.length>1500)
    return res.status(400).json({error:'Document a substantive professional credential-review or rejection explanation (25–1,500 characters).'});
   if(decision==='approve_specialist'){
    if(req.body?.credentialEvidenceReviewed!==true)
     return res.status(400).json({error:'The reviewer must personally confirm checking professional credentials, not merely self-declared form fields.'});
    if(target.specialistAgreementVersion!==SPECIALIST_AGREEMENT.version||
     target.specialistAgreementSha256!==SPECIALIST_AGREEMENT.sha256||
     !target.specialistAgreementSignature||!target.qualification?.trim())
     return res.status(409).json({error:'The Specialist must first sign the current confidentiality agreement and submit a professional qualification.'});
   }
   const approved=decision==='approve_specialist',stamp=now();
   const changed=await db.accounts.updateOne({id:target.id,status:'pending_review',verified:true},
    {$set:{approved,status:approved?'active':'rejected',reviewedBy:req.actor.id,
     reviewedAt:stamp,credentialReviewNote:reviewNote,
     credentialEvidenceReviewed:approved,credentialReviewDecision:approved?'approved':'rejected'},
     $inc:{sessionVersion:1}});
   if(!changed.modifiedCount)return res.status(409).json({error:'Another IPS reviewer has already decided this application.'});
   const decisionMessage=approved?
    'Your IPS Specialist Network application has been approved. Sign in to your private Specialist workspace to review available IPS assignments.':
    'Your IPS Specialist Network application has not been approved. Reviewer explanation: '+reviewNote+
    '. You may reply to IPS in writing if you need further clarification.';
   await db.notificationDeliveries.insertOne({id:uid('OUT'),accountId:target.id,
    channel:'email',to:target.email,subject:'IPS Specialist Network application decision',
    text:decisionMessage,kind:'specialist_application_review',status:'pending',
    attempts:0,nextAttemptAt:stamp,createdAt:stamp});
   await audit(req.actor,'academic_specialist_application_reviewed',target.id,
    {decision:approved?'approved':'rejected',credentialEvidenceReviewed:approved});
  }else if(['suspend','reactivate'].includes(decision)){
   const permitted=req.actor.role==='root'||(target.role==='staff'&&target.managerId===req.actor.id);
   if(!permitted)return res.status(403).json({error:'Only Root or the employee’s own manager may change this state.'});
   if(decision==='reactivate'&&!target.verified)return res.status(409).json({error:'The account must verify email before activation.'});
   await db.accounts.updateOne({id:target.id},{$set:{status:decision==='suspend'?'suspended':'active'},$inc:{sessionVersion:1}});
  }else return res.status(400).json({error:'Choose a valid governed account action.'});
  await audit(req.actor,'academic_account_'+decision,target.id);
  res.json({success:true});
 }));
 app.post('/api/administration/people/:id/send-recovery',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','manager','staff']))return;
  const target=await db.accounts.findOne({id:req.params.id,verified:true,status:'active'});
  if(!target)return res.status(404).json({error:'Verified active account not found.'});
  const actor=req.actor;
  const allowed=actor.role==='root'
   ||(actor.role==='manager'&&target.role==='staff'&&target.managerId===actor.id)
   ||((actor.role==='manager'||actor.role==='staff')&&
      ((actor.department==='client_relations'&&target.role==='student')
       ||(actor.department==='specialist_network'&&target.role==='specialist')));
  if(!allowed)return res.status(403).json({error:'You cannot initiate another department’s account recovery.'});
  try{await mailChallenge(target,'recover')}catch{return res.status(503).json({error:'Recovery email could not be delivered.'})}
  await audit(actor,'academic_recovery_assistance_sent',target.id);
  res.status(202).json({success:true,message:'IPS emailed the account owner a one-use recovery link. Staff never see the new password.'});
 }));
 app.get('/api/administration/audit',wrap(async(req,res)=>{
  if(!authorize(req,res,['root','manager']))return;
  if(req.actor.role!=='root'&&req.actor.department!=='governance')return res.status(403).json({error:'Governance audit authority required.'});
  const rows=await db.audit.find({}).sort({at:-1}).limit(100).toArray();
  res.json({events:rows.map(x=>({id:x.id,actorRole:x.actorRole,action:x.action,ref:x.ref,at:x.at}))});
 }));
}
