import { IPS_EMAILS,IPS_MAIL_SENDER_NAME } from '../shared/businessEmails.js';

export const canSendContactEmail=(env=process.env)=>Boolean(
  env.CONTACT_RESEND_API_KEY &&
  String(env.CONTACT_FROM_EMAIL||'').trim().toLowerCase()===IPS_EMAILS.support &&
  String(env.CONTACT_REPLY_TO_EMAIL||'').trim().toLowerCase()===IPS_EMAILS.contact
);
export async function sendBusinessEmail({to,subject,body,idempotencyKey,env=process.env,request=fetch}){
  if(!canSendContactEmail(env))throw Object.assign(new Error('IPS email provider is not configured.'),{status:503});
  if(typeof to!=='string'||!/^\S+@[^\s@]+\.[a-zA-Z]{2,}$/.test(to)||to.length>254)throw Object.assign(new Error('Invalid recipient.'),{status:400});
  if(String(env.IPS_STAGING_MODE||'').toLowerCase()==='true'){
    const recipients=String(env.IPS_STAGING_ALLOWLIST_EMAILS||'')
      .split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
    if(recipients.length===0||!recipients.includes(to.trim().toLowerCase()))
      throw Object.assign(new Error('Staging cannot email a recipient outside the approved test allowlist.'),{status:403});
  }
  if(typeof subject!=='string'||subject.length<1||subject.length>200)throw Object.assign(new Error('Invalid subject.'),{status:400});
  if(typeof body!=='string'||body.length<1||body.length>3000)throw Object.assign(new Error('Invalid body.'),{status:400});
  if(idempotencyKey!==undefined&&(!/^[a-zA-Z0-9/_-]{1,256}$/.test(idempotencyKey)))
    throw Object.assign(new Error('Invalid notification identity.'),{status:400});
  const headers={'Authorization':'Bearer '+env.CONTACT_RESEND_API_KEY,'Content-Type':'application/json'};
  if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;
  const response=await request('https://api.resend.com/emails',{
    method:'POST',headers,
    body:JSON.stringify({
      from:IPS_MAIL_SENDER_NAME+' <'+IPS_EMAILS.support+'>',
      to:[to],subject,text:body,reply_to:IPS_EMAILS.contact
    }),
    signal:AbortSignal.timeout(15000)
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.id)throw Object.assign(new Error('Provider did not accept the email.'),{status:response.status||502});
  return result.id;
}
export async function sendEmailReply({to,subject,body,reference,env=process.env,request=fetch,idempotencyKey}){
  return sendBusinessEmail({to,
    subject:'IPS: '+String(subject).slice(0,125)+' · '+reference,
    body:body+'\n\nReference: '+reference+'\nThis is a reply to your IPS enquiry.',
    idempotencyKey,env,request
  });
}
