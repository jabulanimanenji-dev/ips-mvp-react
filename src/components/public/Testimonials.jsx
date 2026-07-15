import React from 'react';
import { useCMS } from '../../context/CMSContext';

export default function Testimonials() {
  const { cms } = useCMS();
  const testimonials = cms?.testimonials || [];

  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <div className="label">Client Stories</div>
          <h2 className="section-title">Trusted by Students Worldwide</h2>
          <p className="section-subtitle">
            Real feedback from real clients who achieved their goals with I P S.
          </p>
        </div>

        <div className="grid grid-3 gap-6">
          {testimonials.map((t, idx) => (
            <div key={idx} className="card animate-fade-in-up" style={{ animationDelay: `${idx * 0.15}s` }}>
              <div style={{ fontSize: '1.5rem', color: 'var(--accent-gold)', marginBottom: '1rem' }}>★★★★★</div>
              <p
                style={{
                  fontSize: '0.95rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.7,
                  marginBottom: '1.25rem',
                  fontStyle: 'italic'
                }}
              >
                "{t.text}"
              </p>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                — {t.client}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
