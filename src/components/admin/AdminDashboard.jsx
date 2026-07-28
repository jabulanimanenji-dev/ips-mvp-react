import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCMS } from '../../context/CMSContext';
import { fmtCur, fmtDate } from '../../utils/formatters';
import { BADGE_STYLES } from '../../utils/constants';
import DashboardZone from '../common/DashboardZone';
import ConfigurableActionGroup from '../common/ConfigurableActionGroup';

export default function AdminDashboard() {
  const { cms } = useCMS();
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Dashboard could not be loaded.');
        setAnalytics(data.analytics);
      })
      .catch(loadError => setError(loadError.message));
  }, []);

  const counts = analytics?.counts || {};
  const finance = analytics?.finance || {};
  const attention = analytics?.attention || [];
  const activity = analytics?.recentActivity || [];
  const statCards = [
    { title: 'Academic Paid', value: fmtCur(finance.paidAcademic || 0), grad: 'linear-gradient(135deg,#7A4BA8,#C3A7E3)' },
    { title: 'Active Work', value: counts.activeWork || 0, grad: 'linear-gradient(135deg,#4F95B1,#6EC9E8)' },
    { title: 'New Signups (30d)', value: counts.newSignups30d || 0, grad: 'linear-gradient(135deg,#D07E47,#ED9E6F)' },
    { title: 'Open Support', value: counts.openTickets || 0, grad: 'linear-gradient(135deg,#512F5C,#B66570)' }
  ];

  return (
    <div>
      <div className="flex justify-between items-end" style={{ marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div><div style={{ color: 'var(--primary)', fontSize: '.72rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' }}>MongoDB mission control</div><h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '.35rem 0' }}>Dashboard</h2></div>
        <small style={{ color: 'var(--text-muted)' }}>One source of truth across every IPS service</small>
      </div>
      {error && <div className="toast error" style={{ position: 'static', marginBottom: '1rem', maxWidth: 'none' }}>{error}</div>}

      <div className="grid grid-3 gap-4">
        <DashboardZone portal="admin" id="stats">
          <div className="grid grid-4 gap-4" style={{ marginBottom: '1.5rem' }}>
            {statCards.map(card => (
              <div key={card.title} className="card" style={{ background: card.grad, color: '#fff', border: 'none' }}>
                <strong style={{ fontSize: '1.6rem' }}>{card.value}</strong><div style={{ opacity: .9 }}>{card.title}</div>
              </div>
            ))}
          </div>
        </DashboardZone>

        <DashboardZone portal="admin" id="attention">
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}><h3>Academic Orders Needing Attention</h3><Link to="/admin/orders" className="btn btn-secondary btn-sm">View All</Link></div>
            {attention.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>All clear.</p> : (
              <div style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr><th>ID</th><th>Client</th><th>Service</th><th>Deadline</th><th>Status</th></tr></thead><tbody>
                {attention.map(item => <tr key={item.order_id}><td><Link to={`/admin/orders/${item.order_id}`}>{item.order_id}</Link></td><td>{item.client_name}</td><td>{item.service_type}</td><td>{fmtDate(item.deadline)}</td><td><span className={`badge ${BADGE_STYLES[item.status] || 'badge-new'}`}>{item.status}</span></td></tr>)}
              </tbody></table></div>
            )}
          </div>
        </DashboardZone>

        <DashboardZone portal="admin" id="quickActions">
          <div className="card"><h3 style={{ marginBottom: '1rem' }}>Quick Actions</h3><ConfigurableActionGroup portal="admin" area="quickActions" className="flex flex-col gap-2" /></div>
        </DashboardZone>

        <DashboardZone portal="admin" id="activity">
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <h3 style={{ marginBottom: '1rem' }}>Recent Platform Activity</h3>
            {activity.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No activity yet.</p> : activity.map(item => (
              <Link key={`${item.kind}-${item.id}`} to={item.target} className="flex justify-between items-center" style={{ padding: '.7rem 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}>
                <span><strong>{item.text}</strong><small style={{ display: 'block', color: 'var(--text-muted)' }}>{fmtDate(item.date)} · {item.kind}</small></span>
                <span className={`badge ${BADGE_STYLES[item.status] || 'badge-review'}`}>{item.status}</span>
              </Link>
            ))}
          </div>
        </DashboardZone>

        <DashboardZone portal="admin" id="cmsStatus">
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Platform Status</h3>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between"><span>Brand</span><strong>{cms?.brand?.name || 'IPS'}</strong></div>
              <div className="flex justify-between"><span>Clients</span><strong>{counts.clients || 0}</strong></div>
              <div className="flex justify-between"><span>Providers</span><strong>{counts.providers || 0}</strong></div>
              <div className="flex justify-between"><span>Service requests</span><strong>{counts.serviceRequests || 0}</strong></div>
              <Link to="/admin/cms" className="btn btn-primary btn-sm">Open Visual Builder</Link>
            </div>
          </div>
        </DashboardZone>
      </div>
    </div>
  );
}
