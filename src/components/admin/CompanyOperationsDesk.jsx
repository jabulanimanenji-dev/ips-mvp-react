import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';
import AdminIcon from './AdminIcon.jsx';
import './company-desk.css';

const TYPES={
  enquiry:{label:'Quotation / enquiry',icon:'quotes',color:'amber',path:'/admin/enquiries',view:'support.view',manage:'support.manage'},
  support:{label:'Client support',icon:'support',color:'blue',path:'/admin/support',view:'support.view',manage:'support.manage'},
  project:{label:'Academic project',icon:'projects',color:'teal',path:'/admin/services',view:'services.view',manage:'services.manage'},
  telegram:{label:'Telegram',icon:'telegram',color:'purple',path:'/admin/external-chats',view:'messages.view',manage:'messages.manage'}
};
const fmt=value=>value?new Date(value).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Not scheduled';
const elapsed=value=>value?Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/86400000)):null;
const stamp=value=>value?new Date(value).toISOString().slice(0,16):'';
const safeRef=(kind,ref)=>TYPES[kind]?kind+':'+ref:'';
const toLink=c=>c.kind==='enquiry'?'/admin/enquiries?case='+encodeURIComponent(c.ref):
  c.kind==='support'?'/admin/support?ticket='+encodeURIComponent(c.ref):
  c.kind==='project'?'/admin/services/'+encodeURIComponent(c.ref):
  '/admin/external-chats?thread='+encodeURIComponent(c.ref);
const isOpen=c=>!(['closed','Closed','Resolved','Completed','Cancelled'].includes(c.status));
const priorityItem=c=>c.tasks?.overdue>0||
  (c.kind==='enquiry'&&c.due_at&&new Date(c.due_at)<new Date()&&isOpen(c))||
  (c.kind==='project'&&['Submitted for Review','Disputed','Correction Required'].includes(c.status))||
  c.new_message||c.priority==='urgent'||(c.kind==='enquiry'&&c.verified&&c.status==='new');
const typeDescription={enquiry:'Private client intake and quotations',support:'Authenticated customer support',project:'Specialist delivery and quality',telegram:'Customer-initiated written enquiries'};

const Stat=({label,value,description,icon,onClick})=>
  <button className="ips-ops-stat" type="button" onClick={onClick}>
    <span className="ips-ops-stat-icon"><AdminIcon name={icon} size={19}/></span>
    <span className="ips-ops-stat-text"><strong>{value}</strong><span>{label}</span><small>{description}</small></span>
    <AdminIcon name="arrow" size={16}/>
  </button>;

function CaseIdentity({record}){
  return <div className="ips-ops-identity">
    <div className={'ips-ops-identicon '+TYPES[record.kind].color}><AdminIcon name={TYPES[record.kind].icon} size={24}/></div>
    <div style={{minWidth:0}}>
      <span className="ips-ops-upper">{TYPES[record.kind].label} · {record.ref}</span>
      <h2>{record.subject}</h2>
      <p>{record.person||'Private contact'} · {record.channel==='workspace'?'Secure IPS workspace':record.channel}</p>
    </div>
  </div>;
}
function Row({item,selected,onSelect}){
  const urgent=priorityItem(item);
  return <button className={'ips-ops-case-row'+(selected?' selected':'')} type="button" onClick={()=>onSelect(item)}>
    <span className={'ips-ops-row-icon '+TYPES[item.kind].color}><AdminIcon name={TYPES[item.kind].icon} size={19}/></span>
    <span className="ips-ops-row-body">
      <strong>{item.subject}</strong>
      <small>{item.person||'Private contact'} · {TYPES[item.kind].label}</small>
      <span className="ips-ops-row-bottom"><span>{item.status}</span>
        {(item.tasks?.open||0)>0&&<span> · {item.tasks.open} follow-up{item.tasks.open===1?'':'s'}</span>}
        {item.new_message&&<span className="ips-ops-live-tag">Unread</span>}
        {urgent&&!item.new_message&&<span className="ips-ops-priority-tag">Priority</span>}
      </span>
    </span><AdminIcon name="chevron" size={14}/>
  </button>;
}

