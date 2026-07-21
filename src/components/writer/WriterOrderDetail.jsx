import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function WriterOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { writer } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) throw new Error('Order not found');
        const data = await res.json();
        setOrder(data.order || data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  const handleStatusUpdate = async (newStatus) => {
    setUpdating(true);
    setUpdateError('');
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Failed to update status');
      const data = await res.json();
      setOrder(data.order || data);
    } catch (err) {
      setUpdateError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleMilestoneToggle = async (index) => {
    if (!order.milestones) return;
    const updated = [...order.milestones];
    updated[index] = { ...updated[index], completed: !updated[index].completed };

    setUpdating(true);
    setUpdateError('');
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestones: updated })
      });
      if (!res.ok) throw new Error('Failed to update milestone');
      const data = await res.json();
      setOrder(data.order || data);
    } catch (err) {
      setUpdateError(err.message);
    } finally {
      setUpdating(false);
    }
  };

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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        Loading order details...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: 'var(--danger)', marginBottom: '1rem' }}>
          {error || 'Order not found'}
        </div>
        <button onClick={() => navigate('/writer/orders')} className="btn btn-primary">
          ← Back to Orders
        </button>
      </div>
    );
  }

  return (
    <div className="writer-order-detail">
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate('/writer/orders')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--primary)',
            cursor: 'pointer',
            fontSize: '0.9rem',
            marginBottom: '0.5rem',
            padding: 0
          }}
        >
          ← Back to Orders
        </button>
        <h1 className="section-title" style={{ margin: 0 }}>{order.topic || 'Untitled Order'}</h1>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: `${statusColor(order.status)}15`,
            color: statusColor(order.status)
          }}>
            {order.status}
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {order._id || order.id}
          </span>
        </div>
      </div>

      {updateError && (
        <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {updateError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {/* Order Details */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>Order Details</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <DetailRow label="Service" value={order.service} />
            {order.level && <DetailRow label="Level" value={order.level} />}
            <DetailRow label="Subject" value={order.subject || '—'} />
            {order.pages && <DetailRow label="Pages" value={order.pages} />}
            <DetailRow label="Deadline" value={order.deadline ? new Date(order.deadline).toLocaleDateString() : '—'} />
            <DetailRow label="Price" value={`$${order.price || 0}`} />
            <DetailRow label="Your Payout" value={`$${order.writerPayout || Math.round((order.price || 0) * 0.6)}`} />
            <DetailRow label="Client" value={order.clientName || '—'} />
            <DetailRow label="Client Email" value={order.clientEmail || '—'} />
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

        {/* Status & Milestones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Status Actions */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>Update Status</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {['Pending', 'In Progress', 'Under Review', 'Completed'].map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusUpdate(s)}
                  disabled={updating || order.status === s}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: order.status === s ? 'var(--primary)' : 'var(--bg-card)',
                    color: order.status === s ? 'white' : 'var(--text-secondary)',
                    cursor: order.status === s ? 'default' : 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    opacity: order.status === s ? 1 : 0.8
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Milestones */}
          {order.milestones && order.milestones.length > 0 && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>Milestones</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {order.milestones.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => handleMilestoneToggle(i)}
                    disabled={updating}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      background: m.completed ? 'rgba(16,185,129,0.08)' : 'var(--bg-surface)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%'
                    }}
                  >
                    <span style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: m.completed ? '#10b981' : 'var(--border-light)',
                      color: m.completed ? 'white' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      flexShrink: 0
                    }}>
                      {m.completed ? '✓' : i + 1}
                    </span>
                    <span style={{ flex: 1, fontSize: '0.85rem', color: m.completed ? '#10b981' : 'var(--text-primary)', textDecoration: m.completed ? 'line-through' : 'none' }}>
                      {m.label}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {m.dueDate}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}