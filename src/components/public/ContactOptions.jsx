import React, { useEffect, useState } from 'react';
import { PUBLIC_CONTACTS } from '../../../shared/publicContacts.js';

export function useContactOptions(){
  const [config,setConfig]=useState(PUBLIC_CONTACTS);
  useEffect(()=>{
    let mounted=true;
    fetch('/api/contact-channels/config',{cache:'no-store'})
      .then(async res=>{if(!res.ok)throw Error('Unavailable');return res.json();})
      .then(data=>{if(mounted&&data.success)setConfig({
        whatsapp: data.whatsapp?.available ? {...data.whatsapp,connected:true} : PUBLIC_CONTACTS.whatsapp,
        telegram: data.telegram?.available ? {...data.telegram,connected:true} : PUBLIC_CONTACTS.telegram
      });})
      .catch(()=>{if(mounted)setConfig(PUBLIC_CONTACTS);});
    return ()=>{mounted=false;};
  },[]);
  return config;
}

export default function ContactOptions(){
  const config=useContactOptions();
  const options=[['WhatsApp',config?.whatsapp,'Open WhatsApp Business'],['Telegram',config?.telegram,'Open @IPScontactBot']].filter(([,data])=>data?.url&&data.available);
  const integrated=options.filter(([,data])=>data.connected).length;
  return <section className="ipsa-section ipsa-contacts" id="direct-contact" aria-labelledby="ipsa-contact-title">
    <div className="ipsa-wrap ipsa-contact-layout">
      <div>
        <span className="ipsa-eyebrow">PERSONAL COMMUNICATION</span>
        <h2 id="ipsa-contact-title">Prefer to speak <em>directly?</em></h2>
        <p>Contact IPS for general questions and agree the next step with a person. Your official quotation, academic documents and payment history stay in your secure IPS account.</p>
        <p className="ipsa-contact-disclosure">External messaging is optional. Telegram bot chats are not end-to-end encrypted Secret Chats; WhatsApp Business data handling depends on the provider and setup. Avoid sharing passwords, payment credentials, sensitive research records or private documents through these channels.</p>
      </div>
      <div className="ipsa-contact-card">
        <strong>Contact IPS</strong>
        <p>Choose your preferred chat app. IPS project records remain in the website workspace.</p>
        {options.length ? options.map(([label,data,description])=>
          <a key={label} href={data.url} target="_blank" rel="noopener noreferrer" className="ipsa-contact-link">
            <span className="ipsa-contact-symbol" aria-hidden="true">{label==='WhatsApp'?'✉':'➤'}</span>
            <span><b>{label}</b><small>{description}</small></span><span aria-hidden="true">↗</span>
          </a>)
          : <p role="status" className="ipsa-contact-unavailable">WhatsApp and Telegram will appear here when our verified business channels are activated. For now, use your IPS workspace to contact us.</p>}
        {options.length>0 && integrated!==options.length && <p className="ipsa-contact-unavailable" role="status">Direct chat links are available. Automatic replies and synchronization with the IPS inbox are not active until provider setup is completed.</p>}
        <small>We will never ask for account passwords or card numbers in a chat.</small>
      </div>
    </div>
  </section>;
}
