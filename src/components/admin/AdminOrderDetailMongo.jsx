import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fmtCur, fmtDate } from '../../utils/formatters';
import OrderWorkspace from '../common/OrderWorkspace';

export default function AdminOrderDetailMongo() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { admin } = useAuth();
  const [order, setOrder] = useState(null);
  const [writers, setWriters] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [orderResponse, writerResponse] = await Promise.all([
        fetch(`/api/orders/${orderId}`),
        fetch('/api/writers')
      ]);
      const orderData = await orderResponse.json();
      const writerData = await writerResponse.json();
      if (!orderResponse.ok) throw new Error(orderData.error || 'Order not found.');
      setOrder(orderData.order);
      setWriters(writerData.writers || []);
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => { load(); }, [orderId]);

  const patchOrder = async (updates) => {
    const response = await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const data = await response.json();
    if (response.ok) setOrder(data.order);
    else setError(data.error || 'Update failed.');
  };

  const assignWriter = async (writerId) => {
    const writer = writers.find(item => item.writer_id === writerId);
    await patchOrder({
      writer_id: writerId,
      writer_name: writer?.full_name || '',
      status: writerId ? 'Assigned' : 'Awaiting Assignment'
    });
  };

  const updateMilestone = async (index, updates) => {
    const milestones = order.milestones.map((milestone, milestoneIndex) =>
      milestoneIndex === index ? { ...milestone, ...updates } : milestone
    );
    await patchOrder({ milestones });
  };

  if (error && !order) return <div className="card">{error}</div>;
  if (!order) return <div className="card">Loading order…</div>;

  return (
    <div>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/orders')}>← Back to Orders</button>
      <div className="flex justify-between items-center" style={{ margin: '1rem 0', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>{order.order_id}: {order.topic_title}</h2>
          <span style={{ color: 'var(--text-muted)' }}>{order.client_name} · {order.client_email}</span>
        </div>
        <strong>{fmtCur(order.total_fee_usd)}</strong>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginBottom: 10 }}>{error}</div>}

      <div className="grid grid-2 gap-4">
        <div className="card">
          <h3>Order Control</h3>
          <label className="form-label">Assigned Writer</label>
          <select className="form-select" value={order.writer_id || ''} onChange={event => assignWriter(event.target.value)}>
            <option value="">Unassigned</option>
            {writers.filter(writer => writer.status === 'Active').map(writer => (
              <option key={writer.writer_id} value={writer.writer_id}>{writer.full_name} — {writer.primary_expertise}</option>
            ))}
          </select>
          <label className="form-label" style={{ marginTop: 12 }}>Deadline</label>
          <div>{fmtDate(order.deadline)}</div>
          <label className="form-label" style={{ marginTop: 12 }}>Requirements</label>
          <div style={{ whiteSpace: 'pre-wrap' }}>{order.requirements || 'No additional requirements.'}</div>
        </div>

        <div className="card">
          <h3>Milestones</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {(order.milestones || []).map((milestone, index) => (
              <div key={milestone.stage || index} style={{ border: '1px solid var(--border)', padding: 10, borderRadius: 8 }}>
                <strong>{milestone.name}</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Due {fmtDate(milestone.due_date)} · {fmtCur(milestone.amount)}</div>
                <div className="flex gap-1" style={{ marginTop: 6, flexWrap: 'wrap' }}>
                  <select className="form-select" value={milestone.status} onChange={event => updateMilestone(index, { status: event.target.value })} style={{ maxWidth: 170 }}>
                    {['pending', 'active', 'submitted', 'revision required', 'completed'].map(status => <option key={status}>{status}</option>)}
                  </select>
                  <button className="btn btn-secondary btn-sm" onClick={() => updateMilestone(index, { paid: !milestone.paid })}>{milestone.paid ? 'Paid' : 'Mark Paid'}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <OrderWorkspace order={order} role="admin" actor={admin} />
    </div>
  );
}
