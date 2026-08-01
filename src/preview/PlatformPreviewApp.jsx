import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DEFAULT_PLATFORM_CONFIG } from '../../shared/platformConfig.js';
import { PREVIEW_RENDERED_PAGE_IDS, resolvePreviewPath } from '../../shared/platformPreview.js';
import { CMSPreviewProvider } from '../context/CMSContext';
import { PreviewAuthProvider } from '../context/AuthContext';
import VisualPageLayer from '../components/common/VisualPageLayer';

import PublicLayout from '../pages/PublicLayout';
import HomePage from '../pages/HomePage';
import QuotePage from '../pages/QuotePage';
import LoginPage from '../pages/LoginPage';
import SignupPage from '../pages/SignupPage';
import ServiceMarketplacePage from '../pages/ServiceMarketplacePage';
import ProviderApplicationPage from '../pages/ProviderApplicationPage';
import JoinPage from '../pages/JoinPage';

import ClientLayout from '../pages/ClientLayout';
import ClientOverview from '../components/client/ClientOverviewMongo';
import ClientOrders from '../components/client/ClientOrders';
import ClientOrderDetail from '../components/client/ClientOrderDetail';
import ClientOrderForm from '../components/client/ClientOrderForm';
import ClientProfile from '../components/client/ClientProfile';
import ClientSupport from '../components/client/ClientSupport';
import ClientServices from '../components/client/ClientServices';

import WriterLogin from '../components/writer/WriterLogin';
import WriterLayout from '../pages/WriterLayout';
import WriterDashboard from '../components/writer/WriterDashboard';
import WriterOrders from '../components/writer/WriterOrders';
import WriterOrderDetail from '../components/writer/WriterOrderDetail';
import ProviderServices from '../components/writer/ProviderServices';

import AdminLayout from '../pages/AdminLayout';
import AdminLogin from '../components/admin/AdminLogin';
import AdminDashboard from '../components/admin/AdminDashboard';
import AdminOrders from '../components/admin/AdminOrders';
import AdminOrderDetail from '../components/admin/AdminOrderDetailMongo';
import AdminClients from '../components/admin/AdminClients';
import AdminWriters from '../components/admin/AdminWriters';
import AdminPayments from '../components/admin/AdminPayments';
import AdminMessages from '../components/admin/AdminMessages';
import AdminReports from '../components/admin/AdminReports';
import AdminSettings from '../components/admin/AdminSettings';
import AdminServices from '../components/admin/AdminServices';
import AdminSupportTickets from '../components/admin/AdminSupportTickets';
import AdminAccessManager from '../components/admin/AdminAccessManager';

import ServiceJobDetail from '../components/common/ServiceJobDetail';
import ActionCenter from '../components/common/ActionCenter';
import DirectMessaging from '../components/common/DirectMessaging';

const ADMIN_ENTRY_PATH = (import.meta.env.VITE_ADMIN_ENTRY_PATH || '/ips-mission-control').trim().replace(/\/+$/, '');

function PlatformStudioPreviewSummary() {
  return (
    <section className="card" style={{ maxWidth: 1000, margin: '2rem auto', padding: '2rem' }} data-builder-section="platform-studio-summary">
      <span className="badge badge-review">Non-recursive preview</span>
      <h1 style={{ marginTop: '.8rem' }}>Platform Studio</h1>
      <p style={{ color: 'var(--text-muted)' }}>The builder does not render another builder inside itself. This safe overview represents the Platform Studio route while you edit its page frame, theme and custom blocks.</p>
      <div className="grid grid-3 gap-3" style={{ marginTop: '1.5rem' }}>
        {['Website Builder', 'Services & Pricing', 'Publish & History'].map(label => <div className="card" key={label}><strong>{label}</strong><p style={{ color: 'var(--text-muted)' }}>Available in the live administrator workspace.</p></div>)}
      </div>
    </section>
  );
}

function PreviewRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/services" element={<ServiceMarketplacePage />} />
        <Route path="/quote" element={<QuotePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/become-a-provider" element={<ProviderApplicationPage />} />
      </Route>

      <Route path="/client" element={<ClientLayout />}>
        <Route path="overview" element={<ClientOverview />} />
        <Route path="orders" element={<ClientOrders />} />
        <Route path="orders/:orderId" element={<ClientOrderDetail />} />
        <Route path="order" element={<ClientOrderForm />} />
        <Route path="services" element={<ClientServices />} />
        <Route path="services/:requestId" element={<ServiceJobDetail role="client" />} />
        <Route path="messages" element={<DirectMessaging role="client" />} />
        <Route path="profile" element={<ClientProfile />} />
        <Route path="support" element={<ClientSupport />} />
      </Route>

      <Route path="/writer/login" element={<WriterLogin />} />
      <Route path="/writer" element={<WriterLayout />}>
        <Route path="dashboard" element={<WriterDashboard />} />
        <Route path="orders" element={<WriterOrders />} />
        <Route path="orders/:orderId" element={<WriterOrderDetail />} />
        <Route path="services" element={<ProviderServices />} />
        <Route path="services/:requestId" element={<ServiceJobDetail role="writer" />} />
        <Route path="messages" element={<DirectMessaging role="writer" />} />
        <Route path="actions" element={<ActionCenter role="writer" />} />
      </Route>

      <Route path={ADMIN_ENTRY_PATH} element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/:orderId" element={<AdminOrderDetail />} />
        <Route path="services" element={<AdminServices />} />
        <Route path="services/:requestId" element={<ServiceJobDetail role="admin" />} />
        <Route path="clients" element={<AdminClients />} />
        <Route path="writers" element={<AdminWriters />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="cms" element={<PlatformStudioPreviewSummary />} />
        <Route path="access" element={<AdminAccessManager />} />
        <Route path="messages" element={<DirectMessaging role="admin" />} />
        <Route path="job-messages" element={<AdminMessages />} />
        <Route path="actions" element={<ActionCenter role="admin" />} />
        <Route path="support" element={<AdminSupportTickets />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
      <Route path="*" element={<div className="card" style={{ margin: 32 }}><h2>Preview route unavailable</h2></div>} />
    </Routes>
  );
}

function PreviewInteractionGuard({ children, pageId }) {
  const guard = event => {
    const element = event.target.closest?.('[data-preview-element-id]');
    if (element) window.parent.postMessage({ type: 'ips-preview-element', pageId, elementId: element.getAttribute('data-preview-element-id') }, window.location.origin);
    const section = event.target.closest?.('[data-builder-section]');
    if (section) window.parent.postMessage({ type: 'ips-preview-section', pageId, section: section.getAttribute('data-builder-section') }, window.location.origin);
    const interactive = event.target.closest?.('a,button,[role="button"],input[type="submit"],input[type="file"]');
    if (!interactive) return;
    if (interactive.matches('[data-builder-local-control="true"],.site-navbar-mobile-toggle,.site-mobile-backdrop,.client-menu-toggle,.admin-menu-toggle,.writer-menu-toggle')) return;
    event.preventDefault();
    event.stopPropagation();
  };
  return (
    <div
      className="ips-platform-preview"
      data-preview-page-id={pageId}
      onClickCapture={guard}
      onSubmitCapture={event => { event.preventDefault(); event.stopPropagation(); }}
    >
      <div style={{ position: 'sticky', top: 0, zIndex: 500, padding: '.45rem .8rem', background: '#f59e0b', color: '#111827', textAlign: 'center', fontSize: '.78rem', fontWeight: 800 }}>
        PLATFORM STUDIO PREVIEW · SAMPLE DATA · OPERATIONAL ACTIONS DISABLED
      </div>
      {children}
    </div>
  );
}

export default function PlatformPreviewApp() {
  const [state, setState] = useState({ config: DEFAULT_PLATFORM_CONFIG, pageId: 'public.home', device: 'desktop', selectedElementId: '' });
  const root = useRef(null);

  useEffect(() => {
    const receive = event => {
      if (event.origin !== window.location.origin || event.data?.type !== 'ips-preview-update') return;
      setState(previous => ({
        config: event.data.config || previous.config,
        pageId: PREVIEW_RENDERED_PAGE_IDS.includes(event.data.pageId) ? event.data.pageId : previous.pageId,
        device: ['desktop', 'tablet', 'mobile'].includes(event.data.device) ? event.data.device : previous.device,
        selectedElementId: typeof event.data.selectedElementId === 'string' ? event.data.selectedElementId : previous.selectedElementId
      }));
    };
    window.addEventListener('message', receive);
    window.parent.postMessage({ type: 'ips-preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', receive);
  }, []);

  useEffect(() => {
    if (!root.current) return undefined;
    const report = () => window.parent.postMessage({
      type: 'ips-preview-height',
      pageId: state.pageId,
      height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, root.current.scrollHeight)
    }, window.location.origin);
    const observer = new ResizeObserver(() => window.requestAnimationFrame(report));
    observer.observe(root.current);
    report();
    return () => observer.disconnect();
  }, [state]);

  useEffect(() => {
    if (!root.current) return;
    root.current.querySelectorAll('[data-preview-element-id]').forEach(node => {
      node.classList.toggle('is-builder-selected', node.getAttribute('data-preview-element-id') === state.selectedElementId);
    });
  }, [state.config, state.pageId, state.device, state.selectedElementId]);

  const previewPath = useMemo(() => resolvePreviewPath(state.pageId, ADMIN_ENTRY_PATH), [state.pageId]);

  return (
    <div ref={root} style={{ minHeight: '100vh', background: 'var(--bg-body)', color: 'var(--text-primary)' }}>
      <CMSPreviewProvider config={state.config} previewDevice={state.device}>
        <PreviewAuthProvider pageId={state.pageId}>
          <MemoryRouter key={previewPath} initialEntries={[previewPath]}>
            <PreviewInteractionGuard pageId={state.pageId}>
              <VisualPageLayer pageId={state.pageId}>
                <PreviewRoutes />
              </VisualPageLayer>
            </PreviewInteractionGuard>
          </MemoryRouter>
        </PreviewAuthProvider>
      </CMSPreviewProvider>
    </div>
  );
}
