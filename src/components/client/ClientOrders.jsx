import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ClientOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    if (!user || !user._id) {
      setLoading(false);
      return;
    }

    const fetchOrders = async () => {
      try {
        const res = await fetch(`/api/orders/client/${user._id}`);
        if (!res.ok) throw new Error('Failed to fetch orders');
        const data = await res.json();
        setOrders(data.orders || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user]);

  const statusColor = (status) => {
    switch (status) {
      case 'Pending': return '#f59e0b';
      case 'In Progress': return '#3b82f6';
      case 'Under Review': return '#8b5cf6';
      case 'Completed': return '#10b981';
      case 'Cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const filteredOrders = filter === 'All'
    ? orders
    : orders.filter(o => o.status === filter);

  const filters = ['All', 'Pending', 'In Progress', 'Under Review', 'Completed', 'Cancelled'];

  return (
    <div className="client-orders" style={{ padding: '2rem 0' }}>
      <div className="container">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 className="section-title" style={{ margin: 0 }}>My Orders</h1>
            <p className="section-subtitle" style={{ margin: '0.25rem 0 0 0' }}>
              Track and manage all your orders
            </p>
          </div>
          <button
            onClick={() => navigate('/client/order')}
            className="btn btn-primary"
            style={{
              padding: '10px 20px',
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              whiteSpace: 'nowrap'
            }}
          >
            + New Order
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="filter-tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)',
                background: filter === f ? 'var(--primary)' : 'var(--bg-card)',
                color: filter === f ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
            >
              {f} {f !== 'All' && `(${orders.filter(o => o.status === f).length})`}
            </button>
          ))}
        </div>

        {/* Orders Table / Cards */}
        <div className="card" style={{ padding: '1rem' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Loading orders...
            </div>
          )}

          {error && (
            <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: 'var(--danger)', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          {!loading && !error && filteredOrders.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                {filter === 'All' ? "You haven't placed any orders yet." : `No ${filter.toLowerCase()} orders.`}
              </p>
              <button
                onClick={() => navigate('/client/order')}
                className="btn btn-primary"
                style={{ padding: '10px 20px' }}
              >
                Place an Order
              </button>
            </div>
          )}

          {!loading && !error && filteredOrders.length > 0 && (
            <div className="orders-table-wrapper" style={{ overflowX: 'auto' }}>
              <table className="orders-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-light)' }}>
                    <th style={{ textAlign: 'left', padding: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Order</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Service</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Deadline</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Price</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr
                      key={order._id || order.id}
                      style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                          {order.topic || 'Untitled'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {order._id || order.id}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                        {order.service}
                        {order.level && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{order.level}</div>}
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {order.deadline ? new Date(order.deadline).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: `${statusColor(order.status)}15`,
                          color: statusColor(order.status)
                        }}>
                          {order.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                        ${order.price || 0}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <Link
                          to={`/client/orders/${order._id || order.id}`}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--primary)',
                            color: 'white',
                            textDecoration: 'none',
                            fontSize: '0.8rem',
                            fontWeight: 500
                          }}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}