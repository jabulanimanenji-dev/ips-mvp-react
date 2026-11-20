import React, { useEffect, useState } from 'react';
import { PUBLIC_CONTACTS } from '../../../shared/publicContacts.js';
import { IPS_EMAILS } from '../../../shared/businessEmails.js';

export function useContactOptions(){
  const [config,setConfig]=useState(PUBLIC_CONTACTS);
  useEffect(()=>{
    if(import.meta.env.VITE_DESIGN_PREVIEW==='true')return;
    let mounted=true;
    fetch('/api/contact-channels/config',{cache:'no-store'})
      .then(async res=>{if(!res.ok)throw Error('Unavailable');return res.json();})
      .then(data=>{if(mounted&&data.success)setConfig({
        whatsapp: data.whatsapp?.available ? {...data.whatsapp,connected:data.whatsapp.connected===true} : PUBLIC_CONTACTS.whatsapp,
        telegram: data.telegram?.available ? {...data.telegram,connected:data.telegram.connected===true} : PUBLIC_CONTACTS.telegram
      });})
      .catch(()=>{if(mounted)setConfig(PUBLIC_CONTACTS);});
    return ()=>{mounted=false;};
  },[]);
  return config;
}

export default function ContactOptions(){
  const config=useContactOptions();
  const options=[['WhatsApp',config?.whatsapp,'Open WhatsApp Business · separate written chat'],['Telegram',config?.telegram,'Open @IPScontactBot']].filter(([,data])=>data?.url&&data.available);
  const integrated=options.filter(([,data])=>data.connected).length;
  return <section className="ipsa-section ipsa-contacts" id="contact-ips" aria-labelledby="ipsa-contact-title"><span id="direct-contact" aria-hidden="true"/>
    <div className="ipsa-wrap ipsa-contact-layout">
      <div>
        <span className="ipsa-eyebrow">PERSONAL COMMUNICATION</span>
        <h2 id="ipsa-contact-title">Prefer to write <em>directly?</em></h2>
        <p>Contact IPS in writing. Choose email or an available messaging service. Your quotations, private academic documents and payment records belong inside your protected IPS workspace.</p>
        <p className="ipsa-contact-disclosure">External messaging is optional. WhatsApp opens a separate business chat handled manually by IPS staff, without Meta API access or automatic inbox synchronization. Telegram bot chats are not end-to-end encrypted Secret Chats. Avoid sharing passwords, payment credentials, sensitive research records or private documents through these channels.</p>
      </div>
      <div className="ipsa-contact-card">
        <strong>Contact IPS</strong>
        <p>Choose a written contact method. IPS will never call you, and we do not request confidential research records or passwords in chat.</p>
        <a className="ipsa-contact-link" href={'mailto:'+IPS_EMAILS.contact}>
          <span className="ipsa-contact-symbol" aria-hidden="true">✉</span>
          <span><b>Email IPS</b><small>{IPS_EMAILS.contact} · Opens your email app</small></span>
          <span aria-hidden="true">↗</span>
        </a>
        {options.length ? options.map(([label,data,description])=>
          <a key={label} href={data.url} target="_blank" rel="noopener noreferrer" className="ipsa-contact-link">
            <span className="ipsa-contact-symbol" aria-hidden="true">{label==='WhatsApp'?'✉':'➤'}</span>
            <span><b>{label}</b><small>{description}</small></span><span aria-hidden="true">↗</span>
          </a>)
          : <p role="status" className="ipsa-contact-unavailable">WhatsApp and Telegram direct chat links will appear when their business integrations are verified. Email is available now.</p>}
        {config?.whatsapp?.mode==='direct'&&<p className="ipsa-contact-unavailable">WhatsApp is a direct external chat. IPS staff reply there manually. A quote reference must be matched by an IPS reviewer; the chat is not imported into the IPS workspace.</p>}
        {config?.telegram?.available && !config?.telegram?.connected && <p className="ipsa-contact-unavailable">Telegram @IPScontactBot can be opened, but automated bot replies and IPS inbox integration are not yet verified. Start the bot chat yourself.</p>}
        {options.length>0 && integrated!==options.length && <p className="ipsa-contact-unavailable" role="status">Direct chat links are available. WhatsApp is intentionally manual, not an API-connected IPS inbox. Other automated messaging depends on its separate verified provider configuration.</p>}
        <small>We will never ask for account passwords or card numbers in a chat.</small>
      </div>
    </div>
  </section>;
}
