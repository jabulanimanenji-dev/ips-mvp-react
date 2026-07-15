import React, { useEffect, useState } from 'react';
import { fmtCur } from '../../utils/formatters';
import { SERVICE_TYPES } from '../../utils/constants';

export default function AdminReports() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const raw = JSON.parse(localStorage.getItem('ips-orders') || '[]');
    setOrders(raw);
  }, []);

  // Revenue by service
  const revenueByService = SERVICE_TYPES.map((service) => {
    const serviceOrders = orders.filter((o) => o.service_type === service);
    const revenue = serviceOrders.reduce((sum, o) => sum + (o.total_fee_usd || 0), 0);
    return { service, revenue, count: serviceOrders.length };
  }).sort((a, b) => b.revenue - a.revenue);

  const maxRevenue = Math.max(...revenueByService.map((r) => r.revenue), 1);

  // Orders by country
  const clients = JSON.parse(localStorage.getItem('ips-clients') || '[]');
  const countryMap = {};
  orders.forEach((o) => {
    const client = clients.find((c) => c.client_id === o.client_id);
    const country = client?.country || 'Unknown';
    if (!countryMap[country]) countryMap[country] = { count: 0, revenue: 0 };
    countryMap[country].count += 1;
    countryMap[country].revenue += o.total_fee_usd || 0;
  });
  const countryStats = Object.entries(countryMap)
    .map(([country, data]) => ({ country, ...data }))
    .sort((a, b) => b.count - a.count);

  const maxCountryCount = Math.max(...countryStats.map((c) => c.count), 1);

  return (
    <div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem' }}>Reports</h2>

      <div className="grid grid-2 gap-4">
        {/* Revenue by Service */}
        <div className="card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem' }}>📊 Revenue by Service</h3>
          <div className="flex flex-col gap-4">
            {revenueByService.map((r) => (
              <div key={r.service}>
                <div className="flex justify-between" style={{ marginBottom: 6, fontSize: '0.88rem' }}>
                  <span style={{ fontWeight: 600 }}>{r.service}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{fmtCur(r.revenue)} · {r.count} orders</span>
                </div>
                <div
                  style={{
                    height: 28,
                    background: 'var(--bg-surface-2)',
                    borderRadius: 6,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${(r.revenue / maxRevenue) * 100}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #660273 0%, #A305A6 100%)',
                      borderRadius: 6,
                      transition: 'width 0.6s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: 8,
                    }}
                  >
                    {r.revenue > maxRevenue * 0.15 && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>{fmtCur(r.revenue)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Orders by Country */}
        <div className="card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem' }}>🌍 Orders by Country</h3>
          <div className="flex flex-col gap-4">
            {countryStats.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No data available.</p>
            ) : (
              countryStats.map((c) => (
                <div key={c.country}>
                  <div className="flex justify-between" style={{ marginBottom: 6, fontSize: '0.88rem' }}>
                    <span style={{ fontWeight: 600 }}>{c.country}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{c.count} orders · {fmtCur(c.revenue)}</span>
                  </div>
                  <div
                    style={{
                      height: 28,
                      background: 'var(--bg-surface-2)',
                      borderRadius: 6,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${(c.count / maxCountryCount) * 100}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #D07E47 0%, #ED9E6F 100%)',
                        borderRadius: 6,
                        transition: 'width 0.6s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        paddingRight: 8,
                      }}
                    >
                      {c.count > maxCountryCount * 0.2 && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>{c.count}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
