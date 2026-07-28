import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { loginClient } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await loginClient(email, password);
    setLoading(false);

    if (result.success) {
      navigate('/client/overview');
    } else {
      setError(result.error || 'Invalid email or password.');
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
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Welcome to IPS</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Sign in to manage every service in one workspace
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: '1.5rem' }}>
          <div style={{ padding: '.75rem .35rem', textAlign: 'center', borderRadius: 10, background: 'var(--bg-active)', border: '1px solid var(--border-focus)', fontSize: '.78rem', fontWeight: 800, color: 'var(--primary)' }}>Client</div>
          <Link to="/writer/login" style={{ padding: '.75rem .35rem', textAlign: 'center', borderRadius: 10, border: '1px solid var(--border)', fontSize: '.78rem', fontWeight: 700, textDecoration: 'none', color: 'var(--text-secondary)' }}>Provider</Link>
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
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
            style={{ marginTop: '0.5rem' }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="text-center" style={{ marginTop: '1rem' }}>
          <a 
            href="mailto:admin@ipsglobalservice.com?subject=Password Reset Request&body=Please reset my password. My email is: " 
            style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none' }}
          >
            Forgot password? Contact admin@ipsglobalservice.com
          </a>
        </div>

        <div
          className="text-center"
          style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}
        >
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Don't have an account?{' '}
          </span>
          <Link to="/signup" style={{ color: 'var(--text-link)', fontWeight: 600, textDecoration: 'none' }}>
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
