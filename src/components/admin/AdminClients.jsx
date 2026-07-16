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

  // Fetch clients from MongoDB API
  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(data => setClients(data.clients || []));
  }, []);

  const addClient = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newClient)
    });
    const data = await res.json();
    if (data.success) {
      setClients([...clients, data.client]);
      setNewClient({ full_name: '', email: '', password: '', phone: '', country: '' });
      setShowAddModal(false);
    }
  };

  const deleteClient = async (clientId) => {
    if (!window.confirm(`Delete client ${clientId}?`)) return;
    await fetch(`/api/clients/${clientId}`, { method: 'DELETE' });
    setClients(clients.filter(c => c.client_id !== clientId));
  };

  const openEdit = (client) => {
    setSelectedClient(client);
    setEditForm({
      full_name: client.full_name || '',
      email: client.email || '',
      password: '',
      phone: client.phone || '',
      country: client.country || '',
      status: client.status || 'Active',
      notes: client.notes || ''
    });
    setShowEditModal(true);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    const updates = { ...editForm };
    if (!updates.password) delete updates.password; // Don't update if empty
    
    const res = await fetch(`/api/clients/${selectedClient.client_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (data.success) {
      setClients(clients.map(c => c.client_id === selectedClient.client_id ? data.client : c));
      setShowEditModal(false);
    }
  };

  const resetPassword = async (client) => {
    const newPassword = prompt(`New password for ${client.full_name}:`);
    if (!newPassword) return;
    const res = await fetch(`/api/clients/${client.client_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword })
    });
    const data = await res.json();
    if (data.success) alert(`Password reset for ${client.full_name}`);
  };

  const viewFullDetails = (client) => {
    setSelectedClient(client);
    setShowViewModal(true);
  };

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return search === '' || (c.full_name && c.full_name.toLowerCase().includes(q)) || (c.email && c.email.toLowerCase().includes(q)) || (c.client_id && c.client_id.toLowerCase().includes(q));
  });

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Clients</h2>
        <div className="flex gap-2">
          <input type="text" className="form-input" placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 260 }} />
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add Client</button>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 420, maxWidth: '90%' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Add New Client</h3>
            <form onSubmit={addClient} className="flex flex-col gap-3">
              <div className="form-group"><label>Full Name *</label><input className="form-input" value={newClient.full_name} onChange={e => setNewClient({...newClient, full_name: e.target.value})} required /></div>
              <div className="form-group"><label>Email *</label><input type="email" className="form-input" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} required /></div>
              <div className="form-group"><label>Password *</label><input className="form-input" value={newClient.password} onChange={e => setNewClient({...newClient, password: e.target.value})} required /></div>
              <div className="form-group"><label>Phone</label><input className="form-input" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} /></div>
              <div className="form-group"><label>Country</label><input className="form-input" value={newClient.country} onChange={e => setNewClient({...newClient, country: e.target.value})} /></div>
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary">Add</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedClient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 420, maxWidth: '90%' }}>
            <h3>Edit {selectedClient.client_id}</h3>
            <form onSubmit={saveEdit} className="flex flex-col gap-3">
              <div className="form-group"><label>Full Name</label><input className="form-input" value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} required /></div>
              <div className="form-group"><label>Email</label><input type="email" className="form-input" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} required /></div>
              <div className="form-group"><label>New Password (leave blank to keep)</label><input className="form-input" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} placeholder="Leave blank" /></div>
              <div className="form-group"><label>Phone</label><input className="form-input" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} /></div>
              <div className="form-group"><label>Country</label><input className="form-input" value={editForm.country} onChange={e => setEditForm({...editForm, country: e.target.value})} /></div>
              <div className="form-group"><label>Status</label><select className="form-select" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}><option>Active</option><option>Suspended</option><option>Inactive</option></select></div>
              <div className="form-group"><label>Notes</label><textarea className="form-textarea" value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} /></div>
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedClient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 480, maxWidth: '90%' }}>
            <h3>Client: {selectedClient.client_id}</h3>
            <div className="flex flex-col gap-2" style={{ fontSize: '0.9rem' }}>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Name:</span> <span style={{ fontWeight: 600 }}>{selectedClient.full_name}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Email:</span> <span>{selectedClient.email}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Password:</span> <span style={{ fontFamily: 'monospace', background: '#131F38', padding: '2px 6px', borderRadius: 4 }}>{selectedClient.password || '—'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Phone:</span> <span>{selectedClient.phone || '—'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Country:</span> <span>{selectedClient.country || '—'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Status:</span> <span className={`badge ${selectedClient.status === 'Active' ? 'badge-completed' : 'badge-disputed'}`}>{selectedClient.status}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Registered:</span> <span>{fmtDate(selectedClient.registration_date)}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Orders:</span> <span>{selectedClient.total_orders || 0}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Spent:</span> <span>{fmtCur(selectedClient.total_spent)}</span></div>
              {selectedClient.notes && <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--bg-surface-2)', borderRadius: 8 }}><div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Notes:</div><div>{selectedClient.notes}</div></div>}
            </div>
            <div className="flex gap-2" style={{ marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={() => { setShowViewModal(false); openEdit(selectedClient); }}>Edit</button>
              <button className="btn btn-gold" onClick={() => { resetPassword(selectedClient); setShowViewModal(false); }}>Reset PW</button>
              <button className="btn btn-secondary" onClick={() => setShowViewModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Country</th><th>Orders</th><th>Spent</th><th>Status</th><th>Registered</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No clients found.</td></tr>}
            {filtered.map((c) => (
              <tr key={c.client_id}>
                <td style={{ fontWeight: 700 }}>{c.client_id}</td>
                <td>{c.full_name}</td>
                <td>{c.email}</td>
                <td>{c.country || '—'}</td>
                <td>{c.total_orders || 0}</td>
                <td>{fmtCur(c.total_spent)}</td>
                <td><span className={`badge ${c.status === 'Active' ? 'badge-completed' : c.status === 'Suspended' ? 'badge-disputed' : 'badge-new'}`}>{c.status}</span></td>
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