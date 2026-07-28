import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import PublicLayout from './pages/PublicLayout';
import HomePage from './pages/HomePage';
import QuotePage from './pages/QuotePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ServiceMarketplacePage from './pages/ServiceMarketplacePage';

import ClientLayout from './pages/ClientLayout';
import ClientOverview from './components/client/ClientOverviewMongo';
import ClientOrders from './components/client/ClientOrders';
import ClientOrderDetail from './components/client/ClientOrderDetail';
import ClientOrderForm from './components/client/ClientOrderForm';
import ClientProfile from './components/client/ClientProfile';
import ClientSupport from './components/client/ClientSupport';
import ClientServices from './components/client/ClientServices';

import AdminLayout from './pages/AdminLayout';
import AdminLogin from './components/admin/AdminLogin';
import AdminDashboard from './components/admin/AdminDashboard';
import AdminOrders from './components/admin/AdminOrders';
import AdminOrderDetail from './components/admin/AdminOrderDetailMongo';
import AdminClients from './components/admin/AdminClients';
import AdminWriters from './components/admin/AdminWriters';
import AdminPayments from './components/admin/AdminPayments';
import AdminCMS from './components/admin/AdminCMS';
import AdminMessages from './components/admin/AdminMessages';
import AdminReports from './components/admin/AdminReports';
import AdminSettings from './components/admin/AdminSettings';
import AdminServices from './components/admin/AdminServices';
import AdminSupportTickets from './components/admin/AdminSupportTickets';
import AdminAccessManager from './components/admin/AdminAccessManager';

import WriterLogin from './components/writer/WriterLogin';
import WriterLayout from './pages/WriterLayout';
import WriterDashboard from './components/writer/WriterDashboard';
import WriterOrders from './components/writer/WriterOrders';
import WriterOrderDetail from './components/writer/WriterOrderDetail';
import ProviderServices from './components/writer/ProviderServices';
import ServiceJobDetail from './components/common/ServiceJobDetail';
import ActionCenter from './components/common/ActionCenter';
import DirectMessaging from './components/common/DirectMessaging';
import VisualPageLayer from './components/common/VisualPageLayer';

const ADMIN_ENTRY_PATH = (import.meta.env.VITE_ADMIN_ENTRY_PATH || '/ips-mission-control')
  .trim()
  .replace(/\/+$/, '');


function ProtectedClientRoute({ children }) {

  const { user, loading } = useAuth();


  if (loading) {
    return (
      <div style={{
        padding:'3rem',
        textAlign:'center'
      }}>
        Loading...
      </div>
    );
  }


  return user
    ? children
    : <Navigate to="/login" replace />;

}



function ProtectedAdminRoute({ children }) {

  const { admin, loading, changeAdminPassword, logout } = useAuth();
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordState, setPasswordState] = useState({ working: false, error: '' });


  if (loading) {
    return (
      <div style={{
        padding:'3rem',
        textAlign:'center'
      }}>
        Loading...
      </div>
    );
  }


  if (!admin) return <Navigate to={ADMIN_ENTRY_PATH} replace />;

  if (admin.mustChangePassword) {
    const submit = async event => {
      event.preventDefault();
      if (passwords.next !== passwords.confirm) {
        setPasswordState({ working: false, error: 'The new passwords do not match.' });
        return;
      }
      setPasswordState({ working: true, error: '' });
      const result = await changeAdminPassword(passwords.current, passwords.next);
      if (!result.success) setPasswordState({ working: false, error: result.error });
    };
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem', background: 'var(--bg-body)' }}>
        <form className="card" style={{ width: 'min(500px, 100%)' }} onSubmit={submit}>
          <div className="badge badge-review">Security action required</div>
          <h2>Replace your temporary password</h2>
          <p style={{ color: 'var(--text-muted)' }}>Before Mission Control opens, choose a private password known only to you. Your temporary credentials and prior sessions will be revoked.</p>
          {passwordState.error && <div className="toast error" style={{ position: 'static', marginBottom: '1rem' }}>{passwordState.error}</div>}
          <div className="flex flex-col gap-3">
            <input className="form-input" type="password" placeholder="Current temporary password" value={passwords.current} onChange={event => setPasswords({ ...passwords, current: event.target.value })} required />
            <input className="form-input" type="password" minLength={10} pattern="(?=.*[A-Za-z])(?=.*\d).{10,}" placeholder="New password (10+ characters, letter + number)" value={passwords.next} onChange={event => setPasswords({ ...passwords, next: event.target.value })} required />
            <input className="form-input" type="password" minLength={10} pattern="(?=.*[A-Za-z])(?=.*\d).{10,}" placeholder="Confirm new password" value={passwords.confirm} onChange={event => setPasswords({ ...passwords, confirm: event.target.value })} required />
            <button className="btn btn-primary" disabled={passwordState.working}>{passwordState.working ? 'Securing account…' : 'Change password and continue'}</button>
            <button type="button" className="btn btn-secondary" onClick={logout}>Sign out</button>
          </div>
        </form>
      </div>
    );
  }

  return children;

}



