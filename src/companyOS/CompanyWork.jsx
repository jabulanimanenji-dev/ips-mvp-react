import React,{useEffect,useMemo,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useAuth} from '../context/AuthContext.jsx';
import AdminIcon from '../components/admin/AdminIcon.jsx';
import {PageHeading,Panel,ErrorState,Empty,Refresh,Status,useCompanyResource,companyRequest} from './data.jsx';
import {CASE_TYPES,caseKey,caseOpen,caseLate,caseNeedsOwner,caseNeedsDecision,shortDate,caseUrl} from './model.js';
const FILTERS=[['open','Open work'],['priority','Decisions'],['unowned','Unassigned'],['overdue','Overdue'],['enquiry','Quotations'],['project','Projects'],['support','Support'],['telegram','Telegram'],['all','All']];

export default function CompanyWork({initialFilter}){
  const {admin,hasAdminPermission}=useAuth();
  const [params,setParams]=useSearchParams();
  const source=useCompanyResource('/api/admin/company-cases','cases');
  const staff=useCompanyResource('/api/admin/company-cases/staff','staff',hasAdminPermission('team.manage'));
  const requested=params.get('case')||'';
  const filter=params.get('filter')||initialFilter||'open';
  const [search,setSearch]=useState(''),[detail,setDetail]=useState(null),[loadingDetail,setLoadingDetail]=useState(false),
    [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),
    [note,setNote]=useState(''),[entryKind,setEntryKind]=useState('task'),[due,setDue]=useState(''),
    [priority,setPriority]=useState('standard'),[assigned,setAssigned]=useState(admin?.id||''),[tab,setTab]=useState('brief');
  const cases=source.value||[];
  const sorted=useMemo(()=>cases.filter(c=>{
    if(filter==='open'&&!caseOpen(c))return false;
    if(filter==='priority'&&!caseNeedsDecision(c))return false;
    if(filter==='unowned'&&!caseNeedsOwner(c))return false;
    if(filter==='overdue'&&!caseLate(c))return false;
    if(CASE_TYPES[filter]&&c.kind!==filter)return false;
    const q=search.trim().toLowerCase();
    return !q||[c.subject,c.ref,c.person,c.status,c.kind,c.owner].join(' ').toLowerCase().includes(q);
  }).sort((a,b)=>Number(caseNeedsDecision(b))-Number(caseNeedsDecision(a))||
    Number(caseLate(b))-Number(caseLate(a))||
    Date.parse(b.updated_at||0)-Date.parse(a.updated_at||0)),[source.value,filter,search]);
  const selected=cases.find(c=>caseKey(c)===requested)||null;
  const authorized=selected&&hasAdminPermission(CASE_TYPES[selected.kind]?.manage||'unknown');
  const url=selected?'/api/admin/company-cases/'+selected.kind+'/'+encodeURIComponent(selected.ref):'';
  function choose(c){const next=new URLSearchParams(params);next.set('case',caseKey(c));setParams(next);setTab('brief');setNotice('');setError('');}
  function changeFilter(x){const next=new URLSearchParams(params);next.set('filter',x);next.delete('case');setParams(next);}
  useEffect(()=>{
    if(!selected){setDetail(null);return;}
    let active=true;const controller=new AbortController();
    setLoadingDetail(true);setError('');setDetail(null);
    companyRequest(url,{signal:controller.signal}).then(x=>{if(active)setDetail(x);}).catch(e=>{if(active&&e.name!=='AbortError')setError(e.message);}).finally(()=>{if(active)setLoadingDetail(false);});
    return()=>{active=false;controller.abort();};
  },[url]);
  async function act(path,method,payload,message){
    if(busy||!selected||!authorized)return;
    setBusy(true);setError('');setNotice('');
    try{
      await companyRequest(path,{method,body:JSON.stringify(payload)});
      const fresh=await companyRequest(url);
      setDetail(fresh);source.refresh();
      setNotice(message||'Saved to the company record.');
      return true;
    }catch(e){setError(e.message);return false;}finally{setBusy(false);}
  }
  async function saveAction(e){
    e.preventDefault();if(note.trim().length<3)return;
    const payload={entry_kind:entryKind,body:note.trim(),priority,
      ...(entryKind==='task'&&due?{due_at:new Date(due).toISOString()}:{}),
      ...(entryKind==='task'&&assigned?{assigned_to:assigned}:{})};
    const saved=await act(url+'/actions','POST',payload,'The internal '+(entryKind==='note'?'note':'follow-up')+' is recorded.');
    if(saved){setNote('');setDue('');}
  }
  const actions=detail?.actions||[];
  const tabActions=actions.filter(x=>x.entry_kind===(tab==='notes'?'note':'task'));
  const nextLinks=selected?.kind==='enquiry'?['Quotation & private reply','/admin/enquiries?case='+encodeURIComponent(selected.ref)]:
    selected?.kind==='project'?['Detailed delivery controls','/admin/services/'+encodeURIComponent(selected.ref)]:
    selected?.kind==='support'?['Client support conversation','/admin/support?ticket='+encodeURIComponent(selected.ref)]:
    ['Telegram conversation','/admin/external-chats?thread='+encodeURIComponent(selected?.ref||'')];
  return <>
    <PageHeading eyebrow="WORK COMMAND / ACCOUNTABILITY" title="One company work queue"
      description="Every record has a responsible person, next decision, case history and follow-up. New client work stays confidential until consent and verification.">
      <Refresh onClick={()=>{source.refresh();if(selected)companyRequest(url).then(setDetail).catch(e=>setError(e.message));}} loading={source.loading}/>
    </PageHeading>
    <ErrorState error={source.error} retry={source.refresh}/>
    <div className="os-pill-bar" aria-label="Filter accountable company work">
      {FILTERS.map(([id,label])=><button key={id} type="button" className="os-pill" aria-pressed={filter===id} onClick={()=>changeFilter(id)}>{label}</button>)}
    </div>
    <div className="os-case-workspace">
      <section className="os-panel" aria-label="Work case list">
        <div className="os-panel-head"><h2>{FILTERS.find(([id])=>id===filter)?.[1]||'Cases'} <span style={{color:'var(--o-gold)'}}>{sorted.length}</span></h2></div>
        <label className="os-field" htmlFor="os-case-search">Find case or reference
          <input id="os-case-search" className="os-input" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search your authorized work…"/>
        </label>
        <div className="os-case-list" style={{marginTop:15}}>
          {source.loading&&!source.value?<Empty>Loading genuine company records…</Empty>:
          sorted.length===0?<Empty>No records match. Try All or another workstream.</Empty>:
          sorted.map(c=><button key={caseKey(c)} type="button" className={'os-case-item'+(requested===caseKey(c)?' selected':'')} onClick={()=>choose(c)}>
            <span className="os-eyebrow">{CASE_TYPES[c.kind]?.label||c.kind} · {c.ref}</span>
            <strong>{c.subject||'Confidential case'}</strong>
            <small>{c.status} · {c.owner||'Unassigned'} · {shortDate(c.due_at)}</small>
            <span style={{display:'flex',gap:6,flexWrap:'wrap'}}>{caseLate(c)&&<Status tone="bad">Overdue</Status>}
              {caseNeedsOwner(c)&&<Status tone="warn">No owner</Status>}
              {c.new_message&&<Status>Unread message</Status>}</span>
          </button>)}
        </div>
      </section>
      <section className="os-stack" aria-label="Selected company case">
        {!selected?<div className="os-panel"><span className="os-eyebrow">SELECT A REAL COMPANY RECORD</span>
          <h2 style={{fontSize:25,margin:'13px 0'}}>An accountable case file, not another dashboard.</h2>
          <p className="os-lead">Choose a case to review its owner, customer consent, next deadline, work history, private notes and follow-up tasks. Only staff with management authority can change it.</p>
          {sorted.length>0&&<button className="os-action" type="button" onClick={()=>choose(sorted[0])}>Open first case <AdminIcon name="arrow" size={16}/></button>}
        </div>:<>
          <div className="os-panel">
            <div className="os-panel-head"><span className="os-eyebrow">{selected.kind.toUpperCase()} / {selected.ref}</span><Status tone={caseLate(selected)?'bad':caseNeedsOwner(selected)?'warn':'good'}>{selected.status}</Status></div>
            <h2 style={{fontSize:24,margin:'8px 0 10px'}}>{selected.subject}</h2>
            <p className="os-lead">{selected.person||'Confidential contact'} · {selected.channel||'IPS workspace'}</p>
            <div className="os-facts">
              {[['Accountable person',selected.owner||'Not assigned'],['Next response deadline',shortDate(selected.due_at)],
              ['Contact authorization',selected.verified?'Verified':selected.kind==='enquiry'?'Consent / verification pending':'Role governed'],
              ['Open tasks',String(selected.tasks?.open||0)]].map(([l,v])=><div className="os-fact" key={l}><small>{l}</small><strong>{v}</strong></div>)}
            </div>
            {selected.kind==='enquiry'&&!selected.verified&&<div className="os-command-note"><AdminIcon name="lock" size={16}/> Do not send private academic material or quotations before verified consent and channel authorization.</div>}
            <div className="os-pill-bar">{[['brief','Brief'],['timeline','Activity'],['tasks','Tasks'],['notes','Private notes']].map(([id,label])=>
              <button key={id} type="button" className="os-pill" aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</div>
            {loadingDetail&&<Empty>Opening the protected source record…</Empty>}
            <ErrorState error={error} retry={()=>{source.refresh();}}/>
            {notice&&<div className="os-notice" role="status">{notice}</div>}
            {detail&&tab==='brief'&&<>
              <div className="os-facts">
                {Object.entries(selected.kind==='enquiry'?{Service:detail.details?.service||'Not supplied',
                  Discipline:detail.details?.discipline||'Not supplied',Level:detail.details?.study_level||'Not supplied',
                  'Linked project':detail.details?.service_request_id||'Not yet linked'}:
                  selected.kind==='project'?{'Linked quote':detail.details?.source_quote_id||'Not linked',
                  Specialist:detail.details?.provider_name||'Not assigned',Progress:(detail.details?.progress||0)+'%',
                  'Payment verification':detail.details?.payment?.status||'Not verified'}:
                  selected.kind==='support'?{'Support category':detail.details?.category||'General',
                    'Assigned staff':detail.details?.assigned_admin||'Unassigned'}:
                  {'Unread messages':detail.details?.unread_count||0}).map(([l,v])=>
                  <div className="os-fact" key={l}><small>{l}</small><strong>{String(v)}</strong></div>)}
              </div>
              {authorized&&selected.kind==='enquiry'&&<>
                {!selected.owner&&selected.verified&&caseOpen(selected)&&<button type="button" className="os-action" disabled={busy} onClick={()=>act('/api/contact-enquiries/admin/'+encodeURIComponent(selected.ref)+'/claim','POST',{},'Case ownership accepted.')}>Take ownership of verified enquiry</button>}
                <div className="os-fields os-section-gap"><label className="os-field">Quotation status
                  <select className="os-input" disabled={busy} value={selected.status} onChange={e=>act('/api/contact-enquiries/admin/'+encodeURIComponent(selected.ref),'PATCH',{status:e.target.value},'Enquiry state updated.')}>
                    {['new','in_progress','waiting_for_customer','closed'].map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}
                  </select></label>
                  <label className="os-field">Next written update <input className="os-input" type="datetime-local" onChange={e=>{if(e.target.value)act('/api/contact-enquiries/admin/'+encodeURIComponent(selected.ref),'PATCH',{next_update_at:new Date(e.target.value).toISOString()},'Follow-up time saved.');}}/></label>
                </div>
              </>}
              {authorized&&selected.kind==='support'&&<div className="os-fields os-section-gap">
                <label className="os-field">Support status<select className="os-input" value={selected.status} disabled={busy} onChange={e=>act('/api/support-tickets/'+encodeURIComponent(selected.ref),'PATCH',{status:e.target.value},'Support status updated.')}>{['Open','In Progress','Waiting for Client','Resolved','Closed'].map(x=><option key={x}>{x}</option>)}</select></label>
                <label className="os-field">Priority<select className="os-input" value={selected.priority||'standard'} disabled={busy} onChange={e=>act('/api/support-tickets/'+encodeURIComponent(selected.ref),'PATCH',{priority:e.target.value},'Priority updated.')}><option value="standard">Standard</option><option value="urgent">Urgent</option></select></label>
                {!selected.owner&&<button className="os-action secondary" type="button" disabled={busy} onClick={()=>act('/api/support-tickets/'+encodeURIComponent(selected.ref),'PATCH',{assigned_admin:admin?.id},'Assigned to you.')}>Assign to myself</button>}
              </div>}
              {selected.kind==='project'&&<div className="os-command-note">Academic project assignments and delivery require verified payment and an eligible specialist. Never forge client acceptance or mark unpaid work paid.</div>}
              <Link className="os-action secondary os-section-gap" to={nextLinks[1]}>{nextLinks[0]} <AdminIcon name="arrow" size={16}/></Link>
            </>}
            {detail&&tab==='timeline'&&(!(detail.events||[]).length?<Empty>No recorded external events for this case yet.</Empty>:
              detail.events.map((e,i)=><div className="os-timeline-item" key={e.id||i}><strong>{e.who} · {shortDate(e.at)} · {e.status}</strong><p>{e.body||'Action recorded'}</p></div>))}
            {detail&&(tab==='tasks'||tab==='notes')&&<>
              {!tabActions.length?<Empty>No {tab==='tasks'?'follow-up tasks':'private notes'} recorded.</Empty>:tabActions.map(a=><div className="os-row" key={a._id}>
                <div><strong>{a.body}</strong><small>{a.created_by} · {shortDate(a.createdAt)} {a.due_at?'· Due '+shortDate(a.due_at):''} {a.assigned_to?'· Assigned '+a.assigned_to:''}</small></div>
                {a.entry_kind==='task'&&authorized&&<button className="os-action secondary" type="button" disabled={busy} onClick={()=>act(url+'/tasks/'+a._id,'PATCH',{task_status:a.task_status==='done'?'open':'done'},'Task updated.')}>{a.task_status==='done'?'Reopen':'Complete'}</button>}
              </div>)}
              {authorized&&<form onSubmit={saveAction} className="os-stack os-section-gap">
                <div className="os-pill-bar"><button type="button" className="os-pill" aria-pressed={entryKind==='task'} onClick={()=>setEntryKind('task')}>Follow-up task</button><button type="button" className="os-pill" aria-pressed={entryKind==='note'} onClick={()=>setEntryKind('note')}>Private note</button></div>
                <label className="os-field">Internal {entryKind==='task'?'task':'note'} — never transmitted to clients
                  <textarea className="os-input" minLength={3} maxLength={2000} required value={note} onChange={e=>setNote(e.target.value)}/></label>
                {entryKind==='task'&&<div className="os-fields">
                  <label className="os-field">Due date<input className="os-input" type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></label>
                  <label className="os-field">Priority<select className="os-input" value={priority} onChange={e=>setPriority(e.target.value)}><option>standard</option><option>urgent</option></select></label>
                  {!!staff.value?.length&&<label className="os-field">Accountable staff<select className="os-input" value={assigned} onChange={e=>setAssigned(e.target.value)}><option value={admin?.id||''}>Myself</option>{staff.value.filter(x=>x.id!==admin?.id).map(x=><option key={x.id} value={x.id}>{x.name} · {x.role}</option>)}</select></label>}
                </div>}
                <button type="submit" className="os-action" disabled={busy||note.trim().length<3}>{busy?'Saving…':'Record '+(entryKind==='task'?'task':'confidential note')}</button>
              </form>}
            </>}
          </div>
        </>}
      </section>
    </div>
  </>;
}
