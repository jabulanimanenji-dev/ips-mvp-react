// Telegram is an optional private written channel. A username is NEVER a destination.
// Link only a private chat proven through a signed bot webhook and one-use token.
import crypto from 'node:crypto';
import {strongToken} from './security.mjs';
import {registerTelegramConversationRoutes,receiveTelegramMessage} from './routes-telegram-conversations.mjs';

export const telegramConfigured=env=>/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(String(env.IPS_TELEGRAM_BOT_USERNAME||''))&&
 !!String(env.TELEGRAM_BOT_TOKEN||'')&&
 /^[A-Za-z0-9_-]{16,256}$/.test(String(env.IPS_TELEGRAM_WEBHOOK_SECRET||''));

const secureMatch=(received,expected)=>{
 const a=Buffer.from(String(received||'')),b=Buffer.from(String(expected||''));
 return a.length===b.length&&a.length>=16&&crypto.timingSafeEqual(a,b);
};

export function registerTelegramRoutes(ctx){
 const {app,db,env,security,throttle,authorize,audit,notify,sendTelegram,rootEmail,wrap,now}=ctx;
 const ready=()=>telegramConfigured(env);
 app.get('/api/contact/telegram/status',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','specialist']))return;
  const a=await db.accounts.findOne({id:req.actor.id,verified:true,status:'active'});
  if(!a)return res.status(403).json({error:'Active verified account required.'});
  res.json({available:ready(),linked:!!(a.telegramChatId&&a.telegramVerifiedAt&&a.telegramConnectionStatus==='confirmed'),
   botUsername:ready()?env.IPS_TELEGRAM_BOT_USERNAME:''});
 }));
 app.post('/api/contact/telegram/link',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','specialist']))return;
  if(await throttle.limited(req,'telegram-link',5))return res.status(429).json({error:'Please retry Telegram linking later.'});
  if(!ready())return res.status(503).json({error:'IPS Telegram connection is not yet available. Use the secure workspace or email.'});
  const a=await db.accounts.findOne({id:req.actor.id,verified:true,status:'active'});
  if(!a)return res.status(403).json({error:'Verify your IPS account before linking Telegram.'});
  const token=strongToken(),expiry=new Date(Date.now()+20*60000);
  await db.accounts.updateOne({id:a.id,verified:true,status:'active'},{$set:{
   telegramLinkHash:security.digest('telegram-link:'+token),
   telegramLinkUntil:expiry,telegramLinkRequestedAt:now()}});
  await audit(req.actor,'telegram_private_link_requested',a.id);
  res.json({success:true,expiresAt:expiry.toISOString(),
   url:'https://t.me/'+env.IPS_TELEGRAM_BOT_USERNAME+'?start=ips_'+token});
 }));
 app.post('/api/contact/telegram/unlink',wrap(async(req,res)=>{
  if(!authorize(req,res,['student','specialist']))return;
  const row=await db.accounts.findOneAndUpdate({id:req.actor.id,verified:true,status:'active'},
   {$unset:{telegramChatId:'',telegramVerifiedAt:'',telegramUsername:'',
    telegramLinkHash:'',telegramLinkUntil:'',telegramLinkRequestedAt:''},
    $set:{contactPreference:'workspace',updatedAt:now()}},{returnDocument:'after'});
  if(!row)return res.status(403).json({error:'An active verified account is required.'});
  await db.notificationDeliveries.updateMany({accountId:row.id,channel:'telegram',
   status:{$in:['pending','sending']}},{$set:{status:'cancelled',cancelledAt:now()},
    $unset:{lockedAt:''}});
  await db.telegramMessages.updateMany({accountId:row.id,direction:'outbound',
    status:'queued'},{$set:{status:'cancelled',cancelledAt:now()}});
  await audit(req.actor,'telegram_private_contact_revoked',row.id);
  res.json({success:true,linked:false,contactPreference:'workspace'});
 }));
 // Telegram sends this header only after setWebhook with the matching secret_token.
 // Nothing in this endpoint uses untrusted usernames as verified destinations.
 app.post('/api/integrations/telegram/webhook',wrap(async(req,res)=>{
  if(!ready())return res.status(503).json({error:'Telegram bot integration is unavailable.'});
  if(!secureMatch(req.get('X-Telegram-Bot-Api-Secret-Token'),env.IPS_TELEGRAM_WEBHOOK_SECRET))
   return res.status(401).json({error:'Unauthorized Telegram webhook.'});
  const m=req.body?.message,chat=m?.chat,from=m?.from;
  const message=String(m?.text||'');
  const match=message.match(/^\/start(?:@[A-Za-z0-9_]+)?\s+ips_([A-Za-z0-9_-]{43})$/);
  const chatId=Number(chat?.id);
  if(chat?.type!=='private'||!Number.isSafeInteger(chatId)||chatId<=0||
   Number(from?.id)!==chatId)return res.json({ok:true,linked:false});
  if(!match){
   const result=await receiveTelegramMessage(ctx,req.body);
   return res.json({ok:true,...result});
  }
  // Never silently associate a bot chat with more than one verified account.
  if(await db.accounts.findOne({telegramChatId:chatId,
    telegramConnectionStatus:'confirmed',verified:true,status:'active'}))
   return res.json({ok:true,linked:false});
  const digest=security.digest('telegram-link:'+match[1]);
  const account=await db.accounts.findOneAndUpdate({
   telegramLinkHash:digest,telegramLinkUntil:{$gt:now()},
   verified:true,status:'active',role:{$in:['student','specialist']}
  },{$set:{telegramChatId:chatId,telegramVerifiedAt:now(),
    telegramUsername:String(from?.username||'').slice(0,32),
    telegramConnectionStatus:'confirmed',updatedAt:now()},
    $unset:{telegramLinkHash:'',telegramLinkUntil:'',telegramLinkRequestedAt:''}},
   {returnDocument:'after'});
  if(!account)return res.json({ok:true,linked:false});
  await audit({id:account.id,role:account.role},'telegram_private_chat_verified',account.id);
  try{
   await sendTelegram(chatId,'Your IPS Academic Services secure written updates are now connected. Academic files and message details remain inside your IPS workspace.');
  }catch{
   await db.accounts.updateOne({id:account.id,telegramChatId:chatId},
    {$set:{telegramConnectionStatus:'provider_failure',updatedAt:now()}});
   await notify(rootEmail,'Telegram confirmation could not be sent for verified IPS account '+account.id,
    'communication_failure');
  }
  res.json({ok:true,linked:true});
 }));
 registerTelegramConversationRoutes(ctx);
}
