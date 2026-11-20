import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';
import {isIpsQaFixtureEmail} from '../../../shared/ipsCompanyScope.js';
import {isCompanyAcademicProject} from './AdminServices.jsx';
import {summarizeCompanyCases} from '../../../shared/companyPulse.js';
import AdminIcon from './AdminIcon.jsx';
import './company-reporting.css';

export default function AdminReports(){
  const {hasAdminPermission}=useAuth();
  const [quotes,setQuotes]=useState(null);
  const [projects,setProjects]=useState(null);
  const [cases,setCases]=useState(null);
  const [roster,setRoster]=useState(null);
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
          if(active)setQuotes((data.enquiries||[]).filter(q=>q.request_type==='quote'&&q.contact_consent&&!isIpsQaFixtureEmail(q.email)));
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
      try{
        const response=await fetch('/api/admin/company-cases',{cache:'no-store',credentials:'same-origin'});
        const data=await response.json().catch(()=>({}));
        if(!response.ok||!data.success||!Array.isArray(data.cases))throw Error(data.error||'Unavailable');
        if(active)setCases(data.cases);
      }catch(e){failures.push('Company case index: '+e.message);}
      if(hasAdminPermission('team.manage')){
        try{
          const response=await fetch('/api/admin/company-team/roster',{cache:'no-store',credentials:'same-origin'});
          const data=await response.json().catch(()=>({}));
          if(!response.ok||!data.success||!Array.isArray(data.members))throw Error(data.error||'Unavailable');
          if(active)setRoster(data.members);
        }catch(e){failures.push('Staff workloads: '+e.message);}
      }
      if(active)setWarning(failures.join(' '));
    };
    collect();return()=>{active=false;};
  },[hasAdminPermission]);
  const channelCounts=quotes?.reduce((s,x)=>({...s,[x.preferred_channel]:(s[x.preferred_channel]||0)+1}),{})||{};
  const serviceCounts=quotes?.reduce((s,x)=>({...s,[x.service||'Unclassified']:(s[x.service||'Unclassified']||0)+1}),{})||{};
  const pulse=summarizeCompanyCases(cases);
  const serviceMix=pulse?Object.entries(pulse.counts).map(([kind,count])=>({
    kind,count,label:({enquiry:'Enquiries & quotations',project:'Academic delivery',support:'Customer support',telegram:'Telegram inbox'})[kind]
  })):[];
  const workload=roster?.filter(x=>x.status==='Active').map(x=>({
    id:x.id,name:x.name,role:x.company_role,department:x.department,
    total:(x.workload?.tasks||0)+(x.workload?.enquiries||0)+(x.workload?.support||0)
  })).sort((a,b)=>b.total-a.total)||[];
  const metrics=[
    ['Recent confidential requests',quotes?.length,'Latest 120 stored enquiries, filtered to academic quotations'],
    ['Verified contacts',quotes?.filter(q=>q.contact_verified).length,'Written contact verified and consented'],
    ['Awaiting review',quotes?.filter(q=>q.status==='new'&&q.contact_verified).length,'Customer-verified academic quotations'],
    ['Academic projects',projects?.length,'Projects created from confirmed academic quote handoffs'],
    ['In progress',projects?.filter(j=>!['Completed','Cancelled'].includes(j.status)).length,'Academic projects not marked complete or cancelled']
  ];
  return <section className="ips-premium-report" style={{maxWidth:1450,margin:'0 auto'}}>
    <div className="ips-case-top" style={{marginBottom:22}}>
      <div><span className="ips-eyebrow">Company intelligence · verified source records</span>
        <h1>Service performance</h1>
        <p>Case volume, written-contact preferences and academic project progression. Financial figures are withheld until the payment provider is active and reconciled.</p>
      </div>
      <span className="ips-status-pill neutral">Operational reporting · latest 120 enquiries</span>
    </div>
    {warning&&<p role="alert" className="card" style={{color:'var(--danger)'}}>Some sources cannot be loaded: {warning}. Unavailable figures are displayed as —.</p>}
    <div className="ips-case-overview" style={{margin:'19px 0'}}>
      {metrics.map(([label,value,note])=><article key={label}>
        <span>{label}</span><strong>{value===undefined?'—':value}</strong>
        <small style={{color:'var(--text-muted)',lineHeight:1.45,display:'block'}}>{note}</small>
      </article>)}
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:15}}>
      <section className="ips-panel" style={{padding:23}}><h2 style={{fontSize:'1.12rem'}}>Contact methods requested</h2>
        {quotes===null?<p>Data unavailable for this role.</p>:Object.keys(channelCounts).length===0?<p>No recent academic enquiries.</p>:
          Object.entries(channelCounts).sort((a,b)=>b[1]-a[1]).map(([k,v])=><div key={k} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid var(--border)'}}><span style={{textTransform:'capitalize'}}>{k}</span><strong>{v}</strong></div>)}
        <p style={{color:'var(--text-muted)',fontSize:'.79rem'}}>WhatsApp is manual and not synchronized with IPS. These figures reflect customer preferences, not confirmed delivery.</p>
      </section>
      <section className="ips-panel" style={{padding:23}}><h2 style={{fontSize:'1.12rem'}}>Academic quotation categories</h2>
        {quotes===null?<p>Data unavailable for this role.</p>:Object.keys(serviceCounts).length===0?<p>No recent academic quotations.</p>:
          Object.entries(serviceCounts).sort((a,b)=>b[1]-a[1]).map(([k,v])=><div key={k} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',gap:16,borderBottom:'1px solid var(--border)'}}><span style={{overflowWrap:'anywhere'}}>{k}</span><strong>{v}</strong></div>)}
      </section>
    </div>
    <section className="ips-report-operational" aria-label="Company service intelligence">
      <div className="ips-report-intelligence-head">
        <div><span className="ips-eyebrow">Authorized live case index</span>
          <h2>Operational performance and exceptions</h2>
          <p>Recent accessible case records only — this is not an all-time financial report.</p></div>
        <Link to="/admin/case-desk" className="btn btn-secondary">Open case desk <AdminIcon name="arrow" size={16}/></Link>
      </div>
      <div className="ips-report-kpis">
        {[
          ['Open cases',pulse?.open,'Current open work'],
          ['Attention required',pulse?.attention,'Client messages, QA exceptions, overdue or unassigned work'],
          ['Unassigned verified enquiries',pulse?.unowned,'No accountable reviewer yet'],
          ['Overdue follow-ups',pulse?.overdue,'Overdue case tasks or written customer updates'],
          ['Open follow-up tasks',pulse?.tasks,'Tasks associated with accessible active cases']
        ].map(([name,value,hint])=><div key={name} className="ips-report-kpi">
          <span>{name}</span><strong>{value===undefined||value===null?'—':value}</strong><small>{hint}</small>
        </div>)}
      </div>
      <div className="ips-report-columns">
        <div className="ips-report-section"><h3>Live work by service</h3>
          {!pulse?<p>Accessible case data is unavailable.</p>:
            !pulse.open?<p>No open cases in the accessible snapshot.</p>:
              serviceMix.map(item=><div className="ips-report-bar-row" key={item.kind}>
                <div><span>{item.label}</span><strong>{item.count}</strong></div>
                <i><b style={{width:Math.round(100*item.count/Math.max(1,pulse.open))+'%'}}/></i>
              </div>)}
          <small>Case index is capped per source. Do not interpret these counts as a full company history.</small>
        </div>
        {hasAdminPermission('team.manage')&&<div className="ips-report-section"><h3>Accountability and staff workload</h3>
          {roster===null?<p>Assigned staff data is unavailable.</p>:!workload.length?
            <p>No active managers or team members in this management scope.</p>:
            <div className="ips-report-workload">
              {workload.slice(0,8).map(m=><div key={m.id}>
                <span><strong>{m.name||m.id}</strong><small>{m.department?.replaceAll('_',' ')||'Unassigned'} · {m.role}</small></span>
                <b>{m.total} <small>open items</small></b>
              </div>)}
            </div>}
          <small>Counts combine open tasks, enquiries and support assignments. Project-specialist workload is tracked in academic delivery.</small>
        </div>}
      </div>
      <p className="ips-report-scope"><AdminIcon name="shield" size={15}/>
        Role-restricted company data. Financial results remain withheld until the payment system is activated and reconciled.
        Case lists are bounded recent samples, not comprehensive financial or historical analytics.</p>
    </section>
    <div style={{display:'flex',gap:12,marginTop:18,flexWrap:'wrap'}}>
      {hasAdminPermission('support.view')&&<Link className="btn btn-secondary" to="/admin/enquiries">Review source enquiries</Link>}
      {hasAdminPermission('services.view')&&<Link className="btn btn-secondary" to="/admin/services">Review academic projects</Link>}
    </div>
    <p style={{fontSize:'.78rem',marginTop:15,color:'var(--text-muted)'}}>These are operational counts from current accessible records, not audited financial results. Payment processing is disabled.</p>
  </section>;
}
