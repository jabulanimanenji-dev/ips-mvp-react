import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const channelLabels = {
  client_admin: 'Client conversation',
  writer_admin: 'Provider conversation',
  client_provider: 'Direct client–provider',
  admin_internal: 'Internal admin notes',
  announcement: 'Admin announcement'
};

export default function AdminMessages() {
  const { admin } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/admin/inbox');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load inbox.');
      setConversations(data.conversations || []);
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, []);

  const openConversation = async conversation => {
    setSelected(conversation); setDetail(null); setError('');
    try {
      const res = await fetch(`/api/admin/inbox/${conversation.work_id}/${conversation.channel}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not open conversation.');
      setDetail(data); load();
    } catch (err) { setError(err.message); }
  };

  const updateState = async updates => {
    if (!selected) return;
    const res = await fetch(`/api/admin/inbox/${selected.work_id}/${selected.channel}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Conversation update failed.');
    setDetail(current => ({ ...current, state: data.state }));
    load();
  };

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setBusy(true); setError('');
    const res = await fetch(`/api/orders/${selected.work_id}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: selected.channel, body: reply })
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || 'Reply failed.');
    else {
      setReply('');
      await updateState({ status: selected.channel === 'client_admin' ? 'waiting_client' : selected.channel === 'writer_admin' ? 'waiting_provider' : 'open' });
      await openConversation(selected);
    }
    setBusy(false);
  };

  const visible = useMemo(() => {
    let list = conversations.filter(item => {
      const haystack = `${item.work_id} ${item.title} ${item.category} ${item.client_name} ${item.provider_name} ${item.latest_message} ${item.channel} ${(item.tags || []).join(' ')}`.toLowerCase();
      if (!haystack.includes(query.toLowerCase())) return false;
      if (filter === 'unread') return item.unread_count > 0;
      if (filter === 'needs_reply') return item.latest_sender_role !== 'admin' && item.conversation_status !== 'resolved';
      if (filter === 'client') return item.channel === 'client_admin';
      if (filter === 'provider') return item.channel === 'writer_admin';
      if (filter === 'direct') return item.channel === 'client_provider';
      if (filter === 'decisions') return item.open_decisions > 0;
      if (filter === 'expenses') return item.pending_expenses > 0;
      if (filter === 'escalated') return item.escalated;
      if (filter === 'resolved') return item.conversation_status === 'resolved';
      return true;
    });
    if (sort === 'oldest') list.sort((a,b) => new Date(a.latest_at) - new Date(b.latest_at));
    else if (sort === 'priority') list.sort((a,b) => ['normal','important','urgent','critical'].indexOf(b.priority) - ['normal','important','urgent','critical'].indexOf(a.priority));
    else if (sort === 'deadline') list.sort((a,b) => new Date(a.deadline || '2999-01-01') - new Date(b.deadline || '2999-01-01'));
    else list.sort((a,b) => new Date(b.latest_at) - new Date(a.latest_at));
    return list;
  }, [conversations, query, filter, sort]);

  const counts = {
    all: conversations.length,
    unread: conversations.filter(c => c.unread_count).length,
    needs: conversations.filter(c => c.latest_sender_role !== 'admin' && c.conversation_status !== 'resolved').length,
    escalated: conversations.filter(c => c.escalated).length
  };
  const work = detail?.work;
  const jobHref = work?.work_kind === 'service' ? `/admin/services/${selected?.work_id}` : `/admin/orders/${work?._id || selected?.work_id}`;

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', gap:16, flexWrap:'wrap', marginBottom:'1rem' }}>
        <div><small style={{ color:'#c28bff', fontWeight:800, letterSpacing:'.12em' }}>MISSION CONTROL</small><h2 style={{ fontSize:'1.6rem', margin:'.25rem 0' }}>Unified Inbox</h2><p style={{ color:'var(--text-muted)', margin:0 }}>Every client, provider and operational conversation connected to its root job.</p></div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>{[['All',counts.all],['Unread',counts.unread],['Needs reply',counts.needs],['Escalated',counts.escalated]].map(([label,count]) => <div key={label} className="card" style={{ padding:'.65rem 1rem' }}><strong>{count}</strong><small style={{ display:'block' }}>{label}</small></div>)}</div>
      </div>
      {error && <div style={{ color:'var(--danger)', marginBottom:10 }}>{error}</div>}

      <div className="admin-inbox-shell" style={{ display:'grid', gridTemplateColumns:'minmax(310px, .9fr) minmax(420px, 1.35fr) minmax(260px, .75fr)', minHeight:'72vh', border:'1px solid rgba(185,205,238,.12)', borderRadius:16, overflow:'hidden', background:'var(--bg-card)' }}>
        <aside className="admin-inbox-list" style={{ borderRight:'1px solid var(--border)', overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <div style={{ padding:12, borderBottom:'1px solid var(--border)' }}>
            <input className="form-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search messages, jobs, people..." />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
              <select className="form-select" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All conversations</option><option value="unread">Unread</option><option value="needs_reply">Needs reply</option><option value="client">Client messages</option><option value="provider">Provider messages</option><option value="direct">Direct oversight</option><option value="decisions">Open decisions</option><option value="expenses">Pending expenses</option><option value="escalated">Escalated</option><option value="resolved">Resolved</option></select>
              <select className="form-select" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="priority">Priority</option><option value="deadline">Deadline</option></select>
            </div>
          </div>
          <div style={{ overflowY:'auto', flex:1 }}>
            {!visible.length && <p style={{ padding:20, color:'var(--text-muted)' }}>No conversations match this view.</p>}
            {visible.map(item => <button key={item.key} onClick={()=>openConversation(item)} style={{ width:'100%', textAlign:'left', padding:'1rem', border:0, borderBottom:'1px solid var(--border)', borderLeft:selected?.key===item.key?'4px solid #a305a6':'4px solid transparent', background:selected?.key===item.key?'rgba(163,5,166,.12)':'transparent', color:'inherit', cursor:'pointer' }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}><strong>{item.client_name || item.work_id}</strong><small>{new Date(item.latest_at).toLocaleDateString()}</small></div>
              <div style={{ fontSize:'.8rem', color:'#c28bff', margin:'.25rem 0' }}>{channelLabels[item.channel]} · {item.work_id}</div>
              <div style={{ fontWeight:650 }}>{item.title}</div>
              <p style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:'var(--text-muted)', margin:'.3rem 0' }}>{item.latest_message}</p>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>{item.unread_count>0&&<small className="badge">{item.unread_count} unread</small>}{item.open_decisions>0&&<small className="badge">{item.open_decisions} decisions</small>}{item.pending_expenses>0&&<small className="badge">{item.pending_expenses} expenses</small>}{item.priority!=='normal'&&<small className="badge">{item.priority}</small>}</div>
            </button>)}
          </div>
        </aside>

        <main className="admin-inbox-thread" style={{ display:'flex', flexDirection:'column', minWidth:0 }}>
          {!detail ? <div style={{ margin:'auto', textAlign:'center', padding:30, color:'var(--text-muted)' }}><div style={{ fontSize:'2.5rem' }}>●</div><h3>Select a conversation</h3><p>Open any thread to reply and manage the root job.</p></div> : <>
            <header style={{ padding:'1rem', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
              <div><small style={{ color:'#c28bff', fontWeight:800 }}>{channelLabels[selected.channel]}</small><h3 style={{ margin:'.2rem 0' }}>{work?.topic_title || work?.title}</h3><div style={{ display:'flex', gap:8, flexWrap:'wrap' }}><button className="btn btn-ghost btn-sm" onClick={()=>setQuery(work?.client_name||'')}>Client: {work?.client_name}</button>{(work?.writer_name||work?.provider_name)&&<button className="btn btn-ghost btn-sm" onClick={()=>setQuery(work.writer_name||work.provider_name)}>Provider: {work.writer_name||work.provider_name}</button>}<button className="btn btn-ghost btn-sm" onClick={()=>setQuery(work?.service_type||work?.category||'')}>{work?.service_type||work?.category}</button></div></div>
              <Link to={jobHref} className="btn btn-primary">Open root job →</Link>
            </header>
            <div style={{ flex:1, overflowY:'auto', padding:'1rem', display:'flex', flexDirection:'column', gap:10 }}>
              {detail.messages.map(message => <div key={message._id} style={{ alignSelf:message.sender_role==='admin'?'flex-end':'flex-start', maxWidth:'78%', padding:'.8rem 1rem', borderRadius:14, background:message.sender_role==='admin'?'linear-gradient(135deg,#660273,#a305a6)':'var(--bg-surface-2)', color:message.sender_role==='admin'?'#fff':'inherit' }}><small style={{ opacity:.7 }}>{message.sender_role} · {new Date(message.createdAt).toLocaleString()}</small><div style={{ whiteSpace:'pre-wrap', marginTop:4 }}>{message.body}</div></div>)}
            </div>
            <footer style={{ padding:'1rem', borderTop:'1px solid var(--border)' }}><textarea className="form-textarea" value={reply} onChange={e=>setReply(e.target.value)} placeholder={`Reply in ${channelLabels[selected.channel]}...`} /><div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}><small style={{ color:'var(--text-muted)' }}>Reply is recorded in the job audit history.</small><button className="btn btn-primary" disabled={busy||!reply.trim()} onClick={sendReply}>{busy?'Sending...':'Send reply'}</button></div></footer>
          </>}
        </main>

        <aside className="admin-inbox-context" style={{ borderLeft:'1px solid var(--border)', padding:'1rem', overflowY:'auto' }}>
          {!detail ? <p style={{ color:'var(--text-muted)' }}>Job context appears here.</p> : <>
            <h3>Conversation control</h3>
            <label className="form-group"><span className="form-label">Priority</span><select className="form-select" value={detail.state?.priority||'normal'} onChange={e=>updateState({priority:e.target.value})}>{['normal','important','urgent','critical'].map(v=><option key={v}>{v}</option>)}</select></label>
            <label className="form-group"><span className="form-label">State</span><select className="form-select" value={detail.state?.status||'open'} onChange={e=>updateState({status:e.target.value})}>{['open','waiting_client','waiting_provider','waiting_admin','resolved','archived'].map(v=><option key={v}>{v.replaceAll('_',' ')}</option>)}</select></label>
            <label className="form-group"><span className="form-label">Assigned admin</span><input className="form-input" value={detail.state?.assigned_admin||''} onChange={e=>setDetail({...detail,state:{...detail.state,assigned_admin:e.target.value}})} onBlur={e=>updateState({assigned_admin:e.target.value})} placeholder={admin?.email||'Admin name'}/></label>
            <label className="form-group"><span className="form-label">Follow up</span><input type="datetime-local" className="form-input" value={detail.state?.follow_up_at?String(detail.state.follow_up_at).slice(0,16):''} onChange={e=>updateState({follow_up_at:e.target.value||null})}/></label>
            <button className={`btn btn-sm ${detail.state?.escalated?'btn-danger':'btn-ghost'}`} onClick={()=>updateState({escalated:!detail.state?.escalated,escalation_reason:!detail.state?.escalated?'Admin escalation':''})}>{detail.state?.escalated?'Remove escalation':'Escalate'}</button>

            <hr style={{ borderColor:'var(--border)', margin:'1.25rem 0' }}/>
            <h3>Root job</h3>
            <div style={{ display:'grid', gap:7, fontSize:'.86rem' }}><span><b>ID:</b> {selected.work_id}</span><span><b>Type:</b> {work?.work_kind}</span><span><b>Status:</b> {work?.status}</span><span><b>Deadline:</b> {work?.deadline?new Date(work.deadline).toLocaleDateString():'TBD'}</span><span><b>Direct contact:</b> {work?.direct_contact_enabled?'Enabled':'Blocked'}</span></div>
            <Link to={jobHref} className="btn btn-secondary btn-sm" style={{ marginTop:10 }}>Open complete workspace</Link>

            <hr style={{ borderColor:'var(--border)', margin:'1.25rem 0' }}/>
            <h3>Operational context</h3>
            <div style={{ display:'grid', gap:8 }}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setFilter('decisions')}>Decisions & clarifications ({detail.decisions.length})</button>
              <Link className="btn btn-ghost btn-sm" to={jobHref}>Files & evidence ({detail.files.length})</Link>
              <Link className="btn btn-ghost btn-sm" to={jobHref}>Expenses & receipts ({detail.expenses.length})</Link>
            </div>
          </>}
        </aside>
      </div>
      <style>{`
        @media (max-width: 1180px) {
          .admin-inbox-shell { grid-template-columns: minmax(290px,.8fr) minmax(420px,1.2fr) !important; }
          .admin-inbox-context { grid-column: 1 / -1; border-left: 0 !important; border-top: 1px solid var(--border); }
        }
        @media (max-width: 760px) {
          .admin-inbox-shell { display: block !important; overflow: visible !important; }
          .admin-inbox-list { max-height: 420px; border-right: 0 !important; }
          .admin-inbox-thread { min-height: 600px; border-top: 1px solid var(--border); }
        }
      `}</style>
    </div>
  );
}
