import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCMS } from '../../context/CMSContext';
import { fmtCur, fmtDate, daysUntil } from '../../utils/formatters';
import { BADGE_STYLES } from '../../utils/constants';

export default function AdminDashboard() {
  const { cms } = useCMS();
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    const rawOrders = JSON.parse(localStorage.getItem('ips-orders') || '[]');
    const rawClients = JSON.parse(localStorage.getItem('ips-clients') || '[]');
    setOrders(rawOrders);
    setClients(rawClients);

    // Build recent activity from orders
    const acts = rawOrders
      .slice()
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
      .slice(0, 6)
      .map((o) => ({
        id: o.order_id,
        text: `Order #${o.order_id} — ${o.service_type} for ${o.client_name}`,
        date: o.created_date,
        status: o.status,
      }));
    setActivity(acts);
  }, []);

  const revenue = orders.reduce((sum, o) => {
    const paid = (o.milestones || []).filter((m) => m.paid).reduce((s, m) => s + (o.total_fee_usd / (o.milestones.length || 1)), 0);
    return sum + paid;
  }, 0);

  const activeOrders = orders.filter((o) => o.status === 'In Progress' || o.status === 'Under Review').length;
  const newSignups = clients.filter((c) => {
    const reg = new Date(c.registration_date);
    const now = new Date();
    return now - reg < 30 * 24 * 60 * 60 * 1000;
  }).length;
  const pendingPayments = orders.reduce((sum, o) => {
    const unpaidMilestones = (o.milestones || []).filter((m) => !m.paid && (m.status === 'completed' || m.status === 'active'));
    return sum + unpaidMilestones.length * (o.total_fee_usd / (o.milestones.length || 1));
  }, 0);

  const attentionOrders = orders
    .filter((o) => {
      const d = daysUntil(o.deadline);
      return (d <= 7 && d >= 0 && o.status !== 'Completed' && o.status !== 'Cancelled') || o.status === 'Disputed' || o.status === 'New';
    })
    .slice(0, 5);

  const statCards = [
    { title: 'Total Revenue', value: fmtCur(revenue), icon: '💰', grad: 'linear-gradient(135deg, #7A4BA8 0%, #C3A7E3 100%)' },
    { title: 'Active Orders', value: activeOrders, icon: '📦', grad: 'linear-gradient(135deg, #6EC9E8 0%, #4F95B1 100%)' },
    { title: 'New Signups (30d)', value: newSignups, icon: '👤', grad: 'linear-gradient(135deg, #D07E47 0%, #ED9E6F 100%)' },
    { title: 'Pending Payments', value: fmtCur(pendingPayments), icon: '⏳', grad: 'linear-gradient(135deg, #512F5C 0%, #B66570 100%)' },
  ];

  return (
    <div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem' }}>Dashboard</h2>

      {/* Stats */}
      <div className="grid grid-4 gap-4" style={{ marginBottom: '1.5rem' }}>
        {statCards.map((s, i) => (
          <div
            key={i}
            className="card"
            style={{
              background: s.grad,
              color: '#fff',
              border: 'none',
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{s.icon}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{s.value}</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>{s.title}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-3 gap-4">
        {/* Orders Needing Attention */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>🚨 Orders Needing Attention</h3>
            <Link to="/admin/orders" className="btn btn-sm btn-secondary">View All</Link>
          </div>
          {attentionOrders.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>All clear. No orders need attention.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Client</th>
                  <th>Service</th>
                  <th>Deadline</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attentionOrders.map((o) => (
                  <tr key={o.order_id}>
                    <td>
                      <Link to={`/admin/orders/${o.order_id}`} style={{ color: 'var(--text-link)', fontWeight: 600 }}>
                        #{o.order_id}
                      </Link>
                    </td>
                    <td>{o.client_name}</td>
                    <td>{o.service_type}</td>
                    <td>{fmtDate(o.deadline)} <span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>({daysUntil(o.deadline)}d)</span></td>
                    <td><span className={`badge ${BADGE_STYLES[o.status] || 'badge-new'}`}>{o.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem' }}>⚡ Quick Actions</h3>
          <div className="flex flex-col gap-2">
            <Link to="/admin/orders" className="btn btn-primary">Manage Orders</Link>
            <Link to="/admin/clients" className="btn btn-secondary">View Clients</Link>
            <Link to="/admin/writers" className="btn btn-secondary">Assign Writers</Link>
            <Link to="/admin/payments" className="btn btn-gold">Create Payment Link</Link>
            <Link to="/admin/cms" className="btn btn-ghost">Edit CMS (God Mode)</Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem' }}>📋 Recent Activity</h3>
          {activity.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No recent activity.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {activity.map((a) => (
                <div key={a.id} className="flex justify-between items-center" style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{a.text}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmtDate(a.date)}</div>
                  </div>
                  <span className={`badge ${BADGE_STYLES[a.status] || 'badge-new'}`}>{a.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CMS Status */}
        <div className="card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem' }}>🌐 CMS Status</h3>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>Brand Name</span>
              <span style={{ fontWeight: 600 }}>{cms?.brand?.name || 'I P S'}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>Services Listed</span>
              <span style={{ fontWeight: 600 }}>{(cms?.services || []).length}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>FAQs</span>
              <span style={{ fontWeight: 600 }}>{(cms?.faq || []).length}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>Testimonials</span>
              <span style={{ fontWeight: 600 }}>{(cms?.testimonials || []).length}</span>
            </div>
            <Link to="/admin/cms" className="btn btn-sm btn-primary" style={{ marginTop: '0.5rem' }}>
              Open CMS Editor
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
