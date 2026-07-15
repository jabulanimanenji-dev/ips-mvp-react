import React from 'react';
import { Outlet } from 'react-router-dom';
import ClientSidebar from '../components/client/ClientSidebar';

export default function ClientLayout() {
  return (
    <div className="flex" style={{ minHeight: '100vh' }}>
      <ClientSidebar />
      <main
        style={{
          flex: 1,
          marginLeft: 'var(--sidebar-w)',
          padding: '2rem',
          background: 'var(--bg-body)',
          minHeight: '100vh',
        }}
      >
        <div className="container" style={{ maxWidth: 1100 }}>
          <Outlet />
        </div>
      </main>

      {/* Responsive margin override */}
      <style>{`
        @media (max-width: 768px) {
          main { margin-left: 0 !important; padding: 1rem !important; padding-top: 4rem !important; }
        }
      `}</style>
    </div>
  );
}
