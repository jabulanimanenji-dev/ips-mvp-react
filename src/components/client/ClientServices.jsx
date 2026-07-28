import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ClientServices() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');

  const load = () => {
    if (!user?.client_id) return;
    fetch(`/api/services?client_id=${user.client_id}`).then(r => r.json()).then(d => setRequests(d.requests || []));
  };
  useEffect(load, [user]);

  const decideQuote = async (request, accepted) => {
    setBusy(request.request_id);
    await fetch(`/api/services/${request.request_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quote: { ...request.quote, accepted },
        status: accepted ? 'Quote Accepted' : 'Under Review',
        actor_id: user.client_id,
        actor_role: 'client'
      })
    });
    setBusy('');
    load();
  };

  const visible = useMemo(() => requests.filter(r => {
    const matchesText = `${r.title} ${r.category} ${r.request_id} ${r.status}`.toLowerCase().includes(query.toLowerCase());
    if (!matchesText) return false;
    if (filter === 'active') return !['Completed', 'Cancelled'].includes(r.status);
    if (filter === 'quotes') return r.status === 'Quoted' && !r.quote?.accepted;
    if (filter === 'professional' || filter === 'odd_job') return r.family === filter;
    return true;
  }), [requests, filter, query]);

  return (
    <div>
      <section style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div><small style={{ color: 'var(--primary)', fontWeight: 800, letterSpacing: '.12em' }}>MY IPS</small><h1 className="section-title">Service Hub</h1><p className="section-subtitle">Request, approve and follow every service from brief to delivery.</p></div>
        <Link to="/services" className="btn btn-primary">+ Create service request</Link>
      </section>

      <div className="grid grid-3 gap-4" style={{ marginBottom: '1.5rem' }}>
        <Link to="/services?type=professional" className="card" style={{ textDecoration: 'none', color: 'inherit', borderTop: '4px solid #a305a6' }}><strong>Professional service</strong><p style={{ color: 'var(--text-muted)' }}>Business, digital, research, career and technical support.</p><span style={{ color: 'var(--primary)', fontWeight: 800 }}>Create request →</span></Link>
        <Link to="/services?type=odd_job" className="card" style={{ textDecoration: 'none', color: 'inherit', borderTop: '4px solid #ee7b54' }}><strong>Odd job</strong><p style={{ color: 'var(--text-muted)' }}>Local errands, moving, personal admin, events and practical help.</p><span style={{ color: '#b54627', fontWeight: 800 }}>Create request →</span></Link>
        <Link to="/client/order" className="card" style={{ textDecoration: 'none', color: 'inherit', borderTop: '4px solid #2868d8' }}><strong>Academic & writing</strong><p style={{ color: 'var(--text-muted)' }}>Use the specialist order form for structured writing work.</p><span style={{ color: '#2868d8', fontWeight: 800 }}>Create order →</span></Link>
      </div>

      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[['all','All'],['active','Active'],['quotes','Quotes'],['professional','Professional'],['odd_job','Odd jobs']].map(([value,label]) =>
              <button key={value} className={`btn btn-sm ${filter === value ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(value)}>{label}</button>
            )}
          </div>
          <input className="form-input" style={{ maxWidth: 270 }} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search requests..." />
        </div>

        {!visible.length && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No service requests match this view.</div>}
        {visible.map(r => (
          <article key={r._id} style={{ padding: '1.1rem 0', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 16 }}>
            <div>
              <small style={{ color: 'var(--primary)', fontWeight: 800 }}>{r.family === 'odd_job' ? 'ODD JOB' : 'PROFESSIONAL'} · {r.category}</small>
              <h3 style={{ margin: '.25rem 0' }}><Link to={`/client/services/${r.request_id}`} style={{ color: 'inherit' }}>{r.title}</Link></h3>
              <p style={{ color: 'var(--text-muted)', margin: '.25rem 0' }}>{r.status} · {r.progress || 0}% complete · {r.provider_name || 'Provider not assigned'}</p>
              <div style={{ height: 7, background: 'var(--bg-surface-2)', borderRadius: 8, maxWidth: 600 }}><i style={{ display: 'block', height: '100%', width: `${r.progress || 0}%`, background: 'linear-gradient(90deg,#660273,#ee7b54)', borderRadius: 8 }} /></div>
              {r.status === 'Quoted' && !r.quote?.accepted && <div style={{ display: 'flex', gap: 8, marginTop: '1rem', flexWrap: 'wrap' }}>
                <button disabled={busy === r.request_id} className="btn btn-primary btn-sm" onClick={() => decideQuote(r, true)}>Accept ${r.quote.total}</button>
                <Link className="btn btn-ghost btn-sm" to={`/client/services/${r.request_id}`}>Request changes with reason</Link>
              </div>}
            </div>
            <div style={{ textAlign: 'right' }}><strong>{r.request_id}</strong><div style={{ marginTop: 4 }}>{r.quote?.total ? `$${r.quote.total}` : 'Quote pending'}</div><small style={{ color: 'var(--text-muted)' }}>{r.deadline ? `Due ${new Date(r.deadline).toLocaleDateString()}` : 'Deadline TBD'}</small></div>
          </article>
        ))}
      </section>
    </div>
  );
}
