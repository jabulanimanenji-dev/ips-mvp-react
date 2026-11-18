import React,{useState} from 'react';
import { PUBLIC_CONTACTS } from '../../../shared/publicContacts.js';
import { IPS_EMAILS } from '../../../shared/businessEmails.js';

const starting={name:'',email:'',phone:'',preferred_channel:'email',subject:'',message:'',contact_consent:false,website:''};
const demo=import.meta.env.VITE_DESIGN_PREVIEW === 'true';
export default function PublicEnquiry(){
  const [form,setForm]=useState(starting);
  const [pending,setPending]=useState(false);
  const [result,setResult]=useState('');
  const [error,setError]=useState('');
  const [fallback,setFallback]=useState(false);
  const set=(field,value)=>setForm(old=>({...old,[field]:value}));
  const needsPhone=['phone','whatsapp'].includes(form.preferred_channel);
  const details=[
    'Hello IPS — I would like you to contact me.',
    'Name: '+form.name.trim(),
    'Preferred reply: '+form.preferred_channel,
    ...(form.email?['Email: '+form.email.trim()]:[]),
    ...(form.phone?['Phone: '+form.phone.trim()]:[]),
    'Subject: '+form.subject.trim(),
    'Enquiry: '+form.message.trim(),
    'I consent to IPS contacting me about this enquiry.'
  ].join('\n');
  const chatUrl=PUBLIC_CONTACTS.whatsapp.url+'?text='+encodeURIComponent(details);
  const mailUrl='mailto:'+IPS_EMAILS.contact+'?subject='+encodeURIComponent('IPS Enquiry: '+form.subject.trim())+'&body='+encodeURIComponent(details);
  const viaEmail=form.preferred_channel==='email';
  const fallbackUrl=viaEmail?mailUrl:chatUrl;
  async function submit(e){
    e.preventDefault();setError('');setResult('');setFallback(false);
    if(demo){
      setFallback(true);return;
    }
    setPending(true);
    try{
      const response=await fetch('/api/contact-enquiries',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(form)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.success)throw Error(data.error||'IPS could not save your enquiry.');
      setResult('Enquiry '+data.enquiry_id+' saved. IPS can follow up using the contact method you selected. Keep this reference.');
      setForm(starting);
    }catch(ex){
      setError(ex.message||'We could not save your enquiry. You can contact us directly via email or WhatsApp.');
      setFallback(true);
    }finally{setPending(false);}
  }
  return <section className="ipsa-section ipsa-enquiry" id="contact-ips" aria-labelledby="ipsa-enquiry-heading">
    <div className="ipsa-wrap ipsa-enquiry-columns">
      <div className="ipsa-enquiry-intro">
        <span className="ipsa-eyebrow">CONTACT & CALLBACK REQUESTS</span>
        <h2 id="ipsa-enquiry-heading">Have a question? <em>We'll take it from here.</em></h2>
        <p>Ask about a service, discuss an upcoming project, or request a call back. You do not need a student account just to make an enquiry.</p>
        <div className="ipsa-enquiry-assurances">
          <p><strong>01.</strong> Tell us how to reach you.</p>
          <p><strong>02.</strong> Choose email, phone or WhatsApp as your preferred reply.</p>
          <p><strong>03.</strong> IPS handles the follow-up; project files and payments stay inside the secure workspace.</p>
        </div>
        <p className="ipsa-enquiry-fine">Telegram bots cannot initiate messages to a new user; start the bot conversation yourself if you choose to speak there. Do not include passwords, card numbers or sensitive research participant data in this form.</p>
      </div>
      <div className="ipsa-enquiry-card">
        <div className="ipsa-enquiry-card-heading"><h3>Ask IPS to contact you</h3><p>Tell us a little about your enquiry.</p></div>
        <form onSubmit={submit} className="ipsa-enquiry-form">
          <div className="ipsa-form-row">
            <label>Your name *<input required minLength={2} maxLength={100} autoComplete="name" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Name" /></label>
            <label>Preferred contact *<select value={form.preferred_channel} onChange={e=>set('preferred_channel',e.target.value)}>
              <option value="email">Email</option><option value="phone">Phone callback</option>
              <option value="whatsapp">WhatsApp</option><option value="telegram">Telegram (after you start the bot)</option>
            </select></label>
          </div>
          <div className="ipsa-form-row">
            <label>Email {form.preferred_channel==='email'?'*':'(optional)'}<input type="email" required={form.preferred_channel==='email'||form.preferred_channel==='telegram'&&!form.phone} maxLength={254} autoComplete="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="you@example.com"/></label>
            <label>Phone {needsPhone?'*':'(optional)'}<input type="tel" required={needsPhone} autoComplete="tel" pattern="\+[0-9 ()-]{7,23}" maxLength={24} value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+48 794 088 714" title="Include your country code, e.g. +48 794 088 714"/></label>
          </div>
          <label>Subject *<input required minLength={4} maxLength={140} value={form.subject} onChange={e=>set('subject',e.target.value)} placeholder="What would you like help with?"/></label>
          <label>Message *<textarea required minLength={15} maxLength={3000} rows={5} value={form.message} onChange={e=>set('message',e.target.value)} placeholder="Explain what you need and when IPS should contact you."/></label>
          <label className="ipsa-enquiry-trap" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={e=>set('website',e.target.value)} /></label>
          <label className="ipsa-enquiry-consent"><input type="checkbox" required checked={form.contact_consent} onChange={e=>set('contact_consent',e.target.checked)}/><span>I agree that IPS may use my details to reply about this enquiry. This is not consent to marketing messages.</span></label>
          {demo&&<p className="ipsa-enquiry-preview">This is a website preview. Your details are not submitted or saved here. Prepare an email or WhatsApp message, then send it yourself from the corresponding app.</p>}
          {error&&<p className="ipsa-form-error" role="alert">{error}</p>}
          {result&&<p className="ipsa-form-success" role="status">{result}</p>}
          {fallback&&<div role="status" className="ipsa-enquiry-fallback">
            <p>{viaEmail?'Open the prepared email in your email application and press Send. IPS will receive it at '+IPS_EMAILS.contact+'.':'Open the prepared WhatsApp message and press Send. If you prefer Telegram, start a chat with @IPScontactBot yourself.'} This website preview does not send or save the message automatically.</p>
            <a className="ipsa-btn ipsa-btn-dark" href={fallbackUrl} target={viaEmail?undefined:'_blank'} rel={viaEmail?undefined:'noopener noreferrer'}>
              {viaEmail?'Open prepared email to IPS':'Open prepared WhatsApp message'} <span>↗</span>
            </a>
          </div>}
          <button className="ipsa-btn ipsa-btn-dark ipsa-enquiry-send" type="submit" disabled={pending}>{pending?'Sending enquiry…':demo?(viaEmail?'Prepare email to IPS':'Prepare WhatsApp message'):'Request a response from IPS'}<span aria-hidden="true">↗</span></button>
          <small>Enquiries are free. We do not start or charge for work without an agreed quotation.</small>
        </form>
      </div>
    </div>
  </section>;
}
