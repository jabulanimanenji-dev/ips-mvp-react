import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const closed = ['Completed', 'Cancelled'];

export default function ClientOverviewMongo() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.client_id) return setLoading(false);
    Promise.all([
      fetch(`/api/orders/client/${user.client_id}`).then(r => r.json()),
      fetch(`/api/services?client_id=${user.client_id}`).then(r => r.json())
    ]).then(([orderData, serviceData]) => {
      setOrders(orderData.orders || []);
      setServices(serviceData.requests || []);
    }).finally(() => setLoading(false));
  }, [user]);

  const activity = useMemo(() => [
    ...services.map(item => ({
      id: item.request_id,
      title: item.title,
      kind: item.family === 'odd_job' ? 'Odd job' : 'Professional service',
      status: item.status,
      progress: item.progress || 0,
      href: '/client/services',
      date: item.updatedAt || item.createdAt
    })),
    ...orders.map(item => ({
      id: item.order_id,
      title: item.topic_title,
      kind: 'Academic & writing',
      status: item.status,
      progress: item.progress || 0,
      href: `/client/orders/${item._id}`,
      date: item.updatedAt || item.createdAt
    }))
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [orders, services]);

  const active = activity.filter(item => !closed.includes(item.status));
  const quotes = services.filter(item => item.status === 'Quoted' && !item.quote?.accepted);
  const completed = activity.filter(item => item.status === 'Completed');

  return (
    <div>
      <section style={{
        borderRadius: 24,
        padding: '2rem',
        color: '#fff',
        background: 'linear-gradient(125deg,#091a35 0%,#40105d 62%,#8a187d 100%)',
        boxShadow: '0 22px 55px rgba(16,24,40,.18)',
        marginBottom: '1.5rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <small style={{ letterSpacing: '.14em', textTransform: 'uppercase', opacity: .72, fontWeight: 800 }}>Your IPS workspace</small>
          <h1 style={{ fontSize: 'clamp(1.8rem,4vw,3rem)', margin: '.5rem 0', color: '#fff' }}>
            Welcome back, {user?.full_name?.split(' ')[0] || 'Client'}.
          </h1>
          <p style={{ maxWidth: 640, color: 'rgba(255,255,255,.76)', marginBottom: '1.25rem' }}>
            One place for professional services, odd jobs, academic support, quotes, files and delivery progress.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link to="/services?type=professional" className="btn" style={{ background: '#fff', color: '#40105d' }}>Request a service</Link>
            <Link to="/client/order" className="btn" style={{ background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.25)' }}>Academic & writing order</Link>
          </div>
        </div>
      </section>

      <div className="grid grid-4 gap-4" style={{ marginBottom: '1.5rem' }}>
        {[
          ['All jobs', activity.length, 'Across every IPS service'],
          ['Active', active.length, 'Currently being handled'],
          ['Quotes waiting', quotes.length, 'Ready for your decision'],
          ['Completed', completed.length, 'Delivered successfully']
        ].map(([label, value, detail]) => (
          <div className="card" key={label}>
            <div style={{ fontSize: '2rem', fontWeight: 850, color: 'var(--primary)' }}>{value}</div>
            <strong>{label}</strong>
            <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: 4 }}>{detail}</small>
          </div>
        ))}
      </div>

      <div className="grid grid-3 gap-4" style={{ marginBottom: '1.5rem' }}>
        <Link to="/services?type=professional" className="card" style={{ textDecoration: 'none', color: 'inherit', borderTop: '4px solid #a305a6' }}>
          <small style={{ color: 'var(--primary)', fontWeight: 800 }}>START HERE</small>
          <h3 style={{ margin: '.5rem 0' }}>Professional services</h3>
          <p style={{ color: 'var(--text-muted)' }}>Business, career, digital, research and technology support.</p>
        </Link>
        <Link to="/services?type=odd_job" className="card" style={{ textDecoration: 'none', color: 'inherit', borderTop: '4px solid #ee7b54' }}>
          <small style={{ color: '#c04f2e', fontWeight: 800 }}>GET IT DONE</small>
          <h3 style={{ margin: '.5rem 0' }}>Odd jobs</h3>
          <p style={{ color: 'var(--text-muted)' }}>Errands, relocation, personal admin, events and local tasks.</p>
        </Link>
        <Link to="/client/order" className="card" style={{ textDecoration: 'none', color: 'inherit', borderTop: '4px solid #2868d8' }}>
          <small style={{ color: '#2868d8', fontWeight: 800 }}>SPECIALIST DESK</small>
          <h3 style={{ margin: '.5rem 0' }}>Academic & writing</h3>
          <p style={{ color: 'var(--text-muted)' }}>Structured writing, editing and research orders.</p>
        </Link>
      </div>

      <div className="card">
        <div className="flex justify-between items-center" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div><h3>Recent activity</h3><p style={{ color: 'var(--text-muted)' }}>Every job, together in one timeline.</p></div>
          <Link className="btn btn-secondary btn-sm" to="/client/services">Open Service Hub</Link>
        </div>
        {loading && <p>Loading your workspace...</p>}
        {!loading && !activity.length && <p style={{ color: 'var(--text-muted)', padding: '1.5rem 0' }}>No activity yet. Choose a service above to begin.</p>}
        {activity.slice(0, 7).map(item => (
          <Link key={`${item.kind}-${item.id}`} to={item.href} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, padding: '1rem 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}>
            <span><small style={{ color: 'var(--primary)', fontWeight: 800 }}>{item.kind.toUpperCase()}</small><br /><strong>{item.title}</strong><br /><small style={{ color: 'var(--text-muted)' }}>{item.id}</small></span>
            <span style={{ textAlign: 'right' }}><strong>{item.status}</strong><br /><small>{item.progress}% complete</small></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
