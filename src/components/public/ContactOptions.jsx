import React, { useEffect, useState } from 'react';

export function useContactOptions(){
  const [config,setConfig]=useState(null);
  useEffect(()=>{
    let mounted=true;
    fetch('/api/contact-channels/config',{cache:'no-store'})
      .then(async res=>{if(!res.ok)throw Error('Unavailable');return res.json();})
      .then(data=>{if(mounted&&data.success)setConfig(data);})
      .catch(()=>{if(mounted)setConfig(null);});
    return ()=>{mounted=false;};
  },[]);
  return config;
}

export default function ContactOptions(){
  const config=useContactOptions();
  const options=[['WhatsApp',config?.whatsapp,'Chat with our business team'],['Telegram',config?.telegram,'Message the IPS support bot']].filter(([,data])=>data?.url&&data.available);
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
        <p>Choose the channel that is convenient for you.</p>
        {options.length ? options.map(([label,data,description])=>
          <a key={label} href={data.url} target="_blank" rel="noopener noreferrer" className="ipsa-contact-link">
            <span className="ipsa-contact-symbol" aria-hidden="true">{label==='WhatsApp'?'✉':'➤'}</span>
            <span><b>{label}</b><small>{description}</small></span><span aria-hidden="true">↗</span>
          </a>)
          : <p role="status" className="ipsa-contact-unavailable">WhatsApp and Telegram will appear here when our verified business channels are activated. For now, use your IPS workspace to contact us.</p>}
        <small>We will never ask for account passwords or card numbers in a chat.</small>
      </div>
    </div>
  </section>;
}
