import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function DirectMessaging({ role }) {
  const { admin, writer, user } = useAuth();
  const actor = role === 'admin' ? admin : role === 'writer' ? writer : user;
  const headers = actor?.token ? { Authorization: `Bearer ${actor.token}` } : {};
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [viewerId, setViewerId] = useState('');
  const [directory, setDirectory] = useState({ clients: [], providers: [], jobs: [] });
  const [query, setQuery] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({ subject: '', type: role === 'client' ? 'client_admin' : role === 'writer' ? 'writer_admin' : 'client_admin', target: '', work_id: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  const loadConversations = useCallback(async () => {
    const response = await fetch('/api/conversations', { headers });
    const data = await response.json();
    if (!response.ok) return setError(data.error || 'Could not load conversations.');
    setConversations(data.conversations || []);
    if (!selectedId && data.conversations?.length) setSelectedId(data.conversations[0].conversation_id);
  }, [actor?.token, selectedId]);

  const loadThread = useCallback(async () => {
    if (!selectedId) return;
    const response = await fetch(`/api/conversations/${selectedId}/messages`, { headers });
    const data = await response.json();
    if (!response.ok) return setError(data.error || 'Could not open conversation.');
    setThread(data.conversation); setMessages(data.messages || []); setViewerId(data.viewer_id || '');
  }, [selectedId, actor?.token]);

  useEffect(() => {
    fetch('/api/messaging/directory', { headers }).then(r => r.json()).then(data => { if (data.success) setDirectory(data); }).catch(() => {});
    loadConversations();
  }, [actor?.token]);
  useEffect(() => { loadThread(); const timer = setInterval(() => { loadThread(); loadConversations(); }, 10000); return () => clearInterval(timer); }, [loadThread]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const filtered = useMemo(() => conversations.filter(item =>
    `${item.subject} ${item.last_message_preview} ${item.work_id} ${item.participants?.map(p => p.name).join(' ')}`.toLowerCase().includes(query.toLowerCase())
  ), [conversations, query]);

  const createConversation = async event => {
    event.preventDefault(); setBusy(true); setError('');
    const [target_role, target_id, target_name] = draft.target.split('|');
    const response = await fetch('/api/conversations', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ ...draft, target_role, target_id, target_name })
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Conversation could not be created.');
    else {
      setShowNew(false); setDraft({ subject: '', type: role === 'client' ? 'client_admin' : role === 'writer' ? 'writer_admin' : 'client_admin', target: '', work_id: '' });
      setSelectedId(data.conversation.conversation_id); await loadConversations();
    }
    setBusy(false);
  };

  const chooseFiles = async event => {
    const files = [...event.target.files].slice(0, 3);
    event.target.value = '';
    if (files.some(file => file.size > 10 * 1024 * 1024)) return setError('Each attachment must be 10 MB or smaller.');
    const encoded = await Promise.all(files.map(file => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, mime_type: file.type, size: file.size, data: reader.result });
      reader.onerror = reject; reader.readAsDataURL(file);
    })));
    setAttachments(encoded);
  };

  const send = async () => {
    if (!body.trim() && !attachments.length) return;
    setBusy(true); setError('');
    const response = await fetch(`/api/conversations/${selectedId}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ body, attachments })
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Message could not be sent.');
    else { setBody(''); setAttachments([]); await loadThread(); await loadConversations(); }
    setBusy(false);
  };

  const patchConversation = async updates => {
    const response = await fetch(`/api/conversations/${selectedId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(updates) });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Conversation could not be updated.');
    else { setThread(data.conversation); await loadConversations(); }
  };

  const directJobs = directory.jobs?.filter(job => job.direct_contact_enabled) || [];
  const targetOptions = draft.type === 'client_admin' ? directory.clients : directory.providers;

  return (
    <section style={{ maxWidth: 1500, margin: '0 auto' }}>
      <div className="flex justify-between items-center" style={{ gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div><small style={{ color: 'var(--primary)', fontWeight: 800, letterSpacing: '.12em' }}>SECURE COMMUNICATIONS</small><h1 style={{ margin: '.25rem 0' }}>Messages</h1><p style={{ color: 'var(--text-muted)', margin: 0 }}>Private conversations, job context and protected attachments in one place.</p></div>
        <div className="flex gap-1">{role === 'admin' && <Link className="btn btn-ghost" to="/admin/job-messages">Open job-message oversight</Link>}<button className="btn btn-primary" onClick={() => setShowNew(true)}>New conversation</button></div>
      </div>
      {error && <div className="card" style={{ color: 'var(--danger)', marginBottom: 10 }}>{error}</div>}
      {showNew && <form className="card" onSubmit={createConversation} style={{ marginBottom: 12 }}>
        <div className="flex justify-between"><h3>Start a conversation</h3><button type="button" className="btn btn-ghost btn-sm" onClick={()=>setShowNew(false)}>Close</button></div>
        <div className="grid grid-2 gap-2" style={{ marginTop: 10 }}>
          <label className="form-group"><span className="form-label">Subject</span><input required className="form-input" value={draft.subject} onChange={e=>setDraft({...draft,subject:e.target.value})} placeholder="What is this conversation about?" /></label>
          <label className="form-group"><span className="form-label">Conversation</span><select className="form-select" value={draft.type} onChange={e=>setDraft({...draft,type:e.target.value,target:'',work_id:''})}>
            {role === 'admin' ? <><option value="client_admin">Admin ↔ client</option><option value="writer_admin">Admin ↔ provider</option><option value="client_provider">Client ↔ provider (approved job)</option></> : <><option value={role === 'client' ? 'client_admin' : 'writer_admin'}>Message IPS Admin</option>{directJobs.length > 0 && <option value="client_provider">Approved client-provider job chat</option>}</>}
          </select></label>
          {role === 'admin' && draft.type !== 'client_provider' && <label className="form-group"><span className="form-label">Recipient</span><select required className="form-select" value={draft.target} onChange={e=>setDraft({...draft,target:e.target.value})}><option value="">Choose recipient</option>{targetOptions.map(person => { const id=person.client_id||person.writer_id; return <option key={id} value={`${draft.type==='client_admin'?'client':'writer'}|${id}|${person.full_name}`}>{person.full_name} · {person.email}</option>; })}</select></label>}
          {(draft.type === 'client_provider' || role !== 'admin') && <label className="form-group"><span className="form-label">{draft.type === 'client_provider' ? 'Approved job' : 'Link a job (optional)'}</span><select required={draft.type==='client_provider'} className="form-select" value={draft.work_id} onChange={e=>setDraft({...draft,work_id:e.target.value})}><option value="">No linked job</option>{(draft.type==='client_provider'?directJobs:directory.jobs||[]).map(job=><option key={job.work_id} value={job.work_id}>{job.work_id} · {job.title}</option>)}</select></label>}
        </div>
        <button disabled={busy} className="btn btn-primary">{busy ? 'Creating…' : 'Create conversation'}</button>
      </form>}
      <div className="direct-messaging-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,340px) minmax(0,1fr)', minHeight: 650, border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', background: 'var(--bg-surface)' }}>
        <div className="direct-conversation-list" style={{ borderRight: '1px solid var(--border)', padding: 12, overflowY: 'auto', maxHeight: 760 }}>
          <input className="form-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search conversations" style={{ marginBottom: 10 }} />
          {filtered.map(item => <button key={item.conversation_id} onClick={()=>setSelectedId(item.conversation_id)} style={{ width:'100%', textAlign:'left', padding:12, marginBottom:6, borderRadius:10, border:item.conversation_id===selectedId?'1px solid var(--primary)':'1px solid transparent', background:item.conversation_id===selectedId?'var(--bg-active)':'transparent', color:'var(--text-primary)', cursor:'pointer' }}>
            <div className="flex justify-between" style={{ gap:8 }}><strong style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.subject}</strong>{item.unread_count>0&&<span style={{ background:'#ef4444',color:'#fff',borderRadius:20,padding:'1px 7px',fontSize:'.7rem' }}>{item.unread_count}</span>}</div>
            <div style={{ fontSize:'.75rem',color:'var(--text-muted)',marginTop:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{item.last_message_preview||'No messages yet'}</div>
            <small style={{ color:'var(--primary)' }}>{item.work_id||item.type.replace('_',' ↔ ')}</small>
          </button>)}
          {!filtered.length && <p style={{ color:'var(--text-muted)',padding:12 }}>No conversations found.</p>}
        </div>
        <main style={{ display:'flex',flexDirection:'column',minWidth:0 }}>
          {!thread ? <div style={{ margin:'auto',textAlign:'center',padding:30 }}><h3>Select a conversation</h3><p style={{color:'var(--text-muted)'}}>Or start a new secure conversation.</p></div> : <>
            <header style={{ padding:'1rem',borderBottom:'1px solid var(--border)' }}>
              <div className="flex justify-between" style={{gap:10,flexWrap:'wrap'}}><div><h3 style={{margin:0}}>{thread.subject}</h3><small style={{color:'var(--text-muted)'}}>{thread.participants.map(p=>p.name||p.role).join(' ↔ ')}{thread.work_id?` · ${thread.work_id}`:''}</small></div><div className="flex gap-1">{role==='admin'&&<select className="form-select" value={thread.priority} onChange={e=>patchConversation({priority:e.target.value})} style={{maxWidth:120}}><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select>}{role==='admin'&&<button className="btn btn-ghost btn-sm" onClick={()=>patchConversation({status:thread.status==='resolved'?'open':'resolved'})}>{thread.status==='resolved'?'Reopen':'Resolve'}</button>}<button className="btn btn-ghost btn-sm" onClick={()=>patchConversation({archived:true})}>Archive</button></div></div>
            </header>
            <div style={{ flex:1,padding:'1rem',overflowY:'auto',maxHeight:540,display:'grid',gap:10,alignContent:'start' }}>
              {messages.map(message => { const mine=message.sender_id===viewerId; return <div key={message._id} style={{maxWidth:'78%',justifySelf:mine?'end':'start',background:mine?'var(--primary)':'var(--bg-surface-2)',color:mine?'#fff':'var(--text-primary)',padding:'.7rem .85rem',borderRadius:mine?'14px 14px 3px 14px':'14px 14px 14px 3px'}}>
                <small style={{opacity:.72,fontWeight:700}}>{message.sender_role}</small>{message.body&&<div style={{whiteSpace:'pre-wrap'}}>{message.body}</div>}
                {message.attachments?.map((file,index)=><a key={file.stored_name} href={`/api/conversation-files/${thread.conversation_id}/${message._id}/${index}?token=${encodeURIComponent(actor?.token||'')}`} style={{display:'block',color:'inherit',marginTop:6,textDecoration:'underline'}}>📎 {file.original_name} ({(file.size/1024).toFixed(1)} KB)</a>)}
                <small style={{display:'block',opacity:.62,marginTop:4}}>{new Date(message.createdAt).toLocaleString()}</small>
              </div>; })}
              <div ref={endRef} />
            </div>
            <footer style={{ padding:'1rem',borderTop:'1px solid var(--border)' }}>
              {attachments.length>0&&<div style={{fontSize:'.78rem',marginBottom:6}}>{attachments.map(file=>file.name).join(', ')} <button className="btn btn-ghost btn-sm" onClick={()=>setAttachments([])}>Clear</button></div>}
              <textarea className="form-textarea" value={body} onChange={e=>setBody(e.target.value)} placeholder="Write a secure message…" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}} />
              <div className="flex justify-between" style={{marginTop:8}}><label className="btn btn-ghost btn-sm">Attach files<input hidden multiple type="file" onChange={chooseFiles} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.png,.jpg,.jpeg" /></label><button className="btn btn-primary btn-sm" disabled={busy||(!body.trim()&&!attachments.length)} onClick={send}>{busy?'Sending…':'Send message'}</button></div>
            </footer>
          </>}
        </main>
      </div>
      <style>{`@media(max-width:800px){.direct-messaging-grid{grid-template-columns:1fr!important}.direct-conversation-list{max-height:260px!important;border-right:0!important;border-bottom:1px solid var(--border)}}`}</style>
    </section>
  );
}
