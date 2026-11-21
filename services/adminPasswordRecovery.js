import crypto from 'node:crypto';
import Admin from '../models/Admin.js';
import {sendBusinessEmail} from './businessEmailTransport.js';
import {recoveryReady,recoveryOrigin} from './passwordRecovery.js';
import {emailValid,normalizeEmail} from '../shared/privacyIdentity.js';
import {companyStaffPasswordValid} from '../shared/companyGovernance.js';
import {isIpsQaFixtureEmail} from '../shared/ipsCompanyScope.js';

// Staff and department managers reset THEIR OWN credentials by verified mail.
// Root is environment-owned and deliberately excluded. No employee, manager or
// Root can read somebody's password or token; every link is one-use and expires.
const digest=(token,secret)=>crypto.createHmac('sha256',secret)
  .update('ips-company-employee-password-recovery|'+token).digest('hex');
const scope=env=>({
  status:'Active',company_role:{$in:['manager','staff']},
  email_verified_at:{$ne:null},email:{$ne:String(env.ADMIN_EMAIL||'').toLowerCase()}
});
export async function requestAdminPasswordRecovery(email,{
  env=process.env,model=Admin,send=sendBusinessEmail,now=()=>new Date(),
  random=()=>crypto.randomBytes(32).toString('base64url')
}={}){
  if(!recoveryReady(env))return {unavailable:true};
  const address=normalizeEmail(email);
  if(!emailValid(address)||address===String(env.ADMIN_EMAIL||'').trim().toLowerCase()||
      (env.NODE_ENV==='production'&&String(env.IPS_EVALUATION_MODE||'').toLowerCase()!=='true'&&
        isIpsQaFixtureEmail(address)))
    return {accepted:true};
  const record=await model.findOne({...scope(env),email:address})
    .select('+password_reset_hash +password_reset_expires_at +password_reset_sent_at');
  if(!record)return {accepted:true};
  const at=now();
  if(record.password_reset_sent_at&&at.getTime()-new Date(record.password_reset_sent_at).getTime()<60000)
    return {accepted:true,alreadySent:true};
  const token=random();
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw Error('Secure employee recovery token unavailable.');
  const hash=digest(token,env.EMAIL_VERIFICATION_SECRET);
  record.password_reset_hash=hash;
  record.password_reset_expires_at=new Date(at.getTime()+15*60000);
  record.password_reset_sent_at=at;
  await record.save();
  const url=recoveryOrigin(env)+'/admin/reset-password#token='+token;
  try{
    await send({to:address,subject:'Reset your IPS company account password',
      body:'A password reset was requested for your IPS employee account.\n\n'+
        'Open this one-use private link (expires after 15 minutes):\n'+url+'\n\n'+
        'If this was not you, ignore this email. Your password is unchanged.\n'+
        'Never share your password or recovery link with other IPS employees.\n\nIPS Academic Services',
      env});
    return {accepted:true,delivered:true};
  }catch{
    await model.updateOne({_id:record._id,password_reset_hash:hash},
      {$unset:{password_reset_hash:'',password_reset_expires_at:'',password_reset_sent_at:''}});
    return {accepted:true,delivered:false};
  }
}
export async function completeAdminPasswordRecovery(token,password,{
  env=process.env,model=Admin,hashPassword,now=()=>new Date()
}={}){
  if(!recoveryReady(env))return {status:503,error:'Secure employee recovery is unavailable.'};
  if(typeof hashPassword!=='function')throw Error('Employee password hashing is required.');
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))
    return {status:400,error:'This employee recovery link is invalid or expired.'};
  if(!companyStaffPasswordValid(password))
    return {status:400,error:'Use at least 10 characters, an uppercase letter, number and symbol.'};
  const at=now();
  const hash=digest(token,env.EMAIL_VERIFICATION_SECRET);
  const member=await model.findOneAndUpdate({
    ...scope(env),password_reset_hash:hash,password_reset_expires_at:{$gt:at}
  },{
    $set:{password:hashPassword(password),must_change_password:false,last_password_reset_at:at},
    $inc:{session_version:1},
    $unset:{password_reset_hash:'',password_reset_expires_at:'',password_reset_sent_at:''}
  },{new:true});
  if(!member)return {status:400,error:'This employee recovery link has expired or was already used.'};
  return {success:true,account:member};
}
const attempts=new Map();
function rateLimited(req,now=Date.now()){
  const key=crypto.createHash('sha256').update(String(req.ip||req.socket?.remoteAddress||'unknown')).digest('hex');
  if(attempts.size>2000)for(const [id,v] of attempts)if(v.until<now)attempts.delete(id);
  const old=attempts.get(key);
  const next=!old||old.until<now?{count:1,until:now+15*60000}:{count:old.count+1,until:old.until};
  attempts.set(key,next);
  return next.count>8;
}
export function registerAdminPasswordRecoveryRoutes(app,{
  env=process.env,model=Admin,send=sendBusinessEmail,hashPassword,grantSession
}={}){
  app.post('/api/admin/password-recovery/request',async(req,res)=>{
    res.set('Cache-Control','no-store');
    if(rateLimited(req))return res.status(429).json({success:false,error:'Too many recovery requests. Try again later.'});
    try{
      const result=await requestAdminPasswordRecovery(req.body?.email,{env,model,send});
      if(result.unavailable)return res.status(503).json({success:false,error:'Employee recovery email is temporarily unavailable.'});
      return res.status(202).json({success:true,
        message:'If an active verified IPS employee account exists at that address, a private one-time recovery link will be sent.'});
    }catch{return res.status(503).json({success:false,error:'Secure employee recovery is unavailable.'});}
  });
  app.post('/api/admin/password-recovery/complete',async(req,res)=>{
    res.set('Cache-Control','no-store');
    if(rateLimited(req))return res.status(429).json({success:false,error:'Too many recovery attempts. Try again later.'});
    try{
      const result=await completeAdminPasswordRecovery(req.body?.token,req.body?.password,
        {env,model,hashPassword});
      if(result.error)return res.status(result.status).json({success:false,error:result.error});
      if(typeof grantSession!=='function')
        return res.status(503).json({success:false,error:'Employee login session is temporarily unavailable. Sign in with your new password.'});
      await grantSession(res,result.account);
      return res.json({success:true,session_opened:true,redirect:'/admin/dashboard',
        message:'Your employee password has been changed. Your IPS company workspace is ready.'});
    }catch{return res.status(503).json({success:false,error:'Secure employee recovery could not complete.'});}
  });
}
