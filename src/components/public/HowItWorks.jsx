import React from 'react';
import { useCMS } from '../../context/CMSContext';

const STEPS = [
  {
    number: '01',
    title: 'Request a Quote',
    description: 'Tell us what you need — academic level, subject, word count, and deadline. We\'ll respond within hours.'
  },
  {
    number: '02',
    title: 'Review & Confirm',
    description: 'Receive a detailed quote and milestone plan. Approve it, pay the deposit, and we begin immediately.'
  },
  {
    number: '03',
    title: 'Track Progress',
    description: 'Follow every milestone in your private client portal. Chat with our team and download drafts in real time.'
  },
  {
    number: '04',
    title: 'Receive & Own',
    description: 'Get your final deliverable plus a signed Certificate of Ownership Transfer. Publish it as your own.'
  }
];

export default function HowItWorks() {
  const { cms } = useCMS();
  const process = cms?.process || {};
  const steps = process.steps || STEPS;
  return (
    <section className="section" style={{ background: 'var(--bg-surface)' }}>
      <div className="container">
        <div className="section-header">
          <div className="label">{process.label || 'The Process'}</div>
          <h2 className="section-title">{process.headline || 'How It Works'}</h2>
          <p className="section-subtitle">
            {process.subheadline || 'A simple, transparent workflow designed to keep you in control from start to finish.'}
          </p>
        </div>

        <div className="grid grid-4 gap-6">
          {steps.map((step, idx) => (
            <div key={idx} className="card text-center animate-fade-in-up" style={{ animationDelay: `${idx * 0.1}s` }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--grad-hero)',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  marginBottom: '1rem'
                }}
              >
                {step.number}
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                {step.title}
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
