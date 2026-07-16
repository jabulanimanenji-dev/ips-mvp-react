import React, { useEffect, useState } from 'react';
import { fmtCur, fmtDate } from '../../utils/formatters';

export default function AdminClients() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [newClient, setNewClient] = useState({ full_name: '', email: '', password: '', phone: '', country: '' });
  const [editForm, setEditForm] = useState({ full_name: '', email: '', password: '', phone: '', country: '', status: '', notes: '' });

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
      password: newClient.password,
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
    setNewClient({ full_name: '', email: '', password: '', phone: '', country: '' });
    setShowAddModal(false);
  };

  const openEdit = (client) => {
    setSelectedClient(client);
    setEditForm({
      full_name: client.full_name || '',
      email: client.email || '',
      password: client.password || '',
      phone: client.phone || '',
      country: client.country || '',
      status: client.status || 'Active',
      notes: client.notes || ''
    });
    setShowEditModal(true);
  };

  const saveEdit = (e) => {
    e.preventDefault();
    const updated = clients.map(c => {
      if (c.client_id === selectedClient.client_id) {
        return { ...c, ...editForm };
      }
      return c;
    });
    saveClients(updated);
    setShowEditModal(false);
    setSelectedClient(null);
  };

  const resetPassword = (client) => {
    const newPassword = prompt(`Enter new password for ${client.full_name}:`);
    if (!newPassword) return;
    const updated = clients.map(c => {
      if (c.client_id === client.client_id) {
        return { ...c, password: newPassword };
      }
      return c;
    });
    saveClients(updated);
    alert(`Password reset for ${client.full_name}. New password: ${newPassword}`);
  };

  const viewFullDetails = (client) => {
    setSelectedClient(client);
    setShowViewModal(true);
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
                <label className="form-label">Full Name *</label>
                <input type="text" className="form-input" value={newClient.full_name} onChange={e => setNewClient({...newClient, full_name: e.target.value})} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email *</label>
                <input type="email" className="form-input" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Password *</label>
                <input type="text" className="form-input" value={newClient.password} onChange={e => setNewClient({...newClient, password: e.target.value})} required placeholder="Client will use this to login" />
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

      {/* Edit Client Modal */}
      {showEditModal && selectedClient && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 420, maxWidth: '90%' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Edit Client: {selectedClient.client_id}</h3>
            <form onSubmit={saveEdit} className="flex flex-col gap-3">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Full Name</label>
                <input type="text" className="form-input" value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Password</label>
                <input type="text" className="form-input" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} placeholder="Leave blank to keep current" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Phone</label>
                <input type="text" className="form-input" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Country</label>
                <input type="text" className="form-input" value={editForm.country} onChange={e => setEditForm({...editForm, country: e.target.value})} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Status</label>
                <select className="form-select" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                  <option value="Active">Active</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Admin Notes</label>
                <textarea className="form-textarea" value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} placeholder="Private notes about this client..." />
              </div>
              <div className="flex gap-2" style={{ marginTop: 8 }}>
                <button type="submit" className="btn btn-primary">Save Changes</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Full Details Modal */}
      {showViewModal && selectedClient && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 480, maxWidth: '90%' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Client Details: {selectedClient.client_id}</h3>
            <div className="flex flex-col gap-2" style={{ fontSize: '0.9rem' }}>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Full Name:</span> <span style={{ fontWeight: 600 }}>{selectedClient.full_name}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Email:</span> <span>{selectedClient.email}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Password:</span> <span style={{ fontFamily: 'monospace', background: '#131F38', padding: '2px 6px', borderRadius: 4 }}>{selectedClient.password || '—'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Phone:</span> <span>{selectedClient.phone || '—'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Country:</span> <span>{selectedClient.country || '—'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Status:</span> <span className={`badge ${selectedClient.status === 'Active' ? 'badge-completed' : 'badge-disputed'}`}>{selectedClient.status || 'Active'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Registered:</span> <span>{fmtDate(selectedClient.registration_date)}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Total Orders:</span> <span>{selectedClient.total_orders || 0}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Total Spent:</span> <span>{fmtCur(selectedClient.total_spent)}</span></div>
              {selectedClient.notes && (
                <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--bg-surface-2)', borderRadius: 8 }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 4 }}>Admin Notes:</div>
                  <div>{selectedClient.notes}</div>
                </div>
              )}
            </div>
            <div className="flex gap-2" style={{ marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={() => { setShowViewModal(false); openEdit(selectedClient); }}>Edit Client</button>
              <button className="btn btn-gold" onClick={() => { resetPassword(selectedClient); setShowViewModal(false); }}>Reset Password</button>
              <button className="btn btn-secondary" onClick={() => setShowViewModal(false)}>Close</button>
            </div>
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
                  <div className="flex gap-1">
                    <button className="btn btn-sm btn-secondary" onClick={() => viewFullDetails(c)}>View</button>
                    <button className="btn btn-sm btn-primary" onClick={() => openEdit(c)}>Edit</button>
                    <button className="btn btn-sm btn-gold" onClick={() => resetPassword(c)}>Reset PW</button>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteClient(c.client_id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}