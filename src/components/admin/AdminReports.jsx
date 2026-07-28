import React, { useEffect, useState } from 'react';
import { fmtCur } from '../../utils/formatters';

const bar = (value, max, colors) => ({
  width: `${Math.max(value ? 4 : 0, (value / Math.max(max, 1)) * 100)}%`,
  height: '100%',
  borderRadius: 7,
  background: colors,
  transition: 'width .4s ease'
});

export default function AdminReports() {
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Reports could not be loaded.');
        setAnalytics(data.analytics);
      })
      .catch(loadError => setError(loadError.message));
  }, []);

  const services = analytics?.byService || [];
  const countries = analytics?.byCountry || [];
  const counts = analytics?.counts || {};
  const maxService = Math.max(...services.map(item => item.value), 1);
  const maxCountry = Math.max(...countries.map(item => item.count), 1);

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ color: 'var(--primary)', fontSize: '.72rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' }}>Unified intelligence</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '.35rem 0' }}>Platform Reports</h2>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Academic work, professional services, and odd jobs are reported from one MongoDB dataset.</p>
      </div>
      {error && <div className="toast error" style={{ position: 'static', marginBottom: '1rem', maxWidth: 'none' }}>{error}</div>}

      <div className="grid grid-4 gap-4" style={{ marginBottom: '1rem' }}>
        {[
          ['Academic orders', counts.academicOrders || 0],
          ['Service requests', counts.serviceRequests || 0],
          ['Active work', counts.activeWork || 0],
          ['Open support tickets', counts.openTickets || 0]
        ].map(([label, value]) => <div className="card" key={label}><strong style={{ fontSize: '1.6rem' }}>{value}</strong><div style={{ color: 'var(--text-muted)' }}>{label}</div></div>)}
      </div>

      <div className="grid grid-2 gap-4">
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Tracked Value by Service</h3>
          {services.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No service data yet.</p> : services.map(item => (
            <div key={`${item.type}-${item.service}`} style={{ marginBottom: '1rem' }}>
              <div className="flex justify-between" style={{ gap: '1rem', marginBottom: 6 }}>
                <span><strong>{item.service}</strong><small style={{ marginLeft: 6, color: 'var(--text-muted)' }}>{item.type}</small></span>
                <span>{fmtCur(item.value)} · {item.count}</span>
              </div>
              <div style={{ height: 12, background: 'var(--bg-surface-2)', borderRadius: 7 }}><div style={bar(item.value, maxService, 'linear-gradient(90deg,var(--primary-dark),var(--primary))')} /></div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>All Work by Client Country</h3>
          {countries.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No country data yet.</p> : countries.map(item => (
            <div key={item.country} style={{ marginBottom: '1rem' }}>
              <div className="flex justify-between" style={{ marginBottom: 6 }}><strong>{item.country}</strong><span>{item.count} jobs · {fmtCur(item.value)}</span></div>
              <div style={{ height: 12, background: 'var(--bg-surface-2)', borderRadius: 7 }}><div style={bar(item.count, maxCountry, 'linear-gradient(90deg,#D07E47,#ED9E6F)')} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
