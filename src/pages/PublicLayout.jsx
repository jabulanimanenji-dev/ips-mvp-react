import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import Toast from '../components/common/Toast';
import { StudentSiteHeader, StudentSiteFooter } from '../components/public/StudentSiteShell.jsx';
import './student-support.css';
import { useCMS } from '../context/CMSContext';

export default function PublicLayout() {
  const { config } = useCMS();
  const density = config.layouts?.public?.density || 'comfortable';
  const studentLaunch = import.meta.env.VITE_STUDENT_LAUNCH === 'true';
  return (
    <div className={`flex flex-col density-${density}`} style={{ minHeight: '100vh' }}>
      {studentLaunch ? <StudentSiteHeader /> : <Navbar />}
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      {studentLaunch ? <StudentSiteFooter /> : <Footer />}
      <Toast />
    </div>
  );
}
