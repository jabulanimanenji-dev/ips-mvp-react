import crypto from 'node:crypto';
import { PUBLIC_CONTACTS } from '../shared/publicContacts.js';
import ChannelContact from '../models/ChannelContact.js';
import {hasAdminPermission} from '../shared/adminPermissions.js';
import ChannelMessage from '../models/ChannelMessage.js';
import ChannelLinkToken from '../models/ChannelLinkToken.js';
import {quoteReferenceFromMessage,confirmQuoteMessengerContact} from './quoteRequests.js';
import ContactEnquiry from '../models/ContactEnquiry.js';
import {enqueueContactEmailJobs} from './contactEmailQueue.js';
import {canReplyToPublicTelegramSupport,isSubstantiveTelegramInbound,safePublicSupportReply,TELEGRAM_GENERAL_SUPPORT_WINDOW_MS} from './telegramSupportPolicy.js';

const maxBodyLength = 3000;
const safeText = input => typeof input === 'string' ? input.trim().slice(0,maxBodyLength) : '';
const isDuplicate = error => error?.code === 11000;
const safeCompare = (a,b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a),right=Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left,right);
};
export function validTelegramUsername(value) {
  return typeof value === 'string' && /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(value);
}
export function validWhatsappNumber(value) {
  return typeof value === 'string' && /^[1-9][0-9]{7,14}$/.test(value);
}
export function verifyWhatsappSignature(raw,header,secret) {
  if (!Buffer.isBuffer(raw)||!secret||typeof header!=='string'||!/^sha256=[a-f0-9]{64}$/i.test(header))return false;
  const expected='sha256='+crypto.createHmac('sha256',secret).update(raw).digest('hex');
  return safeCompare(header.toLowerCase(),expected);
}
export function verifyTelegramSecret(header,secret){
  return Boolean(secret&&safeCompare(header,secret));
}
export function parseTelegramUpdate(payload){
  const msg=payload?.message;
  if (!Number.isSafeInteger(payload?.update_id)||msg?.chat?.type!=='private'||typeof msg.chat.id!=='number')return [];
  const body=safeText(msg.text);
  if(!body)return [];
  return [{
    channel:'telegram',external_id:String(msg.chat.id),
    external_message_id:'tg:'+String(payload.update_id),
    // Avoid retaining Telegram profile legal names for anonymous academic enquiries.
    display_name:msg.from?.username?'@'+String(msg.from.username).slice(0,32):'Telegram visitor',
    telegram_username:String(msg.from?.username||'').toLowerCase(),
    body,provider_at:new Date((Number(msg.date)||Date.now()/1000)*1000)
  }];
}
export function parseWhatsappUpdate(payload){
  if(payload?.object!=='whatsapp_business_account'||!Array.isArray(payload.entry))return [];
  const result=[];
  for(const entry of payload.entry.slice(0,10)){
    for(const change of (entry.changes||[]).slice(0,10)){
      if(change?.field!=='messages')continue;
      const contacts=new Map((change.value?.contacts||[]).map(c=>[c.wa_id,c.profile?.name||'']));
      for(const msg of (change.value?.messages||[]).slice(0,50)){
        if(msg.type!=='text'||!validWhatsappNumber(msg.from)||typeof msg.id!=='string')continue;
        const body=safeText(msg.text?.body);
        if(!body)continue;
        result.push({channel:'whatsapp',external_id:msg.from,external_message_id:'wa:'+msg.id.slice(0,200),
          display_name:'WhatsApp visitor',body,
          provider_at:new Date((Number(msg.timestamp)||Date.now()/1000)*1000)});
      }
    }
  }
  return result;
}
const tokenHash=code=>crypto.createHash('sha256').update(code).digest('hex');
const linkCodeFromMessage=body=>{
  const m=/^(?:\/link|LINK)\s+([A-Za-z0-9_-]{20})$/i.exec(body);
  return m?m[1]:null;
};
// Disconnecting a messenger revokes contact verification and reply consent on
// every associated request, including guest enquiries linked by their chat ID.
export async function revokeChannelConsent({channel,clientId='',contactIds=[],model=ContactEnquiry}={}){
  if(!['telegram','whatsapp'].includes(channel))throw Error('Unsupported contact channel');
  const selectors=[];
  if(clientId)selectors.push({client_id:clientId});
  if(contactIds.length)selectors.push({contact_thread_id:{$in:contactIds}});
  if(!selectors.length)return {modifiedCount:0};
  return model.updateMany({
    request_type:{$in:['quote','general']},preferred_channel:channel,contact_verified:true,$or:selectors
  },{$set:{contact_verified:false,verification_status:'awaiting_verification',contact_consent:false},
     $unset:{contact_thread_id:'',contact_verified_at:''}});
}

