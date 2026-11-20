// Temporary, opt-in production diagnostic for a single owner-authored Telegram
// test message. Never exports message bodies, chat IDs, handles or sender data.
// The digest stays in the Render environment rather than in public source.
import crypto from 'node:crypto';
import ChannelMessage from '../models/ChannelMessage.js';

export async function qualifyOwnerTelegramInbound({
  env=process.env,model=ChannelMessage,now=()=>new Date()
}={}){
  const id=String(env.IPS_TELEGRAM_INBOUND_CHECK_ID||'').trim();
  if(!id || env.NODE_ENV!=='production' ||
      String(env.IPS_PUBLICATION_STRICT||'').toLowerCase()!=='true' ||
      String(env.IPS_EVALUATION_MODE||'').toLowerCase()==='true')
    return {skipped:true};
  const sha=String(env.IPS_TELEGRAM_INBOUND_CHECK_SHA256||'').trim().toLowerCase();
  if(!/^[a-z0-9_-]{8,64}$/i.test(id)||!/^[a-f0-9]{64}$/.test(sha))
    throw new Error('Telegram inbound check requires a bounded run ID and SHA-256 digest.');
  const since=new Date(now().getTime()-8*60*60*1000);
  const recent=await model.find({
    channel:'telegram',direction:'inbound',createdAt:{$gte:since}
  }).select('body').sort({createdAt:-1}).limit(500).lean();
  const matched=recent.some(row=>crypto.createHash('sha256')
    .update(String(row.body||'').trim(),'utf8').digest('hex')===sha);
  return {run_id:id,matched,scanned:recent.length};
}
