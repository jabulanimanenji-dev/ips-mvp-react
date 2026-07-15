import React, { useState } from 'react';
import { useCMS } from '../../context/CMSContext';

export default function FAQ() {
  const { cms } = useCMS();
  const faq = cms?.faq || [];
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (idx) => {
    setOpenIndex(prev => (prev === idx ? null : idx));
  };

  return (
    <section id="faq" className="section" style={{ background: 'var(--bg-surface)' }}>
      <div className="container">
        <div className="section-header">
          <div className="label">Got Questions?</div>
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-subtitle">
            Everything you need to know about our process, pricing, and policies.
          </p>
        </div>

        <div className="flex flex-col gap-4" style={{ maxWidth: 800, margin: '0 auto' }}>
          {faq.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="card"
                style={{
                  cursor: 'pointer',
                  borderColor: isOpen ? 'var(--border-strong)' : undefined
                }}
                onClick={() => toggle(idx)}
              >
                <div className="flex items-center justify-between" style={{ gap: '1rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.q}
                  </h3>
                  <span
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 300,
                      color: 'var(--text-muted)',
                      lineHeight: 1,
                      transition: 'transform 0.2s',
                      transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                      display: 'inline-block'
                    }}
                  >
                    +
                  </span>
                </div>
                {isOpen && (
                  <p
                    style={{
                      fontSize: '0.9rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.7,
                      marginTop: '0.75rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid var(--border)'
                    }}
                  >
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
