// CI-only fake Resend transport for a separate disposable IPS HTTP server.
// Only allow fake @example.org mail; never send anything to the real provider.
// The HTTP application and MongoDB operations remain the actual IPS code.
import {appendFileSync} from 'node:fs';
import crypto from 'node:crypto';
const out=String(process.env.IPS_CI_MAIL_JOURNAL||'');
if(process.env.NODE_ENV!=='development'||
   !/\/ips-ci-mail-[A-Za-z0-9_-]+\/messages\.jsonl$/.test(out)||
   !String(process.env.MONGODB_URI||'').includes('/ips_ci_mail?')||
   String(process.env.CONTACT_RESEND_API_KEY||'')!=='ci-only-mail-provider-stub')
  throw Error('Local mail interception may run only in explicitly isolated CI.');
const nativeFetch=globalThis.fetch;
globalThis.fetch=async (target,options={})=>{
  const url=typeof target==='string'?target:String(target?.url||target);
  if(url==='https://api.resend.com/emails'){
    const data=JSON.parse(String(options.body||'{}'));
    const recipients=data.to;
    if(!Array.isArray(recipients)||recipients.length!==1||
       !/^[a-z0-9+._-]+@example\.org$/.test(recipients[0])||
       !String(data.from||'').includes('support@ipsglobalservice.com'))
      throw Error('Synthetic mail is restricted to example.org and trusted IPS sender');
    if(recipients[0].startsWith('fail-provider-'))
      return new Response(JSON.stringify({error:'simulated upstream refusal'}),{
        status:503,headers:{'Content-Type':'application/json'}});
    appendFileSync(out,JSON.stringify({to:recipients[0],subject:data.subject,text:data.text,
      provider_id:'ci-'+crypto.randomBytes(8).toString('hex')})+'\n',{mode:0o600});
    return new Response(JSON.stringify({id:'ci-'+crypto.randomBytes(12).toString('hex')}),{
      status:200,headers:{'Content-Type':'application/json'}});
  }
  if(/^http:\/\/(?:127\.0\.0\.1|localhost):\d+(?:\/|$)/.test(url))
    return nativeFetch(target,options);
  throw Error('Unexpected external HTTP egress is forbidden during synthetic email qualification');
};
console.log('IPS_CI_LOCAL_MAIL_STUB_ACTIVE no real contact delivery');
