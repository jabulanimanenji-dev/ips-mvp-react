import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fmtCur, fmtDate } from '../../utils/formatters';
import { BADGE_STYLES } from '../../utils/constants';

export default function ClientOverview() {
  const { user } = useAuth();

  const orders = useMemo(() => {
    if (!user?.client_id) return [];
    const all = JSON.parse(localStorage.getItem('ips-orders') || '[]');
    return all.filter((o) => o.client_id === user.client_id);
  }, [user]);

  const stats = useMemo(() => {
    const active = orders.filter((o) => o.status === 'New' || o.status === 'In Progress' || o.status === 'Under Review').length;
    const completed = orders.filter((o) => o.status === 'Completed').length;
    const totalSpent = orders.reduce((sum, o) => sum + (o.total_fee_usd || 0), 0);
    return { active, completed, totalSpent };
  }, [orders]);

  const recentOrders = orders.slice(0, 5);

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Dashboard</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Welcome back, {user?.full_name || 'Client'}
          </p>
        </div>
        <Link to="/client/orders" className="btn btn-primary btn-sm">
          View All Orders
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-3 gap-4" style={{ marginBottom: '2rem' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
          <div className="label" style={{ marginBottom: '0.5rem' }}>Active Orders</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {stats.active}
          </div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="label" style={{ marginBottom: '0.5rem' }}>Completed</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {stats.completed}
          </div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--accent-gold)' }}>
          <div className="label" style={{ marginBottom: '0.5rem' }}>Total Spent</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {fmtCur(stats.totalSpent)}
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="card">
        <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 700 }}>Recent Orders</h3>
        </div>

        {recentOrders.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
            No orders yet. <Link to="/quote" style={{ color: 'var(--text-link)' }}>Request a quote</Link> to get started.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Service</th>
                  <th>Topic</th>
                  <th>Deadline</th>
                  <th>Fee</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.order_id}>
                    <td>
                      <Link
                        to={`/client/orders/${o.order_id}`}
                        style={{ color: 'var(--text-link)', fontWeight: 600, textDecoration: 'none' }}
                      >
                        #{o.order_id}
                      </Link>
                    </td>
                    <td>{o.service_type}</td>
                    <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.topic_title}
                    </td>
                    <td>{fmtDate(o.deadline)}</td>
                    <td>{fmtCur(o.total_fee_usd)}</td>
                    <td>
                      <span className={`badge ${BADGE_STYLES[o.status] || 'badge-new'}`}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
