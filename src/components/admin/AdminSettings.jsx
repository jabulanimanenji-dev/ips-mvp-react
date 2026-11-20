import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';

export default function AdminSettings(){
  const {admin,hasAdminPermission}=useAuth();
  const [checks,setChecks]=useState({telegram:null,whatsapp:null,email:null,payments:null});
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const [a,b,c]=await Promise.all([
          fetch('/api/contact-channels/config',{cache:'no-store'}),
          fetch('/api/contact-enquiries/config',{cache:'no-store'}),
          fetch('/api/student-payments/config',{cache:'no-store'})
        ]);
        const [channels,emails,payments]=await Promise.all([a.json(),b.json(),c.json()]);
        if(!a.ok||!b.ok||!c.ok)throw Error('Some public company service checks are unavailable.');
        if(active)setChecks({
          telegram:channels.telegram?.connected===true,
          whatsapp:channels.whatsapp?.mode==='direct'&&channels.whatsapp.available===true,
          email:emails.email_replies_configured===true,
          payments:payments.enabled===true
        });
      }catch(e){if(active)setError(e.message);}
    })();
    return()=>{active=false;};
  },[]);
  const rows=[
    ['IPS business email',checks.email===null?'Not checked':checks.email?'Configured':'Needs attention','Written confirmations from support@ipsglobalservice.com'],
    ['Telegram bot',checks.telegram===null?'Not checked':checks.telegram?'Connected':'Needs attention','Customer-initiated, governed written support'],
    ['WhatsApp',checks.whatsapp===null?'Not checked':checks.whatsapp?'Direct / manual':'Needs attention','Direct business chat; messages are not imported into IPS'],
    ['Payments',checks.payments===null?'Not checked':checks.payments?'Enabled':'Pending integration','No payment collection until provider verification']
  ];
  return <section style={{maxWidth:1150,margin:'0 auto'}}>
    <small style={{color:'var(--text-secondary)',fontWeight:750,letterSpacing:'.12em'}}>IPS · COMPANY SETTINGS</small>
    <h1 style={{fontSize:'1.6rem',margin:'5px 0 8px'}}>Administration & company channels</h1>
    <p style={{color:'var(--text-muted)',maxWidth:700}}>Operational access and written communication status for IPS Academic Services. Technical credentials are managed privately in the secure deployment environment.</p>
    {error&&<p role="alert" className="card" style={{color:'var(--danger)'}}>{error}</p>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(285px,1fr))',gap:16,marginTop:22}}>
      <section className="card">
        <h2 style={{fontSize:'1.12rem'}}>My administrator account</h2>
        <p style={{lineHeight:1.8}}><strong>{admin?.name||'IPS administrator'}</strong><small style={{color:'var(--text-muted)',display:'block'}}>{admin?.email||''}</small></p>
        <p style={{fontSize:'.85rem',color:'var(--text-muted)'}}>Role: {admin?.customRoleName||admin?.role||'Administrator'}. Staff permissions are enforced on the server.</p>
        {admin?.isSuperAdmin&&<Link className="btn btn-secondary" to="/admin/access">Manage authorized IPS staff</Link>}
      </section>
      <section className="card">
        <h2 style={{fontSize:'1.12rem'}}>Communication status</h2>
        <div style={{display:'grid',gap:11}}>
          {rows.map(([name,status,note])=><div key={name} style={{paddingBottom:10,borderBottom:'1px solid var(--border)'}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:10}}><strong>{name}</strong><span style={{fontSize:'.8rem',color:'var(--text-secondary)'}}>{status}</span></div>
            <small style={{display:'block',marginTop:4,color:'var(--text-muted)'}}>{note}</small>
          </div>)}
        </div>
      </section>
      <section className="card">
        <h2 style={{fontSize:'1.12rem'}}>Company website</h2>
        <p style={{color:'var(--text-muted)'}}>The public website and academic service information are released through the company-controlled source and review process. The unrelated universal Platform Studio is not part of this operational workspace.</p>
        <a className="btn btn-secondary" href="/" target="_blank" rel="noopener noreferrer">View IPS public website</a>
      </section>
      <section className="card">
        <h2 style={{fontSize:'1.12rem'}}>Confidentiality & recovery</h2>
        <p style={{color:'var(--text-muted)'}}>Customer documents belong in their authenticated workspace. Telegram supports general enquiries, WhatsApp is handled manually, and staff cannot initiate telephone calls.</p>
        <p style={{fontSize:'.84rem',color:'var(--text-muted)'}}>Backups, production restores, administrator password changes and private credential rotation require governed operational procedures rather than one-click destructive actions.</p>
      </section>
    </div>
  </section>;
}