export default function CompanyOperationsDesk(){
  const {admin,hasAdminPermission}=useAuth();
  const [params,setParams]=useSearchParams();
  const requested=params.get('case')||'';
  const [cases,setCases]=useState([]);
  const [scope,setScope]=useState([]);
  const [fetchError,setFetchError]=useState('');
  const [detailError,setDetailError]=useState('');
  const [notice,setNotice]=useState('');
  const [loading,setLoading]=useState(true);
  const [detailLoading,setDetailLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [detail,setDetail]=useState(null);
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('open');
  const [tab,setTab]=useState('brief');
  const [entryKind,setEntryKind]=useState('task');
  const [draft,setDraft]=useState('');
  const [taskDate,setTaskDate]=useState('');
  const [taskPriority,setTaskPriority]=useState('standard');
  const [staff,setStaff]=useState([]);
  const [assignee,setAssignee]=useState(admin?.id||'');
  const [updateDate,setUpdateDate]=useState('');
  const [refreshCount,setRefreshCount]=useState(0);
  const selection=useMemo(()=>cases.find(c=>safeRef(c.kind,c.ref)===requested)||null,[cases,requested]);
  const selectedRef=selection?safeRef(selection.kind,selection.ref):'';
  const canManage=selection&&hasAdminPermission(TYPES[selection.kind].manage);
  const detailAbort=useRef(null);

  const fetchCases=useCallback(async()=>{
    setLoading(true);setFetchError('');
    try{
      const r=await fetch('/api/admin/company-cases',{credentials:'same-origin',cache:'no-store'});
      const data=await r.json().catch(()=>({}));
      if(!r.ok||!data.success||!Array.isArray(data.cases))throw Error(data.error||'The company case index is unavailable.');
      setCases(data.cases);setScope(data.scope||[]);
      if(!requested&&data.cases[0]){
        const first=data.cases.find(priorityItem)||data.cases.find(isOpen)||data.cases[0];
        setParams(p=>{const next=new URLSearchParams(p);next.set('case',safeRef(first.kind,first.ref));return next;},{replace:true});
      }
    }catch(e){setFetchError(e.message);}
    finally{setLoading(false);}
  },[requested,setParams]);
  useEffect(()=>{fetchCases();},[refreshCount]); // Explicit refresh and periodic refresh only.
  useEffect(()=>{
    if(!hasAdminPermission('administrators.manage'))return;
    let active=true;
    fetch('/api/admin/company-cases/staff',{credentials:'same-origin',cache:'no-store'})
      .then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok||!d.success)throw Error('Team directory unavailable.');return d;})
      .then(d=>{if(active)setStaff(d.staff||[]);})
      .catch(()=>{if(active)setStaff([]);});
    return()=>{active=false;};
  },[admin?.id]);
  useEffect(()=>{
    const timer=setInterval(()=>setRefreshCount(n=>n+1),90000);
    return()=>clearInterval(timer);
  },[]);
  const fetchDetail=useCallback(async()=>{
    if(!selection){setDetail(null);return;}
    detailAbort.current?.abort();
    const controller=new AbortController();detailAbort.current=controller;
    setDetailLoading(true);setDetailError('');setNotice('');setDetail(null);
    try{
      const url='/api/admin/company-cases/'+selection.kind+'/'+encodeURIComponent(selection.ref);
      const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.success)throw Error(data.error||'Case file could not be opened.');
      if(!controller.signal.aborted){
        setDetail(data);setUpdateDate(stamp(data.details?.next_update_at));
      }
    }catch(e){if(e.name!=='AbortError')setDetailError(e.message);}
    finally{if(!controller.signal.aborted)setDetailLoading(false);}
  },[selectedRef]);
  useEffect(()=>{setTab('brief');},[selectedRef]);
  useEffect(()=>{fetchDetail();return()=>detailAbort.current?.abort();},[fetchDetail]);
  const chosen=(record)=>{
    const next=new URLSearchParams(params);next.set('case',safeRef(record.kind,record.ref));
    setParams(next);setTab('brief');setDraft('');
  };
  const visible=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return cases.filter(x=>{
      if(filter==='priority'&&!priorityItem(x))return false;
      if(filter==='enquiry'&&x.kind!=='enquiry')return false;
      if(filter==='support'&&x.kind!=='support')return false;
      if(filter==='project'&&x.kind!=='project')return false;
      if(filter==='telegram'&&x.kind!=='telegram')return false;
      if(filter==='open'&&!isOpen(x))return false;
      return !q||[x.ref,x.subject,x.person,x.status,x.channel].join(' ').toLowerCase().includes(q);
    }).sort((a,b)=>Number(priorityItem(b))-Number(priorityItem(a))||
      Date.parse(b.updated_at||0)-Date.parse(a.updated_at||0));
  },[cases,search,filter]);
  const metrics=useMemo(()=>({
    priority:cases.filter(priorityItem).length,
    unowned:cases.filter(x=>x.kind==='enquiry'&&x.verified&&isOpen(x)&&!x.owner).length,
    deadlines:cases.filter(x=>x.tasks?.overdue>0||
      (x.kind==='enquiry'&&x.due_at&&new Date(x.due_at)<new Date()&&isOpen(x))).length,
    unreads:cases.filter(x=>x.kind==='telegram').reduce((sum,x)=>sum+(x.unread_count||0),0),
    open:cases.filter(isOpen).length,
    projects:cases.filter(x=>x.kind==='project'&&isOpen(x)).length
  }),[cases]);

  const api=async(url,method,body)=>{
    const response=await fetch(url,{method,credentials:'same-origin',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const result=await response.json().catch(()=>({}));
    if(!response.ok||!result.success)throw Error(result.error||'The action was not saved.');
    return result;
  };
  const act=async(url,method,body,message)=>{
    if(busy||!selection)return false;
    setBusy(true);setDetailError('');setNotice('');
    try{
      await api(url,method,body);
      await Promise.all([fetchDetail(),fetchCases()]);
      setNotice(message||'Case updated successfully.');
      return true;
    }catch(e){setDetailError(e.message);return false;}
    finally{setBusy(false);}
  };
  const refUrl=selection?'/api/admin/company-cases/'+selection.kind+'/'+encodeURIComponent(selection.ref):'';
  async function saveAction(e){
    e.preventDefault();
    const content=draft.trim();
    if(!content||!canManage)return;
    const payload={entry_kind:entryKind,body:content,priority:taskPriority,
      ...(entryKind==='task'&&taskDate?{due_at:new Date(taskDate).toISOString()}:{}),
      ...(entryKind==='task'&&assignee?{assigned_to:assignee}:{})};
    const saved=await act(refUrl+'/actions','POST',payload,
      entryKind==='task'?'Internal follow-up task recorded.':'Confidential staff note saved.');
    if(saved){setDraft('');setTaskDate('');}
  }
  const toggleTask=async action=>act(refUrl+'/tasks/'+action._id,'PATCH',{
    task_status:action.task_status==='done'?'open':'done'
  },'Follow-up task updated.');
  const doCaseAction=async(kind,payload)=>{
    if(!selection)return;
    if(kind==='claim')await act('/api/contact-enquiries/admin/'+encodeURIComponent(selection.ref)+'/claim',
      'POST',{},'You now own this verified enquiry.');
    if(kind==='enquiry')await act('/api/contact-enquiries/admin/'+encodeURIComponent(selection.ref),
      'PATCH',payload,'Client enquiry state updated.');
    if(kind==='support')await act('/api/support-tickets/'+encodeURIComponent(selection.ref),
      'PATCH',payload,'Support case updated.');
  };
  const notes=detail?.actions?.filter(x=>x.entry_kind==='note')||[];
  const tasks=detail?.actions?.filter(x=>x.entry_kind==='task')||[];

  return <section className="ips-operations-console">
    <header className="ips-ops-head">
      <div>
        <span className="ips-ops-eyebrow">IPS ACADEMIC SERVICES <span className="ips-ops-separator">/</span> COMPANY MANAGEMENT</span>
        <h1>Operations command desk</h1>
        <p>One governed workspace for client enquiries, written communication, academic delivery and staff follow-through.</p>
      </div>
      <div className="ips-ops-head-actions">
        <Link className="ips-ops-quiet-link" to="/admin/enquiries"><AdminIcon name="plus" size={17}/> Manage quotations</Link>
        <button type="button" className="ips-ops-refresh" disabled={loading||busy}
          onClick={()=>setRefreshCount(n=>n+1)}><AdminIcon name="refresh" size={17}/> {loading?'Updating…':'Refresh live work'}</button>
      </div>
    </header>
    {fetchError&&<div className="ips-ops-alert" role="alert"><AdminIcon name="alert" size={19}/> {fetchError} Existing records were not changed. <button type="button" onClick={()=>setRefreshCount(n=>n+1)}>Retry</button></div>}
    <div className="ips-ops-stats" aria-label="Actual company case workload">
      <Stat icon="alert" label="Requires attention" value={loading&&!cases.length?'—':metrics.priority}
        description="Work with a next decision" onClick={()=>setFilter('priority')}/>
      <Stat icon="clients" label="Unassigned" value={loading&&!cases.length?'—':metrics.unowned}
        description="Verified client requests" onClick={()=>setFilter('enquiry')}/>
      <Stat icon="clock" label="Overdue follow-ups" value={loading&&!cases.length?'—':metrics.deadlines}
        description="Recorded tasks and updates" onClick={()=>setFilter('priority')}/>
      <Stat icon="messages" label="Unread Telegram" value={loading&&!cases.length?'—':metrics.unreads}
        description="Customer-initiated messages" onClick={()=>setFilter('telegram')}/>
    </div>
    <div className="ips-ops-body">
      <aside className="ips-ops-queue" aria-label="Company case queue">
        <div className="ips-ops-queue-top">
          <span className="ips-ops-eyebrow">LIVE OPERATIONS</span>
          <h2>Case queue <span>{visible.length}</span></h2>
          <p>Choose any case to inspect and work on it.</p>
          <label className="ips-ops-queue-search"><AdminIcon name="search" size={17}/><input
            value={search} onChange={e=>setSearch(e.target.value)} type="search"
            placeholder="Search cases, clients or references…" aria-label="Search company cases"/></label>
          <div className="ips-ops-filters" aria-label="Case queue filters">
            {[['priority','Priority'],['open','Open'],['all','All'],['enquiry','Quotes'],['support','Support'],['project','Projects'],['telegram','Telegram']]
              .filter(([,x])=>x!=='All'||scope.length>0)
              .map(([id,label])=><button key={id} type="button" aria-pressed={filter===id}
                className={filter===id?'on':''} onClick={()=>setFilter(id)}>{label}</button>)}
          </div>
        </div>
        <div className="ips-ops-list">
          {!visible.length&&<div className="ips-ops-none">
            <AdminIcon name="check" size={26}/>
            <strong>{loading?'Reading your IPS cases…':'No matching work in this queue'}</strong>
            <p>{filter==='priority'?'No urgent work is flagged. Use Open or All to see normal operations.':'Try another filter or search for a different reference.'}</p>
            {!loading&&<button type="button" onClick={()=>setFilter('all')}>View all cases</button>}
          </div>}
          {visible.map(item=><Row key={safeRef(item.kind,item.ref)} item={item}
            selected={selectedRef===safeRef(item.kind,item.ref)} onSelect={chosen}/>)}
        </div>
        <div className="ips-ops-queue-foot"><AdminIcon name="shield" size={15}/> Role-based access · internal records only</div>
      </aside>
      <main className="ips-ops-detail" aria-label="Selected IPS case file">
        {detailError&&<div role="alert" className="ips-ops-alert"><AdminIcon name="alert" size={18}/> {detailError}</div>}
        {notice&&<div role="status" className="ips-ops-notice"><AdminIcon name="check" size={17}/> {notice}</div>}
        {!selection?<div className="ips-ops-welcome">
          <div className="ips-ops-welcome-emblem"><AdminIcon name="shield" size={30}/></div>
          <span className="ips-ops-eyebrow">YOUR COMPANY WORKSPACE</span>
          <h2>Run the company from one place.</h2>
          <p>New client enquiries become verified quotation cases. IPS staff take ownership, respond through the selected written channel, coordinate approved specialists and oversee delivery and quality.</p>
          <div className="ips-ops-how">
            {[['01','Review a private enquiry','Confirm consent and selected contact method before discussing details.'],
              ['02','Assign responsibility','Record who owns the next response and when it is due.'],
              ['03','Prepare academic delivery','Create the linked project when the verified client is ready.'],
              ['04','Track quality and closure','Coordinate specialist work, feedback and client handover.']]
              .map(([no,title,description])=><div key={no}><b>{no}</b><div><strong>{title}</strong><small>{description}</small></div></div>)}
          </div>
          <div className="ips-ops-welcome-links">
            {hasAdminPermission('support.view')&&<Link to="/admin/enquiries">Open client enquiries <AdminIcon name="arrow" size={15}/></Link>}
            {hasAdminPermission('services.view')&&<Link to="/admin/services">Open project delivery <AdminIcon name="arrow" size={15}/></Link>}
          </div>
        </div>:detailLoading||!detail?<div className="ips-ops-loading" role="status">
          <AdminIcon name="refresh" size={24}/><strong>Opening protected case file…</strong>
        </div>:<>
          <div className="ips-ops-detail-heading">
            <CaseIdentity record={selection}/>
            <div className="ips-ops-detail-actions">
              <span className={'ips-ops-state '+(priorityItem(selection)?'attention':'')}>{selection.status}</span>
              <Link className="ips-ops-open" to={toLink(selection)}>
                Full {selection.kind==='project'?'project':selection.kind==='telegram'?'conversation':'case'} <AdminIcon name="arrow" size={16}/>
              </Link>
            </div>
          </div>
          <div className="ips-ops-case-brief">
            <div><small>Status</small><strong>{selection.status}</strong></div>
            <div><small>Responsible person</small><strong>{selection.owner||'Not assigned'}</strong></div>
            <div><small>Contact authorization</small><strong>{selection.verified?'Verified':selection.kind==='enquiry'?'Pending verification':'Access governed'}</strong></div>
            <div><small>Next deadline</small><strong>{fmt(selection.due_at)}</strong></div>
          </div>
          <div className="ips-ops-tabs" role="tablist" aria-label="Case information">
            {[['brief','Case overview'],['activity','Timeline'],['tasks','Follow-ups ('+tasks.filter(x=>x.task_status==='open').length+')'],['notes','Internal notes ('+notes.length+')']]
              .map(([id,label])=><button type="button" role="tab" aria-selected={tab===id}
                key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}
          </div>
          <div className="ips-ops-tab-content">
            {tab==='brief'&&<div className="ips-ops-details-view">
              <section className="ips-ops-section">
                <div className="ips-ops-section-heading"><div><span className="ips-ops-eyebrow">CASE RESPONSIBILITY</span><h3>Next operational decision</h3></div></div>
                {selection.kind==='enquiry'&&<>
                  {!selection.verified&&<p className="ips-ops-caution"><AdminIcon name="lock" size={17}/> Contact consent or verification is missing. Do not send private quotations or academic records.</p>}
                  <div className="ips-ops-facts">
                    <div><small>Request</small><strong>{detail.details?.service||selection.subject}</strong></div>
                    <div><small>Academic field</small><strong>{detail.details?.discipline||'Not supplied'}</strong></div>
                    <div><small>Level</small><strong>{detail.details?.study_level||'Not supplied'}</strong></div>
                    <div><small>Contact preference</small><strong>{selection.channel}</strong></div>
                    <div><small>Project handoff</small><strong>{detail.details?.service_request_id||'Not yet linked'}</strong></div>
                    <div><small>Customer reference</small><strong>{detail.details?.client_id||'Private visitor'}</strong></div>
                  </div>
                  {canManage&&<div className="ips-ops-work-actions">
                    {!selection.owner&&selection.verified&&isOpen(selection)&&<button disabled={busy} className="ips-ops-primary" type="button" onClick={()=>doCaseAction('claim')}>Take case ownership</button>}
                    <label>Case status
                      <select disabled={busy} value={selection.status} onChange={e=>doCaseAction('enquiry',{status:e.target.value})}>
                        {['new','in_progress','waiting_for_customer','closed'].map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}
                      </select>
                    </label>
                    {isOpen(selection)&&<label>Promised written update
                      <input type="datetime-local" value={updateDate} onChange={e=>setUpdateDate(e.target.value)}/>
                      <button disabled={busy||!updateDate} type="button" onClick={()=>doCaseAction('enquiry',{next_update_at:new Date(updateDate).toISOString()})}>Save date</button>
                    </label>}
                  </div>}
                  <div className="ips-ops-next-links">
                    <Link to={toLink(selection)}>Open full quotation and reply desk <AdminIcon name="arrow" size={15}/></Link>
                    {detail.details?.service_request_id&&<Link to={'/admin/services/'+encodeURIComponent(detail.details.service_request_id)}>Open linked academic project <AdminIcon name="arrow" size={15}/></Link>}
                  </div>
                </>}
                {selection.kind==='support'&&<>
                  <div className="ips-ops-facts">
                    <div><small>Issue type</small><strong>{detail.details?.category||'General'}</strong></div>
                    <div><small>Priority</small><strong>{selection.priority}</strong></div>
                    <div><small>Client reference</small><strong>{detail.details?.client_id||'Private customer'}</strong></div>
                    <div><small>Assigned staff</small><strong>{detail.details?.assigned_admin||'Unassigned'}</strong></div>
                  </div>
                  {canManage&&<div className="ips-ops-work-actions">
                    {!selection.owner&&<button disabled={busy} className="ips-ops-primary" onClick={()=>doCaseAction('support',{assigned_admin:admin?.id})}>Assign to me</button>}
                    <label>Support status<select disabled={busy} value={selection.status} onChange={e=>doCaseAction('support',{status:e.target.value})}>
                      {['Open','In Progress','Waiting for Client','Resolved','Closed'].map(x=><option key={x}>{x}</option>)}
                    </select></label>
                    <label>Priority<select disabled={busy} value={selection.priority||'standard'} onChange={e=>doCaseAction('support',{priority:e.target.value})}>
                      <option value="standard">Standard</option><option value="urgent">Urgent</option></select></label>
                  </div>}
                  <div className="ips-ops-next-links"><Link to={toLink(selection)}>Open private support conversation <AdminIcon name="arrow" size={15}/></Link></div>
                </>}
                {selection.kind==='project'&&<>
                  <div className="ips-ops-facts">
                    <div><small>Linked quote</small><strong>{detail.details?.source_quote_id||'Unlinked'}</strong></div>
                    <div><small>Specialist</small><strong>{detail.details?.provider_name||'Not yet assigned'}</strong></div>
                    <div><small>Progress</small><strong>{Number(detail.details?.progress||0)}%</strong></div>
                    <div><small>Quality stage</small><strong>{selection.status}</strong></div>
                    <div><small>Payment</small><strong>Integration disabled</strong></div>
                    <div><small>Quotation</small><strong>{detail.details?.quote?.total?
                      Number(detail.details.quote.total).toLocaleString('en-GB',{style:'currency',currency:detail.details.quote.currency||'PLN'}):
                      'Not issued'}</strong></div>
                  </div>
                  <p className="ips-ops-hint">Specialist assignment, quotation approval and project status transitions remain governed by the academic project workspace. No payment is treated as collected.</p>
                  <div className="ips-ops-next-links">
                    <Link to={toLink(selection)}>Open academic delivery file <AdminIcon name="arrow" size={15}/></Link>
                    {detail.details?.source_quote_id&&<Link to={'/admin/enquiries?case='+encodeURIComponent(detail.details.source_quote_id)}>Open originating quotation <AdminIcon name="arrow" size={15}/></Link>}
                  </div>
                </>}
                {selection.kind==='telegram'&&<>
                  <div className="ips-ops-facts">
                    <div><small>Contact type</small><strong>Telegram</strong></div>
                    <div><small>Project verification</small><strong>{selection.verified?'Linked':'Not verified'}</strong></div>
                    <div><small>Unread</small><strong>{detail.details?.unread_count||0} messages</strong></div>
                    <div><small>Conversation state</small><strong>{selection.status}</strong></div>
                  </div>
                  {!selection.verified&&<p className="ips-ops-caution"><AdminIcon name="shield" size={17}/> Answer only customer-initiated general enquiries. Keep quotations, personal data and project files inside verified IPS workspaces.</p>}
                  <div className="ips-ops-next-links"><Link to={toLink(selection)}>Open Telegram reply desk <AdminIcon name="arrow" size={15}/></Link></div>
                </>}
              </section>
              <section className="ips-ops-section ips-ops-preview">
                <div className="ips-ops-section-heading"><div><span className="ips-ops-eyebrow">CASE HISTORY</span><h3>Recent activity</h3></div>
                  <button type="button" onClick={()=>setTab('activity')}>View timeline</button></div>
                {(detail.events||[]).length?(detail.events||[]).slice(0,3).map(x=><div key={x.id} className="ips-ops-preview-row">
                  <span className="ips-ops-event-dot"/><div><strong>{x.who}</strong><small>{fmt(x.at)} · {x.status}</small>
                    <p>{x.body?.slice(0,260)||'Activity recorded'}</p></div></div>):<div className="ips-ops-inline-empty">No messages or status changes have been recorded on this case yet.</div>}
              </section>
            </div>}
            {tab==='activity'&&<section className="ips-ops-section">
              <div className="ips-ops-section-heading"><h3>Recorded communication and case history</h3></div>
              {!(detail.events||[]).length&&<div className="ips-ops-inline-empty">No case events recorded. Notes and follow-up tasks are recorded separately and never sent to clients.</div>}
              {(detail.events||[]).map(x=><article className="ips-ops-event" key={x.id}>
                <span className="ips-ops-event-dot"/><div><div className="ips-ops-event-head"><strong>{x.who}</strong><small>{fmt(x.at)} · {x.status}</small></div>
                  <p>{x.body||'Status update'}</p></div></article>)}
            </section>}
            {(tab==='tasks'||tab==='notes')&&<section className="ips-ops-section">
              <div className="ips-ops-section-heading"><div><span className="ips-ops-eyebrow">PRIVATE STAFF WORK</span>
                <h3>{tab==='tasks'?'Follow-up tasks':'Internal case notes'}</h3>
                <p>Visible only to authorized IPS administration. Never transmitted to clients.</p></div></div>
              {(tab==='tasks'?tasks:notes).length===0&&
                <div className="ips-ops-inline-empty">No {tab==='tasks'?'follow-up tasks':'staff notes'} recorded for this case.</div>}
              {(tab==='tasks'?tasks:notes).map(x=><div className="ips-ops-action-row" key={x._id}>
                <span className={'ips-ops-action-mark '+(x.task_status==='done'?'finished':'')}><AdminIcon name={x.entry_kind==='task'?(x.task_status==='done'?'check':'clock'):'file'} size={18}/></span>
                <div style={{flex:1,minWidth:0}}><strong>{x.body}</strong>
                  <small>Assigned: {x.assigned_to||x.created_by} · recorded by {x.created_by} · {fmt(x.createdAt)}{x.due_at?' · Due '+fmt(x.due_at):''}
                    {x.entry_kind==='task'?' · '+x.task_status:''}</small></div>
                {x.entry_kind==='task'&&canManage&&<button className="ips-ops-task-toggle" disabled={busy}
                  onClick={()=>toggleTask(x)}>{x.task_status==='done'?'Reopen':'Complete'}</button>}
              </div>)}
            </section>}
            {(tab==='tasks'||tab==='notes')&&canManage&&<form className="ips-ops-action-editor" onSubmit={saveAction}>
              <div className="ips-ops-editor-tabs">
                <button type="button" aria-pressed={entryKind==='task'} onClick={()=>setEntryKind('task')}>New follow-up task</button>
                <button type="button" aria-pressed={entryKind==='note'} onClick={()=>setEntryKind('note')}>Private note</button>
              </div>
              <label><span>{entryKind==='task'?'Describe the next staff action':'Write a confidential internal note'}</span>
                <textarea required value={draft} onChange={e=>setDraft(e.target.value)} maxLength={2000} minLength={3}
                  placeholder={entryKind==='task'?'E.g. Review the brief and provide a written update to the client.':'Record a decision, context or a review finding. Not visible to the client.'}/></label>
              {entryKind==='task'&&<div className="ips-ops-editor-options">
                {staff.length>0&&<label>Assigned IPS staff
                  <select value={assignee||admin?.id||''} onChange={e=>setAssignee(e.target.value)}>
                    {!staff.some(x=>x.id===admin?.id)&&<option value={admin?.id||''}>Myself</option>}
                    {staff.map(x=><option value={x.id} key={x.id}>{x.name} · {x.role}</option>)}
                  </select>
                </label>}
                <label>Due date (optional)<input type="datetime-local" value={taskDate} onChange={e=>setTaskDate(e.target.value)}/></label>
                <label>Priority<select value={taskPriority} onChange={e=>setTaskPriority(e.target.value)}>
                  <option value="standard">Standard</option><option value="urgent">Urgent</option></select></label>
              </div>}
              <button disabled={busy||draft.trim().length<3} type="submit" className="ips-ops-primary">
                {busy?'Saving…':entryKind==='task'?'Add follow-up task':'Save private note'}
              </button>
            </form>}
            {tab==='brief'&&<section className="ips-ops-section ips-ops-finish">
              <div><span className="ips-ops-eyebrow">NEXT STEPS</span><h3>Keep the case moving</h3>
                <p>Record what needs to happen next, or switch to the correct secure conversation.</p></div>
              <div>
                {canManage&&<button type="button" onClick={()=>{setTab('tasks');setEntryKind('task');}}>Create follow-up</button>}
                <button type="button" onClick={()=>setTab('notes')}>Add private note</button>
              </div>
            </section>}
          </div>
        </>}
      </main>
    </div>
    <footer className="ips-ops-footnote">
      <AdminIcon name="lock" size={15}/> IPS internal operations. Client names are not required for quotation intake. WhatsApp is manual. Calls are not offered. Payments are not active.
    </footer>
  </section>;
}
