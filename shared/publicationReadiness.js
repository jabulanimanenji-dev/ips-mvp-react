import {publicContactConfig} from '../services/contactChannels.js';
import {verificationAvailable} from '../services/accountVerification.js';
import {contactNotificationsEnabled} from '../services/contactEmailQueue.js';
import {paymentLaunchState} from './paymentLaunch.js';
import {isConfiguredMongoUri,isValidR2Endpoint,isValidR2BucketName,isValidR2Prefix} from './runtimeConfig.js';

// Configuration gate only: external provider delivery needs independent
// operational receipts. Source CI mocks never count as real delivery.
export function nonpaymentPublicationGaps(env=process.env){
  if(env.NODE_ENV!=='production'||String(env.IPS_EVALUATION_MODE)==='true')return [];
  const issues=[];
  if(!isConfiguredMongoUri(env.MONGODB_URI))issues.push('persistent-mongodb');
  if(String(env.STORAGE_PROVIDER||'').toLowerCase()!=='r2'||
     !isValidR2Endpoint(env.R2_ENDPOINT)||!isValidR2BucketName(env.R2_BUCKET_NAME)||
     !isValidR2Prefix(env.R2_PREFIX))
    issues.push('persistent-private-object-storage');
  if(!verificationAvailable(env))
    issues.push('real-verified-email-signups-and-account-recovery');
  if(!contactNotificationsEnabled(env))
    issues.push('written-confirmation-delivery-worker');
  const channels=publicContactConfig(env);
  if(!channels.telegram?.available)issues.push('telegram-business-channel');
  // The owner selected direct WhatsApp rather than Meta Cloud API.
  // A real outbound chat link is required; a simulated webhook is not.
  if(!channels.whatsapp?.available||channels.whatsapp.mode!=='direct')issues.push('whatsapp-direct-contact');
  if(!String(env.CONTACT_RESEND_WEBHOOK_SECRET||'').startsWith('whsec_'))
    issues.push('email-delivery-receipts');
  let correctDomain=false;
  try{
    const url=new URL(String(env.PUBLIC_APP_URL||''));
    correctDomain=url.protocol==='https:'&&
      ['www.ipsglobalservice.com','ipsglobalservice.com'].includes(url.hostname.toLowerCase())&&
      !url.username&&!url.password&&!url.port;
  }catch{}
  if(!correctDomain)issues.push('verified-company-public-origin');
  if(paymentLaunchState(env).enabled)issues.push('payments-must-remain-disabled-until-approved');
  return issues;
}
export function enforcePublicationGate(env=process.env){
  if(String(env.IPS_PUBLICATION_STRICT||'').toLowerCase()!=='true')return [];
  const gaps=nonpaymentPublicationGaps(env);
  if(gaps.length){
    throw Error('IPS nonpayment publication gate rejected launch: '+gaps.join(', ')+'. Old version remains the approved fallback until nonpayment providers are verified.');
  }
  return gaps;
}
