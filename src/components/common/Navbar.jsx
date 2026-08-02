import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useCMS } from '../../context/CMSContext';
import useResponsiveDevice from '../../hooks/useResponsiveDevice';
import './navbar.css';

function AuthMenu({ label, items, primary = false, onSelect, previewMode = false }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);

  useEffect(() => {
    const ownerDocument = root.current?.ownerDocument || document;
    const close = event => {
      if (event.type === 'keydown' && event.key === 'Escape') setOpen(false);
      if (event.type === 'mousedown' && !root.current?.contains(event.target)) setOpen(false);
    };
    ownerDocument.addEventListener('mousedown', close);
    ownerDocument.addEventListener('keydown', close);
    return () => {
      ownerDocument.removeEventListener('mousedown', close);
      ownerDocument.removeEventListener('keydown', close);
    };
  }, []);

  const visibleItems = items.filter(item => item.visible !== false);
  if (!visibleItems.length) return null;

  return (
    <div ref={root} className="site-auth-menu">
      <button
        type="button"
        className={`btn ${primary ? 'btn-primary' : 'btn-ghost'} btn-sm`}
        aria-haspopup="menu"
        aria-expanded={open}
        data-builder-local-control={previewMode ? 'true' : undefined}
        onClick={() => setOpen(value => !value)}
      >
        {label} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div role="menu" className="site-auth-popover">
          {visibleItems.map(item => (
            <Link
              key={item.id}
              role="menuitem"
              to={item.target}
              onClick={event => {
                if (previewMode) event.preventDefault();
                setOpen(false);
                onSelect?.();
              }}
            >
              <strong>{item.label}</strong>
              {item.description && <small>{item.description}</small>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, admin, writer, logout } = useAuth();
  const { cms, config, previewDevice } = useCMS();
  const activeDevice = useResponsiveDevice(previewDevice);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileToggle = useRef(null);
  const compactNavigation = activeDevice !== 'desktop';
  const previewMode = Boolean(previewDevice);
  const navItems = (config.navigation?.public || []).filter(item => item.visible);
  const features = config.features || {};
  const auth = cms.authNavigation || {};

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, activeDevice]);

  useEffect(() => {
    const ownerDocument = mobileToggle.current?.ownerDocument || document;
    const closeOnEscape = event => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        mobileToggle.current?.focus();
      }
    };
    ownerDocument.addEventListener('keydown', closeOnEscape);
    return () => ownerDocument.removeEventListener('keydown', closeOnEscape);
  }, []);

  const goToAnchor = target => {
    setMobileOpen(false);
    if (previewMode) return;
    const scroll = () => document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (location.pathname !== '/') {
      navigate('/');
      window.setTimeout(scroll, 80);
    } else scroll();
  };

  const handleLogout = () => {
    if (previewMode) return;
    logout();
    setMobileOpen(false);
    navigate('/');
  };

  const renderNavItem = (item, mobile = false) => {
    const target = item.target || '/';
    if (target.startsWith('#')) {
      return <button key={item.id} type="button" className="site-nav-link" data-builder-local-control={previewMode ? 'true' : undefined} onClick={() => goToAnchor(target)}>{item.icon && `${item.icon} `}{item.label}</button>;
    }
    return (
      <Link
        key={item.id}
        to={target}
        className="site-nav-link"
        onClick={event => {
          if (previewMode) event.preventDefault();
          if (mobile) setMobileOpen(false);
        }}
      >
        {item.icon && `${item.icon} `}{item.label}
      </Link>
    );
  };

  const dashboardPath = admin ? '/admin/dashboard' : writer ? '/writer/dashboard' : '/client/overview';
  const signedIn = Boolean(user || admin || writer);
  const signInItems = [
    { id: 'client-login', label: auth.clientLoginLabel || 'Client sign in', description: auth.clientLoginDescription || 'Access orders, files and messages.', target: '/login', visible: features.clientLogin !== false },
    { id: 'provider-login', label: auth.providerLoginLabel || 'Provider sign in', description: auth.providerLoginDescription || 'Access assignments and provider tools.', target: '/writer/login', visible: features.providerLogin !== false }
  ];
  const signUpItems = [
    { id: 'client-signup', label: auth.clientSignupLabel || 'Create client account', description: auth.clientSignupDescription || 'Request and manage IPS services.', target: '/signup', visible: features.clientRegistration !== false },
    { id: 'provider-signup', label: auth.providerSignupLabel || 'Apply as a provider', description: auth.providerSignupDescription || 'Join the IPS provider network.', target: '/become-a-provider', visible: features.providerApplications !== false }
  ];

  return (
    <header className="site-navbar" data-responsive-device={activeDevice} data-studio-global="public-header" data-studio-label="Public website header">
      <div className="site-navbar-inner">
        <Link to="/" className="site-navbar-brand" onClick={event => previewMode && event.preventDefault()}>
          <img src="/images/my-icon.png" alt="IPS" />
          <span>{cms?.brand?.name || 'I P S'}</span>
        </Link>

        {!compactNavigation && (
          <nav className="site-navbar-desktop" aria-label="Primary navigation">
            {navItems.map(item => renderNavItem(item))}
            <div className="site-navbar-actions">
              <button type="button" onClick={previewMode ? undefined : toggleTheme} aria-label="Toggle theme" className="btn btn-ghost btn-sm">{theme === 'light' ? 'Moon' : 'Sun'}</button>
              {signedIn ? <>
                <Link to={dashboardPath} onClick={event => previewMode && event.preventDefault()} className="btn btn-primary btn-sm">Dashboard</Link>
                <button type="button" onClick={handleLogout} className="btn btn-ghost btn-sm">Logout</button>
              </> : <>
                <AuthMenu label={auth.signInLabel || 'Sign in'} items={signInItems} previewMode={previewMode} />
                <AuthMenu label={auth.signUpLabel || 'Sign up'} items={signUpItems} primary previewMode={previewMode} />
              </>}
            </div>
          </nav>
        )}

        {compactNavigation && (
          <button
            ref={mobileToggle}
            className={`site-navbar-mobile-toggle ${mobileOpen ? 'is-open' : ''}`}
            type="button"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            aria-controls="site-mobile-navigation"
            data-builder-local-control={previewMode ? 'true' : undefined}
            onClick={() => setMobileOpen(value => !value)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        )}
      </div>

      {compactNavigation && mobileOpen && (
        <>
          <button
            type="button"
            className="site-mobile-backdrop"
            aria-label="Close navigation menu"
            data-builder-local-control={previewMode ? 'true' : undefined}
            onClick={() => setMobileOpen(false)}
          />
          <nav id="site-mobile-navigation" className="site-mobile-drawer" aria-label="Mobile navigation">
            <div className="site-mobile-links">{navItems.map(item => renderNavItem(item, true))}</div>
            <div className="site-mobile-account-actions">
              {!signedIn && <>
                <strong>{auth.signInLabel || 'Sign in'}</strong>
                {signInItems.filter(item => item.visible).map(item => <Link key={item.id} to={item.target} onClick={event => { if (previewMode) event.preventDefault(); setMobileOpen(false); }} className="btn btn-ghost">{item.label}</Link>)}
                <strong>{auth.signUpLabel || 'Sign up'}</strong>
                {signUpItems.filter(item => item.visible).map(item => <Link key={item.id} to={item.target} onClick={event => { if (previewMode) event.preventDefault(); setMobileOpen(false); }} className="btn btn-primary">{item.label}</Link>)}
              </>}
              <button type="button" onClick={previewMode ? undefined : toggleTheme} className="btn btn-ghost">{theme === 'light' ? 'Dark mode' : 'Light mode'}</button>
              {signedIn && <>
                <Link to={dashboardPath} onClick={event => { if (previewMode) event.preventDefault(); setMobileOpen(false); }} className="btn btn-primary">Dashboard</Link>
                <button type="button" onClick={handleLogout} className="btn btn-ghost">Logout</button>
              </>}
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
