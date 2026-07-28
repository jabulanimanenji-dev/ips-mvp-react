import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import OrderWorkspace from './OrderWorkspace';

export default function ServiceJobDetail({ role }) {
  const { requestId } = useParams();
  const { user, writer, admin } = useAuth();
  const actor = role === 'client' ? user : role === 'writer' ? writer : admin;
  const [job, setJob] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await fetch(`/api/services/${requestId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Service job not found.');
      if (role === 'client' && data.request.client_id !== user?.client_id) throw new Error('This service does not belong to your account.');
      if (role === 'writer' && data.request.provider_id !== writer?.writer_id) throw new Error('This service is not assigned to your account.');
      setJob(data.request);
      fetch(`/api/work/${requestId}/quotes`).then(r => r.json()).then(q => setQuotes(q.quotes || [])).catch(() => {});
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, [requestId, role, user, writer]);

  const patch = async updates => {
    const actorId = actor?.client_id || actor?.writer_id || actor?.id || actor?._id || role;
    const res = await fetch(`/api/services/${requestId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, actor_id: actorId, actor_role: role === 'writer' ? 'provider' : role })
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Update failed.');
    setJob(data.request);
  };

  if (error && !job) return <div className="card"><h3>Unable to open service</h3><p>{error}</p></div>;
  if (!job) return <div className="card">Loading service workspace...</div>;
  const back = role === 'client' ? '/client/services' : role === 'writer' ? '/writer/services' : '/admin/services';

  return (
    <div>
      <Link to={back} className="btn btn-ghost btn-sm">← Back to services</Link>
      <section style={{ margin: '1rem 0', padding: '2rem', borderRadius: 22, color: '#fff', background: 'linear-gradient(125deg,#081b38,#48135f 70%,#a12681)' }}>
        <small style={{ fontWeight: 800, letterSpacing: '.12em', opacity: .75 }}>{job.family === 'odd_job' ? 'ODD JOB' : 'PROFESSIONAL SERVICE'} · {job.request_id}</small>
        <h1 style={{ color: '#fff', margin: '.4rem 0' }}>{job.title}</h1>
        <p style={{ color: 'rgba(255,255,255,.75)', maxWidth: 720 }}>{job.description}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><span className="btn btn-sm" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}>{job.status}</span><span className="btn btn-sm" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}>{job.progress || 0}% complete</span></div>
      </section>

      <div className="grid grid-3 gap-4">
        <div className="card"><small>Category</small><h3>{job.category}</h3><p>{job.delivery_mode}{job.location ? ` · ${job.location}` : ''}</p></div>
        <div className="card"><small>Delivery</small><h3>{job.deadline ? new Date(job.deadline).toLocaleDateString() : 'To be agreed'}</h3><p>{job.urgency} priority</p></div>
        <div className="card"><small>Quote</small><h3>{job.quote?.total ? `${job.quote.currency} ${job.quote.total}` : 'Pending'}</h3><p>{job.quote?.accepted ? 'Accepted' : job.status === 'Quoted' ? 'Decision required' : 'Under review'}</p></div>
      </div>

      {(role === 'writer' || role === 'admin') && <section className="card" style={{ marginTop: '1rem' }}>
        <h3>Delivery control</h3>
        <div className="grid grid-2 gap-3">
          <label className="form-group"><span className="form-label">Status</span><select className="form-select" value={job.status} onChange={e => patch({ status: e.target.value, reason: `Status updated by ${role}` })}>{(role === 'writer' ? ['Assigned','Scheduled','In Progress','Waiting for Client','Submitted for Review'] : ['Under Review','Clarification Required','Quoted','Quote Accepted','Awaiting Assignment','Assigned','Scheduled','In Progress','Waiting for Client','Submitted for Review','Correction Required','Ready for Client','Completed','On Hold','Cancelled','Disputed']).map(v => <option key={v}>{v}</option>)}</select></label>
          <label className="form-group"><span className="form-label">Progress</span><input className="form-input" type="number" min="0" max="100" value={job.progress || 0} onChange={e => setJob({ ...job, progress: Number(e.target.value) })} onBlur={() => patch({ progress: job.progress })} /></label>
        </div>
      </section>}

      {role === 'client' && job.status === 'Ready for Client' && <section className="card" style={{ marginTop: '1rem', borderLeft: '5px solid #10b981' }}>
        <h3>Completion awaiting your approval</h3>
        <p>Review the final delivery and completion evidence below. Approve only when the agreed outcome has been delivered.</p>
        <button className="btn btn-primary" onClick={() => patch({ status: 'Completed', reason: 'Client approved final completion' })}>Approve completed work</button>
      </section>}

      {!!quotes.length && <section className="card" style={{ marginTop: '1rem' }}>
        <h3>Quote history</h3>
        {quotes.map(item => <div key={item._id} style={{ padding: '.75rem 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div><strong>Version {item.version}</strong><div>{item.notes}</div><small>{item.expires_at ? `Valid until ${new Date(item.expires_at).toLocaleDateString()}` : 'No expiry'}{item.superseded_at ? ' · Superseded' : ''}</small></div>
          <div style={{ textAlign: 'right' }}><strong>{item.currency} {item.total}</strong><div>{item.accepted ? 'Accepted' : 'Not accepted'}</div></div>
        </div>)}
      </section>}

      <OrderWorkspace order={{ ...job, order_id: job.request_id }} workKind="service" role={role} actor={actor} quote={job.quote} />
    </div>
  );
}
