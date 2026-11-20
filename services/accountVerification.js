import crypto from 'node:crypto';
import {sendBusinessEmail,canSendContactEmail} from './businessEmailTransport.js';
import {emailValid,normalizeEmail} from '../shared/privacyIdentity.js';

export const verificationAvailable=(env=process.env)=>
  canSendContactEmail(env)&&typeof env.EMAIL_VERIFICATION_SECRET==='string'&&env.EMAIL_VERIFICATION_SECRET.length>=32;
const digest=(email,code,secret)=>crypto.createHmac('sha256',secret)
  .update(normalizeEmail(email)+'|'+String(code)).digest('hex');
const safeEqual=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&
  crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
export const publicAccount=account=>{
  const data=typeof account.toObject==='function'?account.toObject():{...account};
  for(const key of ['password','verification_hash','verification_attempts','verification_expires_at','verification_sent_at','password_reset_hash','password_reset_expires_at','password_reset_sent_at','notes'])
    delete data[key];
  return data;
};
export async function issueEmailChallenge(account,{env=process.env,send=sendBusinessEmail,now=()=>new Date(),codeFactory=()=>String(crypto.randomInt(0,100000000)).padStart(8,'0')}={}){
  if(!verificationAvailable(env))throw Object.assign(new Error('Email verification is not available.'),{status:503});
  if(!emailValid(normalizeEmail(account?.email)))throw Object.assign(new Error('Invalid email address.'),{status:400});
  const at=now();
  if(account.email_verified_at)return {already_verified:true};
  if(account.verification_sent_at&&at.getTime()-new Date(account.verification_sent_at).getTime()<60000)
    throw Object.assign(new Error('Please wait before requesting another verification code.'),{status:429});
  const code=codeFactory();
  if(!/^\d{8}$/.test(code))throw Error('Invalid verification code generator.');
  // Hash the single-use code using a separate server-only secret, never store the code.
  account.verification_hash=digest(account.email,code,env.EMAIL_VERIFICATION_SECRET);
  account.verification_expires_at=new Date(at.getTime()+15*60000);
  account.verification_sent_at=at;
  account.verification_attempts=0;
  await account.save();
  try{
    // A new registration sends its own mail automatically. The recipient can
    // complete verification with one click; no employee has to issue or mark it.
    // The proof remains fragment-only until the browser POSTs it to IPS.
    let verificationLink='';
    try{
      const origin=new URL(String(env.PUBLIC_APP_URL||''));
      if((origin.protocol==='https:'||(env.NODE_ENV!=='production'&&origin.protocol==='http:'&&
        ['localhost','127.0.0.1'].includes(origin.hostname)))&&
        !origin.username&&!origin.password&&!origin.search&&!origin.hash&&
        ['','/'].includes(origin.pathname)){
        const role=account.writer_id?'writer':'client';
        verificationLink=origin.origin+'/verify-email#'+new URLSearchParams({
          role,email:normalizeEmail(account.email),code
        }).toString();
      }
    }catch{}
    await send({
      to:normalizeEmail(account.email),
      subject:'Verify your IPS email address',
      body:'Confirm ownership of your IPS email address by opening the private link below. No administrator approval is needed.\n\n'+
        (verificationLink?verificationLink+'\n\n':'')+
        'If you cannot open the link, enter this eight-digit code on the IPS verification page: '+code+
        '\n\nYour code and link expire in 15 minutes and work only once. If you did not register, ignore this message. Never share your code or password.\n\nIPS Academic Services',
      env
    });
  }catch(error){
    // A failed provider request never makes an account verified or active.
    account.verification_hash=undefined;
    account.verification_expires_at=undefined;
    account.verification_sent_at=undefined;
    await account.save();
    throw Object.assign(new Error('Verification email could not be sent.'),{status:503});
  }
  return {verification_required:true,expires_in_minutes:15};
}
export async function confirmEmailChallenge(account,code,{env=process.env,now=()=>new Date()}={}){
  if(!verificationAvailable(env))return {error:'Verification is temporarily unavailable.',status:503};
  const at=now();
  const attempts=Number(account?.verification_attempts||0);
  if(!account?.verification_hash||!account.verification_expires_at||
    new Date(account.verification_expires_at)<=at||attempts>=5){
    return {error:'The verification code has expired or is no longer valid.',status:400};
  }
  const candidate=typeof code==='string'&&/^\d{8}$/.test(code)?
    digest(account.email,code,env.EMAIL_VERIFICATION_SECRET):'';
  if(!safeEqual(candidate,account.verification_hash)){
    account.verification_attempts=attempts+1;
    if(account.verification_attempts>=5){
      account.verification_hash=undefined;account.verification_expires_at=undefined;
    }
    await account.save();
    return {error:'Incorrect verification code.',status:400};
  }
  account.email_verified_at=at;
  account.verification_hash=undefined;
  account.verification_expires_at=undefined;
  account.verification_sent_at=undefined;
  account.verification_attempts=0;
  await account.save();
  return {success:true};
}
export function validateVerificationRequest(body){
  const email=normalizeEmail(body?.email);
  const code=String(body?.code||'').trim();
  return emailValid(email)&&/^\d{8}$/.test(code)?{email,code}:null;
}