async function storeInbound(event){
  const now=new Date();
  const contact=await ChannelContact.findOneAndUpdate(
    {channel:event.channel,external_id:event.external_id},
    {$setOnInsert:{channel:event.channel,external_id:event.external_id,status:'open'},
     $set:{display_name:event.display_name||'',last_inbound_at:now,last_message_at:now}},
    {upsert:true,new:true,setDefaultsOnInsert:true}
  );
  const code=linkCodeFromMessage(event.body);
  let messageBody=event.body;
  if(code){
    messageBody='[Account-link request — code not stored]';
    const token=await ChannelLinkToken.findOneAndUpdate(
      {token_hash:tokenHash(code),expires_at:{$gt:now},consumed_at:{$exists:false}},
      {$set:{consumed_at:now}},{new:true}
    );
    if(token){
      const updated=await ChannelContact.findOneAndUpdate(
        {_id:contact._id,$or:[{client_id:''},{client_id:token.client_id}]},
        {$set:{client_id:token.client_id,verified_at:now,status:'open'}},{new:true}
      );
      messageBody=updated?'[Customer verified their IPS account]':'[Account-link request rejected: already linked]';
    }else messageBody='[Invalid or expired account-link request]';
  }
  try{
    await ChannelMessage.create({contact_id:contact._id,channel:event.channel,
      external_message_id:event.external_message_id,direction:'inbound',body:messageBody,
      provider_at:event.provider_at,status:'received'});
  }catch(error){
    if(isDuplicate(error))return {duplicate:true};
    throw error;
  }
  await ChannelContact.updateOne({_id:contact._id},{$inc:{unread_count:1}});
  // STOP is a customer-initiated withdrawal. It takes priority over further
  // quote linking and does not require an IPS account or staff action.
  if(/^(?:\/stop|stop|unsubscribe)$/i.test(event.body.trim())){
    await ChannelContact.updateOne({_id:contact._id},{$set:{status:'closed',client_id:'',verified_at:null}});
    await revokeChannelConsent({channel:event.channel,contactIds:[String(contact._id)]});
    return {duplicate:false,unsubscribed:true};
  }
  // A signed, customer-initiated chat containing the exact quote reference and
  // matching channel identity proves control of that reply route.
  if(quoteReferenceFromMessage(event.body)){
    const verified=await confirmQuoteMessengerContact({...event,contact_id:String(contact._id)});
    if(verified){
      await ChannelContact.updateOne({_id:contact._id},{$set:{status:'open'}});
      const lead=await ContactEnquiry.findOne({enquiry_id:quoteReferenceFromMessage(event.body)}).lean();
      if(lead)try{await enqueueContactEmailJobs(lead);}catch{}
    }
  }
  // General enquiry guests can also prove their selected channel by sending
  // their exact ENQ reference. This does not authenticate an IPS account.
  const ref=/\bENQ-[A-F0-9]{18}\b/i.exec(event.body)?.[0]?.toUpperCase();
  if(ref){
    const filter={enquiry_id:ref,request_type:'general',preferred_channel:event.channel,
      contact_verified:false,contact_consent:true};
    if(event.channel==='telegram'){
      if(event.telegram_username)filter.telegram_username=event.telegram_username.toLowerCase();
      else return {duplicate:false};
    }else filter.phone='+'+String(event.external_id).replace(/^\+/,'');
    const result=await ContactEnquiry.updateOne(filter,{
      $set:{contact_verified:true,verification_status:'verified',contact_verified_at:now,
        contact_thread_id:String(contact._id)},$unset:{purge_at:''}
    });
    if(result.modifiedCount){
      await ChannelContact.updateOne({_id:contact._id},{$set:{status:'open'}});
      const lead=await ContactEnquiry.findOne({enquiry_id:ref}).lean();
      if(lead)try{await enqueueContactEmailJobs(lead);}catch{}
    }
  }
  return {duplicate:false};
}
async function safeEventBatch(events){
  // Return an error for storage failures so Telegram/Meta can retry their webhook.
  for(const event of events)await storeInbound(event);
}

