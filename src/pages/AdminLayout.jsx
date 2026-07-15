import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AdminSidebar from '../components/admin/AdminSidebar';
import { useTheme } from '../context/ThemeContext';

const PAGE_TITLES = {
  '/admin/dashboard': 'Dashboard',
  '/admin/orders': 'Orders',
  '/admin/clients': 'Clients',
  '/admin/writers': 'Writers',
  '/admin/payments': 'Payments',
  '/admin/cms': 'CMS',
  '/admin/messages': 'Messages',
  '/admin/reports': 'Reports',
  '/admin/settings': 'Settings',
};

export default function AdminLayout() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  // Force dark theme for admin portal
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    return () => {
      // Optional: restore previous theme on unmount
      // document.documentElement.setAttribute('data-theme', theme);
    };
  }, []);

  const pageTitle = Object.entries(PAGE_TITLES).find(([path]) =>
    location.pathname.startsWith(path)
  )?.[1] || 'Admin';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AdminSidebar />
      <div style={{ marginLeft: 260, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <header
          style={{
            height: 72,
            position: 'sticky',
            top: 0,
            zIndex: 90,
            background: 'rgba(12,17,31,0.92)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(185,205,238,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 2rem',
          }}
        >
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F8F4E9' }}>{pageTitle}</h1>
          <div className="flex items-center gap-3">
            <button
              className="btn btn-sm btn-ghost"
              onClick={toggleTheme}
              title="Toggle theme"
              style={{ color: '#B9CDEE' }}
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #660273 0%, #A305A6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#fff',
              }}
            >
              AD
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main style={{ flex: 1, padding: '1.5rem 2rem 3rem' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
