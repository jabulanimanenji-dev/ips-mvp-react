import React, { useEffect, useState } from 'react';
import { fmtCur } from '../../utils/formatters';
import SpecialistPayoutLedger from './SpecialistPayoutLedger.jsx';
import StudentRefundLedger from './StudentRefundLedger.jsx';

export default function AdminPayments() {
  const [analytics, setAnalytics] = useState(null);
  const [studentPayments, setStudentPayments] = useState([]);
  const [studentError, setStudentError] = useState('');
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

  useEffect(() => {
    fetch('/api/student-payments/admin').then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Student payments unavailable');
      setStudentPayments(data.payments || []);
    }).catch(error => setStudentError(error.message));
  }, []);

  const finance = analytics?.finance || {};
  const outstanding = analytics?.outstandingAcademicOrders || [];

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ color: 'var(--primary)', fontSize: '.72rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' }}>MongoDB finance ledger</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '.35rem 0' }}>Payments & Tracked Value</h2>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>This view reports legacy tracked value separately from the verified student-support checkout transactions shown below.</p>
      </div>
      {error && <div className="toast error" style={{ position: 'static', marginBottom: '1rem', maxWidth: 'none' }}>{error}</div>}
      <div className="grid grid-4 gap-4" style={{ marginBottom: '1rem' }}>
        {[
          ['Legacy academic tracked', fmtCur(finance.paidAcademic || 0)],
          ['Legacy academic outstanding', fmtCur(finance.outstandingAcademic || 0)],
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
          <div className="badge badge-review" style={{ marginBottom: '1rem' }}>Payment integration pending</div>
          <p style={{ color: 'var(--text-muted)' }}>IPS payment collection remains disabled until the company activates and verifies its selected payment provider. Existing legacy amounts are not evidence of collected funds.</p>
          <p style={{ color: 'var(--text-secondary)' }}>The provider-backed student transaction and refund ledgers below are separate from legacy financial estimates. Review pending refunds and failed transfers before reporting cash collected.</p>
        </div>
      </div>
      <section className="card" style={{ marginTop: '1rem', overflowX: 'auto' }}>
        <h3>Student support — payment provider ledger</h3>
        <p style={{ color: 'var(--text-muted)' }}>Only provider-verified transactions are marked paid. The legacy totals above are not cash collected.</p>
        {studentError && <p role="alert">{studentError}</p>}
        <table className="data-table"><thead><tr><th>Request</th><th>Amount</th><th>Status</th><th>Paid at</th></tr></thead><tbody>{studentPayments.map(item => <tr key={item._id}><td>{item.request_id}</td><td>{item.currency.toUpperCase()} {(item.amount_minor / 100).toFixed(2)}</td><td>{item.status}</td><td>{item.paid_at ? new Date(item.paid_at).toLocaleString() : '—'}</td></tr>)}</tbody></table>
        {!studentPayments.length && !studentError && <p>No student payments recorded.</p>}
      </section>
      <StudentRefundLedger payments={studentPayments}/>
      <SpecialistPayoutLedger />
    </div>
  );
}
