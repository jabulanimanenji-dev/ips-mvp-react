import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AdminSidebar from '../components/admin/AdminSidebar';
import { useTheme } from '../context/ThemeContext';
import { useCMS } from '../context/CMSContext';

const PAGE_TITLES = {
  '/admin/dashboard': 'Dashboard',
  '/admin/orders': 'Orders',
  '/admin/clients': 'Clients',
  '/admin/writers': 'Service Providers',
  '/admin/services': 'Service Operations',
  '/admin/payments': 'Payments',
  '/admin/cms': 'CMS',
  '/admin/messages': 'Messages',
  '/admin/reports': 'Reports',
  '/admin/settings': 'Settings',
};

export default function AdminLayout() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { config } = useCMS();
  const layout = config.layouts?.admin || {};

  // Force dark theme for admin portal
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    return () => {
      // Optional: restore previous theme on unmount
      // document.documentElement.setAttribute('data-theme', theme);
    };
  }, []);

  const configuredTitle = (config.navigation?.admin || []).find(item =>
    location.pathname.startsWith(item.target?.split('?')[0])
  )?.label;
  const pageTitle = configuredTitle || Object.entries(PAGE_TITLES).find(([path]) =>
    location.pathname.startsWith(path)
  )?.[1] || 'Admin';

  return (
    <div className={`admin-layout density-${layout.density || 'comfortable'}`} style={{ display: 'flex', minHeight: '100vh' }}>
      <AdminSidebar />
      <div className="admin-layout-content" style={{ marginLeft: layout.sidebarWidth || 260, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <header
          data-studio-global="admin-topbar"
          data-studio-label="Admin portal top bar"
          style={{
            height: 72,
            position: 'sticky',
            top: 0,
            zIndex: 90,
            background: 'var(--bg-header)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--border)',
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
                background: 'var(--grad-hero)',
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
        <main className="admin-main-content" style={{ flex: 1, padding: `${layout.contentPadding || 32}px` }}>
          <Outlet />
        </main>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .admin-layout-content { margin-left: 0 !important; width: 100%; }
          .admin-layout-content > header { padding-left: 5.5rem !important; }
          .admin-main-content { padding: 1rem !important; }
        }
      `}</style>
    </div>
  );
}
