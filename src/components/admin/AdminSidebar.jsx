import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCMS } from '../../context/CMSContext';

export default function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { config } = useCMS();
  const [actionCount, setActionCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = (config.navigation?.admin || []).filter(item => item.visible);
  const sidebarWidth = config.layouts?.admin?.sidebarWidth || 260;

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
    navigate('/admin/login', { replace: true });
  };

  return (
    <>
      <button type="button" className="btn btn-ghost admin-menu-toggle" onClick={() => setMobileOpen(previous => !previous)}>Menu</button>
      {mobileOpen && <div className="admin-sidebar-overlay" onClick={() => setMobileOpen(false)} />}
      <aside
        className={`admin-sidebar ${mobileOpen ? 'sidebar-open' : ''}`}
        style={{
          width: sidebarWidth,
          minHeight: '100vh',
          background: `linear-gradient(180deg, ${config.theme?.dark?.surface || '#0B1C3B'} 0%, ${config.theme?.gradientStart || '#2D1F44'} 100%)`,
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 100
        }}
      >
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(185,205,238,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--grad-hero)', display: 'grid', placeItems: 'center', fontSize: '0.85rem', fontWeight: 800, color: '#fff', boxShadow: 'var(--shadow-glow-purple)' }}>
              IPS
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#F8F4E9', fontSize: '0.95rem', lineHeight: 1.2 }}>Mission Control</div>
              <div style={{ fontSize: '0.7rem', color: '#748B91', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Admin Portal</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '1rem 0.75rem', overflowY: 'auto' }}>
          {navItems.map(item => {
            const active = location.pathname.startsWith(item.target.split('?')[0]);
            return (
              <Link
                key={item.id}
                to={item.target}
                onClick={() => setMobileOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.7rem',
                  padding: '0.7rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 4,
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: active ? '#F8F4E9' : '#B9CDEE',
                  background: active ? 'rgba(122,75,168,0.25)' : 'transparent',
                  border: active ? '1px solid rgba(163,5,166,0.3)' : '1px solid transparent',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ fontSize: '1rem', opacity: 0.9 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.target === '/admin/actions' && actionCount > 0 && <span className="admin-nav-count admin-nav-count-danger">{actionCount > 99 ? '99+' : actionCount}</span>}
                {item.target.startsWith('/admin/messages') && messageCount > 0 && <span className="admin-nav-count">{messageCount > 99 ? '99+' : messageCount}</span>}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '1rem 0.75rem', borderTop: '1px solid rgba(185,205,238,0.08)' }}>
          <button type="button" onClick={handleLogout} className="btn btn-danger" style={{ width: '100%' }}>Logout</button>
        </div>
      </aside>

      <style>{`
        .admin-menu-toggle { display: none; position: fixed; top: 1rem; left: 1rem; z-index: 1100; width: auto !important; padding: .65rem !important; }
        .admin-sidebar-overlay { position: fixed; inset: 0; background: var(--overlay); z-index: 99; }
        .admin-nav-count { min-width: 24px; height: 24px; padding: 0 7px; border-radius: 20px; background: var(--primary); color: #fff; display: grid; place-items: center; font-size: .7rem; font-weight: 800; }
        .admin-nav-count-danger { background: #ef4444; }
        @media (max-width: 768px) {
          .admin-menu-toggle { display: inline-flex; }
          .admin-sidebar { transform: translateX(-100%); max-width: 88vw; transition: transform .25s ease; }
          .admin-sidebar.sidebar-open { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
