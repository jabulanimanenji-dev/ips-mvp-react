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

  return (
    <div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem' }}>Settings</h2>

      <div className="grid grid-2 gap-4">
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

        <div className="card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem' }}>⚠️ Danger Zone</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1rem' }}>
            These actions are destructive and cannot be undone. Use with caution.
          </p>
          <div className="flex flex-col gap-2">
            <button
              className="btn btn-danger"
              onClick={() => {
                if (window.confirm('Clear all orders? This cannot be undone.')) {
                  localStorage.removeItem('ips-orders');
                  window.location.reload();
                }
              }}
            >
              Clear All Orders
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (window.confirm('Clear all clients? This cannot be undone.')) {
                  localStorage.removeItem('ips-clients');
                  window.location.reload();
                }
              }}
            >
              Clear All Clients
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (window.confirm('Reset ALL local data? This will wipe orders, clients, and writers.')) {
                  localStorage.removeItem('ips-orders');
                  localStorage.removeItem('ips-clients');
                  localStorage.removeItem('ips-admin-writers');
                  window.location.reload();
                }
              }}
            >
              Reset All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
