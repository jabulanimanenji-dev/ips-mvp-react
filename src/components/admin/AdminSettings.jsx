import React, { useState, useEffect } from 'react';
import { useCMS } from '../../context/CMSContext';

export default function AdminSettings() {
  const { cms, saveCMS } = useCMS();
  const [form, setForm] = useState({
    brandName: '',
    tagline: '',
    email: '',
    whatsapp: '',
    currency: 'USD',
  });
  const [saved, setSaved] = useState(false);
  const [showAdmins, setShowAdmins] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '', role: 'admin' });

  useEffect(() => {
    if (cms?.brand) {
      setForm({
        brandName: cms.brand.name || '',
        tagline: cms.brand.tagline || '',
        email: cms.brand.email || '',
        whatsapp: cms.brand.whatsapp || '',
        currency: cms.brand.currency || 'USD',
      });
    }
    const raw = JSON.parse(localStorage.getItem('ips-admin-list') || '[]');
    setAdmins(raw);
  }, [cms]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setSaved(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const updated = {
      ...cms,
      brand: {
        ...cms.brand,
        name: form.brandName,
        tagline: form.tagline,
        email: form.email,
        whatsapp: form.whatsapp,
        currency: form.currency,
      },
    };
    saveCMS(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const addAdmin = (e) => {
    e.preventDefault();
    const admin = {
      id: `ADM-${String(admins.length + 1).padStart(3, '0')}`,
      name: newAdmin.name,
      email: newAdmin.email,
      password: newAdmin.password,
      role: newAdmin.role,
      created_at: new Date().toISOString()
    };
    const updated = [...admins, admin];
    localStorage.setItem('ips-admin-list', JSON.stringify(updated));
    setAdmins(updated);
    setNewAdmin({ name: '', email: '', password: '', role: 'admin' });
    setShowAddAdmin(false);
  };

  const deleteAdmin = (adminId) => {
    if (!window.confirm('Delete this admin?')) return;
    const updated = admins.filter(a => a.id !== adminId);
    localStorage.setItem('ips-admin-list', JSON.stringify(updated));
    setAdmins(updated);
  };

  const exportData = () => {
    const data = {
      clients: JSON.parse(localStorage.getItem('ips-clients') || '[]'),
      orders: JSON.parse(localStorage.getItem('ips-orders') || '[]'),
      writers: JSON.parse(localStorage.getItem('ips-admin-writers') || '[]'),
      admins: JSON.parse(localStorage.getItem('ips-admin-list') || '[]'),
      cms: JSON.parse(localStorage.getItem('ips-cms') || '{}'),
      exported_at: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ips-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.clients) localStorage.setItem('ips-clients', JSON.stringify(data.clients));
        if (data.orders) localStorage.setItem('ips-orders', JSON.stringify(data.orders));
        if (data.writers) localStorage.setItem('ips-admin-writers', JSON.stringify(data.writers));
        if (data.admins) localStorage.setItem('ips-admin-list', JSON.stringify(data.admins));
        if (data.cms) localStorage.setItem('ips-cms', JSON.stringify(data.cms));
        alert('Data imported! Refresh the page.');
        window.location.reload();
      } catch (err) {
        alert('Invalid file format');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem' }}>Settings</h2>

      <div className="grid grid-2 gap-4">
        {/* Business Info */}
        <div className="card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem' }}>🏢 Business Info</h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Brand Name</label>
              <input type="text" name="brandName" className="form-input" value={form.brandName} onChange={handleChange} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tagline</label>
              <input type="text" name="tagline" className="form-input" value={form.tagline} onChange={handleChange} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Support Email</label>
              <input type="email" name="email" className="form-input" value={form.email} onChange={handleChange} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">WhatsApp Number</label>
              <input type="text" name="whatsapp" className="form-input" value={form.whatsapp} onChange={handleChange} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Default Currency</label>
              <select name="currency" className="form-select" value={form.currency} onChange={handleChange}>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="NGN">NGN — Nigerian Naira</option>
                <option value="INR">INR — Indian Rupee</option>
              </select>
            </div>
            <div className="flex gap-2" style={{ marginTop: 8 }}>
              <button type="submit" className="btn btn-primary">Save Changes</button>
              {saved && <span style={{ color: 'var(--success)', fontSize: '0.85rem', alignSelf: 'center' }}>✓ Saved</span>}
            </div>
          </form>
        </div>

        {/* Admin Management */}
        <div className="card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem' }}>👑 Admin Management</h3>
          <button className="btn btn-primary" onClick={() => setShowAdmins(!showAdmins)} style={{ marginBottom: '1rem' }}>
            {showAdmins ? 'Hide Admins' : 'Manage Admins'}
          </button>

          {showAdmins && (
            <div>
              <div className="flex justify-between items-center" style={{ marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{admins.length} additional admins</span>
                <button className="btn btn-sm btn-primary" onClick={() => setShowAddAdmin(true)}>+ Add Admin</button>
              </div>

              {/* Add Admin Modal */}
              {showAddAdmin && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="card" style={{ width: 400, maxWidth: '90%' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Add New Admin</h4>
                    <form onSubmit={addAdmin} className="flex flex-col gap-3">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Name</label>
                        <input type="text" className="form-input" value={newAdmin.name} onChange={e => setNewAdmin({...newAdmin, name: e.target.value})} required />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Email</label>
                        <input type="email" className="form-input" value={newAdmin.email} onChange={e => setNewAdmin({...newAdmin, email: e.target.value})} required />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Password</label>
                        <input type="text" className="form-input" value={newAdmin.password} onChange={e => setNewAdmin({...newAdmin, password: e.target.value})} required />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Role</label>
                        <select className="form-select" value={newAdmin.role} onChange={e => setNewAdmin({...newAdmin, role: e.target.value})}>
                          <option value="admin">Admin</option>
                          <option value="moderator">Moderator</option>
                        </select>
                      </div>
                      <div className="flex gap-2" style={{ marginTop: 8 }}>
                        <button type="submit" className="btn btn-primary">Add Admin</button>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowAddAdmin(false)}>Cancel</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              <div className="card" style={{ overflowX: 'auto', padding: '0.75rem' }}>
                <table className="data-table">
                  <thead>
                    <tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {admins.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>No additional admins</td></tr>
                    )}
                    {admins.map(a => (
                      <tr key={a.id}>
                        <td>{a.id}</td>
                        <td>{a.name}</td>
                        <td>{a.email}</td>
                        <td><span className={`badge ${a.role === 'admin' ? 'badge-completed' : 'badge-review'}`}>{a.role}</span></td>
                        <td><button className="btn btn-sm btn-danger" onClick={() => deleteAdmin(a.id)}>Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Data Management */}
        <div className="card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem' }}>💾 Data Management</h3>
          <div className="flex flex-col gap-2">
            <button className="btn btn-secondary" onClick={exportData}>📥 Export All Data</button>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Import Data (JSON)</label>
              <input type="file" accept=".json" onChange={importData} className="form-input" />
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card" style={{ border: '1px solid rgba(239,68,68,0.3)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', color: '#ef4444' }}>⚠️ Danger Zone</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1rem' }}>
            These actions are destructive and cannot be undone.
          </p>
          <div className="flex flex-col gap-2">
            <button className="btn btn-danger" onClick={() => {
              if (window.confirm('Clear all orders?')) { localStorage.removeItem('ips-orders'); window.location.reload(); }
            }}>Clear All Orders</button>
            <button className="btn btn-danger" onClick={() => {
              if (window.confirm('Clear all clients?')) { localStorage.removeItem('ips-clients'); window.location.reload(); }
            }}>Clear All Clients</button>
            <button className="btn btn-danger" onClick={() => {
              if (window.confirm('Clear all writers?')) { localStorage.removeItem('ips-admin-writers'); window.location.reload(); }
            }}>Clear All Writers</button>
            <button className="btn btn-danger" onClick={() => {
              if (window.confirm('Reset ALL data?')) {
                localStorage.removeItem('ips-orders');
                localStorage.removeItem('ips-clients');
                localStorage.removeItem('ips-admin-writers');
                localStorage.removeItem('ips-admin-list');
                window.location.reload();
              }
            }}>Reset All Data</button>
          </div>
        </div>
      </div>
    </div>
  );
}