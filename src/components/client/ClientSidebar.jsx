import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const NAV_ITEMS = [
  { path: '/client/overview', label: 'Overview', icon: '◈' },
  { path: '/client/orders', label: 'My Orders', icon: '▤' },
  { path: '/client/profile', label: 'Profile', icon: '◉' },
  { path: '/client/support', label: 'Support', icon: '✉' },
];

export default function ClientSidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="btn btn-ghost"
        style={{
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          zIndex: 1100,
          display: 'none',
        }}
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        ☰
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--overlay)',
            zIndex: 998,
          }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        style={{
          width: 'var(--sidebar-w)',
          minHeight: '100vh',
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: 999,
          transition: 'transform 0.3s ease',
        }}
        className={mobileOpen ? 'sidebar-open' : ''}
      >
        {/* Brand */}
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'var(--grad-hero)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.85rem',
            }}
          >
            IPS
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>Client Portal</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {user?.full_name || 'Guest'}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '1rem 0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.65rem 0.875rem',
                    borderRadius: 'var(--radius-md)',
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    transition: 'all var(--transition)',
                    background: active ? 'var(--bg-active)' : 'transparent',
                    color: active ? 'var(--primary)' : 'var(--text-secondary)',
                    border: active ? '1px solid var(--border-focus)' : '1px solid transparent',
                  }}
                >
                  <span style={{ fontSize: '1rem', opacity: 0.8 }}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom actions */}
        <div
          style={{
            padding: '1rem 0.75rem',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <button
            className="btn btn-ghost"
            onClick={toggleTheme}
            style={{ justifyContent: 'flex-start', fontSize: '0.85rem' }}
          >
            <span>{theme === 'light' ? '☾' : '☀'}</span>
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>
          <button
            className="btn btn-ghost btn-danger"
            onClick={handleLogout}
            style={{ justifyContent: 'flex-start', fontSize: '0.85rem' }}
          >
            <span>↪</span> Logout
          </button>
        </div>
      </aside>

      {/* Mobile sidebar CSS */}
      <style>{`
        @media (max-width: 768px) {
          aside { transform: translateX(-100%); }
          aside.sidebar-open { transform: translateX(0); }
          button[aria-label="Toggle menu"] { display: inline-flex !important; }
        }
      `}</style>
    </>
  );
}
