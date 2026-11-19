import React,{useEffect,useMemo,useState} from 'react';
import {useAuth} from '../../context/AuthContext';
import {STUDENT_OFFERS} from '../../../shared/studentOffers.js';
import {PUBLIC_CONTACTS} from '../../../shared/publicContacts.js';
import {usernameValid} from '../../../shared/privacyIdentity.js';
import {IPS_EMAILS} from '../../../shared/businessEmails.js';

const demo=import.meta.env.VITE_DESIGN_PREVIEW==='true';
const start={username:'',service:'',subject:'',level:'',deadline:'',message:'',
  preferred_channel:'email',email:'',phone:'',telegram_username:'',contact_consent:false,website:''};
export default function QuoteRequestForm({selectedService=''}) {
  const {user}=useAuth();
  const [form,setForm]=useState({...start,service:selectedService});
  const [config,setConfig]=useState({email:false,telegram:false,whatsapp:false,workspace:true,accepting_requests:false});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null),[code,setCode]=useState('');
  useEffect(()=>setForm(old=>({...old,service:selectedService||old.service})),[selectedService]);
  useEffect(()=>{let active=true;
    fetch('/api/quote-requests/config',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{
      if(active&&data.success)setConfig(data);
    }).catch(()=>{});
    return ()=>{active=false;};
  },[]);
  const set=(key,value)=>{setForm(old=>({...old,[key]:value}));setError('');};
  const channel=form.preferred_channel;
  const verifiedUser=Boolean(user?.email_verified_at&&user?.username);
  const identity=user?.username||form.username;
  const options=useMemo(()=>[
    {value:'email',label:'Email',description:'Receive a written response at an email address you verify.'},
    {value:'telegram',label:'Telegram',description:'Start @IPScontactBot and send your quote reference. Bot chats are not end-to-end encrypted.'},
    {value:'whatsapp',label:'WhatsApp',description:'Message IPS first from your WhatsApp number. Written messages only; no calls.'},
    ...(verifiedUser?[{value:'workspace',label:'My IPS Workspace',description:'Receive the review and quote inside your signed-in IPS account.'}]:[])
  ],[verifiedUser]);
  const allowed=demo||Boolean(config.accepting_requests&&config[channel]);
  const chatReference=result?.quote_id||'';
  const telegramHref=PUBLIC_CONTACTS.telegram?.url||'https://t.me/IPScontactBot';
  const waHref=(PUBLIC_CONTACTS.whatsapp?.url||'https://wa.me/48794088714')+
    (chatReference?'?text='+encodeURIComponent(chatReference):'');
  const mailHref='mailto:'+IPS_EMAILS.contact+'?subject='+encodeURIComponent('IPS academic support enquiry');
  async function submit(e){
    e.preventDefault();setError('');setResult(null);
    if(!usernameValid(identity||''))return setError('Choose a username using 3–32 letters, numbers, periods, underscores or hyphens.');
    if(form.message.trim().length<20)return setError('Describe your requirements in at least 20 characters.');
    if(!form.contact_consent)return setError('Please agree to written contact about this request.');
    if(demo){setResult({preview:true});return;}
    if(!allowed)return setError('This written contact channel is not yet active. Select another available channel.');
    setBusy(true);
    try{
      const response=await fetch('/api/quote-requests',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...form,username:identity,subject:form.subject.trim()||'General academic support'})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.success)throw Error(data.error||'Could not save your request.');
      setResult(data);
    }catch(e){setError(e.message||'Your quotation request could not be submitted.');}
    finally{setBusy(false);}
  }
  async function verifyEmail(e){
    e.preventDefault();setBusy(true);setError('');
    try{
      const response=await fetch('/api/quote-requests/verify-email',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({quote_id:result.quote_id,code})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.success)throw Error(data.error||'Email verification failed.');
      setResult({...result,verification_required:false,contact_status:'verified'});
      setCode('');
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  }
  return <section className="ipsa-quote-form-wrap" aria-label="Get a Quote">
    <div className="ipsa-quote-heading">
      <h3>Get a Quote</h3>
      <p>Tell us what you need. IPS confirms successful submission immediately, but a person reviews requests before providing a written quotation. There is no instant price or payment obligation. No account, legal name or phone call is required.</p>
    </div>
    {result&&!result.preview?<div role="status" className="ipsa-form-success" style={{padding:18}}>
      <strong>Your private reference: {result.quote_id}</strong>
      <p>{result.message}</p>
      {result.verification_required?<form onSubmit={verifyEmail}>
        <label>8-digit email verification code
          <input required inputMode="numeric" pattern="[0-9]{8}" maxLength={8}
            value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,8))} placeholder="Code from your email"/>
        </label>
        <button className="ipsa-btn ipsa-btn-dark" disabled={busy||code.length!==8}>{busy?'Verifying…':'Verify email & submit request'}</button>
      </form>:null}
      {result.requires_chat_start?<div>
        <p>For your privacy, IPS cannot message an unverified Telegram or WhatsApp account. Open the selected app and send only this reference: <strong>{result.quote_id}</strong>. Do not send your private documents there.</p>
        <a className="ipsa-btn ipsa-btn-dark" href={channel==='telegram'?telegramHref:waHref} target="_blank" rel="noopener noreferrer">
          Open {channel==='telegram'?'Telegram':'WhatsApp'} to verify your contact ↗
        </a>
      </div>:null}
      {result.contact_status==='verified'&&<p>Contact verified. IPS may now review your request. The written quote is not a payment demand or work authorization.</p>}
    </div>:null}
    {result?.preview&&<div className="ipsa-enquiry-preview" role="status">
      <strong>Design preview only.</strong> Your quote request has not been sent or saved. You can contact IPS using a written channel below, but do not send confidential research materials by ordinary email or chat.
      <p>{channel==='telegram'?<a href={telegramHref} target="_blank" rel="noopener noreferrer">Open Telegram ↗</a>:
      channel==='whatsapp'?<a href={waHref} target="_blank" rel="noopener noreferrer">Open WhatsApp ↗</a>:
      <a href={mailHref}>Prepare an email to IPS ↗</a>}</p>
    </div>}
    <form className="ipsa-request-form" onSubmit={submit}>
      <label>Choose a username <span>*</span>
        <input required minLength={3} maxLength={32} autoComplete="nickname" value={identity}
          disabled={verifiedUser} onChange={e=>set('username',e.target.value)}
          placeholder="Use any available username, not your legal name"/>
      </label>
      <p className="ipsa-selected-help">Use a pseudonym if you prefer. Your username and project details are not displayed publicly.</p>
      <label>What do you need help with? <span>*</span>
        <select required value={form.service} onChange={e=>set('service',e.target.value)}>
          <option value="">Select a service</option>
          {STUDENT_OFFERS.map(offer=><option key={offer.id} value={offer.id}>{offer.title}</option>)}
          <option value="other">Other — describe your needs</option>
        </select>
      </label>
      <label>Subject or discipline (optional)
        <input value={form.subject} onChange={e=>set('subject',e.target.value)} maxLength={160} placeholder="e.g. Nursing, economics, engineering"/>
      </label>
      <div className="ipsa-form-row">
        <label>Study level (optional)
          <select value={form.level} onChange={e=>set('level',e.target.value)}>
            <option value="">Not specified</option><option>Undergraduate</option><option>Master's</option><option>Doctoral</option><option>Professional Research</option><option>Other</option>
          </select>
        </label>
        <label>Preferred deadline (optional)
          <input type="date" min={new Date().toISOString().slice(0,10)} value={form.deadline} onChange={e=>set('deadline',e.target.value)}/>
        </label>
      </div>
      <label>Tell us about your requirements <span>*</span>
        <textarea required minLength={20} maxLength={3000} rows={5} value={form.message}
          onChange={e=>set('message',e.target.value)}
          placeholder="Describe your project, current stage and what you want IPS to review or help with. Avoid identifying research participants."/>
      </label>
      <label>How would you like to receive your quote? <span>*</span>
        <select value={channel} onChange={e=>{set('preferred_channel',e.target.value);setResult(null);}}>
          {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <p className="ipsa-selected-help">{options.find(o=>o.value===channel)?.description}</p>
      {channel==='email'&&<label>Email address <span>*</span>
        <input type="email" autoComplete="email" required maxLength={254} value={form.email}
          onChange={e=>set('email',e.target.value)} placeholder="you@example.com"/>
      </label>}
      {channel==='telegram'&&<label>Telegram username <span>*</span>
        <input required value={form.telegram_username} onChange={e=>set('telegram_username',e.target.value)}
          minLength={5} maxLength={33} placeholder="@yourusername"/>
      </label>}
      {channel==='whatsapp'&&<label>WhatsApp number (written messages only) <span>*</span>
        <input required type="tel" value={form.phone} onChange={e=>set('phone',e.target.value)}
          placeholder="+48123456789" maxLength={24}/>
      </label>}
      <p className="ipsa-selected-help">Signal messaging will be offered only after a verified IPS business integration is available. No telephone or voice calls are used.</p>
      <label className="ipsa-checkbox"><input required type="checkbox" checked={form.contact_consent}
        onChange={e=>set('contact_consent',e.target.checked)}/>
        <span>I agree that IPS may review this request and contact me in writing through my selected method. I am not consenting to marketing.</span>
      </label>
      <p className="ipsa-selected-help"><strong>Privacy at IPS:</strong> No compulsory legal name. Requests are visible only to authorized IPS personnel; specialists receive assigned details only. Messaging services have their own privacy policies, and Telegram bots are not end-to-end encrypted. See our Privacy & Confidentiality section below.</p>
      {!allowed&&!demo&&<p role="status" className="ipsa-enquiry-preview">This method is not currently available on the IPS backend. Choose an active method when the service is online.</p>}
      {error&&<p className="ipsa-form-error" role="alert">{error}</p>}
      <button className="ipsa-btn ipsa-btn-dark ipsa-submit" disabled={busy||(!allowed&&!demo)}>
        {busy?'Saving request…':demo?'Preview quotation request':'Submit Quote Request'} <span aria-hidden="true">↗</span>
      </button>
      <small className="ipsa-legal">Submitting is free and creates no payment obligation. IPS will never call you. Unverified guest requests expire after 30 days. Verified requests follow applicable retention rules.</small>
    </form>
  </section>;
}