export function registerContactWebhooks(app,express){
  app.get('/api/channels/whatsapp/webhook',(req,res)=>{
    const token=process.env.WHATSAPP_VERIFY_TOKEN;
    if(!token)return res.status(503).send('Not configured');
    const q=req.query||{};
    if(q['hub.mode']==='subscribe'&&safeCompare(q['hub.verify_token'],token)&&/^\d+$/.test(String(q['hub.challenge']||''))){
      return res.status(200).type('text/plain').send(String(q['hub.challenge']));
    }
    return res.sendStatus(403);
  });
  app.post('/api/channels/whatsapp/webhook',express.raw({type:'application/json',limit:'256kb'}),async(req,res)=>{
    const secret=process.env.WHATSAPP_APP_SECRET;
    if(!secret)return res.sendStatus(503);
    if(!verifyWhatsappSignature(req.body,req.headers['x-hub-signature-256'],secret))return res.sendStatus(403);
    try{
      const payload=JSON.parse(req.body.toString('utf8'));
      await safeEventBatch(parseWhatsappUpdate(payload));
      return res.sendStatus(200);
    }catch(error){console.error('WhatsApp webhook rejected:',error?.name||'error');return res.sendStatus(500);}
  });
  app.post('/api/channels/telegram/webhook',express.raw({type:'application/json',limit:'256kb'}),async(req,res)=>{
    const secret=process.env.TELEGRAM_WEBHOOK_SECRET;
    if(!secret)return res.sendStatus(503);
    if(!verifyTelegramSecret(req.headers['x-telegram-bot-api-secret-token'],secret))return res.sendStatus(403);
    try{
      const payload=JSON.parse(req.body.toString('utf8'));
      await safeEventBatch(parseTelegramUpdate(payload));
      return res.sendStatus(200);
    }catch(error){console.error('Telegram webhook rejected:',error?.name||'error');return res.sendStatus(500);}
  });
}

export function publicContactConfig(env=process.env){
  const username=String(env.TELEGRAM_BOT_USERNAME||'').replace(/^@/,'').trim();
  // Direct WhatsApp is a user-initiated wa.me link: no Meta API or webhook
  // authority is claimed. API integration is opt-in if ever enabled later.
  const number=String(env.WHATSAPP_PUBLIC_NUMBER||PUBLIC_CONTACTS.whatsapp.number).trim();
  const telegram=validTelegramUsername(username)&&Boolean(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_WEBHOOK_SECRET);
  const apiMode=String(env.WHATSAPP_CONTACT_MODE||'direct').toLowerCase()==='api';
  const apiReady=Boolean(env.WHATSAPP_PHONE_NUMBER_ID&&env.WHATSAPP_ACCESS_TOKEN&&env.WHATSAPP_APP_SECRET&&env.WHATSAPP_VERIFY_TOKEN);
  const whatsapp=validWhatsappNumber(number)&&(!apiMode||apiReady);
  return {telegram:telegram?{url:'https://t.me/'+username,available:true,connected:true,mode:'api'}:null,
    whatsapp:whatsapp?{url:'https://wa.me/'+number,available:true,connected:apiMode,
      mode:apiMode?'api':'direct',manual_confirmation:!apiMode}:null,
    confidentiality:'Messages in external apps are processed under those providers\' terms. Keep payment details, private academic files and sensitive data in your IPS account.'};
}

