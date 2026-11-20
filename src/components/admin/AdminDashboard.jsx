import React,{useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';
import {isIpsAcademicProject,isIpsQaFixtureEmail} from '../../../shared/ipsCompanyScope.js';
import AdminIcon from './AdminIcon.jsx';

const OPEN_PROJECT_STATUSES=new Set(['New Request','Under Review','Clarification Required','Quoted','Quote Accepted',
  'Awaiting Assignment','Assigned','In Progress','Waiting for Client','Submitted for Review',
  'Correction Required','Ready for Client','On Hold','Disputed']);
const due=record=>Boolean(record.next_update_at && record.contact_verified && record.contact_consent &&
  ['new','in_progress'].includes(record.status) && new Date(record.next_update_at).getTime()<=Date.now());
const displayNumber=value=>value===null?'—':new Intl.NumberFormat('en').format(value);
const caseName=q=>q.username||q.enquiry_id||'Private client request';

const phases=[
  {name:'Quotation & review',statuses:['New Request','Under Review','Clarification Required','Quoted','Quote Accepted']},
  {name:'Specialist assignment',statuses:['Awaiting Assignment','Assigned']},
  {name:'Delivery in progress',statuses:['In Progress','Waiting for Client','Correction Required']},
  {name:'Quality & completion',statuses:['Submitted for Review','Ready for Client','Completed']}
];

export default function AdminDashboard(){
  const {admin,hasAdminPermission}=useAuth();
  const [data,setData]=useState({enquiries:null,threads:null,projects:null,tickets:null});
  const [errors,setErrors]=useState([]);
  const [loading,setLoading]=useState(true);
  const [updated,setUpdated]=useState(null);
  const [refreshKey,setRefreshKey]=useState(0);
  useEffect(()=>{
    const timer=setInterval(()=>setRefreshKey(k=>k+1),90000);
    return()=>clearInterval(timer);
  },[]);
  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    const sources=[
      ['enquiries','/api/contact-enquiries/admin','support.view','enquiries'],
      ['threads','/api/contact-channels/admin/threads','messages.view','threads'],
      ['projects','/api/services','services.view','requests'],
      ['tickets','/api/support-tickets','support.view','tickets']
    ];
    (async()=>{
      setLoading(true);
      const next={enquiries:null,threads:null,projects:null,tickets:null};
      const failures=[];
      await Promise.all(sources.filter(([, ,permission])=>hasAdminPermission(permission)).map(async ([key,url,,field])=>{
        try{
          const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
          const body=await response.json().catch(()=>({}));
          if(!response.ok||!body.success||!Array.isArray(body[field]))throw Error(body.error||'Unavailable');
          next[key]=body[field];
        }catch(error){
          if(error.name!=='AbortError')failures.push(key);
        }
      }));
      if(active){
        setData(next);setErrors(failures);setUpdated(new Date());setLoading(false);
      }
    })();
    return()=>{active=false;controller.abort();};
  },[refreshKey,admin?.id]);

  const enquiries=useMemo(()=>data.enquiries?.filter(q=>
    q.contact_consent && !isIpsQaFixtureEmail(q.email) && ['general','quote'].includes(q.request_type)
  )??null,[data.enquiries]);
  const projects=useMemo(()=>data.projects?.filter(isIpsAcademicProject)??null,[data.projects]);
  const threads=useMemo(()=>data.threads?.filter(x=>x.channel==='telegram')??null,[data.threads]);
  const tickets=data.tickets;
  const activeProjects=projects?.filter(p=>OPEN_PROJECT_STATUSES.has(p.status))??null;
  const summary=[
    {label:'New verified enquiries',count:enquiries?.filter(q=>q.status==='new'&&q.contact_verified).length??null,
      icon:'quotes',tone:'blue',to:'/admin/enquiries',permission:'support.view',hint:'Ready for human review'},
    {label:'Without an owner',count:enquiries?.filter(q=>['new','in_progress'].includes(q.status)&&q.contact_verified&&!q.assigned_admin_id).length??null,
      icon:'clients',tone:'rose',to:'/admin/enquiries',permission:'support.view',hint:'Assign a responsible reviewer'},
    {label:'Updates overdue',count:enquiries?.filter(due).length??null,
      icon:'clock',tone:'rose',to:'/admin/enquiries?filter=overdue',permission:'support.view',hint:'Written updates need attention'},
    {label:'Active academic projects',count:activeProjects?.length??null,
      icon:'projects',tone:'teal',to:'/admin/services',permission:'services.view',hint:'Verified quotation handoffs'},
    {label:'Unread Telegram messages',count:threads?.reduce((sum,t)=>sum+Number(t.unread_count||0),0)??null,
      icon:'messages',tone:'blue',to:'/admin/external-chats',permission:'messages.view',hint:'Customer-initiated conversations'},
    {label:'Open support requests',count:tickets?.filter(t=>!['Resolved','Closed'].includes(t.status)).length??null,
      icon:'support',tone:'teal',to:'/admin/support',permission:'support.view',hint:'Cases awaiting resolution'}
  ].filter(x=>hasAdminPermission(x.permission));

  const priority=useMemo(()=>{
    const items=[];
    for(const q of enquiries||[]){
      const name=caseName(q);
      if(due(q))items.push({key:'overdue-'+q.enquiry_id,score:0,icon:'clock',urgent:true,
        title:'Written update overdue',subtitle:name+' · '+q.enquiry_id,
        to:'/admin/enquiries?case='+encodeURIComponent(q.enquiry_id),label:'Overdue'});
      else if(q.contact_verified&&q.status==='new')items.push({key:'review-'+q.enquiry_id,score:1,icon:'quotes',
        title:'New quotation to review',subtitle:name+' · '+q.enquiry_id,
        to:'/admin/enquiries?case='+encodeURIComponent(q.enquiry_id),label:'Review'});
      else if(!q.contact_verified&&q.status!=='closed')items.push({key:'verify-'+q.enquiry_id,score:4,icon:'lock',
        title:'Awaiting written-contact verification',subtitle:name+' · '+q.preferred_channel,
        to:'/admin/enquiries?case='+encodeURIComponent(q.enquiry_id),label:'Verify'});
    }
    for(const p of projects||[]){
      if(['Submitted for Review','Correction Required','Disputed'].includes(p.status))items.push({
        key:'qa-'+p.request_id,score:2,icon:'projects',title:'Academic work requires a decision',
        subtitle:p.title||p.request_id,to:'/admin/services/'+encodeURIComponent(p.request_id),
        label:p.status==='Disputed'?'Disputed':'Quality review'});
    }
    for(const t of threads||[]){
      if(Number(t.unread_count)>0)items.push({key:'tg-'+t._id,score:3,icon:'telegram',
        title:'Unread Telegram support',subtitle:'Customer-initiated conversation · '+Number(t.unread_count)+' unread',
        to:'/admin/external-chats?thread='+encodeURIComponent(t._id),label:'New message'});
    }
    return items.sort((a,b)=>a.score-b.score).slice(0,7);
  },[enquiries,projects,threads]);
  const projectCount=projects?.length??null;
  const quick=[
    {title:'Review client enquiries',detail:'Open the confidential case desk',path:'/admin/enquiries',icon:'quotes',permission:'support.view'},
    {title:'Telegram support',detail:'Answer verified or general requests',path:'/admin/external-chats',icon:'telegram',permission:'messages.view'},
    {title:'Academic projects',detail:'Coordinate deadlines and QA',path:'/admin/services',icon:'projects',permission:'services.view'},
    {title:'Specialist network',detail:'Review credentials and approvals',path:'/admin/writers',icon:'specialists',permission:'providers.view'}
  ].filter(x=>hasAdminPermission(x.permission));

  return <div className="ips-command-center">
    <section className="ips-command-hero">
      <div>
        <span className="ips-eyebrow">IPS academic services · operations</span>
        <h2>Everything that needs your attention.</h2>
        <p>A single view of confidential client requests, active academic work and written support. Real company records only—no marketplace or simulated revenue.</p>
        <div className="ips-hero-actions">
          {hasAdminPermission('support.view')&&
            <Link className="btn btn-primary" to="/admin/enquiries"><AdminIcon name="quotes" size={17}/> Open case desk <AdminIcon name="arrow" size={16}/></Link>}
          {hasAdminPermission('services.view')&&
            <Link className="btn btn-secondary" to="/admin/services"><AdminIcon name="projects" size={17}/> Academic projects</Link>}
          <button className="btn btn-ghost" type="button" disabled={loading} onClick={()=>setRefreshKey(k=>k+1)}>
            <AdminIcon name="refresh" size={16}/>{loading?'Refreshing…':'Refresh'}
          </button>
        </div>
      </div>
      <div className="ips-command-health" aria-label="Company operating principles">
        <span className="ips-eyebrow">Operating principles</span>
        <div className="ips-health-row"><span className="ips-health-dot"/><div><strong>Confidential by design</strong>Private project records remain inside IPS</div></div>
        <div className="ips-health-row"><span className="ips-health-dot"/><div><strong>Human-managed cases</strong>Central review and responsibility</div></div>
        <div className="ips-health-row"><span className="ips-health-dot pending"/><div><strong>Payments not activated</strong>No real funds are collected</div></div>
      </div>
    </section>
    {errors.length>0&&<div className="ips-panel" role="alert" style={{borderLeft:'4px solid #b75d50',padding:'14px 19px',fontSize:'.84rem'}}>
      <strong>Some live feeds did not load.</strong> {errors.join(', ')}. Unavailable figures show — rather than zero.
    </div>}
    <div className="ips-stat-grid" aria-label="Company operations summary">
      {summary.map(s=><Link key={s.label} to={s.to} className="ips-stat-card">
        <div className="ips-stat-top"><span>{s.label}</span><span className={'ips-stat-icon '+s.tone}><AdminIcon name={s.icon} size={19}/></span></div>
        <strong className="ips-stat-number">{displayNumber(s.count)}</strong>
        <div className="ips-stat-foot"><span>{s.hint}</span><AdminIcon name="arrow" size={15}/></div>
      </Link>)}
    </div>
    <div className="ips-command-columns">
      <section className="ips-panel">
        <div className="ips-panel-head">
          <div><span className="ips-eyebrow">Daily priorities</span><h3 style={{marginTop:6}}>Next actions</h3><p>Actual requests that need human attention</p></div>
          {hasAdminPermission('support.view')&&<Link to="/admin/enquiries">All cases <AdminIcon name="arrow" size={13}/></Link>}
        </div>
        <div className="ips-attention-list">
          {priority.length?priority.map(item=><Link className="ips-attention-row" key={item.key} to={item.to}>
            <span className={'ips-attention-index'+(item.urgent?' urgent':'')}><AdminIcon name={item.icon} size={18}/></span>
            <span style={{minWidth:0}}><strong>{item.title}</strong><small>{item.subtitle}</small></span>
            <span className={'ips-status-pill'+(item.urgent?' urgent':item.score===4?' pending':' neutral')}>{item.label}</span>
          </Link>):<div className="ips-zero-state">
            <AdminIcon name={loading?'refresh':'check'} size={24}/>
            <div><strong>{loading?'Checking live priorities…':'No urgent actions in the loaded queues'}</strong>
              {loading?'Collecting company records.':'Use the case desk to review current requests or assign new work.'}</div>
          </div>}
        </div>
      </section>
      <section className="ips-panel">
        <div className="ips-panel-head">
          <div><span className="ips-eyebrow">Delivery oversight</span><h3 style={{marginTop:6}}>Academic workflow</h3><p>Source-bound projects, never generic marketplace work</p></div>
          {hasAdminPermission('services.view')&&<Link to="/admin/services">View work <AdminIcon name="arrow" size={13}/></Link>}
        </div>
        {projectCount===null?<div className="ips-zero-state"><AdminIcon name="clock" size={22}/><div><strong>Project figures unavailable</strong>Requires academic-project viewing access and the live project API.</div></div>:
        projectCount===0?<div className="ips-zero-state"><AdminIcon name="file" size={22}/><div><strong>No academic projects in the active scope</strong>Qualified client quotations begin at the case desk before a project is created.</div></div>:
        <div style={{padding:'18px 0 8px'}}>
          {phases.map(phase=>{
            const count=projects.filter(p=>phase.statuses.includes(p.status)).length;
            return <div className="ips-progress-item" key={phase.name}>
              <div className="ips-progress-row"><span>{phase.name}</span><strong>{count}</strong></div>
              <div className="ips-progress-track"><span style={{width:(projectCount?count/projectCount*100:0)+'%'}}/></div>
            </div>;
          })}
          <p style={{fontSize:'.7rem',color:'#87979b',padding:'0 24px'}}>Counts reflect current project status, not completed payments or revenue.</p>
        </div>}
      </section>
    </div>
    <section>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'end',marginBottom:12}}>
        <div><span className="ips-eyebrow">Your workspace</span><h3 style={{fontSize:'1.03rem',margin:'5px 0 0'}}>Go directly to the work</h3></div>
        {updated&&<small style={{color:'#71858c',fontSize:'.7rem'}}>Checked {updated.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · Latest 120 enquiries</small>}
      </div>
      <div className="ips-work-links">
        {quick.map(x=><Link key={x.path} className="ips-work-link" to={x.path}>
          <span className="ips-work-link-icon"><AdminIcon name={x.icon} size={20}/></span>
          <span style={{minWidth:0}}><strong>{x.title}</strong><small>{x.detail}</small></span>
        </Link>)}
      </div>
    </section>
  </div>;
}
