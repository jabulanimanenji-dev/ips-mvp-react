import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const links = [
  ['Academic services','/#services'],['Disciplines','/#disciplines'],
  ['Our approach','/#approach'],['How it works','/#how-it-works'],['Contact IPS','/#contact-ips']
];
export function StudentSiteHeader() {
  const { user, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(()=>setMenu(false),[location.pathname,location.hash]);
  useEffect(()=>{
    if (!menu) return;
    const onKey = e=>e.key === 'Escape' && setMenu(false);
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[menu]);
  return <header className="ipsa-site-header">
    <div className="ipsa-topbar"><div className="ipsa-wrap"><span>IPS · Professional academic services & research support</span><a href="/#contact-ips">Request a callback <span aria-hidden="true">↗</span></a></div></div>
    <div className="ipsa-navbar ipsa-wrap">
      <Link className="ipsa-brand" to="/" aria-label="IPS Academic Services home"><span className="ipsa-logo-symbol">IPS<span>.</span></span><span className="ipsa-brand-descriptor">ACADEMIC<br/>SERVICES</span></Link>
      <nav id="ipsa-main-navigation" aria-label="Primary navigation" className={'ipsa-header-links'+(menu?' ipsa-open':'')}>{links.map(([label,url])=><a key={label} href={url} onClick={()=>setMenu(false)}>{label}</a>)}
        <div className="ipsa-mobile-actions">{user?<Link to="/client/services">My workspace</Link>:<Link to="/login">Student sign in</Link>}</div>
      </nav>
      <div className="ipsa-header-actions">
        {user ? <><Link className="ipsa-header-login" to="/client/services">My workspace</Link><button type="button" className="ipsa-header-login" onClick={()=>{logout();navigate('/');}}>Sign out</button></> : <Link to="/login" className="ipsa-header-login">Student sign in</Link>}
        <a href="/#request-support" className="ipsa-header-cta">Get a quote <span aria-hidden="true">↗</span></a>
      </div>
      <button type="button" aria-label={menu?'Close navigation':'Open navigation'} aria-controls="ipsa-main-navigation" aria-expanded={menu} className="ipsa-menu-toggle" onClick={()=>setMenu(m=>!m)}><span/><span/><span/></button>
    </div>
  </header>;
}

export function StudentSiteFooter() {
  return <footer className="ipsa-footer">
    <div className="ipsa-wrap">
      <div className="ipsa-footer-columns">
        <div className="ipsa-footer-about"><Link className="ipsa-brand" to="/"><span className="ipsa-logo-symbol">IPS<span>.</span></span><span className="ipsa-brand-descriptor">ACADEMIC<br/>SERVICES</span></Link><p>Structured academic assistance, research support and professional editing — with clear scope, transparent quotations and private workspaces.</p><a href="mailto:admin@ipsglobalservice.com">Ask IPS to contact you ↗</a></div>
        <div><h4>Explore</h4><a href="/#services">All services</a><a href="/#disciplines">Disciplines</a><a href="/#approach">Our process</a><a href="/#questions">Questions & answers</a><a href="/#direct-contact">WhatsApp & Telegram</a><a href="/#contact-ips">Ask for a callback</a></div>
        <div><h4>Student area</h4><Link to="/signup">Create account</Link><Link to="/login">Sign in</Link><Link to="/client/services">Service workspace</Link><a href="/#request-support">Request a quotation</a></div>
        <div><h4>About our service</h4><p>Academic work must follow your institution's policies. IPS does not supply assessed work for deceptive submission. Specialist assignment and availability are confirmed during review.</p></div>
      </div>
      <div className="ipsa-footer-bottom"><span>© {new Date().getFullYear()} IPS Academic Services. All rights reserved.</span><span>Photography is illustrative, not photographs of IPS team members. <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">Image license</a></span></div>
    </div>
  </footer>;
}
