import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminLogin() {
  const [email, setEmail] = useState('admin@ipsglobal.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const result = await loginAdmin(email, password);
    
    if (result.success) {
      navigate('/admin/dashboard', { replace: true });
    } else {
      setError(result.error || 'Invalid credentials');
    }
    
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0B1C3B 0%, #2D1F44 50%, #512F5C 100%)',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'rgba(12,17,31,0.85)',
          border: '1px solid rgba(185,205,238,0.12)',
          borderRadius: 16,
          padding: '2.5rem',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #660273 0%, #A305A6 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: 800,
              color: '#fff',
              marginBottom: '1rem',
              boxShadow: '0 0 24px rgba(163,5,166,0.3)',
            }}
          >
            IPS
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#F8F4E9', marginBottom: 4 }}>
            Mission Control
          </h1>
          <p style={{ color: '#748B91', fontSize: '0.875rem' }}>Admin Portal</p>
        </div>

        {error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 10,
              background: 'rgba(239,68,68,0.12)',
              color: '#ef4444',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" style={{ color: '#B9CDEE' }}>Email</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ background: '#131F38', borderColor: 'rgba(185,205,238,0.12)', color: '#F8F4E9' }}
            />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ color: '#B9CDEE' }}>Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ background: '#131F38', borderColor: 'rgba(185,205,238,0.12)', color: '#F8F4E9' }}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}