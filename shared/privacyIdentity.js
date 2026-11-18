// IPS privacy-first public account and enquiry validation.
// These validators are shared by the browser, API and automated tests.
export const usernameValid=value=>
  typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{2,31}$/.test(value)&&
  !/^(admin|administrator|support|security|billing|system|ips|root|moderator)$/i.test(value);
export const normalizeUsername=value=>String(value||'').trim();
export const usernameKey=value=>normalizeUsername(value).toLowerCase();
export const passwordValid=value=>
  typeof value==='string'&&value.length>=8&&value.length<=128&&
  /[A-Z]/.test(value)&&/[0-9]/.test(value)&&/[^a-zA-Z0-9\s]/.test(value);
export const normalizeEmail=value=>String(value||'').trim().toLowerCase();
export const emailValid=value=>{
  if(typeof value!=='string'||value.length>254||value.includes('..'))return false;
  const [local,domain,extra]=value.split('@');
  return !extra&&!!local&&local.length<=64&&/^[^\s@\x00-\x1f]+$/.test(local)&&
    !!domain&&domain.length<=253&&domain.includes('.')&&
    domain.split('.').every(part=>part.length>0&&part.length<=63&&/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(part))&&
    !/\.(invalid|test|example|localhost|local)$/i.test(domain);
};
export const replyChannelChoices=Object.freeze(['workspace','email','telegram','whatsapp']);
export const noCallPolicy='IPS communicates in writing only. We never telephone customers or initiate voice calls.';
export function validatePrivateQuote(input,{signedIn=false,verifiedChannels=[]}={}){
  if(!input||typeof input!=='object'||Array.isArray(input))return {error:'Complete the quotation request.'};
  const username=normalizeUsername(input.username||'');
  const service=String(input.service||'').trim();
  const subject=String(input.subject||'').trim();
  const level=String(input.level||'').trim();
  const brief=String(input.message||'').trim();
  const deadline=String(input.deadline||'').trim();
  const contact=String(input.preferred_channel||'').trim();
  const email=normalizeEmail(input.email);
  const phone=String(input.phone||'').trim().replace(/[\s().-]/g,'');
  const telegram=String(input.telegram_username||'').trim().replace(/^@/,'');
  if(!usernameValid(username))return {error:'Choose a username of 3–32 letters, numbers, periods, underscores or hyphens.'};
  if(!service||service.length>100||!subject||subject.length>160||
    brief.length<20||brief.length>3000)return {error:'Choose a service and describe your project (at least 20 characters).'};
  if(level.length>70)return {error:'Invalid academic level.'};
  if(deadline&&(!/^\d{4}-\d{2}-\d{2}$/.test(deadline)||Number.isNaN(Date.parse(deadline))||
    deadline<new Date().toISOString().slice(0,10)))return {error:'Choose a current or future deadline.'};
  if(!replyChannelChoices.includes(contact))return {error:'Choose a supported written reply method.'};
  if(contact==='workspace'&&!signedIn)return {error:'Sign in to use private IPS workspace messages.'};
  if(email&&!emailValid(email))return {error:'Enter a valid email address.'};
  if(contact==='email'&&!emailValid(email))return {error:'A valid email is required for email replies.'};
  if(contact==='whatsapp'&&!/^\+[1-9][0-9]{7,14}$/.test(phone))return {error:'Enter a WhatsApp number with international country code.'};
  if(contact==='telegram'&&!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(telegram))return {error:'Enter a valid Telegram username (5–32 characters).'};
  if(input.contact_consent!==true)return {error:'Agree to receive written updates about this request.'};
  if(String(input.website||'').trim())return {error:'Unable to process this request.'};
  const verified=contact==='workspace'||verifiedChannels.includes(contact);
  return {value:{
    username,service,subject,level,deadline,message:brief,
    preferred_channel:contact,email:contact==='email'?email:'',phone:contact==='whatsapp'?phone:'',
    telegram_username:contact==='telegram'?telegram:'',contact_consent:true,
    contact_verified:verified,verification_status:verified?'verified':'awaiting_verification'
  }};
}
