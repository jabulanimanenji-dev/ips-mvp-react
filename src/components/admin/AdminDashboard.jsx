import React,{useCallback,useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';

const panelLink=(to,title,description)=>(
  <Link to={to} key={to} style={{display:'block',textDecoration:'none',color:'var(--text-primary)',border:'1px solid var(--border)',
    borderRadius:11,padding:'15px 17px',background:'var(--bg-surface-2)'}}>
    <strong style={{display:'block',fontSize:'.95rem'}}>{title}</strong>
    <small style={{color:'var(--text-muted)',display:'block',marginTop:5,lineHeight:1.5}}>{description}</small>
  </Link>
);

export default function AdminDashboard(){
  const {hasAdminPermission}=useAuth();
  const [summary,setSummary]=useState({newRequests:null,unassigned:null,overdue:null,unread:null,openSupport:null});
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [updated,setUpdated]=useState(null);

  const refresh=useCallback(async()=>{
    setLoading(true);setError('');
    const next={newRequests:null,unassigned:null,overdue:null,unread:null,openSupport:null};
    const errors=[];
    async function get(path){
      const response=await fetch(path,{cache:'no-store',credentials:'same-origin'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.success)throw Error(data.error||'Operational feed unavailable.');
      return data;
    }
    const checks=[];
    if(hasAdminPermission('support.view'))checks.push((async()=>{
      try{
        const data=await get('/api/contact-enquiries/admin/attention');
        next.newRequests=Number(data.new_requests||0);
        next.unassigned=Number(data.unassigned_requests||0);
        next.overdue=Number(data.overdue_updates||0);
      }catch(e){errors.push('Quotation queue: '+e.message);}
    })());
    if(hasAdminPermission('messages.view'))checks.push((async()=>{
      try{
        const data=await get('/api/contact-channels/admin/threads');
        next.unread=(data.threads||[]).filter(t=>t.channel==='telegram').reduce((sum,t)=>sum+Number(t.unread_count||0),0);
      }catch(e){errors.push('Telegram inbox: '+e.message);}
    })());
    if(hasAdminPermission('support.view'))checks.push((async()=>{
      try{
        const data=await get('/api/support-tickets');
        next.openSupport=(data.tickets||[]).filter(t=>!['Resolved','Closed'].includes(t.status)).length;
      }catch(e){errors.push('Support cases: '+e.message);}
    })());
    await Promise.all(checks);
    setSummary(next);
    setUpdated(new Date());
    setError(errors.join(' '));
    setLoading(false);
  },[hasAdminPermission]);

  useEffect(()=>{refresh();},[refresh]);

  const metrics=[
    {label:'New private enquiries',value:summary.newRequests,path:'/admin/enquiries',permission:'support.view'},
    {label:'Unassigned requests',value:summary.unassigned,path:'/admin/enquiries',permission:'support.view'},
    {label:'Updates overdue',value:summary.overdue,path:'/admin/enquiries',permission:'support.view'},
    {label:'Unread Telegram messages',value:summary.unread,path:'/admin/external-chats',permission:'messages.view'},
    {label:'Open support cases',value:summary.openSupport,path:'/admin/support',permission:'support.view'}
  ].filter(m=>hasAdminPermission(m.permission));

  return <div style={{maxWidth:1350,margin:'0 auto'}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'start',flexWrap:'wrap',marginBottom:22}}>
      <div>
        <small style={{color:'var(--text-secondary)',fontWeight:750,letterSpacing:'.13em'}}>IPS ACADEMIC SERVICES</small>
        <h1 style={{margin:'5px 0 8px',fontSize:'1.75rem'}}>Company operations</h1>
        <p style={{margin:0,maxWidth:720,color:'var(--text-muted)',lineHeight:1.6}}>
          Manage confidential enquiries, written customer support, specialists and academic projects. Only production IPS work belongs in this workspace.
        </p>
      </div>
      <button type="button" className="btn btn-secondary" onClick={refresh} disabled={loading}>{loading?'Updating…':'Refresh status'}</button>
    </div>
    {error&&<p role="alert" className="card" style={{color:'var(--danger)',borderLeft:'4px solid var(--danger)',marginBottom:18}}>Some live feeds are unavailable: {error}. Unavailable figures are shown as —, not zero.</p>}
    <div className="card" style={{borderLeft:'4px solid #c7a46e',marginBottom:22,padding:'14px 18px'}}>
      <strong>Publication state · payments not activated</strong>
      <p style={{fontSize:'.85rem',color:'var(--text-muted)',margin:'6px 0 0'}}>IPS communicates in writing. Customer names are not required for initial quotations, and project files remain private. Payment records are not evidence of real collections until a verified provider is active.</p>
    </div>
    <div className="ipsa-company-metrics" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(175px,1fr))',gap:14,marginBottom:24}}>
      {metrics.map(m=><Link key={m.label} to={m.path} className="card" style={{color:'inherit',textDecoration:'none',padding:'17px 18px'}}>
        <small style={{color:'var(--text-muted)',display:'block',minHeight:32}}>{m.label}</small>
        <strong style={{fontSize:'1.85rem',display:'block',fontVariantNumeric:'tabular-nums',marginTop:4}}>{m.value===null?'—':m.value}</strong>
        <small style={{color:'var(--text-secondary)'}}>Open queue</small>
      </Link>)}
    </div>
    <div className="ipsa-company-actions" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(275px,1fr))',gap:16}}>
      {hasAdminPermission('support.view')&&<section className="card">
        <h2 style={{fontSize:'1.12rem',margin:'0 0 13px'}}>Client intake & care</h2>
        <div style={{display:'grid',gap:10}}>
          {panelLink('/admin/enquiries','Review quotations','Assign a reviewer, verify the selected written contact and respond to the client.')}
          {panelLink('/admin/support','Resolve support cases','Manage outstanding support cases and agreed follow-ups.')}
        </div>
      </section>}
      {hasAdminPermission('messages.view')&&<section className="card">
        <h2 style={{fontSize:'1.12rem',margin:'0 0 13px'}}>Confidential communication</h2>
        <div style={{display:'grid',gap:10}}>
          {panelLink('/admin/external-chats','Respond on Telegram','Answer fresh customer enquiries; require verification for private project details.')}
          {panelLink('/admin/messages','Secure IPS conversations','Use the protected workspace for client, specialist and project messages.')}
        </div>
      </section>}
      {(hasAdminPermission('orders.view')||hasAdminPermission('providers.view'))&&<section className="card">
        <h2 style={{fontSize:'1.12rem',margin:'0 0 13px'}}>Delivery & quality</h2>
        <div style={{display:'grid',gap:10}}>
          {hasAdminPermission('orders.view')&&panelLink('/admin/orders','Academic project oversight','Review assigned work, deadlines and quality decisions.')}
          {hasAdminPermission('providers.view')&&panelLink('/admin/writers','Specialist applications','Review qualifications and activate approved specialists.')}
        </div>
      </section>}
    </div>
    {updated&&<p style={{color:'var(--text-muted)',fontSize:'.75rem',marginTop:16}}>Live operational feeds last checked: {updated.toLocaleString()}.</p>}
  </div>;
}
