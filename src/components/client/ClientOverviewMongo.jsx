import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DashboardZone from '../common/DashboardZone';
import ConfigurableActionGroup from '../common/ConfigurableActionGroup';
import PrivateQuoteInbox from './PrivateQuoteInbox.jsx';

const closed = ['Completed', 'Cancelled'];
const academicLaunch=import.meta.env.VITE_STUDENT_LAUNCH==='true';

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
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <DashboardZone portal="client" id="hero">
      <section style={{
        borderRadius: 24,
        padding: '2rem',
        color: '#fff',
        background: 'linear-gradient(125deg,#102a43 0%,#284960 70%,#806947 100%)',
        boxShadow: '0 22px 55px rgba(16,24,40,.18)',
        marginBottom: '1.5rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <small style={{ letterSpacing: '.14em', textTransform: 'uppercase', opacity: .72, fontWeight: 800 }}>My Workspace</small>
          <h1 style={{ fontSize: 'clamp(1.8rem,4vw,3rem)', margin: '.5rem 0', color: '#fff' }}>
            {user?.first_login?'Welcome to IPS':`Welcome back, ${user?.username||'there'}`}.
          </h1>
          <p style={{ maxWidth: 640, color: 'rgba(255,255,255,.76)', marginBottom: '1.25rem' }}>
            {academicLaunch?'Track your academic support requests, private quotations, project files and written correspondence in one secure place.':'One place for professional services, odd jobs, academic support, quotes, files and delivery progress.'}
          </p>
          <ConfigurableActionGroup portal="client" area="hero" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} />
        </div>
      </section>
      </DashboardZone>

      <PrivateQuoteInbox />

      <DashboardZone portal="client" id="stats">
      <div data-studio-protected="true" data-studio-protected-reason="Private customer metrics are calculated from live account data." className="grid grid-4 gap-4" style={{ marginBottom: '1.5rem' }}>
        {[
          [academicLaunch?'My projects':'All jobs', activity.length, academicLaunch?'Academic support work and requests':'Across every IPS service'],
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
      </DashboardZone>

      <DashboardZone portal="client" id="serviceLaunchers">
      {academicLaunch?
      <div className="grid grid-3 gap-4" style={{marginBottom:'1.5rem'}}>
        <Link to="/#request-support" className="card" style={{textDecoration:'none',color:'inherit',borderTop:'4px solid #c4a06a'}}>
          <small style={{color:'var(--primary)',fontWeight:800}}>START HERE</small>
          <h3 style={{margin:'.5rem 0'}}>Get a Quote</h3>
          <p style={{color:'var(--text-muted)'}}>Explain what you need, choose a written contact method and receive a reviewed quotation.</p>
        </Link>
        <Link to="/client/services" className="card" style={{textDecoration:'none',color:'inherit',borderTop:'4px solid #254964'}}>
          <small style={{color:'var(--primary)',fontWeight:800}}>MY WORK</small>
          <h3 style={{margin:'.5rem 0'}}>My Projects</h3>
          <p style={{color:'var(--text-muted)'}}>Follow academic support work after IPS accepts and confirms your request.</p>
        </Link>
        <Link to="/client/profile" className="card" style={{textDecoration:'none',color:'inherit',borderTop:'4px solid #72938f'}}>
          <small style={{color:'var(--primary)',fontWeight:800}}>MY PRIVACY</small>
          <h3 style={{margin:'.5rem 0'}}>My Private Account</h3>
          <p style={{color:'var(--text-muted)'}}>Manage your chosen username, verified email and account security.</p>
        </Link>
      </div>:
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

      }
      </DashboardZone>

      <DashboardZone portal="client" id="activity">
      <div className="card">
        <div className="flex justify-between items-center" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div><h3>Recent activity</h3><p style={{ color: 'var(--text-muted)' }}>{academicLaunch?'Your academic projects, updates and service history.':'Every job, together in one timeline.'}</p></div>
          <ConfigurableActionGroup portal="client" area="activity" actionClassName="btn-sm" />
        </div>
        {loading && <p>Loading your workspace...</p>}
        {!loading && !activity.length && <p style={{ color: 'var(--text-muted)', padding: '1.5rem 0' }}>No activity yet. Choose a service above to begin.</p>}
        {activity.slice(0, 7).map(item => (
          <Link key={`${item.kind}-${item.id}`} to={item.href} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, padding: '1rem 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}>
            <span><small style={{ color: 'var(--primary)', fontWeight: 800 }}>{academicLaunch&&item.kind==='Professional service'?'ACADEMIC SUPPORT':item.kind.toUpperCase()}</small><br /><strong>{item.title}</strong><br /><small style={{ color: 'var(--text-muted)' }}>{item.id}</small></span>
            <span style={{ textAlign: 'right' }}><strong>{item.status}</strong><br /><small>{item.progress}% complete</small></span>
          </Link>
        ))}
      </div>
      </DashboardZone>
    </div>
  );
}
