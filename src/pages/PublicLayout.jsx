import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import Toast from '../components/common/Toast';
import { useCMS } from '../context/CMSContext';

export default function PublicLayout() {
  const { config } = useCMS();
  const density = config.layouts?.public?.density || 'comfortable';
  return (
    <div className={`flex flex-col density-${density}`} style={{ minHeight: '100vh' }}>
      <Navbar />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <Footer />
      <Toast />
    </div>
  );
}
