import React from 'react';
import '../styles/academic-workspace.css';
import { Outlet } from 'react-router-dom';
import ClientSidebar from '../components/client/ClientSidebar';
import WorkspaceTopbar from '../components/common/WorkspaceTopbar.jsx';
import { useCMS } from '../context/CMSContext';

export default function ClientLayout() {
  const { config } = useCMS();
  const layout = config.layouts?.client || {};
  return (
    <div className={`client-layout density-${layout.density || 'comfortable'} ipsa-workspace`} style={{ minHeight: '100vh', background: 'var(--bg-body)' }}>
      <ClientSidebar />
      <main className="client-content" style={{ marginLeft: layout.sidebarWidth || 260, padding: layout.contentPadding || 32, minHeight: '100vh' }}>
        <WorkspaceTopbar role="client" />
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
