import React from 'react';
import { useCMS } from '../../context/CMSContext';

export default function About() {
  const { cms } = useCMS();
  const about = cms?.about || {};

  const stats = [
    { value: about.stat1 || '2,000+', label: about.stat1Label || 'Clients Served' },
    { value: about.stat2 || '50+', label: about.stat2Label || 'Countries' },
    { value: about.stat3 || '98%', label: about.stat3Label || 'Satisfaction' }
  ];

  return (
    <section id="about" className="section" style={{ background: 'var(--bg-surface-2)' }}>
      <div className="container">
        <div className="grid grid-2 gap-8 items-center">
          <div>
            <div className="label">About Us</div>
            <h2 className="section-title" style={{ textAlign: 'left', marginTop: '0.5rem' }}>
              {about.headline || 'We Exist to Eliminate Barriers'}
            </h2>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1rem' }}>
              {about.p1 || 'We believe every student, researcher, and professional worldwide deserves access to quality academic and professional services they can afford and trust.'}
            </p>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {about.p2 || 'I P S operates as a professional ghostwriting and academic consulting service — legally analogous to hiring a speechwriter or memoir ghostwriter. We provide original, custom-written work as a work-for-hire, with full copyright transfer to you upon payment.'}
            </p>
          </div>

          <div className="grid grid-3 gap-4">
            {stats.map((stat, idx) => (
              <div
                key={idx}
                className="card text-center animate-fade-in-up"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div
                  style={{
                    fontSize: '1.8rem',
                    fontWeight: 800,
                    color: 'var(--primary)',
                    marginBottom: '0.25rem'
                  }}
                >
                  {stat.value}
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
