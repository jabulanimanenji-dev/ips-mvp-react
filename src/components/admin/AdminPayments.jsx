import React, { useEffect, useState } from 'react';
import { fmtCur } from '../../utils/formatters';

export default function AdminPayments() {
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Payment data could not be loaded.');
        setAnalytics(data.analytics);
      })
      .catch(loadError => setError(loadError.message));
  }, []);

  const finance = analytics?.finance || {};
  const outstanding = analytics?.outstandingAcademicOrders || [];

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ color: 'var(--primary)', fontSize: '.72rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' }}>MongoDB finance ledger</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '.35rem 0' }}>Payments & Tracked Value</h2>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>This view reports recorded milestones and accepted quotes. Phase 8 collection processing remains intentionally disabled.</p>
      </div>
      {error && <div className="toast error" style={{ position: 'static', marginBottom: '1rem', maxWidth: 'none' }}>{error}</div>}
      <div className="grid grid-4 gap-4" style={{ marginBottom: '1rem' }}>
        {[
          ['Academic paid', fmtCur(finance.paidAcademic || 0)],
          ['Academic outstanding', fmtCur(finance.outstandingAcademic || 0)],
          ['Accepted service quotes', fmtCur(finance.acceptedServiceValue || 0)],
          ['Total tracked value', fmtCur(finance.trackedValue || 0)]
        ].map(([label, value]) => (
          <div className="card" key={label}><strong style={{ fontSize: '1.55rem' }}>{value}</strong><div style={{ color: 'var(--text-muted)' }}>{label}</div></div>
        ))}
      </div>
      <div className="grid grid-2 gap-4">
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Outstanding Academic Milestones</h3>
          {outstanding.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No outstanding academic milestone value.</p> : outstanding.map(item => (
            <div key={item.order_id} className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border)', padding: '.7rem 0' }}>
              <div><strong>{item.order_id}</strong><small style={{ display: 'block', color: 'var(--text-muted)' }}>{item.client_name} · {item.service_type}</small></div>
              <strong>{fmtCur(item.outstanding)}</strong>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 style={{ marginBottom: '.5rem' }}>Collection Status</h3>
          <div className="badge badge-review" style={{ marginBottom: '1rem' }}>Tracking only</div>
          <p style={{ color: 'var(--text-muted)' }}>No payment links are generated because no verified payment gateway is active. This prevents fake checkout URLs and false payment confirmations.</p>
          <p style={{ color: 'var(--text-secondary)' }}>When Phase 8 is activated, provider webhooks, payment intents, refunds, receipts, reconciliation, and disputes will connect here.</p>
        </div>
      </div>
    </div>
  );
}
