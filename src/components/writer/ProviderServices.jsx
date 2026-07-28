import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

const progressStatuses = ['Assigned', 'Scheduled', 'In Progress', 'Waiting for Client', 'Submitted for Review'];

export default function ProviderServices() {
  const { writer } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!writer?.writer_id) return setLoading(false);
    fetch(`/api/services?provider_id=${writer.writer_id}`)
      .then(r => r.json())
      .then(data => setJobs(data.requests || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, [writer]);

  const update = async (job, updates) => {
    await fetch(`/api/services/${job.request_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, actor_id: writer.writer_id, actor_role: 'provider' })
    });
    load();
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <small style={{ color: 'var(--primary)', fontWeight: 800, letterSpacing: '.12em' }}>PROVIDER WORKSPACE</small>
        <h1 className="section-title">Assigned service jobs</h1>
        <p className="section-subtitle">Professional services and odd jobs assigned to you by IPS.</p>
      </div>
      {loading && <div className="card">Loading assigned jobs...</div>}
      {!loading && !jobs.length && <div className="card"><h3>No marketplace jobs assigned</h3><p style={{ color: 'var(--text-muted)' }}>New assignments will appear here automatically.</p></div>}
      <div className="grid grid-2 gap-4">
        {jobs.map(job => (
          <article className="card" key={job._id} style={{ borderTop: `4px solid ${job.family === 'odd_job' ? '#ee7b54' : '#a305a6'}` }}>
            <small style={{ color: 'var(--primary)', fontWeight: 800 }}>{job.family === 'odd_job' ? 'ODD JOB' : 'PROFESSIONAL'} · {job.request_id}</small>
            <h3 style={{ margin: '.5rem 0' }}>{job.title}</h3>
            <p style={{ color: 'var(--text-muted)' }}>{job.category} · {job.delivery_mode}{job.location ? ` · ${job.location}` : ''}</p>
            <p>{job.description}</p>
            <div style={{ height: 8, background: 'var(--bg-surface-2)', borderRadius: 8, overflow: 'hidden', margin: '1rem 0 .5rem' }}>
              <span style={{ display: 'block', height: '100%', width: `${job.progress || 0}%`, background: 'linear-gradient(90deg,#660273,#ee7b54)' }} />
            </div>
            <small>{job.progress || 0}% complete</small>
            <div className="grid grid-2 gap-3" style={{ marginTop: '1rem' }}>
              <select className="form-select" value={job.status} onChange={e => update(job, { status: e.target.value })}>
                {progressStatuses.map(status => <option key={status}>{status}</option>)}
              </select>
              <input className="form-input" aria-label="Job progress percentage" type="number" min="0" max="100" value={job.progress || 0} onChange={e => update(job, { progress: Number(e.target.value) })} />
            </div>
            <Link to={`/writer/services/${job.request_id}`} className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>Open workspace</Link>
          </article>
        ))}
      </div>
    </div>
  );
}
