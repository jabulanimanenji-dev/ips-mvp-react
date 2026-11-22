// Real, non-synthetic provider preflight for IPS academic staging/production.
// Execute ONLY in an authorized server environment with its existing secret manager.
// It never prints tokens, email addresses, message contents or academic files.
// This is a provider-configuration and malware-signature witness; it is not
// evidence of human email/Telegram receipt or full release authorization.
import {inspectAcademicFile,scanConfiguration} from '../src/document-scan.mjs';
import {validEmail} from '../src/security.mjs';

const env=process.env;
const fail=reason=>{throw Error('IPS_REAL_PROVIDER_PREFLIGHT_FAILED '+reason)};
const cfg={mode:String(env.IPS_ACADEMIC_MODE||''),origin:String(env.PUBLIC_APP_URL||'')};
if(!['staging','production'].includes(cfg.mode))fail('Must run on authorized staging/production only');
if(!/^https:\/\/[^/?#]+$/.test(cfg.origin))fail('An HTTPS origin is required');
const from=String(env.FROM_EMAIL||'').trim().toLowerCase();
if(!validEmail(from)||!String(env.RESEND_API_KEY||'').startsWith('re_'))
 fail('Resend sender credentials are unavailable');
const expectedBot=String(env.IPS_TELEGRAM_BOT_USERNAME||'').replace(/^@/,'').trim();
if(!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(expectedBot)||
 !String(env.TELEGRAM_BOT_TOKEN||'')||!String(env.IPS_TELEGRAM_WEBHOOK_SECRET||''))
 fail('Real Telegram bot credentials or signature verifier are unavailable');
if(cfg.mode==='staging' &&
 (expectedBot.toLowerCase()==='ipscontactbot'||
  env.IPS_STAGING_DISTINCT_TELEGRAM_BOT_CONFIRMED!=='true'))
 fail('Staging is forbidden from using the live legacy bot');

const safeFetch=async(url,options={})=>{
 const r=await fetch(url,{...options,signal:AbortSignal.timeout(16000)});
 if(!r.ok)fail('Provider returned non-success HTTP '+r.status);
 const data=await r.json();
 if(!data||typeof data!=='object')fail('Provider JSON is invalid');
 return data;
};
const findings={
 email:'not_checked',emailDelivery:'not_requested',
 telegram:'not_checked',telegramDelivery:'not_requested',
 scanner:'not_checked',humanReceipt:'not_proven'
};
try{
 const domains=await safeFetch('https://api.resend.com/domains',{headers:{
  Authorization:'Bearer '+env.RESEND_API_KEY
 }});
 const senderDomain=from.split('@')[1];
 if(!Array.isArray(domains.data)||!domains.data.some(d=>
  String(d.name||'').toLowerCase()===senderDomain && d.status==='verified'))
  fail('The email sender domain is not verified on Resend');
 findings.email='verified_sender_domain';

 // Staging outbound mail is allowed ONLY to an explicitly approved test address
 // that is already in the isolated staging account allowlist.
 if(env.IPS_PROVIDER_TEST_SEND_APPROVED==='true'){
  const recipient=String(env.IPS_PROVIDER_TEST_EMAIL||'').trim().toLowerCase();
  const allowed=String(env.IPS_STAGING_ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase());
  if(cfg.mode!=='staging'||!validEmail(recipient)||!allowed.includes(recipient))
   fail('Out-of-policy real outbound recipient');
  const sent=await safeFetch('https://api.resend.com/emails',{
   method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,
    'Content-Type':'application/json'},
   body:JSON.stringify({from,to:[recipient],
    subject:'IPS Academic Services provider validation',
    text:'This is an authorized IPS delivery verification. No academic information is contained here.'})
  });
  if(typeof sent.id!=='string'||!sent.id)fail('Resend did not return a provider receipt ID');
  findings.emailDelivery='provider_accepted_only';
 }

 const bot=await safeFetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/getMe');
 if(bot.ok!==true||!bot.result?.is_bot||
  String(bot.result.username||'').toLowerCase()!==expectedBot.toLowerCase())
  fail('Telegram bot identity does not match configuration');
 const hook=await safeFetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/getWebhookInfo');
 const expectedUrl=cfg.origin+'/api/integrations/telegram/webhook';
 if(hook.ok!==true||hook.result?.url!==expectedUrl)
  fail('Telegram webhook is not registered to the exact IPS callback');
 if(hook.result?.last_error_message)
  fail('Telegram reports a webhook delivery error');
 findings.telegram='real_bot_and_callback_verified';

 const scanner=scanConfiguration(env);
 if(!scanner.host)fail('No independently configured ClamAV service');
 const eicar=Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
 const detected=await inspectAcademicFile(eicar,{env,sandbox:false});
 if(detected.status!=='malware_blocked'||detected.scanner==='none')
  fail('Real antivirus failed to reject the standard non-malicious test signature');
 const clean=await inspectAcademicFile(Buffer.from('IPS academic clean synthetic signature probe; no client file'),{
  env,sandbox:false});
 if(clean.status!=='clean')fail('Real antivirus did not confirm a clean synthetic document');
 findings.scanner='genuine_clean_and_signature_rejection';
 console.log('IPS_REAL_PROVIDER_PREFLIGHT '+JSON.stringify(findings));
}catch{
 // Individual provider response bodies may contain user information; log only a
 // generic failure and keep the report unaccepted until requalification.
 console.error('IPS_REAL_PROVIDER_PREFLIGHT_BLOCKED: One or more live providers failed the strict checks.');
 process.exitCode=1;
}
