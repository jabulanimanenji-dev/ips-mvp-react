import {sendBusinessEmail} from './businessEmailTransport.js';
import {IPS_EMAILS} from '../shared/businessEmails.js';

// Explicit, one-time operational diagnostic: send a plain-text Resend message
// only to IPS's own contact-routing address. No clients or personal mailbox
// addresses, test accounts, academic details or document files are touched.
// Disabled unless a deliberate probe run ID is set in the secure server host.
export async function sendPublicationEmailProbe({env=process.env, send=sendBusinessEmail}={}){
  if(env.NODE_ENV!=='production'||String(env.IPS_PUBLICATION_STRICT||'').toLowerCase()!=='true'||
     String(env.IPS_EVALUATION_MODE||'').toLowerCase()==='true')
    return {skipped:true};
  const runId=String(env.IPS_EMAIL_PROBE_RUN_ID||'').trim();
  if(!runId)return {skipped:true};
  if(!/^[A-Za-z0-9_-]{8,64}$/.test(runId))
    throw new Error('IPS production email delivery probe ID must be 8-64 letters, numbers, _ or -.');
  const response=await send({
    to:IPS_EMAILS.contact,
    subject:'IPS production Resend delivery check - '+runId,
    body:'This is an authorized IPS internal production email-delivery test. '+
      'It contains no customer data and does not create an order, payment or support enquiry.\n\n'+
      'Run: '+runId+'\n\nIPS Academic Services',
    idempotencyKey:'ips-publication-probe/'+runId,
    env
  });
  if(!response||typeof response!=='string')
    throw new Error('IPS production mail provider did not return a message acceptance identifier.');
  // Acceptance is NOT equivalent to delivery. A real inbox or signed
  // email.delivered webhook receipt must be independently checked.
  return {accepted:true,run_id:runId};
}
