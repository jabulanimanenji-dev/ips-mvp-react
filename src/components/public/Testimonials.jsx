import React from 'react';
import { useCMS } from '../../context/CMSContext';

export default function Testimonials() {
  const { cms } = useCMS();
  // Legacy CMS contained illustrative/unverified testimonials. Never publish
  // private academic work or implied endorsements without explicit approval.
  const testimonials=(Array.isArray(cms?.testimonials)?cms.testimonials:[])
    .filter(item=>item?.verified===true&&item?.consent_for_publication===true&&
      typeof item?.text==='string'&&item.text.trim().length>=10);
  if(!testimonials.length)return null;

  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <div className="label">Client Stories</div>
          <h2 className="section-title">Client Feedback</h2>
          <p className="section-subtitle">
            Reviews shown here are published only with verified client permission.
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
