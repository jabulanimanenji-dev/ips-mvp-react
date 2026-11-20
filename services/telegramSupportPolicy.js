// Public Telegram support is separate from client identity verification.
// A human may answer an unsolicited customer-initiated *general enquiry*,
// but cannot disclose projects, quotes, identities or confidential records.
// The customer has to write again after a reply; no follow-up spam.
export const TELEGRAM_GENERAL_SUPPORT_WINDOW_MS=7*24*60*60*1000;
const commands=/^(?:\/start(?:\s+.*)?|\/link(?:\s+.*)?|\/stop|stop|unsubscribe)$/i;
const privatePayload=/(?:https?:\/\/|\bIPS-Q-[A-F0-9]{18}\b|\bENQ-[A-F0-9]{18}\b|\b(?:\d[ -]*?){14,19}\b)/i;
export function isSubstantiveTelegramInbound(body){
  const text=String(body||'').trim();
  return text.length>0 && !commands.test(text);
}
export function canReplyToPublicTelegramSupport(contact,{inbound,outbound,now=Date.now()}={}){
  if(!contact||contact.channel!=='telegram'||contact.status!=='open'||!inbound ||
    !isSubstantiveTelegramInbound(inbound.body))return false;
  const time=new Date(inbound.createdAt).getTime();
  if(!Number.isFinite(time)||time>now+60000||now-time>TELEGRAM_GENERAL_SUPPORT_WINDOW_MS)return false;
  if(outbound&&new Date(outbound.createdAt).getTime()>=time)return false;
  return true;
}
export function safePublicSupportReply(body){
  const text=String(body||'').trim();
  return text.length>=1&&text.length<=650&&!privatePayload.test(text);
}
