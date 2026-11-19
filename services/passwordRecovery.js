import crypto from 'node:crypto';
import Client from '../models/Client.js';
import {emailValid,normalizeEmail,passwordValid} from '../shared/privacyIdentity.js';
import {verificationAvailable} from './accountVerification.js';
import {sendBusinessEmail} from './businessEmailTransport.js';

// Password-recovery URLs live exclusively on the authenticated IPS origin.
// The token is placed in the URL fragment so it is not sent with HTTP requests.
export function recoveryOrigin(env=process.env){
  try{
    const raw=String(env.PUBLIC_APP_URL||'').trim();
    const parsed=new URL(raw);
    const safe=parsed.protocol==='https:'||
      (env.NODE_ENV!=='production'&&parsed.protocol==='http:'&&['localhost','127.0.0.1'].includes(parsed.hostname));
    return safe&&!parsed.username&&!parsed.password&&!parsed.search&&!parsed.hash&&
      (parsed.pathname==='/'||parsed.pathname==='')?parsed.origin:null;
  }catch{return null;}
}
export const recoveryReady=(env=process.env)=>
  verificationAvailable(env)&&Boolean(recoveryOrigin(env));
export const tokenDigest=(token,secret)=>
  crypto.createHmac('sha256',secret).update('client-password-recovery|'+token).digest('hex');
export const sessionVersion=client=>Math.max(1,Number(client?.session_version)||1);
export const sessionFilter=session=>{
  const version=sessionVersion(session);
  return version===1
    ?{$or:[{session_version:1},{session_version:{$exists:false}}]}
    :{session_version:version};
};

export async function requestPasswordRecovery(email,{
  env=process.env,model=Client,send=sendBusinessEmail,now=()=>new Date(),
  random=()=>crypto.randomBytes(32).toString('base64url')
}={}){
  if(!recoveryReady(env))return {unavailable:true};
  const normalized=normalizeEmail(email);
  // Never reveal whether the mailbox belongs to an IPS customer.
  if(!emailValid(normalized))return {accepted:true};
  const customer=await model.findOne({email:normalized,email_verified_at:{$ne:null},status:'Active'})
    .select('+password_reset_hash +password_reset_expires_at +password_reset_sent_at');
  if(!customer)return {accepted:true};
  const at=now();
  if(customer.password_reset_sent_at&&at.getTime()-new Date(customer.password_reset_sent_at).getTime()<60000)
    return {accepted:true};
  const token=random();
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw Error('Password recovery token generator failed.');
  const hash=tokenDigest(token,env.EMAIL_VERIFICATION_SECRET);
  customer.password_reset_hash=hash;
  customer.password_reset_sent_at=at;
  customer.password_reset_expires_at=new Date(at.getTime()+15*60000);
  await customer.save();
  const link=recoveryOrigin(env)+'/reset-password#token='+token;
  try{
    await send({
      to:normalized,subject:'Reset your IPS account password',
      body:'A password reset was requested for your IPS account.\n\n'+
        'Open this private one-time link (valid for 15 minutes):\n'+link+'\n\n'+
        'If you did not request this, ignore this message. Your password has not changed.\n'+
        'Never share the link or your password with IPS staff.\n\nIPS Academic Services',
      env
    });
  }catch{
    // Never leave an undelivered but valid token behind. Match the exact hash
    // in case the customer has since requested a newer link.
    await model.updateOne({_id:customer._id,password_reset_hash:hash},
      {$unset:{password_reset_hash:'',password_reset_expires_at:'',password_reset_sent_at:''}});
  }
  return {accepted:true};
}

export async function completePasswordRecovery(token,password,{
  env=process.env,model=Client,hashPassword,now=()=>new Date()
}={}){
  if(!recoveryReady(env))return {error:'Secure account recovery is unavailable.',status:503};
  if(typeof hashPassword!=='function')throw Error('Password hashing is required');
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))
    return {error:'This password reset link is invalid or has expired.',status:400};
  if(!passwordValid(password))
    return {error:'Use at least 8 characters with an uppercase letter, number and symbol.',status:400};
  const hash=tokenDigest(token,env.EMAIL_VERIFICATION_SECRET);
  const at=now();
  const match={password_reset_hash:hash,password_reset_expires_at:{$gt:at},
    email_verified_at:{$ne:null},status:'Active'};
  const customer=await model.findOne(match).select('+password_reset_hash +password_reset_expires_at');
  if(!customer)return {error:'This password reset link is invalid or has expired.',status:400};
  const updated=await model.findOneAndUpdate({...match,_id:customer._id},{
    $set:{password:hashPassword(password),session_version:sessionVersion(customer)+1},
    $unset:{password_reset_hash:'',password_reset_expires_at:'',password_reset_sent_at:''}
  },{new:true});
  return updated?{success:true}:{error:'This password reset link was already used.',status:400};
}

const buckets=new Map();
function rateLimited(req){
  const now=Date.now();
  const ip=crypto.createHash('sha256').update(String(req.ip||req.socket?.remoteAddress||'unknown')).digest('hex');
  if(buckets.size>3000){for(const [k,v] of buckets)if(v.expires<=now)buckets.delete(k);}
  const item=buckets.get(ip);
  const record=!item||item.expires<=now?{n:0,expires:now+15*60000}:item;
  record.n++;
  buckets.set(ip,record);
  return record.n>8;
}
export function registerPasswordRecoveryRoutes(app,{hashPassword,model=Client}){
  app.post('/api/client/password-recovery/request',async(req,res)=>{
    res.set('Cache-Control','no-store');
    if(rateLimited(req))return res.status(429).json({success:false,error:'Too many requests. Please try again later.'});
    try{
      const outcome=await requestPasswordRecovery(req.body?.email,{model});
      if(outcome.unavailable)return res.status(503).json({success:false,error:'Password recovery email delivery is not configured.'});
      return res.status(202).json({success:true,message:'If this verified IPS account exists, a private password-reset link will be sent to its email address.'});
    }catch{return res.status(503).json({success:false,error:'Secure recovery is temporarily unavailable.'});}
  });
  app.post('/api/client/password-recovery/complete',async(req,res)=>{
    res.set('Cache-Control','no-store');
    if(rateLimited(req))return res.status(429).json({success:false,error:'Too many requests. Please try again later.'});
    try{
      const result=await completePasswordRecovery(req.body?.token,req.body?.password,{hashPassword,model});
      if(result.error)return res.status(result.status).json({success:false,error:result.error});
      res.setHeader('Set-Cookie','ips_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
      return res.json({success:true,message:'Your password has been changed. Sign in with your new password.'});
    }catch{return res.status(503).json({success:false,error:'Secure recovery is temporarily unavailable.'});}
  });
}
