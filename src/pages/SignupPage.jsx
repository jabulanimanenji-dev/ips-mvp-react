import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SignupPage() {
  const { signupClient } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setError(result.error || 'Signup failed. Please try again.');
alert('Error: ' + (result.error || 'Unknown error'));
    }

    setLoading(true);
    const result = signupClient(form.name.trim(), form.email.trim(), form.password.trim());
    setLoading(false);

    if (result.success) {
      navigate('/client/overview');
    } else {
      setError(result.error || 'Signup failed. Please try again.');
    }
  };

  return (
    <div className="flex justify-center items-center" style={{ minHeight: '80vh', padding: '2rem 1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: 420 }}>
        <div className="text-center" style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 'var(--radius-md)',
              background: 'var(--grad-hero)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: '1rem',
              marginBottom: '1rem',
            }}
          >
            IPS
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Create Account</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Join I P S and start tracking your orders
          </p>
        </div>

        {error && (
          <div
            className="toast error"
            style={{ marginBottom: '1rem', minWidth: 'auto', maxWidth: 'none', animation: 'fadeIn 0.3s ease' }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              name="name"
              className="form-input"
              value={form.name}
              onChange={handleChange}
              placeholder="John Doe"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <input
              type="email"
              name="email"
              className="form-input"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password *</label>
            <input
              type="password"
              name="password"
              className="form-input"
              value={form.password}
              onChange={handleChange}
              placeholder="Choose a strong password"
              required
              minLength="6"
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Minimum 6 characters. Remember this — you'll need it to login.
            </small>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
            style={{ marginTop: '0.5rem' }}
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <div
          className="text-center"
          style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}
        >
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Already have an account?{' '}
          </span>
          <Link to="/login" style={{ color: 'var(--text-link)', fontWeight: 600, textDecoration: 'none' }}>
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}