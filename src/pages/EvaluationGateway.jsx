import React from 'react';
import {Link} from 'react-router-dom';

const accounts=[
 {name:'Customer / Researcher',role:'CLIENT',route:'/login',
  email:'client.evaluation@example.org',password:'EvalClient2026!',
  steps:'Explore private quotations, claim references, submit new written requests, inspect contracts, payment history, private files and revisions.'},
 {name:'Approved IPS Specialist',role:'SPECIALIST',route:'/writer/login',
  email:'specialist.evaluation@example.org',password:'EvalSpecialist2026!',
  steps:'See assigned work, professional profile, management-only messages, authorised documents, deadlines and sample payout records.'},
 {name:'IPS Administration',role:'ADMINISTRATION',route:'/ips-evaluation-ops',
  email:'admin.evaluation@example.org',password:'EvalAdmin2026!',
  steps:'Open Mission Control. Inspect review queues, take ownership of a customer request, manage quotations, approved specialists, quality reviews and separate finance ledgers.'}
];
export default function EvaluationGateway(){
  if(import.meta.env.VITE_IPS_EVALUATION!=='true')return null;
  return <main style={{background:'#f5f4f1',minHeight:'100vh',padding:'clamp(2rem,5vw,5rem) 1rem'}}>
    <div style={{maxWidth:1140,margin:'0 auto'}}>
      <Link to="/" style={{fontWeight:700,color:'#143452'}}>IPS Academic Services — Evaluation Homepage</Link>
      <div style={{border:'2px solid #c8823b',background:'#fff3e1',borderRadius:12,
        padding:'1rem 1.25rem',margin:'1.4rem 0'}} role="status">
        <strong style={{fontSize:'1.05rem'}}>ISOLATED DEMONSTRATION — NOT PRODUCTION</strong>
        <p style={{margin:'.5rem 0 0'}}>This is a real running copy of the IPS React and Express application with its own disposable, local MongoDB.
        Every account, quote, payment and completed project below is synthetic. Do not enter actual personal,
        research participant, confidential, credit card or business data. No real Stripe, email, Telegram, WhatsApp
        or Cloudflare account is connected. Data and uploaded files may be wiped whenever the evaluation container restarts.</p>
      </div>
      <p style={{fontWeight:800,fontSize:'.83rem',letterSpacing:'.14em',color:'#42688a'}}>THREE ACTUAL IPS WORKSPACES</p>
      <h1 style={{fontSize:'clamp(2rem,4vw,3.3rem)',margin:'.5rem 0',color:'#112e48'}}>Evaluate the complete working interface.</h1>
      <p style={{fontSize:'1.06rem',maxWidth:800,color:'#394e60',lineHeight:1.7}}>
        All three logins are backed by the same running Express API and separate local MongoDB.
        Use these public test credentials only. To compare roles, open the links in separate private/incognito windows
        because IPS deliberately uses one secure login session per browser.</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(270px,1fr))',gap:18,marginTop:25}}>
        {accounts.map(a=><section key={a.role} style={{background:'#fff',border:'1px solid #d9e0e6',
          padding:24,borderRadius:15,boxShadow:'0 8px 28px rgba(0,0,0,.05)'}}>
          <p style={{fontWeight:800,fontSize:'.75rem',color:'#6885a0',letterSpacing:'.1em'}}>{a.role}</p>
          <h2 style={{fontSize:'1.4rem',margin:'.5rem 0 1rem',color:'#15344e'}}>{a.name}</h2>
          <p style={{fontSize:'.85rem',lineHeight:1.65,color:'#405569'}}>{a.steps}</p>
          <div style={{background:'#f2f6f8',borderRadius:9,padding:'1rem',margin:'1rem 0',fontSize:'.86rem'}}>
            <div>Email: <strong style={{overflowWrap:'anywhere'}}>{a.email}</strong></div>
            <div style={{marginTop:8}}>Test password: <code>{a.password}</code></div>
          </div>
          <Link to={a.route} className="btn btn-primary" style={{display:'inline-block'}}>Open {a.name} Login</Link>
        </section>)}
      </div>
      <section style={{marginTop:30,background:'#fff',border:'1px solid #d9e0e6',borderRadius:12,padding:'1.5rem'}}>
        <h2 style={{color:'#15344e'}}>Suggested verification journey</h2>
        <ol style={{lineHeight:1.9,paddingLeft:22}}>
          <li>Open the client account, view a private quotation and the associated unpaid managed IPS project.</li>
          <li>Open Mission Control in another browser session, claim a fresh test enquiry and issue a written quotation.</li>
          <li>Open the specialist workspace in a separate browser session, inspect assigned sample work, communication and payout.</li>
          <li>Return as the client to check confidential project files, revisions and payment history.</li>
        </ol>
        <p><strong>Important:</strong> Sample paid orders are labeled simulated and do not represent actual settlement. New Stripe payments, real verified email onboarding,
          refunds to a real bank card, live message delivery, and persistent external file storage are not enabled in this evaluation sandbox.
          Those require separately validated production provider integrations.</p>
      </section>
    </div>
  </main>;
}
