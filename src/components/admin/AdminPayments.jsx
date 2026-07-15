import React, { useEffect, useState } from 'react';
import { fmtCur } from '../../utils/formatters';

export default function AdminPayments() {
  const [orders, setOrders] = useState([]);
  const [linkForm, setLinkForm] = useState({ clientEmail: '', amount: '', description: '' });
  const [generatedLink, setGeneratedLink] = useState('');

  useEffect(() => {
    const raw = JSON.parse(localStorage.getItem('ips-orders') || '[]');
    setOrders(raw);
  }, []);

  const totalRevenue = orders.reduce((sum, o) => {
    const paidCount = (o.milestones || []).filter((m) => m.paid).length;
    const totalMilestones = o.milestones?.length || 1;
    return sum + (o.total_fee_usd / totalMilestones) * paidCount;
  }, 0);

  const outstanding = orders.reduce((sum, o) => {
    const unpaidMilestones = (o.milestones || []).filter((m) => !m.paid && m.status !== 'cancelled');
    const totalMilestones = o.milestones?.length || 1;
    return sum + (o.total_fee_usd / totalMilestones) * unpaidMilestones.length;
  }, 0);

  const outstandingOrders = orders.filter((o) => {
    return (o.milestones || []).some((m) => !m.paid && m.status !== 'cancelled');
  });

  const handleCreateLink = (e) => {
    e.preventDefault();
    const id = `pay_${Date.now()}`;
    const link = `https://ips-services.com/pay/${id}?amount=${linkForm.amount}&desc=${encodeURIComponent(linkForm.description)}`;
    setGeneratedLink(link);
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem' }}>Payments</h2>

      <div className="grid grid-3 gap-4" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ background: 'var(--grad-card-1)', color: '#fff', border: 'none' }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Total Revenue</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: 4 }}>{fmtCur(totalRevenue)}</div>
        </div>
        <div className="card" style={{ background: 'var(--grad-card-3)', color: '#fff', border: 'none' }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Outstanding</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: 4 }}>{fmtCur(outstanding)}</div>
        </div>
        <div className="card" style={{ background: 'var(--grad-card-4)', color: '#fff', border: 'none' }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Orders with Unpaid Milestones</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: 4 }}>{outstandingOrders.length}</div>
        </div>
      </div>

      <div className="grid grid-2 gap-4">
        {/* Outstanding Breakdown */}
        <div className="card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem' }}>📋 Outstanding by Order</h3>
          {outstandingOrders.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No outstanding payments.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {outstandingOrders.map((o) => {
                const unpaidCount = (o.milestones || []).filter((m) => !m.paid && m.status !== 'cancelled').length;
                const totalMilestones = o.milestones?.length || 1;
                const orderOutstanding = (o.total_fee_usd / totalMilestones) * unpaidCount;
                return (
                  <div key={o.order_id} className="flex justify-between items-center" style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>Order #{o.order_id}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{o.client_name} · {o.service_type}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>{fmtCur(orderOutstanding)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Create Payment Link */}
        <div className="card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem' }}>🔗 Create Payment Link</h3>
          <form onSubmit={handleCreateLink} className="flex flex-col gap-3">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Client Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="client@example.com"
                value={linkForm.clientEmail}
                onChange={(e) => setLinkForm({ ...linkForm, clientEmail: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Amount (USD)</label>
              <input
                type="number"
                className="form-input"
                placeholder="0.00"
                min="1"
                step="0.01"
                value={linkForm.amount}
                onChange={(e) => setLinkForm({ ...linkForm, amount: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Description</label>
              <input
                type="text"
                className="form-input"
                placeholder="Milestone 2 payment for Order #1001"
                value={linkForm.description}
                onChange={(e) => setLinkForm({ ...linkForm, description: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn btn-gold" style={{ marginTop: 4 }}>
              Generate Link
            </button>
          </form>

          {generatedLink && (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: 10,
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.2)',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)', marginBottom: 4 }}>Link Generated</div>
              <div style={{ fontSize: '0.8rem', wordBreak: 'break-all', color: 'var(--text-secondary)' }}>{generatedLink}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
