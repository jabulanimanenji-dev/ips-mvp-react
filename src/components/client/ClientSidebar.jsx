import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useCMS } from '../../context/CMSContext';

export default function ClientSidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { config } = useCMS();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const navItems = (config.navigation?.client || []).filter(item => item.visible);
  const sidebarWidth = config.layouts?.client?.sidebarWidth || 260;

  useEffect(() => {
    fetch('/api/conversations').then(response => response.json()).then(data => {
      if (data.success) setMessageCount((data.conversations || []).reduce((sum, item) => sum + (item.unread_count || 0), 0));
    }).catch(() => {});
  }, [location.pathname]);

  const isActive = target => {
    const path = target.split('?')[0];
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  return (
    <>
      <button
        className="btn btn-ghost client-menu-toggle"
        style={{ position: 'fixed', top: '1rem', left: '1rem', zIndex: 1100, display: 'none' }}
        onClick={() => setMobileOpen(previous => !previous)}
        aria-label="Toggle client menu"
      >
        Menu
      </button>

      {mobileOpen && <div className="client-sidebar-overlay" onClick={() => setMobileOpen(false)} />}

      <aside
        className={`client-sidebar ${mobileOpen ? 'sidebar-open' : ''}`}
        style={{
          width: sidebarWidth,
          minHeight: '100vh',
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: 999,
          transition: 'transform 0.3s ease'
        }}
      >
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--grad-hero)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: '0.85rem' }}>
            IPS
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>My IPS</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.full_name || 'Guest'}</div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '1rem 0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {navItems.map(item => {
              const active = isActive(item.target);
              return (
                <Link
                  key={item.id}
                  to={item.target}
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
                    border: active ? '1px solid var(--border-focus)' : '1px solid transparent'
                  }}
                >
                  <span style={{ fontSize: '1rem', opacity: 0.8 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.target.startsWith('/client/messages') && messageCount > 0 && (
                    <span className="nav-count">{messageCount > 99 ? '99+' : messageCount}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        <div style={{ padding: '1rem 0.75rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button className="btn btn-ghost" onClick={toggleTheme} style={{ justifyContent: 'flex-start', fontSize: '0.85rem' }}>
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>
          <button className="btn btn-ghost btn-danger" onClick={handleLogout} style={{ justifyContent: 'flex-start', fontSize: '0.85rem' }}>
            Logout
          </button>
        </div>
      </aside>

      <style>{`
        .client-sidebar-overlay { position: fixed; inset: 0; background: var(--overlay); z-index: 998; }
        .nav-count { min-width: 24px; height: 24px; padding: 0 7px; border-radius: 20px; background: var(--primary); color: #fff; display: grid; place-items: center; font-size: .7rem; font-weight: 800; }
        @media (max-width: 768px) {
          .client-sidebar { transform: translateX(-100%); max-width: 88vw; }
          .client-sidebar.sidebar-open { transform: translateX(0); }
          .client-menu-toggle { display: inline-flex !important; width: auto !important; }
        }
      `}</style>
    </>
  );
}
