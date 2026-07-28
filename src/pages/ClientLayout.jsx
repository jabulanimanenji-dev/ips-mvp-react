import React from 'react';
import { Outlet } from 'react-router-dom';
import ClientSidebar from '../components/client/ClientSidebar';

export default function ClientLayout() {
  return (
    <div className="client-layout" style={{ minHeight: '100vh', background: 'var(--bg-body)' }}>
      <ClientSidebar />
      <main className="client-content" style={{ marginLeft: 'var(--sidebar-w)', padding: '2rem', minHeight: '100vh' }}>
        <Outlet />
      </main>
      <style>{`
        @media (max-width: 768px) {
          .client-content { margin-left: 0 !important; padding: 5rem 1rem 2rem !important; }
        }
      `}</style>
    </div>
  );
}
