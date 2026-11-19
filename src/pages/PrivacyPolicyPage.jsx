import React from 'react';
import {Link} from 'react-router-dom';
import {IPS_EMAILS} from '../../shared/businessEmails.js';

const sections=[
  {title:'You can approach IPS without revealing your legal name',
   content:'Students and researchers choose a username for account registration and quotation enquiries. A legal name, institution, photograph and telephone number are not required to browse services or request a quote. If a paid engagement needs billing or legally necessary identity information, IPS should explain the purpose before requesting it.'},
  {title:'What we collect and why',
   content:'To create an account, IPS asks for a username, email address and password; email ownership must be verified. To review a quotation, we receive the support category, requirements, optional academic level and deadline, and the contact method you select. We use this information to evaluate the request, respond and manage any agreed service. We do not ask for unnecessary research participant identities.'},
  {title:'You control how IPS contacts you',
   content:'Choose written email, your authenticated IPS workspace, or a supported and verified external messenger. IPS never makes telephone or voice calls. External contact is not used for unrelated marketing without separate permission. If your preferred contact method is unavailable, you must choose a different available method yourself.'},
  {title:'The limits of email and messaging privacy',
   content:'Ordinary email is not automatically end-to-end encrypted. Telegram bots do not use end-to-end encrypted Secret Chats; WhatsApp Business handling depends on the service configuration. Avoid sharing passwords, card numbers, identifiable research participant records, or confidential documents through external chats. When appropriate, share documents inside your protected IPS workspace instead.'},
  {title:'Who can access project information',
   content:'Administrative access to academic requests is restricted to authorized IPS personnel. Specialists should receive only the project information required for assignments they are authorized to work on. Individual student usernames and academic projects are not intended to appear on public profiles or testimonials without separate permission.'},
  {title:'Keeping, correcting and removing information',
   content:'Unverified guest quotation requests are scheduled to expire after 30 days. Verified enquiries, completed work, payments, legal records and disputes may need different retention periods. You can ask IPS to explain retention, review information held about you, correct inaccuracies or request deletion where legally permitted. Some records may have to be retained for accounting or legal obligations.'},
  {title:'How your account is protected',
   content:'IPS uses email ownership verification before enabling new account access, password checks, role-controlled access to private account data, and authenticated request handling. No internet service can promise absolute security. Keep your password and verification codes private, and contact IPS promptly if you suspect account misuse.'}
];
export default function PrivacyPolicyPage(){
  return <div className="ipsa" style={{background:'#f7f7f4',minHeight:'75vh',color:'#243749'}}>
    <section className="ipsa-section" style={{paddingTop:'clamp(55px,8vw,110px)'}}>
      <div className="ipsa-wrap" style={{maxWidth:900}}>
        <span className="ipsa-eyebrow">IPS ACADEMIC SERVICES</span>
        <h1 style={{fontSize:'clamp(2.3rem,5vw,4rem)',letterSpacing:'-.055em',lineHeight:1.1,color:'#19324a',margin:'12px 0 18px'}}>
          Privacy & Confidentiality
        </h1>
        <p style={{fontSize:'1.08rem',lineHeight:1.7,maxWidth:730,color:'#586d7f',marginBottom:22}}>
          Your academic work is personal. We explain what we need, how we use it, and where the limits of confidentiality are.
        </p>
        <p style={{fontSize:'.81rem',color:'#677987'}}>Updated 19 November 2026. This notice describes intended IPS account, enquiry and communication practices; availability of individual features depends on verified platform configuration.</p>
        <div style={{display:'grid',gap:14,margin:'35px 0'}}>
          {sections.map(section=><section key={section.title} style={{padding:'24px clamp(18px,3vw,34px)',background:'#fff',border:'1px solid #dbe2e4',borderRadius:5}}>
            <h2 style={{fontSize:'1.12rem',color:'#1c364c',margin:'0 0 11px'}}>{section.title}</h2>
            <p style={{color:'#526779',fontSize:'.91rem',lineHeight:1.85,margin:0}}>{section.content}</p>
          </section>)}
        </div>
        <section style={{borderTop:'1px solid #ccd7d8',paddingTop:26}}>
          <h2 style={{color:'#19324a',fontSize:'1.3rem'}}>Privacy questions or requests</h2>
          <p style={{color:'#526779',lineHeight:1.75}}>
            For information-access requests, corrections, privacy concerns or account deletion requests, contact the IPS team.
            We may need to verify that you control the relevant account before sharing or changing records.
          </p>
          <a href={'mailto:'+IPS_EMAILS.privacy} style={{color:'#27516a',textDecoration:'underline'}}>{IPS_EMAILS.privacy}</a>
          <p style={{marginTop:25,fontSize:'.82rem'}}><Link to="/#request-support">Get a Quote</Link> · <Link to="/">Return to IPS</Link></p>
        </section>
      </div>
    </section>
  </div>;
}
