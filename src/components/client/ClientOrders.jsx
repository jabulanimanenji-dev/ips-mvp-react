import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fmtCur, fmtDate, daysUntil } from '../../utils/formatters';
import { BADGE_STYLES } from '../../utils/constants';

export default function ClientOrders() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('All');

  const orders = useMemo(() => {
    if (!user?.client_id) return [];
    const all = JSON.parse(localStorage.getItem('ips-orders') || '[]');
    return all.filter((o) => o.client_id === user.client_id);
  }, [user]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'All') return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const statuses = ['All', 'New', 'In Progress', 'Under Review', 'Completed', 'Disputed', 'Cancelled'];

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>My Orders</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {orders.length} order{orders.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <Link to="/quote" className="btn btn-primary btn-sm">
          + New Order
        </Link>
      </div>

      {/* Filters */}
      <div className="flex" style={{ gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {statuses.map((s) => (
          <button
            key={s}
            className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStatusFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="card">
        {filteredOrders.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
            No orders match this filter.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Service</th>
                  <th>Topic</th>
                  <th>Deadline</th>
                  <th>Fee</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => {
                  const days = daysUntil(o.deadline);
                  const urgent = days <= 3 && days >= 0 && o.status !== 'Completed' && o.status !== 'Cancelled';
                  return (
                    <tr key={o.order_id}>
                      <td style={{ fontWeight: 600 }}>#{o.order_id}</td>
                      <td>{o.service_type}</td>
                      <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.topic_title}
                      </td>
                      <td>
                        <div>{fmtDate(o.deadline)}</div>
                        {urgent && (
                          <span className="badge badge-urgent" style={{ marginTop: '0.25rem', fontSize: '0.65rem' }}>
                            {days}d left
                          </span>
                        )}
                        {days < 0 && o.status !== 'Completed' && o.status !== 'Cancelled' && (
                          <span className="badge badge-overdue" style={{ marginTop: '0.25rem', fontSize: '0.65rem' }}>
                            Overdue
                          </span>
                        )}
                      </td>
                      <td>{fmtCur(o.total_fee_usd)}</td>
                      <td>
                        <span className={`badge ${BADGE_STYLES[o.status] || 'badge-new'}`}>
                          {o.status}
                        </span>
                      </td>
                      <td>
                        <Link
                          to={`/client/orders/${o.order_id}`}
                          className="btn btn-sm btn-ghost"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
