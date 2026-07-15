import React from 'react';
import { Link } from 'react-router-dom';
import { useCMS } from '../../context/CMSContext';

export default function Footer() {
  const { cms } = useCMS();
  const brand = cms?.brand || {};
  const trustBadges = cms?.trustBadges || [];
  const footer = cms?.footer || {};

  return (
    <footer style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', padding: '3rem 0 1.5rem' }}>
      <div className="container">
        <div className="grid grid-4 gap-6" style={{ marginBottom: '2rem' }}>
          <div className="flex flex-col gap-2">
            <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>{brand.name || 'I P S'}</div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{brand.tagline || ''}</p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="label" style={{ marginBottom: '0.25rem' }}>Navigation</div>
            <Link to="/" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>Home</Link>
            <Link to="/quote" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>Request a Quote</Link>
            <Link to="/login" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>Client Login</Link>
            <Link to="/signup" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>Sign Up</Link>
          </div>

          <div className="flex flex-col gap-2">
            <div className="label" style={{ marginBottom: '0.25rem' }}>Support</div>
            <a href={`mailto:${brand.email || 'admin@ips-services.com'}`} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>Email Support</a>
            <a href={`https://wa.me/${(brand.whatsapp || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>WhatsApp</a>
          </div>

          <div className="flex flex-col gap-2">
            <div className="label" style={{ marginBottom: '0.25rem' }}>Trust</div>
            <div className="flex flex-col gap-1">
              {trustBadges.map((badge, idx) => (
                <span key={idx} style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{badge}</span>
              ))}
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            © {footer.copyright || `${new Date().getFullYear()} I P S`}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
