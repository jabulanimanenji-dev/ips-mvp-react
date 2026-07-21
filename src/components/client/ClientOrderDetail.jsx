import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ClientOrderDetail() {
  const { orderId } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) throw new Error('Order not found');
        const data = await res.json();
        const fetchedOrder = data.order || data;

        // Security: verify this order belongs to the logged-in client
        if (fetchedOrder.clientId !== user?._id && fetchedOrder.client_id !== user?.client_id) {
          throw new Error('You do not have access to this order');
        }

        setOrder(fetchedOrder);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchOrder();
    } else {
      setLoading(false);
      setError('You must be logged in to view this order');
    }
  }, [orderId, user]);

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

  const fmtDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const fmtCur = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
  };

  const daysUntil = (dateStr) => {
    if (!dateStr) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading order details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Order Not Found</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          {error || 'The order you are looking for does not exist.'}
        </p>
        <Link to="/client/orders" className="btn btn-primary">
          Back to Orders
        </Link>
      </div>
    );
  }

  const days = daysUntil(order.deadline);
  const milestones = order.milestones || [];
  const completedMs = milestones.filter((m) => m.completed || m.status === 'completed').length;
  const paidMs = milestones.filter((m) => m.paid).length;
  const progress = milestones.length > 0 ? Math.round((completedMs / milestones.length) * 100) : 0;

  return (
    <div className="client-order-detail" style={{ padding: '2rem 0' }}>
      <div className="container">
        <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <Link to="/client/orders" style={{ color: 'var(--primary)', fontSize: '0.85rem', textDecoration: 'none' }}>
              ← Back to Orders
            </Link>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--text-primary)' }}>
              Order #{order._id || order.id || order.order_id}
            </h2>
          </div>
          <span style={{
            padding: '6px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            fontWeight: 600,
            background: `${statusColor(order.status)}15`,
            color: statusColor(order.status)
          }}>
            {order.status}
          </span>
        </div>

        {/* Order info grid */}
        <div className="grid grid-3 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Service</div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{order.service || order.service_type}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{order.level || order.academic_level}</div>
          </div>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Deadline</div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmtDate(order.deadline)}</div>
            <div style={{ fontSize: '0.85rem', color: days <= 3 && days >= 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
              {days >= 0 ? `${days} day${days !== 1 ? 's' : ''} remaining` : `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`}
            </div>
          </div>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Total Fee</div>
            <div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--text-primary)' }}>{fmtCur(order.price || order.total_fee_usd)}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {paidMs} of {milestones.length} milestones paid
            </div>
          </div>
        </div>

        <div className="grid grid-2 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {/* Topic & Details */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Order Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <DetailRow label="Topic" value={order.topic || order.topic_title} />
              <DetailRow label="Subject" value={order.subject} />
              <DetailRow label="Pages" value={order.pages || order.word_count?.toLocaleString() || 'N/A'} />
              <DetailRow label="Created" value={fmtDate(order.createdAt || order.created_date)} />
              <DetailRow label="Assigned Writer" value={order.writerName || order.writer_name || 'Not assigned yet'} />
            </div>
            {order.requirements && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Requirements</div>
                <div style={{
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-light)',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap'
                }}>
                  {order.requirements}
                </div>
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Overall Progress</h3>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{
                height: 8,
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: 'var(--primary)',
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <span>{completedMs} of {milestones.length} milestones complete</span>
                <span style={{ fontWeight: 700 }}>{progress}%</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Payment Status</div>
              <div style={{
                height: 8,
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${milestones.length > 0 ? Math.round((paidMs / milestones.length) * 100) : 0}%`,
                  height: '100%',
                  background: '#10b981',
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <span>{paidMs} of {milestones.length} milestones paid</span>
                <span style={{ fontWeight: 700 }}>
                  {milestones.length > 0 ? Math.round((paidMs / milestones.length) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Milestones Timeline */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>Milestone Timeline</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {milestones.map((m, i) => {
              const isCompleted = m.completed || m.status === 'completed';
              const isActive = m.status === 'active' || m.status === 'In Progress';
              const dotColor = isCompleted ? '#10b981' : isActive ? '#3b82f6' : 'var(--text-muted)';
              return (
                <div key={m.label || m.name || i} style={{ display: 'flex', position: 'relative' }}>
                  {/* Connector line */}
                  {i < milestones.length - 1 && (
                    <div style={{
                      position: 'absolute',
                      left: 11,
                      top: 28,
                      bottom: -8,
                      width: 2,
                      background: isCompleted ? '#10b981' : 'var(--border-light)',
                      zIndex: 0,
                    }} />
                  )}
                  {/* Dot */}
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: dotColor,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    flexShrink: 0,
                    marginRight: '1rem',
                    zIndex: 1,
                  }}>
                    {isCompleted ? '✓' : (m.stage || i + 1)}
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, paddingBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.label || m.name}</div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          background: m.paid ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                          color: m.paid ? '#10b981' : '#f59e0b'
                        }}>
                          {m.paid ? 'Paid' : 'Unpaid'}
                        </span>
                        {isCompleted && <span style={{
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          background: 'rgba(16,185,129,0.15)',
                          color: '#10b981'
                        }}>Completed</span>}
                        {isActive && <span style={{
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          background: 'rgba(59,130,246,0.15)',
                          color: '#3b82f6'
                        }}>In Progress</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Due: {fmtDate(m.dueDate || m.due_date)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{value || '—'}</div>
    </div>
  );
}