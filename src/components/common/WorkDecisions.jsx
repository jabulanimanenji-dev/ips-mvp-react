import React, { useCallback, useEffect, useState } from 'react';

const labels = {
  quote_change: 'Quote change',
  clarification: 'Clarification',
  revision: 'Revision',
  hold: 'Hold request',
  cancellation: 'Cancellation',
  dispute: 'Dispute'
};

export default function WorkDecisions({ workId, workKind, role, actor, quote }) {
  const actorId = actor?.client_id || actor?.writer_id || actor?.id || actor?._id || role;
  const authHeaders = actor?.token ? { Authorization: `Bearer ${actor.token}` } : {};
  const normalizedRole = role === 'writer' ? 'provider' : role;
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponse] = useState({});
  const [form, setForm] = useState({
    type: role === 'client' && quote ? 'quote_change' : 'clarification',
    subject: '', details: '', requested_changes: '', priority: 'normal',
    assigned_to_role: role === 'admin' ? 'client' : 'admin'
  });

  const load = useCallback(async () => {
    if (!workId) return;
    try {
      const res = await fetch(`/api/work/${workId}/decisions`, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load decisions.');
      setItems(data.decisions || []);
    } catch (err) { setError(err.message); }
  }, [workId, actor?.token]);
  useEffect(() => { load(); }, [load]);

  const submit = async e => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/work/${workId}/decisions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          ...form, work_kind: workKind,
          requested_changes: form.requested_changes.split('\n').map(v => v.trim()).filter(Boolean),
          created_by_id: actorId, created_by_role: normalizedRole,
          quote_snapshot: form.type === 'quote_change' ? quote : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit request.');
      setForm(current => ({ ...current, subject: '', details: '', requested_changes: '' }));
      setOpen(false); await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const update = async (item, updates) => {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/work/${workId}/decisions/${item._id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ ...updates, actor_id: actorId, actor_role: normalizedRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed.');
      setResponse(current => ({ ...current, [item._id]: '' }));
      await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <section className="card" style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div><h3>Questions & Decisions</h3><p style={{ color: 'var(--text-muted)', margin: '.25rem 0' }}>A permanent record of quote changes, clarifications, revisions and resolutions.</p></div>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(!open)}>{open ? 'Close' : '+ New request'}</button>
      </div>

      {open && <form onSubmit={submit} style={{ marginTop: '1rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-surface-2)' }}>
        <div className="grid grid-2 gap-3">
          <label className="form-group"><span className="form-label">Request type</span><select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            {Object.entries(labels).filter(([key]) => role !== 'client' || ['quote_change','clarification','revision','cancellation','dispute'].includes(key)).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label className="form-group"><span className="form-label">Send to</span><select className="form-select" value={form.assigned_to_role} onChange={e => setForm({ ...form, assigned_to_role: e.target.value })}>
            {role !== 'client' && <option value="client">Client</option>}
            {role !== 'admin' && <option value="admin">Admin</option>}
            {role === 'admin' && <option value="provider">Service provider</option>}
          </select></label>
        </div>
        <label className="form-group"><span className="form-label">Subject</span><input required maxLength="180" className="form-input" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="What needs to be decided or clarified?" /></label>
        <label className="form-group"><span className="form-label">Why and what is needed</span><textarea required maxLength="5000" className="form-textarea" value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} placeholder="Explain the reason, context and expected outcome." /></label>
        <label className="form-group"><span className="form-label">Requested changes or questions (one per line)</span><textarea className="form-textarea" value={form.requested_changes} onChange={e => setForm({ ...form, requested_changes: e.target.value })} placeholder={'Change the deadline to...\nExplain whether...\nAdjust the service fee because...'} /></label>
        <label className="form-group"><span className="form-label">Priority</span><select className="form-select" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label>
        <button disabled={busy} className="btn btn-primary">{busy ? 'Submitting...' : 'Submit with explanation'}</button>
      </form>}

      {error && <div style={{ color: 'var(--danger)', marginTop: '1rem' }}>{error}</div>}
      <div style={{ display: 'grid', gap: 12, marginTop: '1rem' }}>
        {!items.length && <p style={{ color: 'var(--text-muted)' }}>No open questions or recorded decisions.</p>}
        {items.map(item => (
          <article key={item._id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '1rem', borderLeft: `4px solid ${item.status === 'resolved' ? '#10b981' : item.priority === 'urgent' ? '#ef4444' : '#8b1ca5'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><small style={{ color: 'var(--primary)', fontWeight: 800 }}>{labels[item.type]?.toUpperCase()} · {item.priority.toUpperCase()}</small><h4 style={{ margin: '.25rem 0' }}>{item.subject}</h4></div><strong>{item.status}</strong></div>
            <p style={{ whiteSpace: 'pre-wrap' }}>{item.details}</p>
            {!!item.requested_changes?.length && <ul>{item.requested_changes.map((change,index) => <li key={index}>{change}</li>)}</ul>}
            <small style={{ color: 'var(--text-muted)' }}>Opened by {item.created_by_role} · {new Date(item.createdAt).toLocaleString()}</small>
            {item.response && <div style={{ marginTop: '.75rem', padding: '.75rem', borderRadius: 8, background: 'var(--bg-surface-2)' }}><strong>Response</strong><p style={{ whiteSpace: 'pre-wrap', margin: '.25rem 0' }}>{item.response}</p><small>{item.responded_by_role} · {new Date(item.responded_at).toLocaleString()}</small></div>}
            {item.status === 'open' && <div style={{ marginTop: '.75rem' }}><textarea className="form-textarea" value={response[item._id] || ''} onChange={e => setResponse({ ...response, [item._id]: e.target.value })} placeholder="Write a complete response..." /><button disabled={busy || !response[item._id]?.trim()} className="btn btn-primary btn-sm" onClick={() => update(item, { response: response[item._id] })}>Submit response</button></div>}
            {item.status === 'answered' && <div style={{ display: 'flex', gap: 8, marginTop: '.75rem' }}><button disabled={busy} className="btn btn-primary btn-sm" onClick={() => update(item, { status: 'resolved' })}>Mark resolved</button><button disabled={busy} className="btn btn-ghost btn-sm" onClick={() => update(item, { status: 'declined' })}>Not resolved</button></div>}
          </article>
        ))}
      </div>
    </section>
  );
}
