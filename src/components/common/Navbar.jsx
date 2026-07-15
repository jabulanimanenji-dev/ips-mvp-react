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
      <div className="container flex items-center justify-between" style={{ height: 'var(--header-h)' }}>
        {/* Logo with icon */}
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            textDecoration: 'none'
          }}
        >
          <img
            src="/images/my-icon.png"
            alt="IPS"
            style={{ height: 32, width: 'auto', display: 'block' }}
          />
          <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {cms?.brand?.name || 'I P S'}
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="flex items-center gap-4" style={{ display: 'flex' }}>
          <div className="hidden@mobile" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <Link to="/" className="nav-link" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}>Home</Link>
            <Link to="/quote" className="nav-link" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}>Quote</Link>
            <button onClick={() => handleScroll('about')} className="nav-link" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>About</button>
            <button onClick={() => handleScroll('faq')} className="nav-link" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>FAQ</button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="btn btn-ghost btn-sm"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
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

          {/* Mobile hamburger */}
          <button
            className="btn btn-ghost btn-sm"
            style={{ display: 'none' }}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
        </nav>
      </div>

      {/* Simple mobile menu */}
      {mobileOpen && (
        <div className="container" style={{ paddingBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Link to="/" onClick={() => setMobileOpen(false)} style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}>Home</Link>
          <Link to="/quote" onClick={() => setMobileOpen(false)} style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}>Quote</Link>
          <button onClick={() => handleScroll('about')} style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>About</button>
          <button onClick={() => handleScroll('faq')} style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>FAQ</button>
          {!user && (
            <>
              <Link to="/login" onClick={() => setMobileOpen(false)} style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}>Log in</Link>
              <Link to="/signup" onClick={() => setMobileOpen(false)} style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}>Sign up</Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}