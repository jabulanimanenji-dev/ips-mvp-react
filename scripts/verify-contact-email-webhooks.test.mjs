import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {verifyResendWebhook,updateContactEmailDelivery} from '../services/contactEmailWebhooks.js';

test('Resend delivery events require authentic signed raw bytes, valid timestamp and correct secret',()=>{
  const secret='whsec_'+Buffer.from('ci-signature-key-only-do-not-use','utf8').toString('base64');
  const raw=Buffer.from(JSON.stringify({type:'email.delivered',data:{email_id:'mock-provider-123456'}}));
  const now=Date.UTC(2026,10,18,12,0,0);
  const id='msg_ci_1',ts=String(now/1000);
  const sig='v1,'+crypto.createHmac('sha256',Buffer.from(secret.slice(6),'base64'))
    .update(id+'.'+ts+'.').update(raw).digest('base64');
  const headers={'svix-id':id,'svix-timestamp':ts,'svix-signature':sig};
  assert.equal(verifyResendWebhook(raw,headers,secret,now),true);
  assert.equal(verifyResendWebhook(Buffer.from('{}'),headers,secret,now),false);
  assert.equal(verifyResendWebhook(raw,headers,'whsec_'+Buffer.from('other-long-different-key').toString('base64'),now),false);
  assert.equal(verifyResendWebhook(raw,{...headers,'svix-timestamp':String(now/1000-3600)},secret,now),false);
  assert.equal(verifyResendWebhook(raw,{...headers,'svix-signature':'v1,bad'},secret,now),false);
  assert.equal(verifyResendWebhook(raw,headers,'',now),false);
});
test('Resend events update only existing provider IDs and never downgrade bounced to delivered',async()=>{
  const calls=[];
  const model={updateOne:async(query,change)=>{calls.push({query,change});return {modifiedCount:1};}};
  assert.deepEqual(await updateContactEmailDelivery({type:'email.delivered',data:{email_id:'provider-123'}},{model}),{updated:1});
  assert.equal(calls[0].query.provider_id,'provider-123');
  assert.deepEqual(calls[0].query.status.$in,['accepted','delivered']);
  assert.equal(calls[0].change.$set.status,'delivered');
  await updateContactEmailDelivery({type:'email.bounced',data:{email_id:'provider-123'}},{model});
  assert.equal(calls[1].change.$set.status,'bounced');
  await updateContactEmailDelivery({type:'email.complained',data:{email_id:'provider-123'}},{model});
  assert.equal(calls[2].change.$set.status,'complained');
  assert.deepEqual(await updateContactEmailDelivery({type:'email.opened',data:{email_id:'provider-123'}},{model}),{updated:0});
  assert.deepEqual(await updateContactEmailDelivery({type:'email.delivered',data:{}},{model}),{updated:0});
  assert.equal(calls.length,3);
});
