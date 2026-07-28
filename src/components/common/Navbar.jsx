import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useCMS } from '../../context/CMSContext';
import ConfigurableAction from './ConfigurableAction';

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, admin, writer, logout } = useAuth();
  const { cms, config } = useCMS();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = (config.navigation?.public || []).filter(item => item.visible);

  const goToAnchor = target => {
    setMobileOpen(false);
    const scroll = () => document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (location.pathname !== '/') {
      navigate('/');
      window.setTimeout(scroll, 80);
    } else {
      scroll();
    }
  };

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    navigate('/');
  };

  const renderNavItem = (item, mobile = false) => {
    const style = {
      fontSize: mobile ? '0.95rem' : '0.875rem',
      fontWeight: 600,
      color: 'var(--text-secondary)',
      textDecoration: 'none',
      padding: mobile ? '0.5rem 0' : 0,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      textAlign: 'left'
    };
    if (item.target.startsWith('#')) {
      return <button key={item.id} type="button" className="nav-link" style={style} onClick={() => goToAnchor(item.target)}>{item.icon && `${item.icon} `}{item.label}</button>;
    }
    return <Link key={item.id} to={item.target} className="nav-link" style={style} onClick={() => setMobileOpen(false)}>{item.icon && `${item.icon} `}{item.label}</Link>;
  };

  const dashboardPath = admin ? '/admin/dashboard' : writer ? '/writer/dashboard' : '/client/overview';
  const signedIn = Boolean(user || admin || writer);
  const authButtons = Object.values(config.buttons || {})
    .filter(button => ['publicLogin', 'publicSignup'].includes(button.id))
    .sort((a, b) => a.position - b.position);

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 1000, background: 'var(--bg-header)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
      <div className="container flex items-center justify-between" style={{ height: 'var(--header-h)', padding: '0 1rem' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', flexShrink: 0 }}>
          <img src="/images/my-icon.png" alt="IPS" style={{ height: 28, width: 'auto', display: 'block' }} />
          <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
            {cms?.brand?.name || 'I P S'}
          </span>
        </Link>

        <nav className="hidden-mobile" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {navItems.map(item => renderNavItem(item))}
          <div className="flex items-center gap-2" style={{ marginLeft: '0.5rem' }}>
            <button type="button" onClick={toggleTheme} aria-label="Toggle theme" className="btn btn-ghost btn-sm">
              {theme === 'light' ? 'Moon' : 'Sun'}
            </button>
            {signedIn ? (
              <>
                <Link to={dashboardPath} className="btn btn-primary btn-sm">Dashboard</Link>
                <button type="button" onClick={handleLogout} className="btn btn-ghost btn-sm">Logout</button>
              </>
            ) : authButtons.map(button => <ConfigurableAction key={button.id} button={button} className="btn-sm" />)}
          </div>
        </nav>

        <button
          className="mobile-only"
          onClick={() => setMobileOpen(previous => !previous)}
          aria-label="Toggle menu"
          style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-primary)', padding: '0.5rem', display: 'none' }}
        >
          {mobileOpen ? 'Close' : 'Menu'}
        </button>
      </div>

      {mobileOpen && (
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', background: 'var(--bg-header)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {navItems.map(item => renderNavItem(item, true))}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button type="button" onClick={toggleTheme} className="btn btn-ghost">{theme === 'light' ? 'Dark mode' : 'Light mode'}</button>
            {signedIn ? (
              <>
                <Link to={dashboardPath} onClick={() => setMobileOpen(false)} className="btn btn-primary">Dashboard</Link>
                <button type="button" onClick={handleLogout} className="btn btn-ghost">Logout</button>
              </>
            ) : authButtons.map(button => <ConfigurableAction key={button.id} button={button} onAction={() => setMobileOpen(false)} />)}
          </div>
        </div>
      )}
    </header>
  );
}
