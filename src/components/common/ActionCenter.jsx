import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const priorityColors = { urgent: '#ef4444', high: '#f59e0b', normal: '#7c4fa8', low: '#64748b' };
const labels = { files: 'Files', decisions: 'Requests', expenses: 'Expenses', assignments: 'Assignments', messages: 'Messages', deadlines: 'Deadlines' };

export default function ActionCenter({ role }) {
  const { admin, writer } = useAuth();
  const actor = role === 'admin' ? admin : writer;
  const headers = actor?.token ? { Authorization: `Bearer ${actor.token}` } : {};
  const [params] = useSearchParams();
  const initialCategory = params.get('category') || 'all';
  const [actions, setActions] = useState([]);
  const [summary, setSummary] = useState({ total: 0, urgent: 0, overdue: 0, in_progress: 0 });
  const [category, setCategory] = useState(initialCategory);
  const [priority, setPriority] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('urgency');
  const [view, setView] = useState('active');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const suffix = view === 'history' ? '?history=true' : view === 'snoozed' ? '?snoozed=true' : '';
    const response = await fetch(`/api/actions${suffix}`, { headers });
    const data = await response.json();
    if (!response.ok) return setError(data.error || 'Could not load pending actions.');
    setActions(data.actions || []);
    setSummary(data.summary || {});
  }, [actor?.token, view]);

  useEffect(() => { load(); const timer = setInterval(load, 30000); return () => clearInterval(timer); }, [load]);

  const update = async (item, updates) => {
    setBusy(item.key); setError('');
    const response = await fetch(`/api/actions/${encodeURIComponent(item.key)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ ...updates, work_id: item.work_id, snapshot: {
        key: item.key, source: item.source, source_id: item.source_id, work_id: item.work_id,
        work: item.work, title: item.title, reason: item.reason, category: item.category,
        created_at: item.created_at, due_at: item.due_at, overdue: item.overdue
      } })
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Action could not be updated.');
    await load(); setBusy('');
  };

  const finish = (item, status) => {
    const resolution_note = window.prompt(status === 'dismissed' ? 'Why is this action being dismissed?' : 'How was this action resolved?') || '';
    if (!resolution_note.trim()) return;
    update(item, { status, resolution_note });
  };

  const snooze = item => {
    const value = window.prompt('Snooze for how many hours?', '24');
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours <= 0) return;
    update(item, { snoozed_until: new Date(Date.now() + hours * 3600000).toISOString() });
  };

  const releaseFile = async (item, visibility) => {
    setBusy(item.key);
    const response = await fetch(`/api/files/${item.source_id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ state: 'released', visibility })
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'File could not be released.');
    else await update(item, { status: 'resolved', resolution_note: `File released to ${visibility}.` });
    await load(); setBusy('');
  };

  const assign = item => {
    const assigned_to = window.prompt('Administrative owner name or ID:', item.assigned_to || '') || '';
    if (!assigned_to.trim()) return;
    update(item, { assigned_to, status: 'in_progress' });
  };

  const filtered = useMemo(() => {
    const rank = { urgent: 0, high: 1, normal: 2, low: 3 };
    return actions.filter(item =>
      (category === 'all' || item.category === category) &&
      (priority === 'all' || item.priority === priority) &&
      `${item.title} ${item.reason} ${item.work?.id} ${item.work?.client} ${item.work?.provider} ${item.work?.category}`.toLowerCase().includes(query.toLowerCase())
    ).sort((a, b) => sort === 'oldest'
      ? new Date(a.created_at || 0) - new Date(b.created_at || 0)
      : sort === 'newest'
        ? new Date(b.created_at || 0) - new Date(a.created_at || 0)
        : rank[a.priority] - rank[b.priority] || Number(b.overdue) - Number(a.overdue));
  }, [actions, category, priority, query, sort]);

  const hrefFor = item => item.source === 'direct_message'
    ? `/${role === 'admin' ? 'admin' : 'writer'}/messages`
    : item.work?.kind === 'service'
    ? `/${role === 'admin' ? 'admin' : 'writer'}/services/${item.work_id}`
    : `/${role === 'admin' ? 'admin' : 'writer'}/orders/${item.work?.mongo_id || item.work_id}`;

  return (
    <section style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ padding: '1.6rem', borderRadius: 18, background: 'linear-gradient(135deg,#111a3a,#421459)', color: '#fff', marginBottom: '1rem' }}>
        <small style={{ letterSpacing: '.14em', fontWeight: 800, opacity: .72 }}>{role === 'admin' ? 'MISSION CONTROL' : 'PROVIDER COMMAND CENTER'}</small>
        <h1 style={{ margin: '.35rem 0' }}>Action Center</h1>
        <p style={{ opacity: .76, margin: 0 }}>Everything requiring attention, ordered by urgency and linked to its source.</p>
      </div>
      <div className="grid grid-4 gap-3" style={{ marginBottom: '1rem' }}>
        {[['Pending', summary.total], ['Urgent', summary.urgent], ['Overdue', summary.overdue], ['In progress', summary.in_progress]].map(([label, value]) =>
          <div className="card" key={label}><strong style={{ fontSize: '1.8rem' }}>{value || 0}</strong><div style={{ color: 'var(--text-muted)' }}>{label}</div></div>)}
      </div>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="grid grid-4 gap-2">
          <input className="form-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search client, provider, job or action" />
          <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}><option value="all">All action types</option>{Object.entries(labels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select>
          <select className="form-select" value={priority} onChange={e => setPriority(e.target.value)}><option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select>
          <select className="form-select" value={sort} onChange={e => setSort(e.target.value)}><option value="urgency">Urgency first</option><option value="oldest">Oldest first</option><option value="newest">Newest first</option></select>
        </div>
        <div className="flex gap-1" style={{ marginTop: 10 }}>
          {[['active','Active'],['snoozed','Snoozed'],['history','Resolved history']].map(([value,label])=><button key={value} className={`btn btn-sm ${view === value ? 'btn-primary' : 'btn-ghost'}`} onClick={()=>setView(value)}>{label}</button>)}
        </div>
      </div>
      {error && <div className="card" style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'grid', gap: '.75rem' }}>
        {filtered.map(item => (
          <article className="card" key={item.key} style={{ borderLeft: `5px solid ${priorityColors[item.priority]}`, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 16 }}>
            <div>
              <div className="flex gap-1 items-center" style={{ flexWrap: 'wrap' }}>
                <span style={{ fontSize: '.7rem', fontWeight: 800, textTransform: 'uppercase', color: priorityColors[item.priority] }}>{item.priority}</span>
                <span style={{ fontSize: '.72rem', padding: '.2rem .5rem', borderRadius: 20, background: 'var(--bg-surface-2)' }}>{labels[item.category] || item.category}</span>
                {item.overdue && <span style={{ color: 'var(--danger)', fontSize: '.75rem', fontWeight: 800 }}>OVERDUE {item.overdue_hours}h</span>}
                {item.status === 'in_progress' && <span style={{ color: 'var(--primary)', fontSize: '.75rem', fontWeight: 800 }}>IN PROGRESS</span>}
              </div>
              <h3 style={{ margin: '.45rem 0 .25rem' }}>{item.title}</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>{item.reason}</p>
              <div style={{ marginTop: '.65rem', fontSize: '.78rem', color: 'var(--text-muted)' }}>{item.work_id} · {item.work?.kind} · {item.work?.client || 'Client'}{item.work?.provider ? ` · ${item.work.provider}` : ''}</div>
            </div>
            <div className="flex gap-1" style={{ alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', maxWidth: 440 }}>
              <Link className="btn btn-primary btn-sm" to={hrefFor(item)}>Open job</Link>
              {role === 'admin' && item.source === 'file' && <select className="form-select" defaultValue="" disabled={busy === item.key} onChange={e => { if (e.target.value) releaseFile(item, e.target.value); }} style={{ maxWidth: 170 }}><option value="">Release file to…</option><option value="admin_client">Client</option><option value="admin_writer">Provider</option><option value="all">Client + provider</option></select>}
              {role === 'admin' && <button className="btn btn-ghost btn-sm" disabled={busy === item.key} onClick={() => assign(item)}>{item.assigned_to ? `Admin owner: ${item.assigned_to}` : 'Set admin owner'}</button>}
              {role === 'admin' && <select className="form-select" value={item.priority} disabled={busy === item.key} onChange={e => update(item, { priority: e.target.value })} style={{ maxWidth: 110 }}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select>}
              {item.status !== 'in_progress' && <button className="btn btn-secondary btn-sm" disabled={busy === item.key} onClick={() => update(item, { status: 'in_progress' })}>Start</button>}
              <button className="btn btn-ghost btn-sm" disabled={busy === item.key} onClick={() => snooze(item)}>Snooze</button>
              <button className="btn btn-secondary btn-sm" disabled={busy === item.key} onClick={() => finish(item, 'resolved')}>Resolve</button>
              {role === 'admin' && <button className="btn btn-ghost btn-sm" disabled={busy === item.key} onClick={() => finish(item, 'dismissed')}>Dismiss</button>}
            </div>
          </article>
        ))}
        {!filtered.length && <div className="card" style={{ textAlign: 'center', padding: '3rem' }}><h3>All clear</h3><p style={{ color: 'var(--text-muted)' }}>There are no actions matching these filters.</p></div>}
      </div>
    </section>
  );
}
