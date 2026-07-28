import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DashboardZone from '../common/DashboardZone';
import ConfigurableActionGroup from '../common/ConfigurableActionGroup';

const done = ['Completed', 'Cancelled'];

export default function WriterDashboard() {
  const { writer } = useAuth();
  const [orders, setOrders] = useState([]);
  const [services, setServices] = useState([]);
  const [filter, setFilter] = useState('attention');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!writer?.writer_id) return setLoading(false);
    Promise.all([
      fetch(`/api/orders/writer/${writer.writer_id}`).then(r => r.json()),
      fetch(`/api/services?provider_id=${writer.writer_id}`).then(r => r.json())
    ]).then(([a, b]) => {
      setOrders(a.orders || []);
      setServices(b.requests || []);
    }).finally(() => setLoading(false));
  };
  useEffect(load, [writer]);

  const jobs = useMemo(() => [
    ...services.map(job => ({
      ...job, id: job.request_id, title: job.title, kind: job.family === 'odd_job' ? 'Odd job' : 'Professional',
      href: '/writer/services', due: job.deadline, payout: job.quote?.labor || 0
    })),
    ...orders.map(job => ({
      ...job, id: job.order_id, title: job.topic_title, kind: 'Academic & writing',
      href: `/writer/orders/${job._id}`, due: job.deadline,
      payout: job.writerPayout || Math.round((job.total_fee_usd || 0) * .6)
    }))
  ], [orders, services]);

  const today = new Date();
  const attention = jobs.filter(j => {
    const days = j.due ? (new Date(j.due) - today) / 86400000 : 99;
    return !done.includes(j.status) && (days <= 3 || ['Assigned', 'Pending', 'Revision Required', 'Correction Required'].includes(j.status));
  });
  const shown = jobs.filter(j => {
    const text = `${j.title} ${j.id} ${j.kind} ${j.status}`.toLowerCase();
    const matchesQuery = text.includes(query.toLowerCase());
    if (!matchesQuery) return false;
    if (filter === 'attention') return attention.includes(j);
    if (filter === 'active') return !done.includes(j.status);
    if (filter === 'completed') return j.status === 'Completed';
    return true;
  });
  const active = jobs.filter(j => !done.includes(j.status));
  const dueSoon = jobs.filter(j => j.due && !done.includes(j.status) && (new Date(j.due) - today) / 86400000 <= 3);
  const earnings = jobs.filter(j => j.status === 'Completed').reduce((sum, j) => sum + Number(j.payout || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <DashboardZone portal="writer" id="hero">
      <section style={{ padding: '2rem', borderRadius: 24, color: '#fff', background: 'var(--grad-hero)', marginBottom: '1.5rem', boxShadow: '0 24px 60px rgba(11,28,59,.2)' }}>
        <small style={{ fontWeight: 800, letterSpacing: '.14em', opacity: .7 }}>PROVIDER COMMAND CENTER</small>
        <h1 style={{ color: '#fff', fontSize: 'clamp(1.8rem,4vw,3rem)', margin: '.4rem 0' }}>Good to see you, {writer?.full_name?.split(' ')[0] || 'Provider'}.</h1>
        <p style={{ color: 'rgba(255,255,255,.75)', maxWidth: 650 }}>Review priorities, manage every assignment and keep clients informed from one workspace.</p>
        <ConfigurableActionGroup portal="writer" area="hero" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: '1.25rem' }} />
      </section>
      </DashboardZone>

      <DashboardZone portal="writer" id="attention">
      {attention.length > 0 && <section className="card" style={{ marginBottom: '1.5rem', borderLeft: '5px solid #ee7b54' }}>
        <strong style={{ color: '#b54627' }}>{attention.length} item{attention.length === 1 ? '' : 's'} need your attention</strong>
        <p style={{ color: 'var(--text-muted)', margin: '.25rem 0 0' }}>New assignments, revisions, or jobs approaching their deadline.</p>
      </section>}
      </DashboardZone>

      <DashboardZone portal="writer" id="stats">
      <div className="grid grid-4 gap-4" style={{ marginBottom: '1.5rem' }}>
        {[['All jobs', jobs.length], ['Active', active.length], ['Due soon', dueSoon.length], ['Earned', `$${earnings.toFixed(0)}`]].map(([label, value]) =>
          <div className="card" key={label}><strong style={{ fontSize: '1.9rem', color: 'var(--primary)' }}>{value}</strong><div>{label}</div></div>
        )}
      </div>
      </DashboardZone>

      <DashboardZone portal="writer" id="queue">
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div><h2 style={{ margin: 0 }}>My work queue</h2><p style={{ color: 'var(--text-muted)', margin: '.2rem 0' }}>Open a job to message, upload files and update delivery.</p></div>
          <input className="form-input" style={{ maxWidth: 280 }} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search jobs..." />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' }}>
          {[['attention','Needs attention'],['active','Active'],['all','All'],['completed','Completed']].map(([value,label]) =>
            <button key={value} className={`btn btn-sm ${filter === value ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(value)}>{label}</button>
          )}
        </div>
        {loading && <p>Loading your work queue...</p>}
        {!loading && !shown.length && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nothing in this view.</div>}
        {shown.map(job => (
          <Link key={`${job.kind}-${job.id}`} to={job.href} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, padding: '1rem 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}>
            <div><small style={{ color: 'var(--primary)', fontWeight: 800 }}>{job.kind.toUpperCase()} · {job.id}</small><h3 style={{ margin: '.25rem 0' }}>{job.title}</h3><small style={{ color: 'var(--text-muted)' }}>{job.due ? `Due ${new Date(job.due).toLocaleDateString()}` : 'Deadline to be confirmed'}</small></div>
            <div style={{ textAlign: 'right' }}><strong>{job.status}</strong><div>{job.progress || 0}% complete</div>{job.payout > 0 && <small>${job.payout}</small>}</div>
          </Link>
        ))}
      </section>
      </DashboardZone>
    </div>
  );
}
