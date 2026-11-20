import React,{useEffect,useMemo,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useAuth} from '../context/AuthContext.jsx';
import {request,useFeed,useAction,Title,Panel,Button,LinkButton,Tag,Notice,Empty,dateTime} from './core.jsx';
import {isOpenCompanyCase,isOverdueCompanyCase,needsCompanyCaseOwner,requiresManagementAttention} from '../../shared/companyPulse.js';

const VIEWS=[['attention','Decisions'],['open','Open'],['overdue','Overdue'],['unowned','No owner'],
  ['enquiry','Enquiries'],['project','Projects'],['support','Support'],['telegram','Telegram'],['all','All cases']];
const kindInfo={enquiry:'Client enquiry',project:'Academic production',support:'Support',telegram:'Telegram'};
const caseKey=c=>c.kind+':'+c.ref;
const linkFor=c=>c.kind==='enquiry'?'/admin/enquiries?case='+encodeURIComponent(c.ref):
  c.kind==='support'?'/admin/support?ticket='+encodeURIComponent(c.ref):
  c.kind==='telegram'?'/admin/external-chats?thread='+encodeURIComponent(c.ref):
  '/admin/services/'+encodeURIComponent(c.ref);
const permissionFor={enquiry:'support.manage',project:'services.manage',support:'support.manage',telegram:'messages.manage'};
export default function OperationsBoard({initialView}){
  const {admin,hasAdminPermission}=useAuth();
  const [params,setParams]=useSearchParams(),view=params.get('view')||initialView||'attention';
  const source=useFeed('/api/admin/company-cases','cases');
  const team=useFeed('/api/admin/company-cases/staff','staff',hasAdminPermission('team.manage'));
  const [search,setSearch]=useState(''),[selected,setSelected]=useState(null),[detail,setDetail]=useState(null),
    [loading,setLoading]=useState(false),[detailError,setDetailError]=useState(''),
    [entryKind,setEntryKind]=useState('task'),[entryText,setEntryText]=useState(''),
    [assignee,setAssignee]=useState(admin?.id||''),[priority,setPriority]=useState('standard'),[due,setDue]=useState('');
  const action=useAction(source.refresh),caseList=source.records||[];
  const requested=params.get('case')||'';
  const filtered=useMemo(()=>caseList.filter(c=>{
    if(view==='attention'&&!requiresManagementAttention(c))return false;
    if(view==='open'&&!isOpenCompanyCase(c))return false;
    if(view==='unowned'&&!needsCompanyCaseOwner(c))return false;
    if(view==='overdue'&&!isOverdueCompanyCase(c))return false;
    if(['enquiry','project','support','telegram'].includes(view)&&c.kind!==view)return false;
    const q=search.trim().toLowerCase();
    return !q||[c.subject,c.ref,c.person,c.status,c.owner].join(' ').toLowerCase().includes(q);
  }).sort((a,b)=>Number(requiresManagementAttention(b))-Number(requiresManagementAttention(a))||Date.parse(b.updated_at||0)-Date.parse(a.updated_at||0)),[source.records,view,search]);
  const focused=caseList.find(c=>caseKey(c)===requested)||null;
  const editable=focused&&hasAdminPermission(permissionFor[focused.kind]);
  function setFocus(c){
    const query=new URLSearchParams(params);
    if(c)query.set('case',caseKey(c));else query.delete('case');
    setParams(query);setSelected(c?caseKey(c):'');setDetail(null);setEntryText('');action.setError('');action.setNotice('');
  }
  function setView(next){const query=new URLSearchParams(params);query.set('view',next);query.delete('case');setParams(query);}
  const path=focused?'/api/admin/company-cases/'+focused.kind+'/'+encodeURIComponent(focused.ref):null;
  async function reloadDetail(){
    if(!path)return;setLoading(true);setDetailError('');
    try{setDetail(await request(path));}catch(e){setDetailError(e.message);}finally{setLoading(false);}
  }
  useEffect(()=>{if(path){void reloadDetail();}else{setDetail(null);}},[path]);
  async function recordTask(e){
    e.preventDefault();if(!focused||!editable||entryText.trim().length<3)return;
    const okay=await action.run(path+'/actions','POST',
      {entry_kind:entryKind,body:entryText.trim(),priority,
        ...(entryKind==='task'&&due?{due_at:new Date(due).toISOString()}:{}),
        ...(entryKind==='task'&&assignee?{assigned_to:assignee}:{})},
      'The follow-up was recorded in the protected source case. No customer message was sent.');
    if(okay){setEntryText('');setDue('');await reloadDetail();}
  }
  const notes=detail?.actions||[],events=detail?.events||[];
  return <>
    <Title kicker="WORK EXECUTION / ONE ACCOUNTABLE CASE FILE" title="Decisions, ownership and next actions"
      description="Every task is tied to an actual enquiry, support case, project or Telegram thread. No managerial action disappears into a generic dashboard."
      actions={<Button onClick={()=>{source.refresh();void reloadDetail();}} disabled={source.busy}>Refresh accountable work</Button>}/>
    {source.error&&<Notice kind="danger">{source.error}</Notice>}
    <div className="ips4-toolbar">{VIEWS.map(([id,label])=><button key={id} type="button" className="ips4-tab" aria-pressed={view===id} onClick={()=>setView(id)}>{label}</button>)}</div>
    <div className="ips4-record-layout">
      <Panel title={'Company queue · '+filtered.length} description="Only the cases and workstreams your delegated authority permits.">
        <div className="ips4-toolbar"><input type="search" aria-label="Search company work" placeholder="Search case, person or reference…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <div className="ips4-record-list">{!source.available?<Empty>{source.busy?'Reading verified company work…':'Company case feed unavailable.'}</Empty>:
          !filtered.length?<Empty>No matching cases. Choose another work queue.</Empty>:
          filtered.map(c=><button type="button" key={caseKey(c)} className="ips4-record-entry" aria-pressed={requested===caseKey(c)} onClick={()=>setFocus(c)}>
            <span>{kindInfo[c.kind]||c.kind} · {c.ref}</span>
            <strong>{c.subject||'Confidential company case'}</strong>
            <small>{c.status} · {c.owner||'No recorded owner'} · {dateTime(c.updated_at)}</small>
            <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
              {isOverdueCompanyCase(c)&&<Tag tone="danger">Deadline missed</Tag>}
              {needsCompanyCaseOwner(c)&&<Tag tone="warn">Needs owner</Tag>}
              {c.new_message&&<Tag tone="good">New message</Tag>}
            </div></button>)}</div>
      </Panel>
      <Panel title={focused?.subject||'Choose a company case'} description={focused?focused.ref+' · '+kindInfo[focused.kind]:'Review the actual business record and decide who is responsible.'}>
        {!focused?<Empty>Select an authentic company case to open its timeline, owner, contact verification and durable internal follow-up actions.</Empty>:
        <>
          <div className="ips4-detail-facts">{[['Current status',focused.status],['Accountable person',focused.owner||'Not allocated'],
            ['Contact verification',focused.verified?'Verified':'Not verified'],['Next deadline',dateTime(focused.due_at)],
            ['Open internal tasks',String(focused.tasks?.open||0)],['Overdue tasks',String(focused.tasks?.overdue||0)]].map(([k,v])=>
            <div className="ips4-fact" key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>
          {focused.kind==='enquiry'&&!focused.verified&&<div className="ips4-blocked"><div><strong>Consent/verification is missing</strong><p>Review general enquiry information only. Do not transmit a private quote, file or academic record to an unverified contact.</p></div></div>}
          <div className="ips4-toolbar"><LinkButton to={linkFor(focused)} kind="gold">Open responsible service desk →</LinkButton>
            {editable&&focused.kind==='enquiry'&&!focused.owner&&focused.verified&&<Button disabled={action.pending} onClick={async()=>{
              const ok=await action.run('/api/contact-enquiries/admin/'+encodeURIComponent(focused.ref)+'/claim','POST',{},'You are now accountable for this verified enquiry.');
              if(ok)await reloadDetail();}}>Take case ownership</Button>}</div>
          {loading&&<Empty>Opening case evidence…</Empty>}{detailError&&<Notice kind="danger">{detailError}</Notice>}
          <div className="ips4-stack" style={{marginTop:16}}>
            <div><h3 style={{fontSize:15,marginBottom:10}}>Activity history</h3>
              <div className="ips4-chat" style={{maxHeight:245}}>
                {!events.length?<Empty>No recorded external messages or status changes.</Empty>:events.map(e=>
                  <div className={'ips4-bubble'+(e.type==='outbound'?' sent':'')} key={e.id}>
                    <small>{e.who} · {dateTime(e.at)} · {e.status||'Recorded'}</small>{e.body||'Case event'}
                  </div>)}</div>
            </div>
            <div><h3 style={{fontSize:15,marginBottom:10}}>Internal action register</h3>
              {!notes.length?<Empty>No internal notes or tasks recorded on this case.</Empty>:notes.map(note=>
                <div key={note._id} className="ips4-row"><div className="ips4-row-text"><strong>{note.body}</strong>
                  <small>{note.entry_kind} · {note.created_by} · {dateTime(note.createdAt)}{note.due_at?' · Due '+dateTime(note.due_at):''}</small></div>
                  {note.entry_kind==='task'&&editable&&<Button disabled={action.pending} onClick={async()=>{
                    const ok=await action.run(path+'/tasks/'+note._id,'PATCH',{task_status:note.task_status==='done'?'open':'done'},'Task state updated.');
                    if(ok)await reloadDetail();}}>{note.task_status==='done'?'Reopen':'Complete'}</Button>}
                </div>)}
            </div>
            {editable&&<form className="ips4-form" onSubmit={recordTask}>
              <div className="ips4-toolbar">{[['task','Follow-up task'],['note','Confidential note']].map(([k,v])=>
                <button type="button" key={k} className="ips4-tab" aria-pressed={entryKind===k} onClick={()=>setEntryKind(k)}>{v}</button>)}</div>
              <label className="ips4-field">{entryKind==='task'?'Accountable next action':'Private staff note'}
                <textarea required maxLength={2000} minLength={3} value={entryText} onChange={e=>setEntryText(e.target.value)} placeholder="Record a concrete next action, not an empty status label…"/></label>
              {entryKind==='task'&&<div className="ips4-fields">
                <label className="ips4-field">Due by<input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></label>
                <label className="ips4-field">Priority<select value={priority} onChange={e=>setPriority(e.target.value)}><option value="standard">Standard</option><option value="urgent">Urgent</option></select></label>
                {team.records?.length>0&&<label className="ips4-field">Responsible colleague<select value={assignee} onChange={e=>setAssignee(e.target.value)}>
                  <option value={admin?.id||''}>My executive / personal follow-up</option>
                  {team.records.filter(t=>t.id!==admin?.id).map(t=><option value={t.id} key={t.id}>{t.name}</option>)}
                </select></label>}
              </div>}
              <Button type="submit" kind="gold" disabled={action.pending||entryText.trim().length<3}>Save internal {entryKind==='task'?'task':'note'}</Button>
              {action.error&&<Notice kind="danger">{action.error}</Notice>}{action.notice&&<Notice>{action.notice}</Notice>}
              <small style={{color:'var(--faint)'}}>Notes are confidential. Saving this form never contacts the client.</small>
            </form>}
          </div>
        </>}
      </Panel>
    </div>
  </>;
}
