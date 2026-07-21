import React from 'react';
import { Outlet } from 'react-router-dom';

export default function ClientLayout() {
  return (
    <div className="client-layout">

      <main className="client-content">
        <Outlet />
      </main>

    </div>
  );
}