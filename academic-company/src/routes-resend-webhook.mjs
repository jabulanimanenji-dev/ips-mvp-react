// Resend's Svix-signed provider events; never infer delivery from API acceptance.
// Raw signed bytes are essential. No email address, body, subject or file is retained here.
import crypto from 'node:crypto';

const eventStates={
 'email.delivered':'delivered',
 'email.delivery_delayed':'delayed',
 'email.bounced':'bounced',
 'email.complained':'complained',
 'email.failed':'failed',
 'email.suppressed':'suppressed'
};
const severity={delayed:1,delivered:2,failed:3,suppressed:3,bounced:4,complained:5};
const terminal=new Set(['bounced','complained','failed','suppressed']);
export function verifyResendSignature(raw,headers,secret,clockSeconds=Math.floor(Date.now()/1000)){
 if(!Buffer.isBuffer(raw)||raw.length<2||raw.length>262144||
  typeof secret!=='string'||!secret.startsWith('whsec_'))return false;
 const id=String(headers?.['svix-id']||headers?.['webhook-id']||'');
 const stamp=String(headers?.['svix-timestamp']||headers?.['webhook-timestamp']||'');
 const signatures=String(headers?.['svix-signature']||headers?.['webhook-signature']||'');
 if(!/^[A-Za-z0-9_-]{6,128}$/.test(id)||!/^\d{10,13}$/.test(stamp)||
  Math.abs(clockSeconds-Number(stamp))>300)return false;
 const key=Buffer.from(secret.slice(6),'base64');
 if(key.length<16)return false;
 const signed=Buffer.concat([Buffer.from(id+'.'+stamp+'.'),raw]);
 const digest=crypto.createHmac('sha256',key).update(signed).digest();
 return signatures.split(/\s+/).some(part=>{
  if(!part.startsWith('v1,'))return false;
  const value=part.slice(3);
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(value))return false;
  const actual=Buffer.from(value,'base64');
  return actual.length===digest.length&&crypto.timingSafeEqual(actual,digest);
 });
}

// Reconcile once a provider ID is known. A later bounce or complaint must never
// be masked by a previously accepted/delivered state or out-of-order events.
export async function reconcileResendDelivery(db,emailId){
 if(typeof emailId!=='string'||!emailId)return {matched:false};
 const history=await db.providerEvents.find({provider:'resend',emailId,
  status:{$in:Object.keys(severity)}}).sort({receivedAt:-1}).limit(30).toArray();
 if(!history.length)return {matched:false};
 history.sort((a,b)=>(severity[b.status]||0)-(severity[a.status]||0)||
  new Date(b.receivedAt)-new Date(a.receivedAt));
 const event=history[0],status=event.status;
 const result=await db.notificationDeliveries.updateOne({
  provider:'resend',providerMessageId:emailId,
  status:{$in:['provider_accepted','delayed','delivered','failed','bounced','complained','suppressed']}
 },{$set:{status,providerEventId:event.id,providerLastEventAt:event.receivedAt,
  ...(status==='delivered'?{deliveredAt:event.receivedAt}:{}),
  ...(terminal.has(status)?{deliveryFailedAt:event.receivedAt}:{}),
  ...(status==='delayed'?{deliveryDelayedAt:event.receivedAt}:{})}});
 return {matched:result.matchedCount>0,status};
}

export async function recordResendEvent(ctx,payload,eventId){
 const {db,rootEmail,now,uid}=ctx;
 const type=String(payload?.type||''),emailId=String(payload?.data?.email_id||'');
 const status=eventStates[type]||'';
 const row={id:eventId,provider:'resend',eventType:type.slice(0,100),
  emailId:emailId.slice(0,200),status,receivedAt:now()};
 try{await db.providerEvents.insertOne(row)}
 catch(err){if(err?.code===11000)return {accepted:true,duplicate:true};throw err}
 if(status&&emailId){
  const outcome=await reconcileResendDelivery(db,emailId);
  if(terminal.has(status)&&outcome.matched){
   await db.notifications.updateOne({accountId:rootEmail,kind:'communication_failure',
    ref:'resend:'+emailId},{$setOnInsert:{
    id:uid('NT'),accountId:rootEmail,kind:'communication_failure',
    ref:'resend:'+emailId,read:false,createdAt:now(),
    message:'IPS email provider reported '+status+' for outgoing delivery '+emailId+
     '. Check the Communications exception queue without exposing account details.'
   }},{upsert:true});
  }
 }
 return {accepted:true,duplicate:false};
}
