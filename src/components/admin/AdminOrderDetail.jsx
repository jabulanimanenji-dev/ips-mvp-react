import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fmtCur, fmtDate, daysUntil } from '../../utils/formatters';
import { ORDER_STATUSES, BADGE_STYLES } from '../../utils/constants';

export default function AdminOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [writers, setWriters] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadData();
  }, [orderId]);

  const loadData = () => {
    const allOrders = JSON.parse(localStorage.getItem('ips-orders') || '[]');
    const found = allOrders.find((o) => String(o.order_id) === String(orderId));
    setOrder(found || null);
    const allWriters = JSON.parse(localStorage.getItem('ips-admin-writers') || '[]');
    setWriters(allWriters);
  };

  const saveOrders = (updated) => {
    localStorage.setItem('ips-orders', JSON.stringify(updated));
    loadData();
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const completeMilestone = (milestoneIndex) => {
    const allOrders = JSON.parse(localStorage.getItem('ips-orders') || '[]');
    const idx = allOrders.findIndex((o) => String(o.order_id) === String(orderId));
    if (idx === -1) return;
    const updatedOrder = { ...allOrders[idx] };
    const milestones = [...(updatedOrder.milestones || [])];
    if (milestones[milestoneIndex]) {
      milestones[milestoneIndex] = { ...milestones[milestoneIndex], status: 'completed' };
      // Activate next pending milestone
      const nextPending = milestones.findIndex((m, i) => i > milestoneIndex && m.status === 'pending');
      if (nextPending !== -1) {
        milestones[nextPending] = { ...milestones[nextPending], status: 'active' };
      }
      updatedOrder.milestones = milestones;
      allOrders[idx] = updatedOrder;
      saveOrders(allOrders);
      showToast(`Milestone "${milestones[milestoneIndex].name}" marked completed.`);
    }
  };

  const markPaid = (milestoneIndex) => {
    const allOrders = JSON.parse(localStorage.getItem('ips-orders') || '[]');
    const idx = allOrders.findIndex((o) => String(o.order_id) === String(orderId));
    if (idx === -1) return;
    const updatedOrder = { ...allOrders[idx] };
    const milestones = [...(updatedOrder.milestones || [])];
    if (milestones[milestoneIndex]) {
      milestones[milestoneIndex] = { ...milestones[milestoneIndex], paid: true };
      updatedOrder.milestones = milestones;
      allOrders[idx] = updatedOrder;
      saveOrders(allOrders);
      showToast(`Milestone "${milestones[milestoneIndex].name}" marked paid.`);
    }
  };

  const assignWriter = (writer) => {
    const allOrders = JSON.parse(localStorage.getItem('ips-orders') || '[]');
    const idx = allOrders.findIndex((o) => String(o.order_id) === String(orderId));
    if (idx === -1) return;
    const updatedOrder = { ...allOrders[idx] };
    updatedOrder.writer_id = writer.writer_id;
    updatedOrder.writer_name = writer.full_name;
    if (updatedOrder.status === 'New') updatedOrder.status = 'In Progress';
    allOrders[idx] = updatedOrder;
    saveOrders(allOrders);
    setShowAssignModal(false);
    showToast(`Writer ${writer.full_name} assigned.`);
  };

  const setStatus = (status) => {
    const allOrders = JSON.parse(localStorage.getItem('ips-orders') || '[]');
    const idx = allOrders.findIndex((o) => String(o.order_id) === String(orderId));
    if (idx === -1) return;
    allOrders[idx] = { ...allOrders[idx], status };
    saveOrders(allOrders);
    showToast(`Order status updated to ${status}.`);
  };

  if (!order) {
    return (
      <div className="card">
        <p style={{ color: 'var(--text-muted)' }}>Order not found.</p>
        <button className="btn btn-secondary" onClick={() => navigate('/admin/orders')} style={{ marginTop: '1rem' }}>
          Back to Orders
        </button>
      </div>
    );
  }

  const client = JSON.parse(localStorage.getItem('ips-clients') || '[]').find((c) => c.client_id === order.client_id);

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type}`} style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 2000 }}>
          {toast.message}
        </div>
      )}

      <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Order #{order.order_id}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 2 }}>
            Created {fmtDate(order.created_date)} · {daysUntil(order.deadline)} days until deadline
          </p>
        </div>
        <div className="flex gap-2">
          <span className={`badge ${BADGE_STYLES[order.status] || 'badge-new'}`} style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}>
            {order.status}
          </span>
        </div>
      </div>

      <div className="grid grid-3 gap-4">
        {/* Client Info */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>👤 Client</h3>
          <div className="flex flex-col gap-2" style={{ fontSize: '0.88rem' }}>
            <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Name</span> <span style={{ fontWeight: 600 }}>{order.client_name}</span></div>
            <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Client ID</span> <span>{order.client_id}</span></div>
            <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Email</span> <span>{client?.email || '—'}</span></div>
            <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Country</span> <span>{client?.country || '—'}</span></div>
            <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Phone</span> <span>{client?.phone || '—'}</span></div>
          </div>
        </div>

        {/* Order Details */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>📋 Order Details</h3>
          <div className="flex flex-col gap-2" style={{ fontSize: '0.88rem' }}>
            <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Service</span> <span style={{ fontWeight: 600 }}>{order.service_type}</span></div>
            <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Level</span> <span>{order.academic_level}</span></div>
            <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Subject</span> <span>{order.subject}</span></div>
            <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Words</span> <span>{order.word_count?.toLocaleString() || '—'}</span></div>
            <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Total Fee</span> <span style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>{fmtCur(order.total_fee_usd)}</span></div>
          </div>
        </div>

        {/* Writer & Admin Actions */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>✍️ Writer</h3>
          <div style={{ marginBottom: '1rem' }}>
            {order.writer_name ? (
              <div>
                <div style={{ fontWeight: 700 }}>{order.writer_name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {order.writer_id}</div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>No writer assigned</div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button className="btn btn-primary btn-sm" onClick={() => setShowAssignModal(true)}>
              {order.writer_id ? 'Reassign Writer' : 'Assign Writer'}
            </button>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {ORDER_STATUSES.filter((s) => s !== order.status).map((s) => (
                <button key={s} className="btn btn-sm btn-secondary" onClick={() => setStatus(s)}>
                  Set {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Milestones */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem' }}>📅 Milestones</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Name</th>
                <th>Status</th>
                <th>Paid</th>
                <th>Due Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(order.milestones || []).map((m, i) => (
                <tr key={i}>
                  <td>{m.stage}</td>
                  <td style={{ fontWeight: 600 }}>{m.name}</td>
                  <td>
                    <span className={`badge ${m.status === 'completed' ? 'badge-completed' : m.status === 'active' ? 'badge-progress' : 'badge-new'}`}>
                      {m.status}
                    </span>
                  </td>
                  <td>
                    {m.paid ? (
                      <span className="badge badge-completed">Paid</span>
                    ) : (
                      <span className="badge badge-new">Unpaid</span>
                    )}
                  </td>
                  <td>{fmtDate(m.due_date)}</td>
                  <td>
                    <div className="flex gap-2">
                      {m.status !== 'completed' && (
                        <button className="btn btn-sm btn-success" onClick={() => completeMilestone(i)}>
                          Complete
                        </button>
                      )}
                      {!m.paid && (
                        <button className="btn btn-sm btn-gold" onClick={() => markPaid(i)}>
                          Mark Paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Actions Bar */}
      <div className="card" style={{ marginTop: '1.5rem', background: 'var(--bg-surface-2)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>🛠️ Admin Actions</h3>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => setShowAssignModal(true)}>Assign / Reassign Writer</button>
          <button className="btn btn-gold" onClick={() => navigate('/admin/payments')}>Create Payment Link</button>
          <button className="btn btn-secondary" onClick={() => navigate('/admin/messages')}>Message Client</button>
          <button className="btn btn-danger" onClick={() => { if (window.confirm('Cancel this order?')) setStatus('Cancelled'); }}>
            Cancel Order
          </button>
        </div>
      </div>

      {/* Assign Writer Modal */}
      {showAssignModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,1,13,0.75)', zIndex: 1500,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}
          onClick={() => setShowAssignModal(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Assign Writer</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setShowAssignModal(false)}>✕</button>
            </div>
            {writers.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No writers available.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {writers.map((w) => (
                  <div
                    key={w.writer_id}
                    className="flex justify-between items-center"
                    style={{ padding: '0.75rem 1rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{w.full_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {w.primary_expertise} · {w.availability} · {fmtCur(w.rate_per_page_usd)}/page · ⭐ {w.rating}
                      </div>
                    </div>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => assignWriter(w)}
                      disabled={w.availability === 'On Leave' || w.writer_id === order.writer_id}
                    >
                      {w.writer_id === order.writer_id ? 'Assigned' : 'Assign'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
