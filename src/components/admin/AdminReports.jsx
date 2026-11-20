import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';
import {isIpsQaFixtureEmail} from '../../../shared/ipsCompanyScope.js';
import {isCompanyAcademicProject} from './AdminServices.jsx';

export default function AdminReports(){
  const {hasAdminPermission}=useAuth();
  const [quotes,setQuotes]=useState(null);
  const [projects,setProjects]=useState(null);
  const [warning,setWarning]=useState('');
  useEffect(()=>{
    let active=true;
    const collect=async()=>{
      const failures=[];
      if(hasAdminPermission('support.view')){
        try{
          const res=await fetch('/api/contact-enquiries/admin',{cache:'no-store',credentials:'same-origin'});
          const data=await res.json().catch(()=>({}));
          if(!res.ok||!data.success)throw Error(data.error||'Unavailable');
          if(active)setQuotes((data.enquiries||[]).filter(q=>q.source==='academic-quote'&&q.request_type==='quote'&&q.contact_consent&&!isIpsQaFixtureEmail(q.email)));
        }catch(e){failures.push('Private quotations: '+e.message);}
      }
      if(hasAdminPermission('services.view')){
        try{
          const res=await fetch('/api/services',{cache:'no-store',credentials:'same-origin'});
          const data=await res.json().catch(()=>({}));
          if(!res.ok||!data.success)throw Error(data.error||'Unavailable');
          if(active)setProjects((data.requests||[]).filter(isCompanyAcademicProject));
        }catch(e){failures.push('Academic projects: '+e.message);}
      }
      if(active)setWarning(failures.join(' '));
    };
    collect();return()=>{active=false;};
  },[hasAdminPermission]);
  const channelCounts=quotes?.reduce((s,x)=>({...s,[x.preferred_channel]:(s[x.preferred_channel]||0)+1}),{})||{};
  const serviceCounts=quotes?.reduce((s,x)=>({...s,[x.service||'Unclassified']:(s[x.service||'Unclassified']||0)+1}),{})||{};
  const metrics=[
    ['Recent confidential requests',quotes?.length,'Latest 120 stored enquiries, filtered to academic quotations'],
    ['Verified contacts',quotes?.filter(q=>q.contact_verified).length,'Written contact verified and consented'],
    ['Awaiting review',quotes?.filter(q=>q.status==='new'&&q.contact_verified).length,'Customer-verified academic quotations'],
    ['Academic projects',projects?.length,'Projects created from confirmed academic quote handoffs'],
    ['In progress',projects?.filter(j=>!['Completed','Cancelled'].includes(j.status)).length,'Academic projects not marked complete or cancelled']
  ];
  return <section style={{maxWidth:1300,margin:'0 auto'}}>
    <small style={{letterSpacing:'.11em',fontWeight:750,color:'var(--text-secondary)'}}>IPS · OPERATIONAL REPORTING</small>
    <h1 style={{fontSize:'1.65rem',margin:'5px 0 8px'}}>Academic services report</h1>
    <p style={{color:'var(--text-muted)',maxWidth:750}}>Reporting is restricted to this company's verified academic request and delivery workflows. Historical marketplace work, fabricated payments and generic platform valuations are excluded.</p>
    {warning&&<p role="alert" className="card" style={{color:'var(--danger)'}}>Some sources cannot be loaded: {warning}. Unavailable figures are displayed as —.</p>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(175px,1fr))',gap:12,margin:'19px 0'}}>
      {metrics.map(([label,value,note])=><div key={label} className="card" style={{padding:17}}>
        <small style={{color:'var(--text-muted)',display:'block',minHeight:30}}>{label}</small>
        <strong style={{fontSize:'1.8rem',display:'block'}}>{value===undefined?'—':value}</strong>
        <small style={{color:'var(--text-secondary)',display:'block',marginTop:5,lineHeight:1.45}}>{note}</small>
      </div>)}
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:15}}>
      <section className="card"><h2 style={{fontSize:'1.12rem'}}>Contact methods requested</h2>
        {quotes===null?<p>Data unavailable for this role.</p>:Object.keys(channelCounts).length===0?<p>No recent academic enquiries.</p>:
          Object.entries(channelCounts).sort((a,b)=>b[1]-a[1]).map(([k,v])=><div key={k} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid var(--border)'}}><span style={{textTransform:'capitalize'}}>{k}</span><strong>{v}</strong></div>)}
        <p style={{color:'var(--text-muted)',fontSize:'.79rem'}}>WhatsApp is manual and not synchronized with IPS. These figures reflect customer preferences, not confirmed delivery.</p>
      </section>
      <section className="card"><h2 style={{fontSize:'1.12rem'}}>Academic quotation categories</h2>
        {quotes===null?<p>Data unavailable for this role.</p>:Object.keys(serviceCounts).length===0?<p>No recent academic quotations.</p>:
          Object.entries(serviceCounts).sort((a,b)=>b[1]-a[1]).map(([k,v])=><div key={k} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',gap:16,borderBottom:'1px solid var(--border)'}}><span style={{overflowWrap:'anywhere'}}>{k}</span><strong>{v}</strong></div>)}
      </section>
    </div>
    <div style={{display:'flex',gap:12,marginTop:18,flexWrap:'wrap'}}>
      {hasAdminPermission('support.view')&&<Link className="btn btn-secondary" to="/admin/enquiries">Review source enquiries</Link>}
      {hasAdminPermission('services.view')&&<Link className="btn btn-secondary" to="/admin/services">Review academic projects</Link>}
    </div>
    <p style={{fontSize:'.78rem',marginTop:15,color:'var(--text-muted)'}}>These are operational counts from current accessible records, not audited financial results. Payment processing is disabled.</p>
  </section>;
}
