import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const emptyAdmin = { name: '', email: '', password: '', role: 'admin' };

export default function AdminSettings() {
  const [admins, setAdmins] = useState([]);
  const [summary, setSummary] = useState(null);
  const [newAdmin, setNewAdmin] = useState(emptyAdmin);
  const [showAdd, setShowAdd] = useState(false);
  const [state, setState] = useState({ loading: true, saving: false, error: '', success: '' });

  const load = async () => {
    try {
      const [adminsResponse, summaryResponse] = await Promise.all([
        fetch('/api/admins'),
        fetch('/api/admin/data-summary')
      ]);
      const [adminsData, summaryData] = await Promise.all([adminsResponse.json(), summaryResponse.json()]);
      if (!adminsResponse.ok || !adminsData.success) throw new Error(adminsData.error || 'Admins could not be loaded.');
      if (!summaryResponse.ok || !summaryData.success) throw new Error(summaryData.error || 'Database summary could not be loaded.');
      setAdmins(adminsData.admins || []);
      setSummary(summaryData);
      setState(previous => ({ ...previous, loading: false, error: '' }));
    } catch (error) {
      setState(previous => ({ ...previous, loading: false, error: error.message }));
    }
  };

  useEffect(() => { load(); }, []);

  const addAdmin = async event => {
    event.preventDefault();
    setState(previous => ({ ...previous, saving: true, error: '', success: '' }));
    try {
      const response = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAdmin)
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Admin could not be created.');
      setNewAdmin(emptyAdmin);
      setShowAdd(false);
      await load();
      setState(previous => ({ ...previous, saving: false, success: 'Administrator created in MongoDB.' }));
    } catch (error) {
      setState(previous => ({ ...previous, saving: false, error: error.message }));
    }
  };

  const deleteAdmin = async id => {
    if (!window.confirm(`Delete administrator ${id}?`)) return;
    setState(previous => ({ ...previous, saving: true, error: '', success: '' }));
    try {
      const response = await fetch(`/api/admins/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Admin could not be deleted.');
      await load();
      setState(previous => ({ ...previous, saving: false, success: 'Administrator removed.' }));
    } catch (error) {
      setState(previous => ({ ...previous, saving: false, error: error.message }));
    }
  };

  const exportData = async () => {
    setState(previous => ({ ...previous, saving: true, error: '', success: '' }));
    try {
      const response = await fetch('/api/admin/export');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Export could not be generated.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ips-database-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setState(previous => ({ ...previous, saving: false, success: 'Sanitised database export downloaded.' }));
    } catch (error) {
      setState(previous => ({ ...previous, saving: false, error: error.message }));
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ color: 'var(--primary)', fontSize: '.72rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' }}>System governance</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '.35rem 0' }}>Settings & Data</h2>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>MongoDB is the only source of truth. Browser storage is no longer used for IPS business records.</p>
      </div>

      {state.error && <div className="toast error" style={{ position: 'static', marginBottom: '1rem', maxWidth: 'none' }}>{state.error}</div>}
      {state.success && <div className="toast success" style={{ position: 'static', marginBottom: '1rem', maxWidth: 'none' }}>{state.success}</div>}

      <div className="grid grid-2 gap-4">
        <div className="card">
          <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
            <div><h3 style={{ margin: 0 }}>Administrator Access</h3><small style={{ color: 'var(--text-muted)' }}>Passwords are never returned by the API.</small></div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>Add Admin</button>
          </div>
          {state.loading ? <p>Loading administrators…</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th /></tr></thead>
                <tbody>
                  {admins.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--text-muted)' }}>Environment super-admin only.</td></tr>}
                  {admins.map(item => (
                    <tr key={item.id}>
                      <td>{item.id}</td><td>{item.name}</td><td>{item.email}</td><td>{item.role}</td>
                      <td><button className="btn btn-danger btn-sm" onClick={() => deleteAdmin(item.id)}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '.5rem' }}>Brand, Layout & Buttons</h3>
          <p style={{ color: 'var(--text-muted)' }}>Visual configuration is versioned on the server. Use the Phase 12 builder to edit, preview, publish, or roll back the website.</p>
          <Link to="/admin/cms" className="btn btn-primary">Open Visual Builder</Link>
        </div>

        <div className="card">
          <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
            <div><h3 style={{ margin: 0 }}>Database Inventory</h3><small style={{ color: 'var(--text-muted)' }}>{summary?.source || 'MongoDB'} · {summary?.mode || 'server authoritative'}</small></div>
            <button className="btn btn-secondary" onClick={exportData} disabled={state.saving}>Export Safe JSON</button>
          </div>
          <div className="grid grid-3 gap-3">
            {Object.entries(summary?.collections || {}).map(([key, value]) => (
              <div key={key} style={{ padding: '.8rem', borderRadius: 12, background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
                <strong style={{ fontSize: '1.25rem' }}>{value}</strong>
                <small style={{ display: 'block', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{key}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ borderColor: 'rgba(237,158,111,.35)' }}>
          <h3 style={{ marginBottom: '.5rem' }}>Recovery & Destructive Operations</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '.75rem' }}>There are no fake browser reset buttons. Production deletion, restore, and bulk import require a controlled maintenance procedure, verified backup, and audit record.</p>
          <div className="badge badge-review">Protected maintenance only</div>
        </div>
      </div>

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 1200, display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: 'min(460px, 100%)' }}>
            <h3>Add Administrator</h3>
            <form onSubmit={addAdmin} className="flex flex-col gap-3">
              <input className="form-input" placeholder="Full name" value={newAdmin.name} onChange={event => setNewAdmin({ ...newAdmin, name: event.target.value })} required />
              <input className="form-input" type="email" placeholder="Email" value={newAdmin.email} onChange={event => setNewAdmin({ ...newAdmin, email: event.target.value })} required />
              <input className="form-input" type="password" minLength={8} placeholder="Temporary password" value={newAdmin.password} onChange={event => setNewAdmin({ ...newAdmin, password: event.target.value })} required />
              <select className="form-select" value={newAdmin.role} onChange={event => setNewAdmin({ ...newAdmin, role: event.target.value })}>
                <option value="admin">Admin</option><option value="moderator">Moderator</option>
              </select>
              <div className="flex gap-2">
                <button className="btn btn-primary" disabled={state.saving}>Create Admin</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
