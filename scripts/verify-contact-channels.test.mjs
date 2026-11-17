import test from 'node:test';
import { PUBLIC_CONTACTS } from '../shared/publicContacts.js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {validTelegramUsername,validWhatsappNumber,verifyWhatsappSignature,verifyTelegramSecret,parseTelegramUpdate,parseWhatsappUpdate,publicContactConfig} from '../services/contactChannels.js';

test('public channels remain disabled until actual verified business settings exist',()=>{
  assert.deepEqual(publicContactConfig({}).whatsapp,null);
  assert.deepEqual(publicContactConfig({TELEGRAM_BOT_USERNAME:'IPS_Bot'}).telegram,null);
  assert.deepEqual(publicContactConfig({WHATSAPP_PUBLIC_NUMBER:'48123123123'}).whatsapp,null);
  const config=publicContactConfig({
    TELEGRAM_BOT_USERNAME:'IPSAcademicBot',TELEGRAM_BOT_TOKEN:'not-a-real-token',
    TELEGRAM_WEBHOOK_SECRET:'not-a-real-secret',
    WHATSAPP_PUBLIC_NUMBER:'48123123123',WHATSAPP_PHONE_NUMBER_ID:'test-id',
    WHATSAPP_ACCESS_TOKEN:'not-a-real-token',WHATSAPP_APP_SECRET:'not-a-real-secret',
    WHATSAPP_VERIFY_TOKEN:'not-a-real-token'
  });
  assert.equal(config.telegram.url,'https://t.me/IPSAcademicBot');
  assert.equal(config.whatsapp.url,'https://wa.me/48123123123');
  assert.ok(!JSON.stringify(config).includes('not-a-real'));
});

test('message handle validation rejects malformed and injected links',()=>{
  assert.equal(validTelegramUsername('IPSAcademicBot'),true);
  assert.equal(validTelegramUsername('https://malicious.example'),false);
  assert.equal(validTelegramUsername('x'),false);
  assert.equal(validWhatsappNumber('48123123123'),true);
  assert.equal(validWhatsappNumber('+48123123123'),false);
  assert.equal(validWhatsappNumber('1234'),false);
});

test('Whatsapp requires raw authentic HMAC of exact body bytes',()=>{
  const secret='local-test-only';
  const payload=Buffer.from(JSON.stringify({object:'whatsapp_business_account',entry:[]}));
  const signature='sha256='+crypto.createHmac('sha256',secret).update(payload).digest('hex');
  assert.equal(verifyWhatsappSignature(payload,signature,secret),true);
  assert.equal(verifyWhatsappSignature(Buffer.from('{}'),signature,secret),false);
  assert.equal(verifyWhatsappSignature(payload,'sha256=bad',secret),false);
  assert.equal(verifyWhatsappSignature(payload,signature,''),false);
});

test('Telegram secret rejects unauthenticated requests',()=>{
  assert.equal(verifyTelegramSecret('local-test-only','local-test-only'),true);
  assert.equal(verifyTelegramSecret('wrong','local-test-only'),false);
  assert.equal(verifyTelegramSecret(undefined,'local-test-only'),false);
  assert.equal(verifyTelegramSecret('anything',''),false);
});

test('Telegram parser only ingests text in private customer chats',()=>{
  const update={update_id:55,message:{chat:{id:12345,type:'private'},text:'Hello IPS',date:1794861000,from:{first_name:'Student'}}};
  assert.deepEqual(parseTelegramUpdate(update)[0],{
    channel:'telegram',external_id:'12345',external_message_id:'tg:55',display_name:'Student',
    body:'Hello IPS',provider_at:new Date(1794861000*1000)
  });
  assert.equal(parseTelegramUpdate({...update,message:{...update.message,chat:{id:12345,type:'group'}}}).length,0);
  assert.equal(parseTelegramUpdate({...update,message:{...update.message,text:''}}).length,0);
});

test('Whatsapp parser ingests customer texts but ignores delivery statuses and media',()=>{
  const payload={object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{
    contacts:[{wa_id:'48123123123',profile:{name:'Student'}}],
    messages:[
      {type:'text',id:'wamid.1',from:'48123123123',text:{body:'Please help with my research'},timestamp:'1794861000'},
      {type:'image',id:'wamid.2',from:'48123123123'}
    ],
    statuses:[{id:'status-1'}]
  }}]}]};
  const messages=parseWhatsappUpdate(payload);
  assert.equal(messages.length,1);
  assert.equal(messages[0].external_message_id,'wa:wamid.1');
  assert.equal(messages[0].display_name,'Student');
  assert.equal(messages[0].body,'Please help with my research');
  assert.equal(parseWhatsappUpdate({...payload,object:'bad'}).length,0);
});


test('public links use configured business identities without exposing secrets',()=>{
  assert.equal(PUBLIC_CONTACTS.whatsapp.url,'https://wa.me/48794088714');
  assert.equal(PUBLIC_CONTACTS.telegram.url,'https://t.me/IPScontactBot');
  assert.equal(PUBLIC_CONTACTS.whatsapp.connected,false);
  assert.equal(PUBLIC_CONTACTS.telegram.connected,false);
  assert.equal(JSON.stringify(PUBLIC_CONTACTS).includes('token'),false);
});
