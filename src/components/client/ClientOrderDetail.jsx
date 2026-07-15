import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fmtCur, fmtDate, daysUntil } from '../../utils/formatters';
import { BADGE_STYLES } from '../../utils/constants';

export default function ClientOrderDetail() {
  const { orderId } = useParams();
  const { user } = useAuth();

  const order = useMemo(() => {
    if (!user?.client_id) return null;
    const all = JSON.parse(localStorage.getItem('ips-orders') || '[]');
    return all.find((o) => String(o.order_id) === String(orderId) && o.client_id === user.client_id) || null;
  }, [orderId, user]);

  if (!order) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Order Not Found</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          The order you are looking for does not exist or you do not have access to it.
        </p>
        <Link to="/client/orders" className="btn btn-primary">
          Back to Orders
        </Link>
      </div>
    );
  }

  const days = daysUntil(order.deadline);
  const milestones = order.milestones || [];
  const completedMs = milestones.filter((m) => m.status === 'completed').length;
  const paidMs = milestones.filter((m) => m.paid).length;
  const progress = milestones.length > 0 ? Math.round((completedMs / milestones.length) * 100) : 0;

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Link to="/client/orders" style={{ color: 'var(--text-link)', fontSize: '0.85rem', textDecoration: 'none' }}>
            ← Back to Orders
          </Link>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.35rem' }}>
            Order #{order.order_id}
          </h2>
        </div>
        <span className={`badge ${BADGE_STYLES[order.status] || 'badge-new'}`} style={{ fontSize: '0.85rem' }}>
          {order.status}
        </span>
      </div>

      {/* Order info grid */}
      <div className="grid grid-3 gap-4" style={{ marginBottom: '2rem' }}>
        <div className="card">
          <div className="label" style={{ marginBottom: '0.5rem' }}>Service</div>
          <div style={{ fontWeight: 700 }}>{order.service_type}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{order.academic_level}</div>
        </div>
        <div className="card">
          <div className="label" style={{ marginBottom: '0.5rem' }}>Deadline</div>
          <div style={{ fontWeight: 700 }}>{fmtDate(order.deadline)}</div>
          <div style={{ fontSize: '0.85rem', color: days <= 3 && days >= 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
            {days >= 0 ? `${days} day${days !== 1 ? 's' : ''} remaining` : `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`}
          </div>
        </div>
        <div className="card">
          <div className="label" style={{ marginBottom: '0.5rem' }}>Total Fee</div>
          <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>{fmtCur(order.total_fee_usd)}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {paidMs} of {milestones.length} milestones paid
          </div>
        </div>
      </div>

      <div className="grid grid-2 gap-4" style={{ marginBottom: '2rem' }}>
        {/* Topic & Details */}
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Order Details</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <div className="label">Topic</div>
              <div style={{ fontWeight: 600 }}>{order.topic_title}</div>
            </div>
            <div>
              <div className="label">Subject</div>
              <div>{order.subject}</div>
            </div>
            <div>
              <div className="label">Word Count</div>
              <div>{order.word_count?.toLocaleString() || 'N/A'}</div>
            </div>
            <div>
              <div className="label">Created</div>
              <div>{fmtDate(order.created_date)}</div>
            </div>
            <div>
              <div className="label">Assigned Writer</div>
              <div>{order.writer_name || 'Not assigned yet'}</div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Overall Progress</h3>
          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                height: 8,
                background: 'var(--bg-surface-2)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: 'var(--grad-hero)',
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
            <div className="flex justify-between" style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span>{completedMs} of {milestones.length} milestones complete</span>
              <span style={{ fontWeight: 700 }}>{progress}%</span>
            </div>
          </div>

          <div>
            <div className="label" style={{ marginBottom: '0.5rem' }}>Payment Status</div>
            <div
              style={{
                height: 8,
                background: 'var(--bg-surface-2)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${milestones.length > 0 ? Math.round((paidMs / milestones.length) * 100) : 0}%`,
                  height: '100%',
                  background: 'var(--success)',
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
            <div className="flex justify-between" style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span>{paidMs} of {milestones.length} milestones paid</span>
              <span style={{ fontWeight: 700 }}>
                {milestones.length > 0 ? Math.round((paidMs / milestones.length) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Milestones Timeline */}
      <div className="card">
        <h3 style={{ fontWeight: 700, marginBottom: '1.25rem' }}>Milestone Timeline</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {milestones.map((m, i) => {
            const isCompleted = m.status === 'completed';
            const isActive = m.status === 'active';
            const dotColor = isCompleted ? 'var(--success)' : isActive ? 'var(--accent-cyan)' : 'var(--text-muted)';
            return (
              <div key={m.stage} className="flex" style={{ position: 'relative' }}>
                {/* Connector line */}
                {i < milestones.length - 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 11,
                      top: 28,
                      bottom: -8,
                      width: 2,
                      background: isCompleted ? 'var(--success)' : 'var(--border)',
                      zIndex: 0,
                    }}
                  />
                )}
                {/* Dot */}
                <div
                  style={{
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
                  }}
                >
                  {isCompleted ? '✓' : m.stage}
                </div>
                {/* Content */}
                <div style={{ flex: 1, paddingBottom: '1.5rem' }}>
                  <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontWeight: 700 }}>{m.name}</div>
                    <div className="flex" style={{ gap: '0.5rem' }}>
                      <span className={`badge ${m.paid ? 'badge-completed' : 'badge-new'}`}>
                        {m.paid ? 'Paid' : 'Unpaid'}
                      </span>
                      {isCompleted && <span className="badge badge-completed">Completed</span>}
                      {isActive && <span className="badge badge-progress">In Progress</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Due: {fmtDate(m.due_date)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
