import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtCur, fmtDate } from '../../utils/formatters';

export default function AdminClients() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const raw = JSON.parse(localStorage.getItem('ips-clients') || '[]');
    setClients(raw);
  }, []);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      search === '' ||
      (c.full_name && c.full_name.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.client_id && c.client_id.toLowerCase().includes(q)) ||
      (c.country && c.country.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Clients</h2>
        <input
          type="text"
          className="form-input"
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 260 }}
        />
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Client ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Country</th>
              <th>Orders</th>
              <th>Spent</th>
              <th>Status</th>
              <th>Registered</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  No clients found.
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.client_id}>
                <td style={{ fontWeight: 700, color: 'var(--text-link)' }}>{c.client_id}</td>
                <td>{c.full_name}</td>
                <td>{c.email}</td>
                <td>{c.country || '—'}</td>
                <td>{c.total_orders || 0}</td>
                <td>{fmtCur(c.total_spent)}</td>
                <td>
                  <span className={`badge ${c.status === 'Active' ? 'badge-completed' : c.status === 'Suspended' ? 'badge-disputed' : 'badge-new'}`}>
                    {c.status || 'Active'}
                  </span>
                </td>
                <td>{fmtDate(c.registration_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
