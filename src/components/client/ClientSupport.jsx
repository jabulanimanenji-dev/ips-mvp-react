import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCMS } from '../../context/CMSContext';

const emptyForm = { category: 'general', priority: 'standard', subject: '', message: '' };

export default function ClientSupport() {
  const { user } = useAuth();
  const { cms } = useCMS();
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [reply, setReply] = useState('');
  const [state, setState] = useState({ loading: true, saving: false, error: '', success: '' });
  const selected = useMemo(() => tickets.find(ticket => ticket.ticket_id === selectedId), [tickets, selectedId]);

  const load = async preferredId => {
    try {
      const response = await fetch('/api/support-tickets');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Support tickets could not be loaded.');
      setTickets(data.tickets || []);
      setSelectedId(current => preferredId || current || data.tickets?.[0]?.ticket_id || '');
      setState(previous => ({ ...previous, loading: false, error: '' }));
    } catch (error) {
      setState(previous => ({ ...previous, loading: false, error: error.message }));
    }
  };

  useEffect(() => { load(); }, []);

  const createTicket = async event => {
    event.preventDefault();
    setState(previous => ({ ...previous, saving: true, error: '', success: '' }));
    try {
      const response = await fetch('/api/support-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Ticket could not be created.');
      setForm(emptyForm);
      await load(data.ticket.ticket_id);
      setState(previous => ({ ...previous, saving: false, success: `Ticket ${data.ticket.ticket_id} opened.` }));
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
      setState(previous => ({ ...previous, saving: false, success: 'Reply sent to IPS support.' }));
    } catch (error) {
      setState(previous => ({ ...previous, saving: false, error: error.message }));
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ color: 'var(--primary)', fontSize: '.72rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' }}>Client help desk</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '.35rem 0' }}>Support Centre</h2>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Open a trackable ticket, see every response, and keep the full history in your account.</p>
      </div>

      {state.error && <div className="toast error" style={{ position: 'static', marginBottom: '1rem', maxWidth: 'none' }}>{state.error}</div>}
      {state.success && <div className="toast success" style={{ position: 'static', marginBottom: '1rem', maxWidth: 'none' }}>{state.success}</div>}

      <div className="grid grid-2 gap-4">
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Open a Support Ticket</h3>
          <form onSubmit={createTicket}>
            <div className="grid grid-2 gap-3">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}>
                  <option value="general">General</option><option value="order">Academic order</option>
                  <option value="service">Professional / odd job</option><option value="billing">Billing</option>
                  <option value="technical">Technical</option><option value="account">Account</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value })}>
                  <option value="standard">Standard</option><option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Subject</label>
              <input className="form-input" minLength={4} maxLength={180} value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">What happened?</label>
              <textarea className="form-textarea" rows={5} minLength={10} maxLength={5000} value={form.message} onChange={event => setForm({ ...form, message: event.target.value })} required />
            </div>
            <button className="btn btn-primary" disabled={state.saving}>{state.saving ? 'Sending…' : 'Open Ticket'}</button>
          </form>
          <div style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '.82rem' }}>
            Signed in as {user?.email}. Direct contact: {cms?.brand?.email || 'IPS Support'}.
          </div>
        </div>

        <div className="card">
          <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
            <h3>My Tickets</h3>
            <span className="badge badge-new">{tickets.length}</span>
          </div>
          {state.loading ? <p>Loading tickets…</p> : tickets.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No tickets yet. Your first request will appear here.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {tickets.map(ticket => (
                <button key={ticket.ticket_id} type="button" onClick={() => setSelectedId(ticket.ticket_id)} className="btn btn-ghost" style={{ textAlign: 'left', justifyContent: 'space-between', background: selectedId === ticket.ticket_id ? 'var(--bg-active)' : '' }}>
                  <span><strong>{ticket.subject}</strong><small style={{ display: 'block', color: 'var(--text-muted)' }}>{ticket.ticket_id} · {ticket.category}</small></span>
                  <span className="badge badge-review">{ticket.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
            <div><h3 style={{ margin: 0 }}>{selected.subject}</h3><small style={{ color: 'var(--text-muted)' }}>{selected.ticket_id} · {selected.priority} priority</small></div>
            <span className="badge badge-review">{selected.status}</span>
          </div>
          <div className="flex flex-col gap-2" style={{ marginBottom: '1rem' }}>
            {(selected.messages || []).map(message => (
              <div key={message._id || message.created_at} style={{ padding: '.85rem', borderRadius: 12, background: message.sender_role === 'client' ? 'var(--bg-active)' : 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
                <strong>{message.sender_role === 'client' ? 'You' : 'IPS Admin'}</strong>
                <p style={{ margin: '.35rem 0', whiteSpace: 'pre-wrap' }}>{message.body}</p>
                <small style={{ color: 'var(--text-muted)' }}>{new Date(message.created_at).toLocaleString()}</small>
              </div>
            ))}
          </div>
          {selected.status !== 'Closed' && (
            <form onSubmit={sendReply} className="flex gap-2">
              <textarea className="form-textarea" rows={2} value={reply} onChange={event => setReply(event.target.value)} placeholder="Add more detail or answer admin…" required />
              <button className="btn btn-primary" disabled={state.saving}>Reply</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
