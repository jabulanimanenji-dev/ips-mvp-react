import React from 'react';
import {Link} from 'react-router-dom';
import '../../pages/academic-interior.css';

const isPreview=import.meta.env.VITE_DESIGN_PREVIEW==='true';

/**
 * Commercial IPS customer-entry system. Preserves existing authentication
 * handlers but deliberately separates editorial presentation from legacy CMS.
 */
export default function AcademicAuthShell({eyebrow,title,italicTitle,intro,children,standalone=false,asideTitle,asideItalic,asideCopy}){
  return <section className="ipsa-auth" aria-label={eyebrow}>
    {standalone&&<header className="ipsa-auth-standalone-head">
      <Link to="/" className="ipsa-auth-standalone-brand" aria-label="IPS Academic Services home">IPS<b>.</b></Link>
      <span>ACADEMIC SERVICES</span>
    </header>}
    <div className="ipsa-auth-shell">
      <div className="ipsa-auth-main">
        <nav className="ipsa-auth-crumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link><span aria-hidden="true">/</span><span>{eyebrow}</span>
        </nav>
        <p className="ipsa-auth-eyebrow">{eyebrow}</p>
        <h1 className="ipsa-auth-title">{title}{italicTitle&&<> <em>{italicTitle}</em></>}</h1>
        <p className="ipsa-auth-intro">{intro}</p>
        {isPreview&&<p className="ipsa-auth-preview" role="status">Website design preview: account access is not active here. A live, secure IPS backend is required for sign-in and registration.</p>}
        {children}
      </div>
      <aside className="ipsa-auth-aside" aria-label="About the IPS workspace">
        <div className="ipsa-auth-aside-mark">IPS. &nbsp; / &nbsp; ACADEMIC SERVICES</div>
        <h2 className="ipsa-auth-aside-title">{asideTitle||'One space for your'} <em>{asideItalic||'next step.'}</em></h2>
        <p className="ipsa-auth-aside-copy">{asideCopy||'Discuss your brief, review your quotation and manage correspondence in a private academic support workspace.'}</p>
        <small className="ipsa-auth-aside-note">Illustrative library photography · IPS Academic Services</small>
      </aside>
    </div>
  </section>;
}
export {isPreview as isAcademicDesignPreview};
