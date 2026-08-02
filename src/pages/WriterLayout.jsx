import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useCMS } from '../context/CMSContext';

export default function WriterLayout() {
  const { writer, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { config } = useCMS();
  const location = useLocation();
  const navigate = useNavigate();
  const [actionCount, setActionCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = (config.navigation?.writer || []).filter(item => item.visible);
  const layout = config.layouts?.writer || {};

  const isActive = target => location.pathname === target.split('?')[0];

  useEffect(() => {
    fetch('/api/actions').then(response => response.json()).then(data => {
      if (data.success) setActionCount(data.summary?.total || 0);
    }).catch(() => {});
    fetch('/api/conversations').then(response => response.json()).then(data => {
      if (data.success) setMessageCount((data.conversations || []).reduce((sum, item) => sum + (item.unread_count || 0), 0));
    }).catch(() => {});
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/writer/login');
  };

  return (
    <div className={`writer-layout density-${layout.density || 'comfortable'}`} style={{ display: 'flex', minHeight: '100vh' }}>
      <button type="button" className="btn btn-ghost writer-menu-toggle" onClick={() => setMobileOpen(previous => !previous)}>Menu</button>
      {mobileOpen && <div className="writer-sidebar-overlay" onClick={() => setMobileOpen(false)} />}

      <aside
        data-studio-global="provider-sidebar"
        data-studio-label="Provider portal navigation"
        className={`writer-sidebar ${mobileOpen ? 'sidebar-open' : ''}`}
        style={{
          width: layout.sidebarWidth || 240,
          flexShrink: 0,
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem 0'
        }}
      >
        <div style={{ padding: '0 1.5rem 1.5rem', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>IPS Provider Portal</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{writer?.full_name || 'Service Provider'}</div>
        </div>

        <nav style={{ flex: 1, padding: '1rem 0' }}>
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
                  padding: '0.75rem 1.5rem',
                  color: active ? 'var(--primary)' : 'var(--text-secondary)',
                  background: active ? 'rgba(122,75,168,0.08)' : 'transparent',
                  borderLeft: active ? '3px solid var(--primary)' : '3px solid transparent',
                  textDecoration: 'none',
                  fontWeight: active ? 600 : 400,
                  fontSize: '0.9rem',
                  transition: 'all 0.15s'
                }}
              >
                <span>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.target === '/writer/actions' && actionCount > 0 && <span className="writer-nav-count writer-nav-count-danger">{actionCount > 99 ? '99+' : actionCount}</span>}
                {item.target.startsWith('/writer/messages') && messageCount > 0 && <span className="writer-nav-count">{messageCount > 99 ? '99+' : messageCount}</span>}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '1rem 1.5rem 0', borderTop: '1px solid var(--border-light)' }}>
          <button type="button" onClick={toggleTheme} className="btn btn-ghost" style={{ width: '100%', marginBottom: '0.65rem' }}>
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button type="button" onClick={handleLogout} className="btn btn-ghost" style={{ width: '100%' }}>Logout</button>
        </div>
      </aside>

      <main className="writer-main" style={{ flex: 1, padding: layout.contentPadding || 32, overflowY: 'auto', background: 'var(--bg-body)' }}>
        <Outlet />
      </main>

      <style>{`
        .writer-menu-toggle { display: none; position: fixed; top: 1rem; left: 1rem; z-index: 1100; width: auto !important; padding: .65rem !important; }
        .writer-sidebar-overlay { position: fixed; inset: 0; background: var(--overlay); z-index: 998; }
        .writer-nav-count { min-width: 24px; height: 24px; padding: 0 7px; border-radius: 20px; background: var(--primary); color: #fff; display: grid; place-items: center; font-size: .7rem; font-weight: 800; }
        .writer-nav-count-danger { background: #ef4444; }
        @media (max-width: 768px) {
          .writer-menu-toggle { display: inline-flex; }
          .writer-sidebar { position: fixed; inset: 0 auto 0 0; z-index: 999; max-width: 88vw; transform: translateX(-100%); transition: transform .25s ease; }
          .writer-sidebar.sidebar-open { transform: translateX(0); }
          .writer-main { padding: 5rem 1rem 2rem !important; width: 100%; }
        }
      `}</style>
    </div>
  );
}
