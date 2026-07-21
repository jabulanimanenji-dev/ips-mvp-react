import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function WriterLayout() {
  const { writer, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/writer/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/writer/orders', label: 'My Orders', icon: '📝' },
  ];

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/writer/login');
  };

  return (
    <div className="writer-layout" style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside className="writer-sidebar" style={{
        width: 240,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem 0'
      }}>
        <div style={{ padding: '0 1.5rem 1.5rem', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>
            ✍️ Literator Portal
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {writer?.name || 'Writer'}
          </div>
        </div>

        <nav style={{ flex: 1, padding: '1rem 0' }}>
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1.5rem',
                color: isActive(item.path) ? 'var(--primary)' : 'var(--text-secondary)',
                background: isActive(item.path) ? 'rgba(122,75,168,0.08)' : 'transparent',
                borderLeft: isActive(item.path) ? '3px solid var(--primary)' : '3px solid transparent',
                textDecoration: 'none',
                fontWeight: isActive(item.path) ? 600 : 400,
                fontSize: '0.9rem',
                transition: 'all 0.15s'
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ padding: '1rem 1.5rem 0', borderTop: '1px solid var(--border-light)' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '0.6rem',
              background: 'transparent',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500
            }}
          >
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="writer-main" style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}