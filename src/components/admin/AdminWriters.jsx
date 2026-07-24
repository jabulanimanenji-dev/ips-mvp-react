import React, { useEffect, useState } from 'react';
import { fmtCur } from '../../utils/formatters';
import { WRITER_DEFAULTS } from '../../utils/constants';

export default function AdminWriters() {
  const [writers, setWriters] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWriter, setNewWriter] = useState({
    full_name: '',
    email: '',
    password: '',
    primary_expertise: '',
    secondary_expertise: '',
    academic_level: 'Master',
    rate_per_page_usd: 10
  });

  useEffect(() => {
    fetch('/api/writers')
      .then(response => response.json())
      .then(data => setWriters(data.writers || []))
      .catch(error => console.error('Failed to load writers:', error));
  }, []);

  const toggleStatus = async (writerId) => {
    const current = writers.find(writer => writer.writer_id === writerId);
    if (!current) return;
    const status = current.status === 'Active' ? 'On Leave' : 'Active';
    const response = await fetch(`/api/writers/${writerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await response.json();
    if (response.ok) {
      setWriters(list => list.map(writer => writer.writer_id === writerId ? data.writer : writer));
    }
  };

  const deleteWriter = async (writerId) => {
    if (!window.confirm(`Delete writer ${writerId}? This cannot be undone.`)) return;
    const response = await fetch(`/api/writers/${writerId}`, { method: 'DELETE' });
    if (response.ok) {
      setWriters(list => list.filter(writer => writer.writer_id !== writerId));
    }
  };

  const resetPassword = async (writer) => {
    const password = window.prompt(`Set a new temporary password for ${writer.full_name}:`);
    if (!password) return;
    if (password.length < 6) {
      window.alert('Password must contain at least 6 characters.');
      return;
    }
    const response = await fetch(`/api/writers/${writer.writer_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await response.json();
    if (response.ok) {
      window.alert(`Password reset for ${writer.full_name}. Share it securely.`);
    } else {
      window.alert(data.error || 'Password reset failed.');
    }
  };

  const addWriter = async (e) => {
    e.preventDefault();
    const writer = {
      full_name: newWriter.full_name,
      email: newWriter.email,
      password: newWriter.password,
      primary_expertise: newWriter.primary_expertise,
      secondary_expertise: newWriter.secondary_expertise,
      academic_level: newWriter.academic_level,
      rate_per_page_usd: parseFloat(newWriter.rate_per_page_usd) || WRITER_DEFAULTS.rate_per_page_usd,
      rating: WRITER_DEFAULTS.rating,
      projects_completed: WRITER_DEFAULTS.projects_completed,
      availability: WRITER_DEFAULTS.availability,
      status: WRITER_DEFAULTS.status,
    };
    const response = await fetch('/api/writers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(writer)
    });
    const data = await response.json();
    if (!response.ok) {
      window.alert(data.error || 'Failed to add writer.');
      return;
    }
    setWriters(list => [...list, data.writer]);
    setNewWriter({
      full_name: '',
      email: '',
      password: '',
      primary_expertise: '',
      secondary_expertise: '',
      academic_level: 'Master',
      rate_per_page_usd: 10
    });
    setShowAddModal(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Writers</h2>
        <div className="flex gap-2">
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', alignSelf: 'center' }}>{writers.length} total</span>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add Writer</button>
        </div>
      </div>

      {/* Add Writer Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 480, maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Add New Writer</h3>
            <form onSubmit={addWriter} className="flex flex-col gap-3">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Full Name *</label>
                <input type="text" className="form-input" value={newWriter.full_name} onChange={e => setNewWriter({...newWriter, full_name: e.target.value})} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email *</label>
                <input type="email" className="form-input" value={newWriter.email} onChange={e => setNewWriter({...newWriter, email: e.target.value})} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Password *</label>
                <input type="text" className="form-input" value={newWriter.password} onChange={e => setNewWriter({...newWriter, password: e.target.value})} required placeholder="Writer will use this to login" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Primary Expertise *</label>
                <input type="text" className="form-input" value={newWriter.primary_expertise} onChange={e => setNewWriter({...newWriter, primary_expertise: e.target.value})} required placeholder="e.g. Business, Engineering" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Secondary Expertise</label>
                <input type="text" className="form-input" value={newWriter.secondary_expertise} onChange={e => setNewWriter({...newWriter, secondary_expertise: e.target.value})} placeholder="e.g. Psychology, Law" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Academic Level</label>
                <select className="form-select" value={newWriter.academic_level} onChange={e => setNewWriter({...newWriter, academic_level: e.target.value})}>
                  <option value="Bachelor">Bachelor</option>
                  <option value="Master">Master</option>
                  <option value="PhD">PhD</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Rate per Page (USD)</label>
                <input type="number" className="form-input" value={newWriter.rate_per_page_usd} onChange={e => setNewWriter({...newWriter, rate_per_page_usd: e.target.value})} min="1" />
              </div>
              <div className="flex gap-2" style={{ marginTop: 8 }}>
                <button type="submit" className="btn btn-primary">Add Writer</button>
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
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Expertise</th>
              <th>Level</th>
              <th>Rating</th>
              <th>Completed</th>
              <th>Availability</th>
              <th>Rate</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {writers.length === 0 && (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  No writers found.
                </td>
              </tr>
            )}
            {writers.map((w) => (
              <tr key={w.writer_id}>
                <td style={{ fontWeight: 700 }}>{w.writer_id}</td>
                <td>{w.full_name}</td>
                <td>{w.email}</td>
                <td>{w.primary_expertise}{w.secondary_expertise ? ` / ${w.secondary_expertise}` : ''}</td>
                <td>{w.academic_level}</td>
                <td>⭐ {w.rating}</td>
                <td>{w.projects_completed}</td>
                <td>
                  <span className={`badge ${w.availability === 'Available' ? 'badge-completed' : w.availability === 'Limited' ? 'badge-review' : w.availability === 'Busy' ? 'badge-progress' : 'badge-new'}`}>
                    {w.availability}
                  </span>
                </td>
                <td>{fmtCur(w.rate_per_page_usd)}/page</td>
                <td>
                  <span className={`badge ${w.status === 'Active' ? 'badge-completed' : 'badge-new'}`}>
                    {w.status}
                  </span>
                </td>
                <td>
                  <div className="flex gap-1">
                    <button className="btn btn-sm btn-secondary" onClick={() => toggleStatus(w.writer_id)}>
                      {w.status === 'Active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="btn btn-sm btn-gold" onClick={() => resetPassword(w)}>Reset PW</button>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteWriter(w.writer_id)}>Delete</button>
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
