import StudentSupportPage from './pages/StudentSupportPage.jsx';
import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useCMS } from './context/CMSContext';

import PublicLayout from './pages/PublicLayout';
import HomePage from './pages/HomePage';
import QuotePage from './pages/QuotePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import PasswordRecoveryPage from './pages/PasswordRecoveryPage.jsx';
import EmailConfirmationPage from './pages/EmailConfirmationPage.jsx';
import CompanyAdministration from './administration/CompanyAdministration.jsx';
import {Restricted} from './administration/core.jsx';
import {CompanyBridge,DepartmentBridge,JourneyBridge,CompanyInsights} from './administration/CompanyControl.jsx';
import OperationsBoard from './administration/OperationsBoard.jsx';
import Workforce from './administration/Workforce.jsx';
import {ClientRegistry,SpecialistRegistry} from './administration/PeopleHub.jsx';
import TelegramOperations from './administration/TelegramOperations.jsx';
import IntakeDesk from './administration/IntakeDesk.jsx';
import CustomerSupportDesk from './administration/CustomerSupportDesk.jsx';
import PrivateConversations from './administration/PrivateConversations.jsx';
import {ProductionRegister,ProjectCaseFile} from './administration/ProductionHub.jsx';

import StaffOnboardingPage from './pages/StaffOnboardingPage.jsx';
import EvaluationGateway from './pages/EvaluationGateway.jsx';
import ServiceMarketplacePage from './pages/ServiceMarketplacePage';
import ProviderApplicationPage from './pages/ProviderApplicationPage';
import JoinPage from './pages/JoinPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage.jsx';

import ClientLayout from './pages/ClientLayout';
import ClientOverview from './components/client/ClientOverviewMongo';
import ClientOrders from './components/client/ClientOrders';
import ClientOrderDetail from './components/client/ClientOrderDetail';
import ClientOrderForm from './components/client/ClientOrderForm';
import ClientProfile from './components/client/ClientProfile';
import ClientPayments from './components/client/ClientPayments.jsx';
import ClientSupport from './components/client/ClientSupport';
import ClientServices from './components/client/ClientServices';

import CompanyShell from './companyOS/CompanyShell.jsx';
import CompanyHome from './companyOS/CompanyHome.jsx';
import CompanyWork from './companyOS/CompanyWork.jsx';
import CompanyTeam from './companyOS/CompanyTeam.jsx';
import {CompanyClients,CompanySpecialists,CompanyProjects} from './companyOS/CompanyRecords.jsx';
import {CompanyDepartments,CompanyJourneys,CompanyIntelligence} from './companyOS/CompanyOperations.jsx';
import {CompanyGuard,ProtectedBusinessWorkspace} from './companyOS/CompanyGuard.jsx';
import AdminLogin from './components/admin/AdminLogin';
import CompanyOperationsDesk from './components/admin/CompanyOperationsDesk.jsx';
import CompanyCommandCenter from './components/admin/CompanyCommandCenter.jsx';
import AdminClients from './components/admin/AdminClients';
import AdminWriters from './components/admin/AdminWriters';
import AdminPayments from './components/admin/AdminPayments';

import AdminReports from './components/admin/AdminReports';
import AdminSettings from './components/admin/AdminSettings';
import AdminServices from './components/admin/AdminServices';
import AdminSupportTickets from './components/admin/AdminSupportTickets';
import AdminAccessManager from './components/admin/AdminAccessManager';

import WriterLogin from './components/writer/WriterLogin';
import WriterLayout from './pages/WriterLayout';
import WriterDashboard from './components/writer/WriterDashboard';
import WriterOrders from './components/writer/WriterOrders';
import WriterProfile from './components/writer/WriterProfile.jsx';
import SpecialistEarnings from './components/writer/SpecialistEarnings.jsx';
import WriterOrderDetail from './components/writer/WriterOrderDetail';
import ProviderServices from './components/writer/ProviderServices';
import ServiceJobDetail from './components/common/ServiceJobDetail';
import ActionCenter from './components/common/ActionCenter';
import DirectMessaging from './components/common/DirectMessaging';
import ChannelInbox from './components/admin/ChannelInbox.jsx';
import AdminEnquiries from './components/admin/AdminEnquiries.jsx';
import VisualPageLayer from './components/common/VisualPageLayer';

const ADMIN_ENTRY_PATH = (import.meta.env.VITE_ADMIN_ENTRY_PATH || '/ips-mission-control')
  .trim()
  .replace(/\/+$/, '');

