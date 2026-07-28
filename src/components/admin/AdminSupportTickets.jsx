import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminSupportTickets() {
  const { admin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [reply, setReply] = useState('');
  const [state, setState] = useState({ loading: true, saving: false, error: '', success: '' });
  const selectedId = searchParams.get('ticket') || '';
  const selected = tickets.find(ticket => ticket.ticket_id === selectedId);

  const load = async preferredId => {
    try {
      const response = await fetch('/api/support-tickets');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Support queue could not be loaded.');
      setTickets(data.tickets || []);
      const nextId = preferredId || selectedId || data.tickets?.[0]?.ticket_id;
      if (nextId) setSearchParams({ ticket: nextId }, { replace: true });
      setState(previous => ({ ...previous, loading: false, error: '' }));
    } catch (error) {
      setState(previous => ({ ...previous, loading: false, error: error.message }));
    }
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => tickets.filter(ticket => {
    const matchesFilter = filter === 'all'
      || (filter === 'active' && !['Resolved', 'Closed'].includes(ticket.status))
      || ticket.status === filter;
    const haystack = `${ticket.ticket_id} ${ticket.subject} ${ticket.client_name} ${ticket.client_email} ${ticket.category}`.toLowerCase();
    return matchesFilter && haystack.includes(search.trim().toLowerCase());
  }), [tickets, filter, search]);

  const updateTicket = async updates => {
    if (!selected) return;
    setState(previous => ({ ...previous, saving: true, error: '', success: '' }));
    try {
      const response = await fetch(`/api/support-tickets/${selected.ticket_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Ticket could not be updated.');
      await load(selected.ticket_id);
      setState(previous => ({ ...previous, saving: false, success: 'Ticket updated.' }));
    } catch (error) {
      setState(previous => ({ ...previous, saving: false, error: error.message }));
    }
  };

  const sendReply = async event => {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    setState(previous => ({ ...previous, saving: true, error: '', success: '' }));
    try {
      const response = await fetch(`/api/support-tickets/${selected.ticket_id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: reply })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Reply could not be sent.');
      setReply('');
      await load(selected.ticket_id);
      setState(previous => ({ ...previous, saving: false, success: 'Reply sent to the client.' }));
    } catch (error) {
      setState(previous => ({ ...previous, saving: false, error: error.message }));
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: 'var(--primary)', fontSize: '.72rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' }}>Phase 9 help desk</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '.35rem 0' }}>Support Tickets</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Every client request, response, assignment, and resolution in one controlled queue.</p>
        </div>
        <span className="badge badge-new">{tickets.filter(ticket => !['Resolved', 'Closed'].includes(ticket.status)).length} active</span>
      </div>

      {state.error && <div className="toast error" style={{ position: 'static', marginBottom: '1rem', maxWidth: 'none' }}>{state.error}</div>}
      {state.success && <div className="toast success" style={{ position: 'static', marginBottom: '1rem', maxWidth: 'none' }}>{state.success}</div>}

      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(300px, .8fr) minmax(0, 1.5fr)' }}>
        <div className="card">
          <div className="flex gap-2" style={{ marginBottom: '.75rem' }}>
            <input className="form-input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tickets…" />
            <select className="form-select" value={filter} onChange={event => setFilter(event.target.value)} style={{ maxWidth: 150 }}>
              <option value="active">Active</option><option value="all">All</option>
              <option value="Open">Open</option><option value="In Progress">In Progress</option>
              <option value="Waiting for Client">Waiting</option><option value="Resolved">Resolved</option><option value="Closed">Closed</option>
            </select>
          </div>
          {state.loading ? <p>Loading queue…</p> : visible.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No tickets match this view.</p>
          ) : visible.map(ticket => (
            <button key={ticket.ticket_id} type="button" onClick={() => setSearchParams({ ticket: ticket.ticket_id })} className="btn btn-ghost" style={{ width: '100%', textAlign: 'left', alignItems: 'flex-start', marginBottom: 6, background: selectedId === ticket.ticket_id ? 'var(--bg-active)' : '' }}>
              <span style={{ flex: 1 }}>
                <strong style={{ display: 'block' }}>{ticket.subject}</strong>
                <small style={{ color: 'var(--text-muted)' }}>{ticket.client_name} · {ticket.ticket_id}</small>
              </span>
              <span className="badge badge-review">{ticket.status}</span>
            </button>
          ))}
        </div>

        <div className="card">
          {!selected ? <p style={{ color: 'var(--text-muted)' }}>Select a support ticket to inspect and resolve it.</p> : (
            <>
              <div className="flex justify-between items-start" style={{ gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <div><h3 style={{ margin: 0 }}>{selected.subject}</h3><small style={{ color: 'var(--text-muted)' }}>{selected.ticket_id} · {selected.client_name} · {selected.client_email}</small></div>
                <div className="flex gap-2">
                  <select className="form-select" value={selected.priority} onChange={event => updateTicket({ priority: event.target.value })}>
                    <option value="standard">Standard</option><option value="urgent">Urgent</option>
                  </select>
                  <select className="form-select" value={selected.status} onChange={event => updateTicket({ status: event.target.value })}>
                    <option>Open</option><option>In Progress</option><option>Waiting for Client</option><option>Resolved</option><option>Closed</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2" style={{ marginBottom: '1rem' }}>
                <input className="form-input" value={selected.assigned_admin || ''} readOnly placeholder="Unassigned" />
                <button className="btn btn-secondary" type="button" disabled={state.saving} onClick={() => updateTicket({ assigned_admin: admin?.email || admin?.name || 'admin' })}>Assign to me</button>
              </div>

              <div className="flex flex-col gap-2" style={{ maxHeight: 450, overflowY: 'auto', marginBottom: '1rem' }}>
                {(selected.messages || []).map(message => (
                  <div key={message._id || message.created_at} style={{ padding: '.85rem', borderRadius: 12, background: message.sender_role === 'admin' ? 'var(--bg-active)' : 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
                    <strong>{message.sender_role === 'admin' ? 'IPS Admin' : selected.client_name}</strong>
                    <p style={{ margin: '.35rem 0', whiteSpace: 'pre-wrap' }}>{message.body}</p>
                    <small style={{ color: 'var(--text-muted)' }}>{new Date(message.created_at).toLocaleString()}</small>
                  </div>
                ))}
              </div>

              {selected.status !== 'Closed' && (
                <form onSubmit={sendReply}>
                  <label className="form-label">Reply to client</label>
                  <textarea className="form-textarea" rows={3} value={reply} onChange={event => setReply(event.target.value)} required />
                  <button className="btn btn-primary" style={{ marginTop: '.75rem' }} disabled={state.saving}>{state.saving ? 'Saving…' : 'Send Reply'}</button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
