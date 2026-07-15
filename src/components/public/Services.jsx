import React from 'react';
import { useCMS } from '../../context/CMSContext';

export default function Services() {
  const { cms } = useCMS();
  const services = cms?.services || [];

  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <div className="label">What We Do</div>
          <h2 className="section-title">Services Built for Your Success</h2>
          <p className="section-subtitle">
            From dissertations to daily errands — we deliver quality, confidentiality, and peace of mind.
          </p>
        </div>

        <div className="grid grid-4 gap-6">
          {services.map((svc, idx) => (
            <div key={idx} className="card text-center animate-fade-in-up" style={{ animationDelay: `${idx * 0.1}s` }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{svc.icon}</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                {svc.title}
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {svc.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
