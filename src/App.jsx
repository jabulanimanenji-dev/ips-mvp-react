import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import PublicLayout from './pages/PublicLayout';
import HomePage from './pages/HomePage';
import QuotePage from './pages/QuotePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';

import ClientLayout from './pages/ClientLayout';
import ClientOverview from './components/client/ClientOverview';
import ClientOrders from './components/client/ClientOrders';
import ClientOrderDetail from './components/client/ClientOrderDetail';
import ClientProfile from './components/client/ClientProfile';
import ClientSupport from './components/client/ClientSupport';

import AdminLayout from './pages/AdminLayout';
import AdminLogin from './components/admin/AdminLogin';
import AdminDashboard from './components/admin/AdminDashboard';
import AdminOrders from './components/admin/AdminOrders';
import AdminOrderDetail from './components/admin/AdminOrderDetail';
import AdminClients from './components/admin/AdminClients';
import AdminWriters from './components/admin/AdminWriters';
import AdminPayments from './components/admin/AdminPayments';
import AdminCMS from './components/admin/AdminCMS';
import AdminMessages from './components/admin/AdminMessages';
import AdminReports from './components/admin/AdminReports';
import AdminSettings from './components/admin/AdminSettings';

import WriterLogin from './components/writer/WriterLogin';

function ProtectedClientRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function ProtectedAdminRoute({ children }) {
  const { admin } = useAuth();
  return admin ? children : <Navigate to="/admin/login" replace />;
}

function ProtectedWriterRoute({ children }) {
  const { writer } = useAuth();
  return writer ? children : <Navigate to="/writer/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/quote" element={<QuotePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      {/* Client Dashboard */}
      <Route path="/client" element={<ProtectedClientRoute><ClientLayout /></ProtectedClientRoute>}>
        <Route index element={<Navigate to="/client/overview" replace />} />
        <Route path="overview" element={<ClientOverview />} />
        <Route path="orders" element={<ClientOrders />} />
        <Route path="orders/:orderId" element={<ClientOrderDetail />} />
        <Route path="profile" element={<ClientProfile />} />
        <Route path="support" element={<ClientSupport />} />
      </Route>

      {/* Writer Portal */}
      <Route path="/writer/login" element={<WriterLogin />} />
      <Route path="/writer" element={<ProtectedWriterRoute><div>Writer Dashboard (Coming Soon)</div></ProtectedWriterRoute>} />

      {/* Admin Portal */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute>}>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/:orderId" element={<AdminOrderDetail />} />
        <Route path="clients" element={<AdminClients />} />
        <Route path="writers" element={<AdminWriters />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="cms" element={<AdminCMS />} />
        <Route path="messages" element={<AdminMessages />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}