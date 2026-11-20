import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useAuth} from '../context/AuthContext.jsx';
import {request,useFeed,Title,Panel,Button,Tag,Notice,Empty,Dialog,dateTime} from './core.jsx';

const initialDraft={type:'client_admin',target:'',subject:'',work_id:''};
export default function PrivateConversations(){
  const {hasAdminPermission}=useAuth();
  const conversations=useFeed('/api/conversations','conversations',hasAdminPermission('messages.view'));
  const directory=useFeed('/api/messaging/directory','clients',hasAdminPermission('messages.view'));
  const [selected,setSelected]=useState(''),[thread,setThread]=useState(null),[messages,setMessages]=useState([]),
    [viewer,setViewer]=useState(''),[search,setSearch]=useState(''),[body,setBody]=useState(''),
    [attachments,setAttachments]=useState([]),[draft,setDraft]=useState(initialDraft),[create,setCreate]=useState(false),
    [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const endRef=useRef(null);
  const active=conversations.records||[];
  const filtered=useMemo(()=>active.filter(x=>(x.subject+' '+x.work_id+' '+(x.last_message_preview||'')+
    ' '+(x.participants||[]).map(p=>p.name).join(' ')).toLowerCase().includes(search.toLowerCase())),[conversations.records,search]);
  const allowed=hasAdminPermission('messages.manage');
  async function loadThread(id){
    if(!id){setThread(null);setMessages([]);return;}
    try{const res=await request('/api/conversations/'+encodeURIComponent(id)+'/messages');
      setThread(res.conversation);setMessages(res.messages||[]);setViewer(res.viewer_id||'');}
    catch(e){setError(e.message);}
  }
  useEffect(()=>{if(!selected&&active[0]?.conversation_id)setSelected(active[0].conversation_id);},[conversations.records,selected]);
  useEffect(()=>{if(selected)void loadThread(selected);},[selected]);
  useEffect(()=>{
    if(!selected)return;
    const poll=setInterval(()=>{if(document.visibilityState==='visible'){void loadThread(selected);conversations.refresh();}},15000);
    return()=>clearInterval(poll);
  },[selected]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth',block:'end'});},[messages.length,selected]);
  function choose(id){setSelected(id);setError('');setNotice('');setBody('');setAttachments([]);}
  async function encodeFiles(ev){
    const files=Array.from(ev.target.files||[]);ev.target.value='';
    if(files.length>3||files.some(f=>f.size>10*1024*1024)||files.reduce((s,f)=>s+f.size,0)>20*1024*1024)
      return setError('Limit: three attached files, maximum 10 MB each and 20 MB together.');
    try{const all=await Promise.all(files.map(file=>new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onerror=reject;reader.onload=()=>resolve({
        name:file.name,mime_type:file.type,size:file.size,data:reader.result
      });reader.readAsDataURL(file);
    })));setAttachments(all);setError('');}
    catch{setError('A selected file could not be prepared securely.');}
  }
  async function send(e){
    e.preventDefault();if(!allowed||!selected||(!body.trim()&&!attachments.length)||busy)return;
    setBusy(true);setError('');setNotice('');
    try{await request('/api/conversations/'+encodeURIComponent(selected)+'/messages',
      {method:'POST',body:{body:body.trim(),attachments}});
      setBody('');setAttachments([]);await loadThread(selected);conversations.refresh();
      setNotice('Message and any attachments were saved in the authorized IPS conversation.');}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function mutate(payload){
    if(!allowed||!selected||busy)return;
    setBusy(true);setError('');
    try{const result=await request('/api/conversations/'+encodeURIComponent(selected),{method:'PATCH',body:payload});
      setThread(result.conversation);conversations.refresh();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function make(e){
    e.preventDefault();if(!allowed||busy)return;
    const [target_role,target_id]=draft.target.split('|');
    if(!target_role||!target_id||!draft.subject.trim())return;
    setBusy(true);setError('');
    try{const result=await request('/api/conversations',{method:'POST',
      body:{...draft,target_role,target_id}});
      setCreate(false);setDraft(initialDraft);
      setSelected(result.conversation.conversation_id);conversations.refresh();
      setNotice('A new confidential IPS conversation was created for a verified recipient.');}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const roster=directory.payload||{clients:[],providers:[],jobs:[]};
  const recipients=draft.type==='writer_admin'?roster.providers||[]:roster.clients||[];
  return <>
    <Title kicker="IPS PRIVATE COMMUNICATION / ACCOUNTABLE MESSAGING" title="Secure company conversations"
      description="Direct, authenticated IPS messages with approved recipients, attached academic files, real history, responsibility and status. No public chat leaks."
      actions={<><Button onClick={()=>{conversations.refresh();directory.refresh();if(selected)void loadThread(selected);}}>Refresh messages</Button>
        {allowed&&<Button kind="gold" onClick={()=>setCreate(true)}>New private conversation</Button>}</>}/>
    {conversations.error&&<Notice kind="danger">{conversations.error}</Notice>}
    {error&&<Notice kind="danger">{error}</Notice>}{notice&&<Notice>{notice}</Notice>}
    <div className="ips4-record-layout">
      <Panel title={'IPS conversations'+(conversations.available?' ('+active.length+')':'')} description="Recipients are constrained by verified IPS account and project permissions.">
        <div className="ips4-toolbar"><input type="search" placeholder="Find conversation or service…" aria-label="Find private conversation" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <div className="ips4-record-list">{!conversations.available?<Empty>Reading authenticated correspondence…</Empty>:!filtered.length?<Empty>There are no conversations matching your search.</Empty>:
          filtered.map(t=><button type="button" key={t.conversation_id} className="ips4-record-entry" aria-pressed={selected===t.conversation_id} onClick={()=>choose(t.conversation_id)}>
            <span>{t.work_id||'PRIVATE COMPANY CHAT'}</span><strong>{t.subject||'IPS private conversation'}</strong>
            <small>{t.last_message_preview||'No messages recorded yet'}</small>
            <Tag tone={t.priority==='urgent'?'danger':t.status==='resolved'?'good':'neutral'}>{t.status||'open'}</Tag>
          </button>)}</div>
      </Panel>
      <Panel title={thread?.subject||'Choose a private correspondence'} description={thread?'Verified company conversation · '+(thread.work_id||'Direct'):''}>
        {!thread?<Empty>Select a conversation to inspect and reply to its protected messages.</Empty>:<>
          <div className="ips4-row"><div><strong>Participants</strong><small>{(thread.participants||[]).map(x=>x.name||x.role).join(' ↔ ')}</small></div>
            <Tag tone={thread.status==='resolved'?'good':'neutral'}>{thread.status||'open'}</Tag></div>
          {allowed&&<div className="ips4-toolbar">
            <label className="ips4-field">Priority<select value={thread.priority||'normal'} onChange={e=>void mutate({priority:e.target.value})}>
              <option>normal</option><option>important</option><option>urgent</option></select></label>
            <Button disabled={busy} onClick={()=>void mutate({status:thread.status==='resolved'?'open':'resolved'})}>{thread.status==='resolved'?'Reopen':'Resolve'}</Button>
            <Button disabled={busy} onClick={()=>void mutate({archived:true})}>Archive</Button>
          </div>}
          <div className="ips4-chat" aria-label="Secure IPS message history">
            {!messages.length?<Empty>No private correspondence has been recorded yet.</Empty>:messages.map((m,i)=>
              <div key={m._id||i} className={'ips4-bubble'+(m.sender_id===viewer?' sent':'')}>
                <small>{m.sender_name||m.sender_id||'IPS participant'} · {dateTime(m.createdAt||m.created_at)}</small>
                {m.body||'[File attachment]'}
                {(m.attachments||[]).map((file,index)=><a key={file.stored_name||index}
                  href={'/api/conversation-files/'+encodeURIComponent(thread.conversation_id)+'/'+encodeURIComponent(m._id)+'/'+index}
                  style={{display:'block',color:'inherit',textDecoration:'underline',marginTop:8}}>Attachment: {file.original_name||'Protected document'} ({Math.ceil(Number(file.size||0)/1024)} KB)</a>)}
              </div>)}
            <div ref={endRef}/>
          </div>
          {allowed&&thread.status!=='resolved'&&<form className="ips4-form" style={{marginTop:17}} onSubmit={send}>
            <label className="ips4-field">Write authenticated IPS message
              <textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={5000} placeholder="A complete written update, request for clarification or specialist instruction…"/></label>
            <label className="ips4-field">Protected document attachments — maximum 3 files
              <input type="file" multiple onChange={encodeFiles} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"/></label>
            {attachments.length>0&&<div className="ips4-note info">{attachments.map(x=>x.name).join(', ')} <Button onClick={()=>setAttachments([])}>Clear files</Button></div>}
            <Button kind="gold" type="submit" disabled={busy||(!body.trim()&&!attachments.length)}>{busy?'Sending…':'Send private IPS message'}</Button>
          </form>}
          {!allowed&&<div className="ips4-note info">You can read but cannot send: your department does not hold messages.manage authority.</div>}
        </>}
      </Panel>
    </div>
    {create&&<Dialog title="Start a verified company conversation" subtitle="The recipient must exist in the authorized IPS messaging directory." onClose={()=>setCreate(false)}>
      <form className="ips4-form" onSubmit={make}>
        <label className="ips4-field">Recipient class<select value={draft.type} onChange={e=>setDraft({...draft,type:e.target.value,target:''})}>
          <option value="client_admin">Verified client</option><option value="writer_admin">Approved specialist</option></select></label>
        <label className="ips4-field">Verified recipient<select value={draft.target} required onChange={e=>setDraft({...draft,target:e.target.value})}>
          <option value="">Select an authorized recipient</option>{recipients.map(x=>{
            const targetRole=draft.type==='writer_admin'?'writer':'client';const id=x.writer_id||x.client_id||x.id;
            return <option key={targetRole+'|'+id} value={targetRole+'|'+id}>{x.username||x.full_name||x.name||id} · {id}</option>;
          })}</select></label>
        <label className="ips4-field">Subject<input required maxLength={180} value={draft.subject} onChange={e=>setDraft({...draft,subject:e.target.value})}/></label>
        <label className="ips4-field">Linked authorized academic project (optional)<select value={draft.work_id} onChange={e=>setDraft({...draft,work_id:e.target.value})}>
          <option value="">No project link</option>{(roster.jobs||[]).filter(x=>x.direct_contact_enabled).map(x=><option key={x.request_id||x.work_id} value={x.request_id||x.work_id}>{x.title||x.request_id||x.work_id}</option>)}</select></label>
        <Button type="submit" kind="gold" disabled={busy||!draft.target||!draft.subject.trim()}>Open protected conversation</Button>
        {error&&<Notice kind="danger">{error}</Notice>}
      </form>
    </Dialog>}
  </>;
}