function ProtectedWriterRoute({ children }) {

  const { writer, loading } = useAuth();


  if (loading) {
    return (
      <div style={{
        padding:'3rem',
        textAlign:'center'
      }}>
        Loading...
      </div>
    );
  }


  return writer
    ? children
    : <Navigate to="/writer/login" replace />;

}





export default function App() {

  return (

    <VisualPageLayer>
    <Routes>


      {/* PUBLIC ROUTES */}

      <Route element={<PublicLayout />}>

        <Route
          path="/"
          element={<HomePage />}
        />

        <Route
          path="/quote"
          element={<QuotePage />}
        />

        <Route path="/services" element={<ServiceMarketplacePage />} />

        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/signup"
          element={<SignupPage />}
        />

      </Route>





      {/* CLIENT ROUTES */}

      <Route
        path="/client"
        element={
          <ProtectedClientRoute>
            <ClientLayout />
          </ProtectedClientRoute>
        }
      >


        <Route
          index
          element={
            <Navigate
              to="/client/overview"
              replace
            />
          }
        />


        <Route
          path="overview"
          element={<ClientOverview />}
        />


        <Route
          path="orders"
          element={<ClientOrders />}
        />

        <Route path="services" element={<ClientServices />} />
        <Route path="services/:requestId" element={<ServiceJobDetail role="client" />} />


        <Route
          path="orders/:orderId"
          element={<ClientOrderDetail />}
        />


        {/* Quote Page sends users here */}

        <Route
          path="order"
          element={<ClientOrderForm />}
        />


        <Route
          path="profile"
          element={<ClientProfile />}
        />


        <Route
          path="support"
          element={<ClientSupport />}
        />
        <Route path="messages" element={<DirectMessaging role="client" />} />


      </Route>







      {/* WRITER */}

      <Route
        path="/writer/login"
        element={<WriterLogin />}
      />


      <Route
        path="/writer"
        element={
          <ProtectedWriterRoute>
            <WriterLayout />
          </ProtectedWriterRoute>
        }
      >
        <Route index element={<Navigate to="/writer/dashboard" replace />} />
        <Route path="dashboard" element={<WriterDashboard />} />
        <Route path="orders" element={<WriterOrders />} />
        <Route path="services" element={<ProviderServices />} />
        <Route path="services/:requestId" element={<ServiceJobDetail role="writer" />} />
        <Route path="orders/:orderId" element={<WriterOrderDetail />} />
        <Route path="messages" element={<DirectMessaging role="writer" />} />
        <Route path="actions" element={<ActionCenter role="writer" />} />
      </Route>








      {/* ADMIN */}

      <Route path={ADMIN_ENTRY_PATH} element={<AdminLogin />} />
      <Route path="/admin/login" element={<Navigate to="/login" replace />} />


      <Route
        path="/admin"
        element={
          <ProtectedAdminRoute>
            <AdminLayout />
          </ProtectedAdminRoute>
        }
      >


        <Route
          index
          element={
            <Navigate
              to="/admin/dashboard"
              replace
            />
          }
        />


        <Route
          path="dashboard"
          element={<AdminDashboard />}
        />


        <Route
          path="orders"
          element={<AdminOrders />}
        />

        <Route path="services" element={<AdminServices />} />
        <Route path="services/:requestId" element={<ServiceJobDetail role="admin" />} />


        <Route
          path="orders/:orderId"
          element={<AdminOrderDetail />}
        />


        <Route
          path="clients"
          element={<AdminClients />}
        />


        <Route
          path="writers"
          element={<AdminWriters />}
        />


        <Route
          path="payments"
          element={<AdminPayments />}
        />


        <Route
          path="cms"
          element={<AdminCMS />}
        />


        <Route
          path="messages"
          element={<DirectMessaging role="admin" />}
        />
        <Route path="job-messages" element={<AdminMessages />} />
        <Route path="actions" element={<ActionCenter role="admin" />} />
        <Route path="support" element={<AdminSupportTickets />} />


        <Route
          path="reports"
          element={<AdminReports />}
        />


        <Route
          path="settings"
          element={<AdminSettings />}
        />

        <Route
          path="access"
          element={<AdminAccessManager />}
        />


      </Route>





      {/* FALLBACK */}

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />


    </Routes>
    </VisualPageLayer>

  );

}
