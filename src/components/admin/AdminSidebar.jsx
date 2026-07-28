import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/admin/orders', label: 'Orders', icon: '📦' },
  { path: '/admin/services', label: 'Service Operations', icon: 'S' },
  { path: '/admin/clients', label: 'Clients', icon: '👥' },
  { path: '/admin/writers', label: 'Service Providers', icon: '✍️' },
  { path: '/admin/payments', label: 'Payments', icon: '💳' },
  { path: '/admin/cms', label: 'CMS (God Mode)', icon: '⚡' },
  { path: '/admin/messages', label: 'Messages', icon: '💬' },
  { path: '/admin/actions', label: 'Action Center', icon: '!' },
  { path: '/admin/reports', label: 'Reports', icon: '📈' },
  { path: '/admin/settings', label: 'Settings', icon: '⚙️' },
];

export default function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [actionCount, setActionCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);

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
    <aside
      style={{
        width: 260,
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0B1C3B 0%, #1A0F2E 60%, #2D1F44 100%)',
        borderRight: '1px solid rgba(185,205,238,0.08)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 100,
      }}
    >
      <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(185,205,238,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #660273 0%, #A305A6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.85rem', fontWeight: 800, color: '#fff',
              boxShadow: '0 0 16px rgba(163,5,166,0.3)',
            }}
          >
            IPS
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#F8F4E9', fontSize: '0.95rem', lineHeight: 1.2 }}>
              Mission Control
            </div>
            <div style={{ fontSize: '0.7rem', color: '#748B91', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Admin Portal
            </div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '1rem 0.75rem', overflowY: 'auto' }}>
        {NAV_ITEMS.map((item) => {
          const active = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.7rem',
                padding: '0.7rem 1rem', borderRadius: 10, marginBottom: 4,
                fontSize: '0.88rem', fontWeight: 600,
                color: active ? '#F8F4E9' : '#B9CDEE',
                background: active ? 'rgba(122,75,168,0.25)' : 'transparent',
                border: active ? '1px solid rgba(163,5,166,0.3)' : '1px solid transparent',
                textDecoration: 'none', transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!active) { e.currentTarget.style.background = 'rgba(122,75,168,0.12)'; e.currentTarget.style.color = '#F8F4E9'; }
              }}
              onMouseLeave={(e) => {
                if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#B9CDEE'; }
              }}
            >
              <span style={{ fontSize: '1rem', opacity: 0.9 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.path === '/admin/actions' && actionCount > 0 && <span style={{ minWidth: 24, height: 24, padding: '0 7px', borderRadius: 20, background: '#ef4444', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '.7rem', fontWeight: 800 }}>{actionCount > 99 ? '99+' : actionCount}</span>}
              {item.path === '/admin/messages' && messageCount > 0 && <span style={{ minWidth: 24, height: 24, padding: '0 7px', borderRadius: 20, background: 'var(--primary)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '.7rem', fontWeight: 800 }}>{messageCount > 99 ? '99+' : messageCount}</span>}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '1rem 0.75rem', borderTop: '1px solid rgba(185,205,238,0.08)' }}>
        <button onClick={handleLogout} className="btn btn-danger" style={{ width: '100%', justifyContent: 'flex-start', gap: '0.7rem' }}>
          <span>🚪</span> Logout
        </button>
      </div>
    </aside>
  );
}
