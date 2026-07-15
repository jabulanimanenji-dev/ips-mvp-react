import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function ClientProfile() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    client_id: '',
    country: '',
    phone: '',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        email: user.email || '',
        client_id: user.client_id || '',
        country: user.country || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setSaved(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Update in localStorage
    const clients = JSON.parse(localStorage.getItem('ips-clients') || '[]');
    const idx = clients.findIndex((c) => c.client_id === user.client_id);
    if (idx !== -1) {
      clients[idx] = { ...clients[idx], full_name: form.full_name, country: form.country, phone: form.phone };
      localStorage.setItem('ips-clients', JSON.stringify(clients));
    }
    // Update user in localStorage via AuthContext would need a setter, but we can reload
    const storedUser = JSON.parse(localStorage.getItem('ips-user') || '{}');
    localStorage.setItem('ips-user', JSON.stringify({ ...storedUser, full_name: form.full_name, country: form.country, phone: form.phone }));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem' }}>My Profile</h2>

      <div className="card" style={{ maxWidth: 600 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              name="full_name"
              className="form-input"
              value={form.full_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              name="email"
              className="form-input"
              value={form.email}
              readOnly
              style={{ opacity: 0.7, cursor: 'not-allowed' }}
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Email cannot be changed</small>
          </div>

          <div className="form-group">
            <label className="form-label">Client ID</label>
            <input
              type="text"
              name="client_id"
              className="form-input"
              value={form.client_id}
              readOnly
              style={{ opacity: 0.7, cursor: 'not-allowed' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Country</label>
            <input
              type="text"
              name="country"
              className="form-input"
              value={form.country}
              onChange={handleChange}
              placeholder="e.g. Nigeria"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Phone</label>
            <input
              type="tel"
              name="phone"
              className="form-input"
              value={form.phone}
              onChange={handleChange}
              placeholder="e.g. +234 801 234 5678"
            />
          </div>

          <div className="flex" style={{ gap: '1rem', marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn-primary">
              Save Changes
            </button>
            {saved && (
              <span className="badge badge-completed" style={{ alignSelf: 'center' }}>
                ✓ Saved
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
