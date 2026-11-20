import React,{useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext.jsx';
import {COMPANY_DEPARTMENTS} from '../../../shared/companyGovernance.js';
import {isOpenCompanyCase as open,isOverdueCompanyCase as overdue,
  needsCompanyCaseOwner as needsOwner,requiresManagementAttention as attention,
  summarizeCompanyCases} from '../../../shared/companyPulse.js';
import AdminIcon from './AdminIcon.jsx';
import './company-command-centre.css';

const TITLES={enquiry:'Quotation',support:'Client support',project:'Academic project',telegram:'Telegram'};
const ICONS={enquiry:'quotes',support:'support',project:'projects',telegram:'telegram'};
const N=n=>n===null?'—':new Intl.NumberFormat('en').format(n);
const caseHref=c=>'/admin/case-desk?case='+encodeURIComponent(c.kind+':'+c.ref);
const dateText=d=>d?new Date(d).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}):'';
const departmentEntries=Object.entries(COMPANY_DEPARTMENTS);
function PanelTitle({eyebrow,title,link,linkText}){
  return <div className="ips-command-panel-head">
    <div><span className="ips-command-kicker">{eyebrow}</span><h2>{title}</h2></div>
    {link&&<Link to={link}>{linkText||'Open'}<AdminIcon name="arrow" size={15}/></Link>}
  </div>;
}
function Empty({children}){return <div className="ips-command-quiet"><AdminIcon name="check" size={19}/>{children}</div>;}
function Metric({label,value,caption,icon,to,tone}){
  return <Link className={'ips-exec-metric '+(tone||'')} to={to} aria-label={label+': '+N(value)}>
    <div className="ips-exec-metric-top"><span>{label}</span><AdminIcon name={icon} size={19}/></div>
    <strong>{N(value)}</strong><small>{caption}</small>
  </Link>;
}
export default function CompanyCommandCenter(){
  const {admin,hasAdminPermission}=useAuth();
  const isRoot=Boolean(admin?.isRoot);
  const [snapshot,setSnapshot]=useState({cases:null,team:null,clients:null,specialists:null});
  const [errors,setErrors]=useState([]);
  const [synced,setSynced]=useState('');
  const [busy,setBusy]=useState(false);
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{const id=setInterval(()=>setRefresh(x=>x+1),90000);return()=>clearInterval(id);},[]);
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    const tasks=[
      ['cases','/api/admin/company-cases','cases',true],
      ['team','/api/admin/company-team/roster','members',hasAdminPermission('team.manage')],
      ['clients','/api/clients','clients',hasAdminPermission('clients.view')],
      ['specialists','/api/writers','writers',hasAdminPermission('providers.view')]
    ].filter(([, , ,permitted])=>permitted);
    (async()=>{
      setBusy(true);
      const next={cases:null,team:null,clients:null,specialists:null};const failures=[];
      await Promise.all(tasks.map(async ([key,url,field])=>{
        try{
          const r=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
          const d=await r.json().catch(()=>({}));
          if(!r.ok||!d.success||!Array.isArray(d[field]))throw Error(d.error||'Source unavailable');
          next[key]=d[field];
        }catch(e){if(e.name!=='AbortError')failures.push(key);}
      }));
      if(active){setSnapshot(next);setErrors(failures);setSynced(new Date().toISOString());setBusy(false);}
    })();
    return()=>{active=false;controller.abort();};
  },[admin?.id,refresh]);
  const cases=snapshot.cases||[];
  const live=cases.filter(open);
  const pulse=summarizeCompanyCases(snapshot.cases);
  const priority=useMemo(()=>live.filter(attention).sort((a,b)=>
    Number(overdue(b))-Number(overdue(a))||
    Number(needsOwner(b))-Number(needsOwner(a))||
    Date.parse(b.updated_at||0)-Date.parse(a.updated_at||0)),[snapshot.cases]);
  const unowned=live.filter(needsOwner);
  const late=live.filter(overdue);
  const team=snapshot.team||[];
  const managers=team.filter(m=>m.company_role==='manager'&&m.status==='Active');
  const invites=team.filter(m=>m.status==='Invited');
  const members=team.filter(m=>m.status==='Active');
  const clients=snapshot.clients||[];
  const specialists=snapshot.specialists||[];
  const unverifiedClients=clients.filter(c=>c.status==='Active'&&!c.email_verified_at).length;
  const pendingSpecialists=specialists.filter(s=>(s.application_status||'pending')==='pending').length;
  const missingSpecialistVerification=specialists.filter(s=>s.application_status==='approved'&&!s.email_verified_at).length;
  const openTasks=pulse?.tasks??null;
  const visibleCases=snapshot.cases!==null;
  const cards=[
    {label:'Open company cases',value:pulse?.open??null,caption:'Within your authorized service scope',icon:'projects',to:'/admin/case-desk'},
    {label:'Needs management attention',value:pulse?.attention??null,caption:'Priority requests and delivery exceptions',icon:'alert',to:'/admin/case-desk?filter=priority',tone:'attention'},
    {label:'Unassigned quotations',value:pulse?.unowned??null,caption:'Verified, active and without an owner',icon:'clients',to:'/admin/case-desk?filter=enquiry',tone:'attention'},
    {label:'Overdue case follow-ups',value:pulse?.overdue??null,caption:'Cases with overdue tasks or written updates',icon:'clock',to:'/admin/case-desk?filter=priority',tone:'attention'}
  ];
  return <div className="ips-exec">
    <header className="ips-exec-hero">
      <div className="ips-exec-intro">
        <div className="ips-command-kicker"><span className="ips-exec-live-dot"/> IPS ACADEMIC SERVICES / COMPANY CONTROL</div>
        <h1>{isRoot?'Executive command centre':'Department command centre'}</h1>
        <p>{isRoot?'Govern the entire company through accountable people, cases and service delivery. Your ownership role reports to nobody.':
          'Your delegated operational view, restricted to the permissions assigned by the company owner.'}</p>
        <div className="ips-exec-actions">
          <Link className="ips-exec-primary" to="/admin/case-desk"><AdminIcon name="projects" size={17}/> Open the case desk <AdminIcon name="arrow" size={16}/></Link>
          {hasAdminPermission('team.manage')&&<Link className="ips-exec-secondary" to="/admin/access"><AdminIcon name="clients" size={16}/> Manage your people</Link>}
          <button type="button" className="ips-exec-secondary" onClick={()=>setRefresh(v=>v+1)} disabled={busy}><AdminIcon name="refresh" size={16}/>{busy?'Updating…':'Refresh'}</button>
        </div>
      </div>
      <aside className="ips-exec-health" aria-label="Company operating status">
        <span className="ips-command-kicker">OPERATING STATUS</span>
        <div><AdminIcon name="shield" size={17}/><span>Confidential company workspace</span><strong>Protected</strong></div>
        <div><AdminIcon name="clients" size={17}/><span>Accountable work owner</span><strong>{visibleCases?N(live.filter(c=>c.owner).length)+' assigned':'—'}</strong></div>
        <div><AdminIcon name="activity" size={17}/><span>Open follow-up tasks</span><strong>{visibleCases?N(openTasks):'—'}</strong></div>
        <div><AdminIcon name="lock" size={17}/><span>Payment collection</span><strong>Not activated</strong></div>
        <small>{synced?'Source check '+dateText(synced):'Connecting to company records'} · Metrics show only records accessible to this account.</small>
      </aside>
    </header>
    {errors.length>0&&<div className="ips-exec-alert" role="alert">
      <AdminIcon name="alert" size={19}/> Some company records could not be loaded ({errors.join(', ')}). Unavailable counts are shown as —, never zero.
    </div>}
    <section className="ips-exec-metrics" aria-label="Operational indicators">
      {cards.map(c=><Metric key={c.label} {...c}/>)}
    </section>
    <div className="ips-exec-grid">
      <section className="ips-exec-panel ips-exec-main">
        <PanelTitle eyebrow="OPERATIONS / LIVE QUEUE" title="Management attention" link="/admin/case-desk" linkText="All cases"/>
        <p className="ips-exec-help">Actions are linked to existing company case files. Nothing here is simulated.</p>
        {!visibleCases?<div className="ips-command-quiet">Case data is unavailable. Check the connection before making decisions.</div>:
          priority.length===0?<Empty>No urgent cases in the accessible company queue. Review the full desk for routine work.</Empty>:
          <div className="ips-exec-queue">{priority.slice(0,7).map(c=><Link key={c.kind+':'+c.ref} className="ips-exec-case" to={caseHref(c)}>
            <span className="ips-exec-case-icon"><AdminIcon name={ICONS[c.kind]||'file'} size={19}/></span>
            <span className="ips-exec-case-body"><strong>{c.subject||TITLES[c.kind]}</strong>
              <small>{TITLES[c.kind]} · {c.ref} · {c.status}</small></span>
            <span className={'ips-exec-case-flag '+(overdue(c)?'late':'')}>
              {overdue(c)?'Overdue':needsOwner(c)?'No owner':c.new_message?'Unread':'Needs review'}</span>
            <AdminIcon name="chevron" size={17}/>
          </Link>)}</div>}
      </section>
      <section className="ips-exec-panel ips-exec-side">
        <PanelTitle eyebrow="DELIVERY / SERVICE MIX" title="Where the work is" link="/admin/reports" linkText="Reports"/>
        {visibleCases?<div className="ips-exec-workstreams">
          {[
            ['enquiry','Private quotations','/admin/enquiries'],
            ['project','Academic delivery','/admin/services'],
            ['support','Client support','/admin/support'],
            ['telegram','Written enquiries','/admin/external-chats']
          ].filter(([kind])=>hasAdminPermission(({enquiry:'support.view',project:'services.view',support:'support.view',telegram:'messages.view'})[kind]))
            .map(([kind,label,to])=>{
              const n=live.filter(c=>c.kind===kind).length,max=Math.max(1,live.length);
              return <Link key={kind} to={to} className="ips-exec-stream">
                <span><AdminIcon name={ICONS[kind]} size={17}/><strong>{label}</strong><b>{N(n)}</b></span>
                <i><em style={{width:Math.round(100*n/max)+'%'}}/></i>
              </Link>;
            })}
        </div>:<div className="ips-command-quiet">Live case distribution is unavailable.</div>}
        <div className="ips-exec-policy"><AdminIcon name="lock" size={17}/>
          <span>Private client identities and communication details are not displayed in summary counts. Open authorized records to investigate.</span></div>
      </section>
    </div>
    {hasAdminPermission('team.manage')&&<section className="ips-exec-panel">
      <PanelTitle eyebrow="ORGANIZATION / GOVERNANCE" title={isRoot?'Your department leadership':'Your direct team'}
        link="/admin/access" linkText={isRoot?'Appoint managers':'Manage staff'}/>
      <div className="ips-exec-team-summary">
        <div><strong>{snapshot.team===null?'—':isRoot?managers.length:members.length}</strong><span>{isRoot?'Active managers':'Active direct reports'}</span></div>
        <div><strong>{snapshot.team===null?'—':invites.length}</strong><span>Outstanding invitations</span></div>
        <div><strong>{snapshot.team===null?'—':members.reduce((n,m)=>n+(m.workload?.tasks||0)+(m.workload?.enquiries||0)+(m.workload?.support||0),0)}</strong><span>Assigned open items</span></div>
      </div>
      {isRoot&&<div className="ips-exec-departments">{departmentEntries.map(([key,value])=>{
        const leaders=team.filter(m=>m.company_role==='manager'&&m.department===key&&m.status==='Active');
        const invited=team.filter(m=>m.company_role==='manager'&&m.department===key&&m.status==='Invited');
        return <Link className="ips-exec-department" to={'/admin/access?department='+encodeURIComponent(key)} key={key}>
          <span className={'ips-exec-dept-dot '+(leaders.length?'ready':invited.length?'pending':'missing')}/>
          <span><strong>{value.label}</strong><small>{snapshot.team===null?'Directory unavailable':leaders.length?
            leaders.map(m=>m.name).join(', '):invited.length?'Manager invitation pending':'Manager not appointed'}</small></span>
          <span className="ips-exec-dept-action">{leaders.length?'Manage':invited.length?'Review':'Appoint'} <AdminIcon name="arrow" size={14}/></span>
        </Link>;
      })}</div>}
      {!isRoot&&snapshot.team!==null&&team.length===0&&<Empty>No staff members have been invited to your department yet.</Empty>}
    </section>}
    {(hasAdminPermission('clients.view')||hasAdminPermission('providers.view'))&&<section className="ips-exec-panel">
      <PanelTitle eyebrow="TRUST / ACCOUNT READINESS" title="Identity and onboarding exceptions"/>
      <div className="ips-exec-exceptions">
        {hasAdminPermission('clients.view')&&<Link to="/admin/clients"><span><AdminIcon name="clients" size={19}/><strong>Active clients awaiting email verification</strong></span>
          <b>{snapshot.clients===null?'—':N(unverifiedClients)}</b><AdminIcon name="arrow" size={15}/></Link>}
        {hasAdminPermission('providers.view')&&<Link to="/admin/writers"><span><AdminIcon name="specialists" size={19}/><strong>Specialist applications awaiting review</strong></span>
          <b>{snapshot.specialists===null?'—':N(pendingSpecialists)}</b><AdminIcon name="arrow" size={15}/></Link>}
        {hasAdminPermission('providers.view')&&<Link to="/admin/writers"><span><AdminIcon name="shield" size={19}/><strong>Approved specialists without verified email</strong></span>
          <b>{snapshot.specialists===null?'—':N(missingSpecialistVerification)}</b><AdminIcon name="arrow" size={15}/></Link>}
      </div>
      <p className="ips-exec-help">No automatic account approval, email verification, recovery or status change is performed from this screen.</p>
    </section>}
  </div>;
}
