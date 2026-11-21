import crypto from 'node:crypto';

export const email=x=>String(x||'').trim().toLowerCase();
export const validEmail=x=>typeof x==='string'&&x.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)&&!x.includes('..');
export const username=x=>String(x||'').trim();
export const validUsername=x=>/^[A-Za-z0-9][A-Za-z0-9_.-]{2,31}$/.test(x)&&!/^(root|admin|administrator|support|staff|ips|system|finance|billing|security)$/i.test(x);
export const validPassword=x=>typeof x==='string'&&x.length>=8&&x.length<=128&&/[A-Z]/.test(x)&&/[0-9]/.test(x)&&/[^A-Za-z0-9\s]/.test(x);
export const uid=prefix=>prefix+'-'+crypto.randomBytes(9).toString('hex').toUpperCase();
export const now=()=>new Date();
export const hashPassword=password=>{
 const salt=crypto.randomBytes(16).toString('hex');
 return 'scrypt$'+salt+'$'+crypto.scryptSync(password,salt,64).toString('hex');
};
export const checkPassword=(password,stored)=>{
 if(typeof stored!=='string'||!stored.startsWith('scrypt$'))return false;
 const [,salt,hex]=stored.split('$');
 if(!/^[0-9a-f]{32}$/.test(salt)||!/^[0-9a-f]{128}$/.test(hex))return false;
 return crypto.timingSafeEqual(crypto.scryptSync(String(password),salt,64),Buffer.from(hex,'hex'));
};
export const publicAccount=a=>a?({
 id:a.id,role:a.role,username:a.username||'',name:a.name||'',email:a.email,
 verified:!!a.verified,approved:!!a.approved,status:a.status,department:a.department||'',
 managerId:a.managerId||'',expertise:a.expertise||[],firstLogin:!a.lastLoginAt,
 specialistAgreementVersion:a.specialistAgreementVersion||'',
 contactPreference:a.contactPreference||'workspace',
 telegramLinked:!!(a.telegramChatId&&a.telegramVerifiedAt&&a.telegramConnectionStatus==='confirmed')
}):null;
export const publicDocument=d=>{
 if(!d)return null;
 const x={...d};for(const k of ['_id','passwordHash','challengeHash','challengeUntil','recoveryHash','recoveryUntil','fileData','file_buffer','tokenHash','privateNotes'])delete x[k];
 return x;
};
export const ensureRuntime=env=>{
 const mode=String(env.IPS_ACADEMIC_MODE||'production');
 if(!['evaluation','staging','production'].includes(mode))
  throw Error('IPS academic runtime mode must be explicitly recognized.');
 const sandbox=mode==='evaluation',staging=mode==='staging',production=mode==='production';
 const prod=!sandbox;
 const dbName=sandbox?'ips_academic_sandbox':staging?'ips_academic_staging':'ips_academic_services_2026';
 const allowedStagingEmails=staging?String(env.IPS_STAGING_ALLOWED_EMAILS||'')
  .split(',').map(email).filter(Boolean):[];
 if(staging&&(!allowedStagingEmails.length||allowedStagingEmails.some(x=>!validEmail(x))||
  new Set(allowedStagingEmails).size!==allowedStagingEmails.length))
  throw Error('IPS academic staging requires unique, valid, explicit allowed test account email addresses.');
 if(staging&&env.TELEGRAM_BOT_TOKEN&&
  (String(env.IPS_TELEGRAM_BOT_USERNAME||'').replace(/^@/,'').toLowerCase()==='ipscontactbot'||
   env.IPS_STAGING_DISTINCT_TELEGRAM_BOT_CONFIRMED!=='true'))
  throw Error('IPS staging must use a separately verified Telegram bot, never the operational legacy IPS bot.');
 const origin=String(env.PUBLIC_APP_URL||'').replace(/\/$/,'');
 if(!env.MONGODB_URI)throw Error('IPS academic MongoDB must be explicitly configured');
 if(!env.SESSION_SECRET||env.SESSION_SECRET.length<40)throw Error('IPS academic session signing secret is missing or too short');
 if(!validEmail(email(env.ROOT_EMAIL))||!validPassword(env.ROOT_PASSWORD)||String(env.ROOT_PASSWORD).length<12)throw Error('Nyoro Root credentials must be configured');
 if(!sandbox&&(env.NODE_ENV!=='production'||!origin.startsWith('https://')))throw Error('Academic production requires NODE_ENV=production and HTTPS');
 if(sandbox&&env.NODE_ENV!=='test')throw Error('Academic evaluation must use NODE_ENV=test');
 if(!origin.startsWith('http://')&&!origin.startsWith('https://'))throw Error('PUBLIC_APP_URL must be an absolute HTTP(S) URL');
 if(prod&&(!env.RESEND_API_KEY||!validEmail(email(env.FROM_EMAIL))))throw Error('Production needs a real email verification provider');
 return {sandbox,staging,production,allowedStagingEmails,dbName,origin,prod};
};
export function createSecurity(env,{sandbox}){
 const secret=env.SESSION_SECRET,secure=sandbox?'':'; Secure';
 const mac=t=>crypto.createHmac('sha256',secret).update(t).digest('base64url');
 const digest=t=>crypto.createHmac('sha256',secret).update(t).digest('hex');
 const issue=(data)=>{const body=Buffer.from(JSON.stringify({...data,exp:Date.now()+12*3600000})).toString('base64url');return body+'.'+mac(body)};
 const read=req=>{
  const name='ips_academic_session=';
  const cookie=(req.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name))?.slice(name.length)||'';
  if(!cookie)return null;
  const [body,sig]=cookie.split('.');
  if(!body||!sig)return null;
  const expected=mac(body);
  if(expected.length!==sig.length||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(sig)))return null;
  try{const p=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));return p?.exp>Date.now()?p:null}catch{return null}
 };
 const set=(res,data)=>res.set('Set-Cookie','ips_academic_session='+issue(data)+'; HttpOnly; Path=/; SameSite=Strict; Max-Age=43200'+secure);
 const clear=res=>res.set('Set-Cookie','ips_academic_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0'+secure);
 return {digest,issue,read,set,clear};
}
export class Throttle{
 constructor(){
  this.map=new Map();
  this.collection=null;
  this.secret='';
  this.production=false;
 }
 attach(collection,{production=false,secret=''}={}){
  if(production&&(!collection||String(secret).length<40))
   throw Error('IPS production requires a shared MongoDB abuse limiter.');
  this.collection=collection;
  this.secret=String(secret);
  this.production=!!production;
 }
 async limited(req,key,limit=8){
  const n=Number(limit),action=String(key||'').slice(0,100);
  if(!Number.isSafeInteger(n)||n<1||!action)throw Error('Invalid IPS rate policy.');
  // The shared production key holds only a one-way HMAC, never a raw IP address.
  if(this.production){
   const interval=15*60*1000,nowMs=Date.now(),bucket=Math.floor(nowMs/interval);
   const hashed=crypto.createHmac('sha256',this.secret).update(
    String(req.ip||'unknown')+'|'+action+'|'+bucket).digest('hex');
   const expiresAt=new Date((bucket+1)*interval+60000);
   let row;
   try{
    row=await this.collection.findOneAndUpdate({_id:hashed},{
     $inc:{attempts:1},$setOnInsert:{createdAt:new Date(nowMs),expiresAt,
      action,policy:'fixed_15m_window'}},{upsert:true,returnDocument:'after'});
   }catch(err){
    if(err?.code!==11000)throw err;
    // Concurrent first-use upserts can collide; atomically record the retry.
    await this.collection.updateOne({_id:hashed},{$inc:{attempts:1}});
    row=await this.collection.findOne({_id:hashed});
   }
   if(!row||!Number.isSafeInteger(row.attempts))
    throw Error('IPS shared abuse protection is unavailable.');
   return row.attempts>n;
  }
  // Isolated fictional evaluations retain disposable local counters.
  const time=Date.now(),id=(req.ip||'unknown')+'|'+action,existing=this.map.get(id);
  const current=existing?.until>time?existing:{n:0,until:time+15*60000};
  current.n++;this.map.set(id,current);
  if(this.map.size>5000)for(const [k,v] of this.map)if(v.until<=time)this.map.delete(k);
  return current.n>n;
 }
}
export const auditView=d=>({id:d.id,actorRole:d.actorRole,action:d.action,ref:d.ref,at:d.at});
export const normalizeFilename=f=>String(f||'').replace(/[^\w.-]/g,'_').slice(0,100);
export const strongToken=()=>crypto.randomBytes(32).toString('base64url');
export const validToken=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{43}$/.test(x);
export const isRelevantAdminRole=role=>['root','manager','staff'].includes(role);
