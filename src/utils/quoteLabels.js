import {getStudentOffer} from '../../shared/studentOffers.js';

export const serviceTitle=(value)=>{
  const raw=String(value||'').trim();
  if(!raw)return 'Academic support';
  const found=getStudentOffer(raw);
  if(found)return found.title;
  return raw.split(/[-_]/).filter(Boolean).map(part=>part[0].toUpperCase()+part.slice(1)).join(' ');
};
export const quoteStatusTitle=(status)=>({
  new:'Received',in_progress:'Under review',waiting_for_customer:'Awaiting your reply',closed:'Closed'
}[status]||serviceTitle(status||'Unknown'));
export const contactChannelTitle=(channel)=>({
  workspace:'Private IPS workspace',email:'Email',telegram:'Telegram messages',whatsapp:'WhatsApp messages'
}[channel]||serviceTitle(channel||'Written contact'));
export const quoteSubjectTitle=(record)=>{
  if(record?.request_type!=='quote')return String(record?.subject||'Academic enquiry');
  const service=serviceTitle(record?.service);
  const subject=String(record?.discipline||'').trim();
  return subject?service+' — '+subject:service;
};
