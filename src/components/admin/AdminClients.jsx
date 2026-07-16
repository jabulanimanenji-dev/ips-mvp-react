import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtCur, fmtDate } from '../../utils/formatters';

export default function AdminClients() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClient, setNewClient] = useState({ full_name: '', email: '', phone: '', country: '' });

  useEffect(() => {
    const raw = JSON.parse(localStorage.getItem('ips-clients') || '[]');
    setClients(raw);
  }, []);

  const saveClients = (updated) => {
    localStorage.setItem('ips-clients', JSON.stringify(updated));
    setClients(updated);
  };

  const deleteClient = (clientId) => {
    if (!window.confirm(`Delete client ${clientId}? This cannot be undone.`)) return;
    const updated = clients.filter(c => c.client_id !== clientId);
    saveClients(updated);
  };

  const addClient = (e) => {
    e.preventDefault();
    const newId = `CID-${String(clients.length + 1).padStart(3, '0')}`;
    const client = {
      client_id: newId,
      full_name: newClient.full_name,
      email: newClient.email,
      phone: newClient.phone,
      country: newClient.country,
      registration_date: new Date().toISOString().split('T')[0],
      total_orders: 0,
      total_spent: 0,
      status: 'Active',
      notes: ''
    };
    const updated = [...clients, client];
    saveClients(updated);
    setNewClient({ full_name: '', email: '', phone: '', country: '' });
    setShowAddModal(false);
  };

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
        <div className="flex gap-2">
          <input
            type="text"
            className="form-input"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 260 }}
          />
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add Client</button>
        </div>
      </div>

      {/* Add Client Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 420, maxWidth: '90%' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Add New Client</h3>
            <form onSubmit={addClient} className="flex flex-col gap-3">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Full Name</label>
                <input type="text" className="form-input" value={newClient.full_name} onChange={e => setNewClient({...newClient, full_name: e.target.value})} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Phone</label>
                <input type="text" className="form-input" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Country</label>
                <input type="text" className="form-input" value={newClient.country} onChange={e => setNewClient({...newClient, country: e.target.value})} />
              </div>
              <div className="flex gap-2" style={{ marginTop: 8 }}>
                <button type="submit" className="btn btn-primary">Add Client</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
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
                <td>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteClient(c.client_id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}