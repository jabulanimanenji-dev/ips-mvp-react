import crypto from 'node:crypto';
import ContactEmailJob from '../models/ContactEmailJob.js';

export function verifyResendWebhook(raw,headers,secret,now=Date.now()){
  if(!Buffer.isBuffer(raw)||typeof secret!=='string'||!secret.startsWith('whsec_'))return false;
  const id=headers?.['svix-id'],timestamp=headers?.['svix-timestamp'],signature=headers?.['svix-signature'];
  if(typeof id!=='string'||id.length<1||id.length>200||
      typeof timestamp!=='string'||!/^\d{10}$/.test(timestamp)||
      typeof signature!=='string'||Math.abs(now-Number(timestamp)*1000)>300000)return false;
  const key=Buffer.from(secret.slice(6),'base64');
  if(key.length<16)return false;
  const expected=crypto.createHmac('sha256',key)
    .update(id+'.'+timestamp+'.').update(raw).digest();
  return signature.split(' ').some(part=>{
    if(!part.startsWith('v1,'))return false;
    const value=part.slice(3);
    if(!/^[A-Za-z0-9+/]+=*$/.test(value))return false;
    const provided=Buffer.from(value,'base64');
    return provided.length===expected.length&&crypto.timingSafeEqual(provided,expected);
  });
}
export async function updateContactEmailDelivery(event,{model=ContactEmailJob}={}){
  const id=event?.data?.email_id;
  if(typeof id!=='string'||id.length<5||id.length>200)return {updated:0};
  let status;
  switch(event.type){
    case 'email.delivered': status='delivered';break;
    case 'email.bounced':status='bounced';break;
    case 'email.complained':status='complained';break;
    case 'email.failed':status='failed';break;
    default:return {updated:0};
  }
  const filter={provider_id:id,status:{$in:['accepted','delivered','failed','bounced','complained']}};
  if(status==='delivered')filter.status={$in:['accepted','delivered']};
  if(status==='failed')filter.status={$in:['accepted','failed']};
  const result=await model.updateOne(filter,{$set:{status,delivery_updated_at:new Date()}});
  return {updated:result.modifiedCount??0};
}
export function registerContactEmailWebhooks(app,express){
  app.post('/api/contact-email/resend-webhook',
    express.raw({type:'application/json',limit:'128kb'}),async(req,res)=>{
      if(!process.env.CONTACT_RESEND_WEBHOOK_SECRET)return res.sendStatus(503);
      if(!verifyResendWebhook(req.body,req.headers,process.env.CONTACT_RESEND_WEBHOOK_SECRET))
        return res.sendStatus(403);
      try{
        const event=JSON.parse(req.body.toString('utf8'));
        await updateContactEmailDelivery(event);
        return res.sendStatus(200);
      }catch(error){
        console.error('IPS email delivery event processing failed:',error?.name||'error');
        return res.sendStatus(500);
      }
    });
}
