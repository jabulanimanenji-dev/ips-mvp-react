import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function ClientProfile() {
  const { user, updateClientProfile } = useAuth();
  const [form, setForm] = useState({ full_name: '', country: '', phone: '', password: '' });
  const [state, setState] = useState({ saving: false, success: '', error: '' });

  useEffect(() => {
    setForm({
      full_name: user?.full_name || '',
      country: user?.country || '',
      phone: user?.phone || '',
      password: ''
    });
  }, [user]);

  const submit = async event => {
    event.preventDefault();
    setState({ saving: true, success: '', error: '' });
    const updates = {
      full_name: form.full_name.trim(),
      country: form.country.trim(),
      phone: form.phone.trim(),
      ...(form.password ? { password: form.password } : {})
    };
    const result = await updateClientProfile(updates);
    setState({
      saving: false,
      success: result.success ? 'Your MongoDB profile has been updated.' : '',
      error: result.success ? '' : result.error
    });
    if (result.success) setForm(previous => ({ ...previous, password: '' }));
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ color: 'var(--primary)', fontSize: '.72rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' }}>Account centre</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '.35rem 0' }}>My Profile</h2>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>These details are saved securely to your IPS account and used across every service.</p>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <form onSubmit={submit}>
          <div className="grid grid-2 gap-4">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" value={form.full_name} onChange={event => setForm({ ...form, full_name: event.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Client ID</label>
              <input className="form-input" value={user?.client_id || ''} readOnly style={{ opacity: .7 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={user?.email || ''} readOnly style={{ opacity: .7 }} />
              <small style={{ color: 'var(--text-muted)' }}>Ask admin to change your account email.</small>
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" type="tel" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="+263..." />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input className="form-input" value={form.country} onChange={event => setForm({ ...form, country: event.target.value })} placeholder="Country of residence" />
            </div>
            <div className="form-group">
              <label className="form-label">New Password (optional)</label>
              <input className="form-input" type="password" minLength={8} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="Leave blank to keep current password" />
            </div>
          </div>

          {state.error && <div className="toast error" style={{ position: 'static', marginBottom: '1rem', maxWidth: 'none' }}>{state.error}</div>}
          {state.success && <div className="toast success" style={{ position: 'static', marginBottom: '1rem', maxWidth: 'none' }}>{state.success}</div>}
          <button className="btn btn-primary" disabled={state.saving}>{state.saving ? 'Saving…' : 'Save Profile'}</button>
        </form>
      </div>
    </div>
  );
}