export async function deliverExternalMessage(contact,body,{request=fetch,env=process.env}={}){
  if(contact.channel==='telegram'){
    const token=env.TELEGRAM_BOT_TOKEN;
    if(!token)throw Error('Telegram transport is not configured');
    const response=await request('https://api.telegram.org/bot'+token+'/sendMessage',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:contact.external_id,text:body}),
      signal:AbortSignal.timeout(12000)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data.ok!==true||!data.result?.message_id)throw Error('Telegram rejected the reply');
    return 'tg:sent:'+String(data.result.message_id);
  }
  if(contact.channel==='whatsapp'){
    if(!env.WHATSAPP_ACCESS_TOKEN||!env.WHATSAPP_PHONE_NUMBER_ID)throw Error('WhatsApp transport is not configured');
    // Free-form WhatsApp Cloud API text only within the customer service window.
    if(!contact.last_inbound_at||Date.now()-new Date(contact.last_inbound_at).getTime()>23*3600000)
      throw Error('WhatsApp session has ended; customer must message first or an approved template is required');
    const endpoint='https://graph.facebook.com/'+String(env.WHATSAPP_GRAPH_VERSION||'v23.0')+'/'+encodeURIComponent(env.WHATSAPP_PHONE_NUMBER_ID)+'/messages';
    const response=await request(endpoint,{method:'POST',
      headers:{Authorization:'Bearer '+env.WHATSAPP_ACCESS_TOKEN,'Content-Type':'application/json'},
      body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:contact.external_id,type:'text',text:{body}}),
      signal:AbortSignal.timeout(12000)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.messages?.[0]?.id)throw Error('WhatsApp rejected the reply');
    return 'wa:sent:'+String(data.messages[0].id);
  }
  throw Error('Unsupported channel');
}
async function generalSupportReplyAllowed(contact){
  if(!contact||contact.channel!=='telegram'||contact.status!=='open')return false;
  const recent=await ChannelMessage.find({
    contact_id:contact._id,channel:'telegram',
    createdAt:{$gte:new Date(Date.now()-TELEGRAM_GENERAL_SUPPORT_WINDOW_MS)}
  }).select('direction body createdAt').sort({createdAt:-1}).limit(80).lean();
  const inbound=recent.find(m=>m.direction==='inbound'&&isSubstantiveTelegramInbound(m.body));
  const outbound=recent.find(m=>m.direction==='outbound');
  return canReplyToPublicTelegramSupport(contact,{inbound,outbound});
}
export function registerContactApi(app,{requireSession}){
  app.get('/api/contact-channels/config',(_req,res)=>{
    res.set('Cache-Control','no-store');
    res.json({success:true,...publicContactConfig()});
  });

  app.post('/api/contact-channels/link-code',async(req,res)=>{
    try{
      const session=requireSession(req,res);if(!session)return;
      if(session.role!=='client')return res.sendStatus(403);
      const recent=await ChannelLinkToken.countDocuments({client_id:session.id,createdAt:{$gt:new Date(Date.now()-10*60000)}});
      if(recent>=3)return res.status(429).json({success:false,error:'Request limit reached. Please try later.'});
      const code=crypto.randomBytes(15).toString('base64url'); // 20 chars, at least 120 random bits.
      const expires_at=new Date(Date.now()+10*60000);
      await ChannelLinkToken.create({token_hash:tokenHash(code),client_id:session.id,expires_at});
      res.set('Cache-Control','no-store');
      return res.json({success:true,code,expires_at,command:'/link '+code});
    }catch{res.status(500).json({success:false,error:'Unable to create account-link code.'});}
  });

  app.get('/api/contact-channels/me',async(req,res)=>{
    try{const session=requireSession(req,res);if(!session)return;
      if(session.role!=='client')return res.sendStatus(403);
      const contacts=await ChannelContact.find({client_id:session.id}).select('channel verified_at status').lean();
      res.set('Cache-Control','no-store');res.json({success:true,contacts});
    }catch{res.status(500).json({success:false,error:'Could not load your contact preferences.'});}
  });

  app.post('/api/contact-channels/unlink',async(req,res)=>{
    try{const session=requireSession(req,res);if(!session)return;
      if(session.role!=='client'||!['telegram','whatsapp'].includes(req.body?.channel))return res.sendStatus(403);
      const contacts=await ChannelContact.find({client_id:session.id,channel:req.body.channel}).select('_id').lean();
      const ids=contacts.map(item=>String(item._id));
      // Close first to fail closed if the downstream quote cleanup fails.
      await ChannelContact.updateMany({client_id:session.id,channel:req.body.channel},
        {$set:{client_id:'',verified_at:null,status:'closed'}});
      await revokeChannelConsent({channel:req.body.channel,clientId:session.id,contactIds:ids});
      res.json({success:true});
    }catch{res.status(500).json({success:false,error:'Unable to unlink channel.'});}
  });

  app.get('/api/contact-channels/admin/threads',async(req,res)=>{
    try{const session=requireSession(req,res);if(!session)return;
      if(session.role!=='admin'||!req.adminAccess||!hasAdminPermission(req.adminAccess,'messages.view'))return res.sendStatus(403);
      const threads=await ChannelContact.find().select('channel display_name external_id client_id verified_at last_inbound_at last_message_at unread_count status').sort({last_message_at:-1}).limit(100).lean();
      const verified=await ContactEnquiry.find({contact_consent:true,contact_verified:true,status:{$ne:'closed'},contact_thread_id:{$in:threads.map(t=>String(t._id))}})
        .select('contact_thread_id').lean();
      const verifiedIds=new Set(verified.map(q=>q.contact_thread_id));
      // A general-support reply is permitted after a fresh, substantive
      // customer-initiated Telegram message, even before account verification.
      // This does not authorize discussion of projects or private quotes.
      const eligible=threads.filter(t=>t.channel==='telegram'&&t.status==='open'&&!verifiedIds.has(String(t._id)));
      const supportById=new Map();
      if(eligible.length){
        const recent=await ChannelMessage.find({
          contact_id:{$in:eligible.map(t=>t._id)},channel:'telegram',
          createdAt:{$gte:new Date(Date.now()-TELEGRAM_GENERAL_SUPPORT_WINDOW_MS)}
        }).select('contact_id direction body createdAt').sort({createdAt:-1}).limit(3000).lean();
        for(const message of recent){
          const key=String(message.contact_id);
          const state=supportById.get(key)||{};
          if(message.direction==='outbound'&&!state.outbound)state.outbound=message;
          if(message.direction==='inbound'&&!state.inbound&&isSubstantiveTelegramInbound(message.body))state.inbound=message;
          supportById.set(key,state);
        }
      }
      const rows=threads.map(t=>{
        const verified=t.status==='open'&&verifiedIds.has(String(t._id));
        const state=supportById.get(String(t._id))||{};
        const support=!verified&&canReplyToPublicTelegramSupport(t,state);
        return {...t,verified_contact:verified,support_reply_allowed:support,
          reply_mode:verified?'verified':support?'general_support':'unavailable'};
      });
      res.set('Cache-Control','no-store');res.json({success:true,threads:rows});
    }catch{res.status(500).json({success:false,error:'Unable to load channel inbox.'});}
  });

  app.get('/api/contact-channels/admin/threads/:id/messages',async(req,res)=>{
    try{const session=requireSession(req,res);if(!session)return;
      if(session.role!=='admin'||!req.adminAccess||!hasAdminPermission(req.adminAccess,'messages.view'))return res.sendStatus(403);
      if(!/^[a-f0-9]{24}$/i.test(req.params.id))return res.sendStatus(400);
      const contact=await ChannelContact.findById(req.params.id).lean();
      if(!contact)return res.sendStatus(404);
      const messages=await ChannelMessage.find({contact_id:contact._id}).sort({createdAt:-1}).limit(100).lean();
      await ChannelContact.updateOne({_id:contact._id},{$set:{unread_count:0}});
      res.set('Cache-Control','no-store');res.json({success:true,contact,messages:messages.reverse()});
    }catch{res.status(500).json({success:false,error:'Unable to load messages.'});}
  });

  app.post('/api/contact-channels/admin/threads/:id/reply',async(req,res)=>{
    try{const session=requireSession(req,res);if(!session)return;
      if(session.role!=='admin'||!req.adminAccess||!hasAdminPermission(req.adminAccess,'messages.manage'))return res.sendStatus(403);
      if(!/^[a-f0-9]{24}$/i.test(req.params.id))return res.sendStatus(400);
      const body=safeText(req.body?.body);
      if(body.length<1||body.length>2000)return res.status(400).json({success:false,error:'Reply must be 1–2000 characters.'});
      const contact=await ChannelContact.findById(req.params.id);
      if(!contact)return res.sendStatus(404);
      if(contact.status==='closed')return res.status(409).json({success:false,error:'This thread is closed.'});
      const authorized=await ContactEnquiry.exists({
        contact_thread_id:String(contact._id),preferred_channel:contact.channel,
        contact_verified:true,contact_consent:true,status:{$ne:'closed'}
      });
      // General support is distinct from private project messaging.
      // The user has already contacted the bot, so IPS staff may issue a
      // single short reply; after that the customer must message again.
      const generalSupport=!authorized&&await generalSupportReplyAllowed(contact);
      if(!authorized&&!generalSupport)
        return res.status(409).json({success:false,error:'This contact has no verified project request or fresh customer-initiated Telegram support message. Ask them to message IPS again.'});
      if(generalSupport&&!safePublicSupportReply(body))
        return res.status(400).json({success:false,error:'General Telegram support must be 1–650 characters, without links, reference numbers or private records. Move confidential discussion into the IPS workspace.'});
      let msgId;
      try{msgId=await deliverExternalMessage(contact,body);}
      catch(error){return res.status(502).json({success:false,error:error.message});}
      await ChannelMessage.create({contact_id:contact._id,channel:contact.channel,external_message_id:msgId,
        direction:'outbound',body,status:'sent',sent_by:session.id});
      await ChannelContact.updateOne({_id:contact._id},{$set:{last_message_at:new Date()}});
      res.json({success:true,delivery:'provider_accepted',reply_mode:generalSupport?'general_support':'verified'});
    }catch(error){res.status(500).json({success:false,error:'Reply may have been sent; refresh before retrying.'});}
  });
}
