import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useCMS } from '../../context/CMSContext';

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { cms } = useCMS();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleScroll = (id) => {
    setMobileOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        background: 'var(--bg-header)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)'
      }}
    >
      <div className="container flex items-center justify-between" style={{ height: 'var(--header-h)', padding: '0 1rem' }}>
        {/* Logo */}
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            textDecoration: 'none',
            flexShrink: 0
          }}
        >
          <img
            src="/images/my-icon.png"
            alt="IPS"
            style={{ height: 28, width: 'auto', display: 'block' }}
          />
          <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
            {cms?.brand?.name || 'I P S'}
          </span>
        </Link>

        {/* Desktop Nav - hidden on mobile */}
        <nav className="hidden-mobile" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <Link to="/" className="nav-link" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}>Home</Link>
          <Link to="/quote" className="nav-link" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}>Quote</Link>
          <button onClick={() => handleScroll('about')} className="nav-link" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>About</button>
          <button onClick={() => handleScroll('faq')} className="nav-link" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>FAQ</button>

          <div className="flex items-center gap-2" style={{ marginLeft: '0.5rem' }}>
            <button onClick={toggleTheme} aria-label="Toggle theme" className="btn btn-ghost btn-sm">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>

            {user ? (
              <>
                <Link to="/client/overview" className="btn btn-primary btn-sm">Dashboard</Link>
                <button onClick={handleLogout} className="btn btn-ghost btn-sm">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">Log in</Link>
                <Link to="/signup" className="btn btn-primary btn-sm">Sign up</Link>
              </>
            )}
          </div>
        </nav>

        {/* Mobile hamburger - visible only on small screens */}
        <button
          className="mobile-only"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            padding: '0.5rem',
            display: 'none' // Will be overridden by CSS media query
          }}
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile menu - full width dropdown */}
      {mobileOpen && (
        <div style={{
          padding: '1rem',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-header)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <Link to="/" onClick={() => setMobileOpen(false)} style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none', padding: '0.5rem 0' }}>Home</Link>
          <Link to="/quote" onClick={() => setMobileOpen(false)} style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none', padding: '0.5rem 0' }}>Quote</Link>
          <button onClick={() => handleScroll('about')} style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '0.5rem 0' }}>About</button>
          <button onClick={() => handleScroll('faq')} style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '0.5rem 0' }}>FAQ</button>
          
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {user ? (
              <>
                <Link to="/client/overview" onClick={() => setMobileOpen(false)} className="btn btn-primary" style={{ textAlign: 'center' }}>Dashboard</Link>
                <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="btn btn-ghost" style={{ textAlign: 'center' }}>Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)} className="btn btn-ghost" style={{ textAlign: 'center' }}>Log in</Link>
                <Link to="/signup" onClick={() => setMobileOpen(false)} className="btn btn-primary" style={{ textAlign: 'center' }}>Sign up</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}