function FeatureGate({ feature, children }) {
  const { config } = useCMS();
  if (config.features?.[feature] !== false) return children;
  return (
    <section style={{ minHeight: '65vh', display: 'grid', placeItems: 'center', padding: '2rem' }}>
      <div className="card" style={{ width: 'min(620px, 100%)', textAlign: 'center' }}>
        <div className="badge badge-review">Temporarily unavailable</div>
        <h1>This IPS feature is currently turned off</h1>
        <p style={{ color: 'var(--text-muted)' }}>A Super Admin has temporarily disabled this part of the platform. Please return to the homepage or contact IPS support.</p>
        <a href="/" className="btn btn-primary">Return home</a>
      </div>
    </section>
  );
}


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
    <>
    {import.meta.env.VITE_IPS_EVALUATION==='true'&&
      <div className="ips-evaluation-banner" role="status">
        <span>IPS evaluation environment · sample identities and transactions only · no real client data</span>
        <a href="/evaluation">Open three-workspace evaluation guide</a>
      </div>}
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
          element={<FeatureGate feature="quoteRequests">{import.meta.env.VITE_STUDENT_LAUNCH === 'true' ? <StudentSupportPage /> : <QuotePage />}</FeatureGate>}
        />

        <Route path="/services" element={<FeatureGate feature="serviceMarketplace">{import.meta.env.VITE_STUDENT_LAUNCH === 'true' ? <StudentSupportPage /> : <ServiceMarketplacePage />}</FeatureGate>} />
        <Route path="/student-support" element={<FeatureGate feature="serviceMarketplace"><StudentSupportPage /></FeatureGate>} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/evaluation" element={import.meta.env.VITE_IPS_EVALUATION==='true'?<EvaluationGateway/>:<Navigate to="/" replace/>}/>
        <Route path="/become-a-provider" element={<FeatureGate feature="providerApplications"><ProviderApplicationPage /></FeatureGate>} />

        <Route
          path="/login"
          element={<FeatureGate feature="clientLogin"><LoginPage /></FeatureGate>}
        />

        <Route
          path="/signup"
          element={<FeatureGate feature="clientRegistration"><SignupPage /></FeatureGate>}
        />
        <Route path="/forgot-password" element={<PasswordRecoveryPage />} />
        <Route path="/reset-password" element={<PasswordRecoveryPage />} />
        <Route path="/writer/forgot-password" element={<PasswordRecoveryPage/>}/>
        <Route path="/writer/reset-password" element={<PasswordRecoveryPage/>}/>
        <Route path="/verify-email" element={<EmailConfirmationPage/>}/>

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
          element={import.meta.env.VITE_STUDENT_LAUNCH === 'true' ? <Navigate to="/student-support" replace /> : <ClientOrderForm />}
        />


        <Route
          path="profile"
          element={<ClientProfile />}
        />
        <Route path="payments" element={<ClientPayments/>}/>


        <Route
          path="support"
          element={<ClientSupport />}
        />
        <Route path="messages" element={<DirectMessaging role="client" />} />


      </Route>







      {/* WRITER */}

      <Route
        path="/writer/login"
        element={<FeatureGate feature="providerLogin"><WriterLogin /></FeatureGate>}
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
        <Route path="profile" element={<WriterProfile />} />
        <Route path="earnings" element={<SpecialistEarnings />} />
        <Route path="actions" element={<ActionCenter role="writer" />} />
      </Route>








      {/* ADMIN */}

      <Route path="/ips-staff-onboarding" element={<StaffOnboardingPage />} />
      <Route path={ADMIN_ENTRY_PATH} element={<AdminLogin />} />
      <Route path="/admin/login" element={<Navigate to="/login" replace />} />


      {/* IPS ADMINISTRATION FOUR — complete new company operating experience.
          Previously rejected admin components are not mounted anywhere here. */}
      <Route path="/admin" element={<ProtectedAdminRoute><CompanyAdministration/></ProtectedAdminRoute>}>
        <Route index element={<Navigate to="/admin/dashboard" replace/>}/>
        <Route path="dashboard" element={<Restricted permission="dashboard.view"><CompanyBridge/></Restricted>}/>
        <Route path="case-desk" element={<Restricted permission="dashboard.view"><OperationsBoard/></Restricted>}/>
        <Route path="journeys" element={<Restricted permission="dashboard.view"><JourneyBridge/></Restricted>}/>
        <Route path="departments" element={<Restricted permission="dashboard.view"><DepartmentBridge/></Restricted>}/>
        <Route path="access" element={<Restricted permission="team.manage"><Workforce/></Restricted>}/>
        <Route path="clients" element={<Restricted permission="clients.view"><ClientRegistry/></Restricted>}/>
        <Route path="writers" element={<Restricted permission="providers.view"><SpecialistRegistry/></Restricted>}/>
        <Route path="enquiries" element={<Restricted permission="support.view"><IntakeDesk/></Restricted>}/>
        <Route path="services" element={<Restricted permission="services.view"><ProductionRegister/></Restricted>}/>
        <Route path="services/:requestId" element={<Restricted permission="services.view"><ProjectCaseFile/></Restricted>}/>
        <Route path="quality" element={<Restricted permission="services.view"><ProductionRegister quality/></Restricted>}/>
        <Route path="support" element={<Restricted permission="support.view"><CustomerSupportDesk/></Restricted>}/>
        <Route path="external-chats" element={<Restricted permission="messages.view"><TelegramOperations/></Restricted>}/>
        <Route path="messages" element={<Restricted permission="messages.view"><PrivateConversations/></Restricted>}/>
        <Route path="reports" element={<Restricted permission="reports.view"><CompanyInsights/></Restricted>}/>
        <Route path="payments" element={<Restricted permission="payments.view"><CompanyInsights kind="finance"/></Restricted>}/>
        <Route path="settings" element={<Restricted permission="settings.view"><CompanyInsights kind="security"/></Restricted>}/>
        <Route path="intake/reply" element={<Navigate to="/admin/enquiries" replace/>}/>
        <Route path="support/tickets" element={<Navigate to="/admin/support" replace/>}/>
        <Route path="channels/telegram" element={<Navigate to="/admin/external-chats" replace/>}/>
        <Route path="job-messages" element={<Navigate to="/admin/messages" replace/>}/>
        <Route path="orders" element={<Navigate to="/admin/services" replace/>}/>
        <Route path="orders/:orderId" element={<Navigate to="/admin/services" replace/>}/>
        <Route path="actions" element={<Navigate to="/admin/case-desk" replace/>}/>
        <Route path="cms" element={<Navigate to="/admin/dashboard" replace/>}/>
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
    </>
  );

}
