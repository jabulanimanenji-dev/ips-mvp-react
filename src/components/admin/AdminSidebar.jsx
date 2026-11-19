import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCMS } from '../../context/CMSContext';
import { ADMIN_NAV_PERMISSIONS } from '../../../shared/adminPermissions';

export default function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { admin, logout, hasAdminPermission } = useAuth();
  const { config } = useCMS();
  const [actionCount, setActionCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [supportCount, setSupportCount] = useState(0);
  const [quoteAttention,setQuoteAttention] = useState({overdue_updates:0,new_requests:0,unassigned_requests:0});
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutError,setLogoutError]=useState('');
  const navItems = (config.navigation?.admin || []).filter(item => {
    if (!item.visible) return false;
    const permission = ADMIN_NAV_PERMISSIONS[item.target.split('?')[0]];
    return !permission || hasAdminPermission(permission);
  });
  const sidebarWidth = config.layouts?.admin?.sidebarWidth || 260;

  useEffect(() => {
    fetch('/api/actions').then(response => response.json()).then(data => {
      if (data.success) setActionCount(data.summary?.total || 0);
    }).catch(() => {});
    fetch('/api/conversations').then(response => response.json()).then(data => {
      if (data.success) setMessageCount((data.conversations || []).reduce((sum, item) => sum + (item.unread_count || 0), 0));
    }).catch(() => {});
    fetch('/api/support-tickets').then(response => response.json()).then(data => {
      if (data.success) setSupportCount((data.tickets || []).filter(ticket => !['Resolved', 'Closed'].includes(ticket.status)).length);
    }).catch(() => {});
  }, [location.pathname]);

  useEffect(()=>{
    if(!admin?.id||!hasAdminPermission('support.view'))return;
    let active=true;
    const load=async()=>{
      try{
        const response=await fetch('/api/contact-enquiries/admin/attention',{cache:'no-store'});
        const data=await response.json();
        if(active&&response.ok&&data.success)setQuoteAttention({
          overdue_updates:Number(data.overdue_updates||0),new_requests:Number(data.new_requests||0),
          unassigned_requests:Number(data.unassigned_requests||0)
        });
      }catch{}
    };
    load();
    const timer=setInterval(load,60000);
    return ()=>{active=false;clearInterval(timer);};
  },[location.pathname,admin?.id]);

  const handleLogout = async () => {
    setLogoutError('');
    const result=await logout();
    if(result?.success)navigate(import.meta.env.VITE_ADMIN_ENTRY_PATH||'/ips-mission-control',{replace:true});
    else setLogoutError(result?.error||'Unable to end your session. Please try again.');
  };

  return (
    <>
      <button type="button" className="btn btn-ghost admin-menu-toggle" onClick={() => setMobileOpen(previous => !previous)}>Menu</button>
      {mobileOpen && <div className="admin-sidebar-overlay" onClick={() => setMobileOpen(false)} />}
      <aside
        data-studio-global="admin-sidebar"
        data-studio-label="Admin portal navigation"
        className={`admin-sidebar ${mobileOpen ? 'sidebar-open' : ''}`}
        style={{
          width: sidebarWidth,
          minHeight: 0,
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #0d263c 0%, #173d58 100%)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 100
        }}
      >
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(185,205,238,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg,#15344e,#b99664)', display: 'grid', placeItems: 'center', fontSize: '0.85rem', fontWeight: 800, color: '#fff', boxShadow: 'var(--shadow-glow-purple)' }}>
              IPS
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#F8F4E9', fontSize: '0.95rem', lineHeight: 1.2 }}>Mission Control</div>
              <div style={{ fontSize: '0.7rem', color: '#748B91', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Admin Portal</div>
              <div style={{ fontSize: '0.68rem', color: '#B9CDEE', marginTop: 3 }}>{admin?.customRoleName || admin?.role || 'Administrator'}</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, minHeight: 0, padding: '1rem 0.75rem', overflowY: 'auto', overscrollBehavior: 'contain' }}>
          {navItems.map(item => {
            const active = location.pathname.startsWith(item.target.split('?')[0]);
            return (
              <Link
                key={item.id}
                to={item.target}
                onClick={() => setMobileOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.7rem',
                  padding: '0.7rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 4,
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: active ? '#F8F4E9' : '#B9CDEE',
                  background: active ? 'rgba(204,170,110,0.16)' : 'transparent',
                  border: active ? '1px solid rgba(163,5,166,0.3)' : '1px solid transparent',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ fontSize: '1rem', opacity: 0.9 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.target === '/admin/actions' && actionCount > 0 && <span className="admin-nav-count admin-nav-count-danger">{actionCount > 99 ? '99+' : actionCount}</span>}
                {item.target.startsWith('/admin/messages') && messageCount > 0 && <span className="admin-nav-count">{messageCount > 99 ? '99+' : messageCount}</span>}
                {item.target === '/admin/support' && supportCount > 0 && <span className="admin-nav-count">{supportCount > 99 ? '99+' : supportCount}</span>}
              </Link>
            );
          })}
          {hasAdminPermission('support.view') && <Link to="/admin/enquiries" onClick={()=>setMobileOpen(false)} style={{display:'block',margin:'12px 7px 0',padding:'12px 14px',color:'#E8C891',border:'1px solid rgba(232,200,145,.30)',borderRadius:9,textDecoration:'none',fontWeight:700,fontSize:'.83rem'}}>✉ Private Quotes & Enquiries{quoteAttention.new_requests>0?' · '+quoteAttention.new_requests+' new':''}{quoteAttention.overdue_updates>0?' · '+quoteAttention.overdue_updates+' overdue':''}{quoteAttention.unassigned_requests>0?' · '+quoteAttention.unassigned_requests+' unassigned':''}</Link>}
          {hasAdminPermission('messages.view') && <Link to="/admin/external-chats" onClick={()=>setMobileOpen(false)} style={{display:'block',margin:'12px 7px 0',padding:'12px 14px',color:'#E8C891',border:'1px solid rgba(232,200,145,.30)',borderRadius:9,textDecoration:'none',fontWeight:700,fontSize:'.83rem'}}>✉ Written Messaging Inbox</Link>}
        </nav>

        <div style={{ flexShrink: 0, padding: '1rem 0.75rem', borderTop: '1px solid rgba(185,205,238,0.08)' }}>
          <button type="button" onClick={handleLogout} className="btn btn-danger" style={{ width: '100%' }}>Logout</button>
          {logoutError&&<small role="alert" style={{color:'#ffb3b3',fontSize:'.74rem'}}>{logoutError}</small>}
        </div>
      </aside>

      <style>{`
        .admin-menu-toggle { display: none; position: fixed; top: 1rem; left: 1rem; z-index: 1100; width: auto !important; padding: .65rem !important; }
        .admin-sidebar-overlay { position: fixed; inset: 0; background: var(--overlay); z-index: 99; }
        .admin-nav-count { min-width: 24px; height: 24px; padding: 0 7px; border-radius: 20px; background: var(--primary); color: #fff; display: grid; place-items: center; font-size: .7rem; font-weight: 800; }
        .admin-nav-count-danger { background: #ef4444; }
        @media (max-width: 768px) {
          .admin-menu-toggle { display: inline-flex; }
          .admin-sidebar { transform: translateX(-100%); max-width: 88vw; transition: transform .25s ease; }
          .admin-sidebar.sidebar-open { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
