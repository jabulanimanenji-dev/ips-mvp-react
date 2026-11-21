// IPS Academic Services: authenticated, account-linked Telegram operator conversations.
// A provider-accepted message is not proof that a recipient read it.
const canManage=a=>a&&(a.role==='root'||
 ['manager','staff'].includes(a.role)&&a.department==='communications');
const summary=m=>({id:m.id,accountId:m.accountId,direction:m.direction,
 body:m.body,status:m.status,read:!!m.read,createdAt:m.createdAt,
 providerMessageId:m.providerMessageId||'',actorRole:m.actorRole||''});

export async function receiveTelegramMessage(ctx,update){
 const {db,rootEmail,notify,audit,now,uid}=ctx;
 const m=update?.message,chat=m?.chat,from=m?.from;
 const chatId=Number(chat?.id),updateId=Number(update?.update_id);
 const providerMessageId=Number(m?.message_id);
 if(chat?.type!=='private'||!Number.isSafeInteger(chatId)||chatId<=0||
  Number(from?.id)!==chatId||!Number.isSafeInteger(updateId)||updateId<0||
  !Number.isSafeInteger(providerMessageId)||providerMessageId<=0)
  return {accepted:false};
 const body=String(m?.text||'').trim();
 // Bot commands and unsupported media are not recorded as correspondence.
 if(body.length<2||body.length>3500||body.startsWith('/'))return {accepted:false};
 const account=await db.accounts.findOne({telegramChatId:chatId,
  telegramConnectionStatus:'confirmed',verified:true,status:'active',
  role:{$in:['student','specialist']}});
 if(!account)return {accepted:false};
 const item={id:uid('TG-MSG'),providerUpdateId:updateId,
  providerMessageId:String(providerMessageId),accountId:account.id,
  direction:'inbound',body,status:'received',read:false,createdAt:now()};
 try{await db.telegramMessages.insertOne(item)}
 catch(e){if(e?.code===11000)return {accepted:false,duplicate:true};throw e}
 // Inbound text may contain sensitive academic information: never copy it to a notice or audit log.
 await audit({id:account.id,role:account.role},'telegram_private_message_received',
  item.id,{accountId:account.id,channel:'telegram'});
 await notify(rootEmail,'New private Telegram message from linked IPS account '+account.id,
  'telegram_inbound');
 const staff=await db.accounts.find({department:'communications',
  role:{$in:['manager','staff']},verified:true,status:'active'},
  {projection:{id:1}}).toArray();
 for(const member of staff)await notify(member.id,
  'A verified IPS Telegram message needs Communications review','telegram_inbound');
 return {accepted:true};
}

export function registerTelegramConversationRoutes(ctx){
 const {app,db,authorize,audit,now,uid,wrap}=ctx;
 const guard=(req,res)=>{
  if(!authorize(req,res,['root','manager','staff']))return false;
  if(!canManage(req.actor)){
   res.status(403).json({error:'Only authorized IPS Communications personnel may manage Telegram conversations.'});
   return false;
  }
  return true;
 };
 app.get('/api/communications/telegram/threads',wrap(async(req,res)=>{
  if(!guard(req,res))return;
  const groups=await db.telegramMessages.aggregate([
   {$sort:{createdAt:-1}},
   {$group:{_id:'$accountId',last:{$first:'$$ROOT'},
    unread:{$sum:{$cond:[{$and:[{$eq:['$direction','inbound']},{$eq:['$read',false]}]},1,0]}}}},
   {$sort:{'last.createdAt':-1}},{$limit:100}
  ]).toArray();
  const people=await db.accounts.find({id:{$in:groups.map(x=>x._id)}},
   {projection:{id:1,username:1,name:1,role:1,status:1,
    telegramConnectionStatus:1,telegramChatId:1}}).toArray();
  const byId=new Map(people.map(a=>[a.id,a]));
  res.json({threads:groups.map(g=>{
   const a=byId.get(g._id);
   return {accountId:g._id,label:a?.username||a?.name||'IPS account',
    role:a?.role||'',linked:!!(a?.telegramChatId&&a?.telegramConnectionStatus==='confirmed'),
    unread:g.unread,updatedAt:g.last.createdAt,lastDirection:g.last.direction,
    lastStatus:g.last.status};
  })});
 }));
 app.get('/api/communications/telegram/threads/:accountId',wrap(async(req,res)=>{
  if(!guard(req,res))return;
  const account=await db.accounts.findOne({id:req.params.accountId,
   role:{$in:['student','specialist']}},{projection:{id:1,username:1,name:1,
    role:1,status:1,telegramChatId:1,telegramConnectionStatus:1}});
  if(!account)return res.status(404).json({error:'Telegram conversation account does not exist.'});
  const messages=await db.telegramMessages.find({accountId:account.id})
   .sort({createdAt:1}).limit(300).toArray();
  res.json({accountId:account.id,label:account.username||account.name||'IPS account',
   linked:!!(account.telegramChatId&&account.telegramConnectionStatus==='confirmed'),
   messages:messages.map(summary)});
 }));
 app.post('/api/communications/telegram/threads/:accountId/read',wrap(async(req,res)=>{
  if(!guard(req,res))return;
  const updated=await db.telegramMessages.updateMany({accountId:req.params.accountId,
   direction:'inbound',read:false},{$set:{read:true,readAt:now(),readBy:req.actor.id}});
  if(updated.modifiedCount)await audit(req.actor,'telegram_company_messages_read',
   req.params.accountId,{count:updated.modifiedCount});
  res.json({success:true,read:updated.modifiedCount});
 }));
 app.post('/api/communications/telegram/threads/:accountId/reply',wrap(async(req,res)=>{
  if(!guard(req,res))return;
  const body=String(req.body?.body||'').trim();
  if(body.length<2||body.length>2000||req.body?.privacyConfirmed!==true)
   return res.status(400).json({error:'Use a brief written reply and confirm no confidential academic, financial or identity information is sent on Telegram.'});
  const account=await db.accounts.findOne({id:req.params.accountId,
   role:{$in:['student','specialist']},status:'active',verified:true,
   telegramChatId:{$type:'number'},telegramConnectionStatus:'confirmed'});
  if(!account)return res.status(409).json({error:'This account has no active verified Telegram chat. Reply securely inside IPS instead.'});
  const messageId=uid('TG-MSG'),jobId=uid('OUT'),createdAt=now();
  const item={id:messageId,accountId:account.id,direction:'outbound',
   body,status:'queued',actorId:req.actor.id,actorRole:req.actor.role,
   createdAt,read:true,deliveryId:jobId};
  await db.telegramMessages.insertOne(item);
  try{await db.notificationDeliveries.insertOne({id:jobId,accountId:account.id,
   channel:'telegram',chatId:account.telegramChatId,telegramMessageId:messageId,
   text:body,kind:'operator_reply',status:'pending',attempts:0,
   nextAttemptAt:createdAt,createdAt})}
  catch(error){
   await db.telegramMessages.updateOne({id:messageId},
    {$set:{status:'queue_failed',failedAt:now()}});
   throw error;
  }
  await audit(req.actor,'telegram_company_reply_queued',messageId,{accountId:account.id});
  res.status(202).json({success:true,queued:true,messageId,
   warning:'Provider acceptance and recipient reading are not yet verified.'});
 }));
}
